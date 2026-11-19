// ============================================================
// Maestro — interface. Tudo roda local: nada sai do computador.
// Fluxo: abrir pasta → ler cada arquivo (texto / OCR) → Extrator acha os
// campos → usuário confere → modelo preenchido → copiar como HTML p/ o SEI.
// ============================================================
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROTULO_TIPO = { cnpj: 'Cartão CNPJ', proposta: 'Proposta', identidade: 'RG / CNH', bancario: 'Dados bancários',
  curriculo: 'Currículo', qsa: 'Quadro de sócios', contrato_social: 'Contrato social / MEI', sei_interno: 'Documento do SEI',
  empenho: 'Pré-empenho / Empenho',
  outro: 'Outro (só conferência)' }; // não é fonte principal, mas o texto é usado para conferir os dados e dá nome/CPF de certidões

// ─── Armazenamento (localStorage; só neste navegador) ──────
// ponytail: localStorage basta para modelos e um processo aberto; exportar .json cobre backup.
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('mlivre_' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mlivre_' + k, JSON.stringify(v)); } catch { toast('Não consegui salvar no navegador.'); } },
};

const estado = {
  docs: [],                                 // {nome, texto, itens, tipo, tipoForcado, status, achou}
  pasta: '',
  extraidos: {},                            // CAMPO → {valor, fonte, alternativas}
  valores: {},                              // CAMPO → texto mostrado/usado
  editados: new Set(),                      // campos que o usuário mexeu: nunca sobrescrever
  feitos: {},                               // modelo → true: documentos que o usuário marcou como feitos NESTE processo
  // Modelos salvos + de fábrica. Modelo de fábrica que você NÃO editou é atualizado sozinho quando
  // o programa muda (ex.: novo formato dos extratos); os que você editou (editado: true) não são tocados.
  modelos: (() => {
    const salvos = LS.get('modelos', null);
    if (!salvos) return structuredClone(MODELOS_PADRAO);
    const fabrica = Object.fromEntries(MODELOS_PADRAO.map(m => [m.id, m]));
    const lista = salvos.map(m => fabrica[m.id] && !m.editado ? structuredClone(fabrica[m.id]) : m);
    const ids = new Set(lista.map(m => m.id));
    return [...lista, ...structuredClone(MODELOS_PADRAO.filter(m => !ids.has(m.id)))];
  })(),
  modeloAtual: LS.get('modeloAtual', 'memorando'),
};
const memoriaEventos = LS.get('eventos', {}); // evento → {CONTEXTO_EVENTO, RESULTADOS}: reaproveita texto entre artistas do mesmo evento

// O que se guarda de cada documento num processo salvo (o texto não: ocuparia demais).
// cert = validade da certidão já lida do texto — senão, reaberto da lista, só sobraria o nome do arquivo.
const metaDoc = d => ({ nome: d.nome, tipo: d.tipo, achou: d.achou, status: d.status,
  cert: d.texto !== undefined ? Extrator.validadeCertidao(d.nome, d.texto) : d.cert });
function salvarProcesso() {
  LS.set('processo', { salvoId: estado.salvoId, pasta: estado.pasta, valores: estado.valores, editados: [...estado.editados], extraidos: estado.extraidos, feitos: estado.feitos,
    docs: estado.docs.map(metaDoc) });
}

// ─── Leitura dos arquivos ──────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
// Aberto direto do arquivo (file://) o navegador não cria worker a partir de arquivo: o pdf.js roda na
// própria página (carregando o worker como <script>, que é permitido).
const carregarScript = src => new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('não carregou ' + src)); document.head.append(s); });
const pdfPronto = location.protocol === 'file:' ? carregarScript('lib/pdf.worker.min.js') : Promise.resolve();
// OCR: worker, núcleo wasm e idioma vêm de lib/ocr-embutido.js (gerado por ferramentas/embutir-ocr.js),
// carregado só no 1º uso. Por "blob:" funciona igual com servidor ou aberto direto do arquivo, sem internet.
let ocrWorker = null;
async function ocr(imagem) {
  if (!ocrWorker) {
    status('Preparando a leitura de imagens (só na primeira vez)…');
    if (!window.OCR_EMBUTIDO) await carregarScript('lib/ocr-embutido.js');
    const E = window.OCR_EMBUTIDO, blob = (txt, tipo) => URL.createObjectURL(new Blob([txt], { type: tipo }));
    const por = Uint8Array.from(atob(E.por), c => c.charCodeAt(0));
    // Núcleo + worker num blob só, e o worker criado direto dele (workerBlobURL: false): aberto do arquivo,
    // um worker não consegue carregar outro blob (importScripts falha). Com TesseractCore já definido,
    // o worker não tenta carregar o núcleo.
    ocrWorker = await Tesseract.createWorker([{ code: 'por', data: por }], 1, {
      workerPath: blob(E.core + ';\n' + E.worker, 'text/javascript'), workerBlobURL: false, cacheMethod: 'none',
    });
  }
  const { data } = await ocrWorker.recognize(imagem);
  return data.text;
}

async function lerPDF(file, forcarOCR = false) {
  await pdfPronto;
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const itens = [];
  const nPag = Math.min(pdf.numPages, 8);
  for (let p = 1; p <= nPag; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    for (const i of tc.items) if (i.str && i.str.trim())
      itens.push({ str: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]), w: i.width, pag: p });
  }
  let texto = Extrator.itensParaTexto(itens);
  // PDF escaneado (ou CNH digital, que é imagem): OCR nas primeiras páginas
  // v5.0.2: texto embaralhado (fonte sem mapa de caracteres: "_$\" #$%`$") também vai para o OCR
  const legivel = s => { const c = s.replace(/\s/g, ''); return c.length ? (c.match(/[A-Za-zÀ-ÿ0-9]/g) || []).length / c.length : 0; };
  if (forcarOCR || texto.replace(/\s/g, '').length < 150 || legivel(texto) < 0.6) {
    const partes = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 2.5 });
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      // intent 'print': renderiza sem requestAnimationFrame — senão trava se a aba ficar em segundo plano
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp, intent: 'print' }).promise;
      partes.push(await ocr(cv));
    }
    return { texto: texto + '\n' + partes.join('\n'), itens: [], ocr: true };
  }
  return { texto, itens };
}

async function lerHTML(file) {
  // HTML exportado pelo SEI vem em ISO-8859-1
  const buf = await file.arrayBuffer();
  const cabeca = new TextDecoder('latin1').decode(buf.slice(0, 2000));
  const charset = (cabeca.match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  const html = new TextDecoder(charset).decode(buf).replace(/<\/(p|div|tr|td|th|li|h\d)>/gi, '$&\n').replace(/<br\s*\/?>/gi, '\n');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style').forEach(e => e.remove());
  return { texto: doc.body ? doc.body.textContent : '' };
}

async function lerArquivo(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return lerPDF(file);
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) return { texto: await ocr(file), ocr: true };
  if (ext === 'docx') return { texto: (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value };
  if (ext === 'html' || ext === 'htm') return lerHTML(file);
  if (ext === 'txt') return { texto: await file.text() };
  return null;
}

// ─── .zip exportado do SEI, lido sem extrair ─────────────────
// Leitor mínimo de zip: diretório central + DecompressionStream('deflate-raw') do próprio navegador
// (Chrome/Edge/Firefox/Safari atuais) — sem biblioteca. O SEI grava os nomes em Windows-1252 sem a
// marca de UTF-8 (por isso o "1║_Grau" que outros programas mostram).
// ponytail: sem zip64 (>4 GB) nem senha; o SEI não gera nenhum dos dois
async function arquivosDoZip(zip) {
  const buf = new Uint8Array(await zip.arrayBuffer()), dv = new DataView(buf.buffer);
  let e = buf.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error(`"${zip.name}" não é um .zip válido`);
  const out = [];
  for (let n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true); n--; ) {
    const utf8 = dv.getUint16(p + 8, true) & 0x800, metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true);
    const ln = dv.getUint16(p + 28, true), lx = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const caminho = new TextDecoder(utf8 ? 'utf-8' : 'windows-1252').decode(buf.subarray(p + 46, p + 46 + ln));
    p += 46 + ln + lx + lc;
    if (caminho.endsWith('/')) continue; // pasta
    const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const bruto = new Blob([buf.subarray(ini, ini + tam)]);
    const dados = metodo === 0 ? bruto : metodo === 8 ? await new Response(bruto.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob() : null;
    if (dados) out.push(new File([dados], caminho.split('/').pop()));
  }
  return out;
}
// .zip no meio dos arquivos (pasta, arrastar, adicionar) vira os arquivos de dentro
async function abrirZips(files) {
  const out = [];
  for (const f of files) {
    if (!/\.zip$/i.test(f.name)) { out.push(f); continue; }
    status(`Abrindo ${f.name}…`);
    try { out.push(...await arquivosDoZip(f)); } catch (err) { toast(err.message); }
  }
  return out;
}
// Um .zip sozinho = o processo inteiro (como abrir a pasta): o nome do zip traz o nº do processo
function abrirArquivos(files) {
  files = [...files];
  if (files.length === 1 && /\.zip$/i.test(files[0].name)) return carregarPasta(files[0].name.replace(/\.zip$/i, ''), files);
  return processarArquivos(files);
}

async function processarArquivos(files) {
  files = (await abrirZips([...files])).filter(f => /\.(pdf|png|jpe?g|webp|bmp|gif|docx|html?|txt)$/i.test(f.name))
    .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, 'pt-BR', { numeric: true }));
  if (!files.length) return toast('Nenhum arquivo legível (PDF, imagem, Word, HTML, TXT).');
  const rel = files[0].webkitRelativePath;
  if (rel) estado.pasta = rel.split('/')[0];
  mostrarAba('arquivos'); // a lista vai enchendo à vista
  let n = 0;
  for (const f of files) {
    const d = { nome: f.name, status: 'lendo', texto: '', itens: [] };
    estado.docs.push(d);
    status(`Lendo ${++n} de ${files.length}: ${nomeLimpo(f.name).titulo}`, n / files.length);
    renderDocs();
    try {
      let r = await lerArquivo(f);
      // RG/CNH/dados bancários em PDF costumam ser imagem com só um rodapé de texto
      // (a CNH digital tem "SENATRAN..." mas os dados estão na foto): se não achou nada, faz OCR.
      if (r && !r.ocr && /\.pdf$/i.test(f.name)) {
        const tipo = Extrator.classificar(f.name, r.texto);
        if (['identidade', 'bancario'].includes(tipo) && !Object.keys(Extrator.extrairDoc({ nome: '', ...r }).campos).length)
          r = await lerPDF(f, true);
      }
      Object.assign(d, r, { status: r.ocr ? 'OCR' : 'ok' });
    } catch (e) {
      console.error(f.name, e);
      Object.assign(d, { status: 'erro', erro: String(e.message || e) });
    }
  }
  status('');
  extrair();
  mostrarAba('documentos'); // leitura pronta: direto para os documentos preenchidos
}

// ─── Extração → campos ────────────────────────────────────
function extrair() {
  const lidos = estado.docs.filter(d => d.texto);
  Extrator.definirOrgao(estado.valores.ORGAO_CNPJ); // NF emitida para o próprio órgão = a da despesa
  const r = Extrator.extrairTudo(lidos, estado.pasta);
  r.docs.forEach((x, i) => Object.assign(lidos[i], { tipo: x.tipo, achou: x.achou }));
  delete r.campos._datas;
  for (const [k, o] of Object.entries(Extrator.aplicarRegras(camposUsuario.novos, lidos))) if (!r.campos[k]) r.campos[k] = { ...o, alternativas: [] };
  estado.extraidos = r.campos;
  for (const [k, o] of Object.entries(r.campos)) if (!estado.editados.has(k)) estado.valores[k] = o.valor;
  // aba Checklist: item → documento achado; fica em extraidos para ir junto quando o processo é salvo
  estado.extraidos._checklist = { valor: '', ...r.checklist };
  recalcular();
  renderTudo();
  const achou = Object.keys(r.campos).length;
  toast(`${lidos.length} documento(s) lido(s), ${achou} dado(s) encontrado(s). Confira na tela Dados.`);
}

// Campos derivados (CPF mascarado, extenso, objeto…) + padrões fixos + memória do evento.
function recalcular() {
  const v = estado.valores;
  for (const [k, val] of Object.entries(PADROES_FIXOS)) if (!v[k] && !estado.editados.has(k)) v[k] = val;
  const mem = memoriaEventos[Extrator.norm(v.EVENTO || '')];
  if (mem) for (const [k, val] of Object.entries(mem)) if (!estado.editados.has(k) && !v[k]) v[k] = val;
  const d = Extrator.derivados(v);
  // Montado automaticamente não passa por cima do que foi achado num documento
  // (ex.: objeto que você já escreveu no TR vale mais que "Realizar a apresentação de X").
  for (const [k, val] of Object.entries(d)) if (!estado.editados.has(k) && !estado.extraidos[k]) v[k] = val;
  // Categoria trancada: os valores guardados vencem tudo (documentos, padrões, derivados) e valem em todo processo
  for (const g of Object.values(travas)) Object.assign(v, g);
  salvarProcesso();
}

// ─── Campos editáveis (Maestro Livre): mudanças nos de fábrica e campos novos, em LS "campos" ──
// CAMPOS (modelos-padrao.js) é refeito aqui: [código, nome, categoria, longo, escondido, criado pelo usuário]
const camposUsuario = LS.get('campos', { mud: {}, novos: [] });
camposUsuario.mud ||= {}; camposUsuario.novos ||= [];
const CAMPOS_FABRICA = CAMPOS.map(c => c.slice());
function aplicarCampos() {
  CAMPOS.length = 0;
  for (const c of CAMPOS_FABRICA) { const m = camposUsuario.mud[c[0]] || {}; CAMPOS.push([c[0], m.rot || c[1], m.cat || c[2], c[3], !!m.oculto, false]); }
  for (const n of camposUsuario.novos) CAMPOS.push([n.k, n.rot, n.cat || 'Meus campos', !!n.longo, false, true]);
}
aplicarCampos();
function salvarCampos() { LS.set('campos', camposUsuario); aplicarCampos(); renderCampos(); renderCamposCfg(); }

// ─── Trava por categoria (ex.: Ordenador de despesa fixo de um processo para o outro) ──
const travas = LS.get('travas', {}); // categoria → {CAMPO: valor}
let gruposAtuais = {};               // categoria → [CAMPO…], montado no renderCampos
function alternarTrava(g, trancar) {
  if (trancar) travas[g] = Object.fromEntries(gruposAtuais[g].map(k => [k, estado.valores[k] || '']));
  else delete travas[g];
  LS.set('travas', travas);
  recalcular(); renderCampos(); renderModelos();
  toast(trancar ? `"${g}" trancado: não muda com os documentos nem ao trocar de processo.` : `"${g}" destrancado.`);
}

// ─── Modelos ──────────────────────────────────────────────
const RE_CAMPO = /\{\{\s*([A-Z0-9_]+)\s*((?:\|\s*\w+\s*)*)\}\}/g;
// |opc (some se vazio) e |x (X quando vazio): campo opcional, não conta como faltando
const ehOpcional = f => /\|\s*(opc|x)\b/.test(f || '');
const camposDoModelo = html => [...new Set([...semLinhasVazias(html).matchAll(RE_CAMPO)].filter(m => !ehOpcional(m[2])).map(m => m[1]))];
// Linha de tabela marcada class="infra-opcional" (NF balizadora 2/3, tabela de cachê) sai quando
// todos os campos dela estão vazios; senão fica, sem a marca.
const semLinhasVazias = html => html.replace(/<tr class="infra-opcional">[\s\S]*?<\/tr>/g, tr =>
  [...tr.matchAll(RE_CAMPO)].some(m => (estado.valores[m[1]] || '').trim()) ? tr.replace(' class="infra-opcional"', '') : '');
// filtros encadeáveis: {{OBJETO_DETALHADO|min|sempt}}
function aplicaFiltro(v, filtros) {
  for (const f of (filtros || '').split('|').map(s => s.trim()).filter(Boolean)) {
    if (f === 'min') v = v.charAt(0).toLowerCase() + v.slice(1);
    else if (f === 'mai') v = v.toUpperCase();
    else if (f === 'cap') v = v.charAt(0).toUpperCase() + v.slice(1);
    else if (f === 'sempt') v = v.replace(/[.;\s]+$/, ''); // sem ponto final, para usar no meio da frase
    // dotação "1001-2421-…-1.5.00.001001 0001 - RECURSO LIVRE…": |cod = código, |desc = origem dos recursos
    // "Realizar apresentação musical de X" → "apresentação musical de X" (para "Prestação de serviços de …")
    // objeto do contrato de credenciamento já começa com "Prestação de serviços de …": tira também
    else if (f === 'semverbo') v = v.replace(/^\s*(realizar|prestar|executar|desenvolver|presta[cç][aã]o de servi[cç]os? de)\s+((a|o|uma|um)\s+)?/i, '');
    else if (f === 'num') v = v.split('/')[0].trim(); // "104276/2026" → "104276"
    else if (f === 'ano') v = (v.split('/')[1] || '').trim();
    else if (f === 'cod') v = v.split(' - ')[0];
    else if (f === 'desc') v = v.split(' - ').slice(1).join(' - ');
  }
  return v;
}
// modo 'previa' marca o que foi preenchido/faltando; modo 'copia' deixa limpo ([CAMPO] onde falta)
function preencher(html, modo) {
  return semLinhasVazias(html).replace(RE_CAMPO, (_, k, f) => {
    const v = (estado.valores[k] || '').trim();
    if (/\|\s*x\b/.test(f)) return v ? '&nbsp;' : 'X';
    if (!v && ehOpcional(f)) return '&nbsp;';
    if (!v) return modo === 'previa' ? `<mark class="faltando" data-k="${k}" title="Campo vazio. Clique para preencher">[${k}]</mark>` : `[${k}]`;
    // Nos modelos todo CPF sai mascarado (***.***.xxx-**), até o {{REP_CPF}} e CPFs dentro de textos.
    const t = esc(Extrator.protegeCPFs(aplicaFiltro(v, f))).replace(/\n+/g, '<br>');
    return modo === 'previa' ? `<mark class="preenchido" data-k="${k}" title="Clique para ver ou corrigir este dado">${t}</mark>` : t;
  });
}
const modeloAtual = () => estado.modelos.find(m => m.id === estado.modeloAtual) || estado.modelos[0];
const faltando = m => camposDoModelo(m.html).filter(k => !(estado.valores[k] || '').trim());
function salvarModelos() { LS.set('modelos', estado.modelos); LS.set('modeloAtual', estado.modeloAtual); }

// Limpa o HTML colado: mantém só a estrutura e as classes do SEI. Estilo inline
// é justamente o que o CKEditor descarta/desconfigura, então sai aqui.
// <a> fica de fora de propósito: link "ancora_sei" copiado de um processo antigo apontaria para o documento antigo.
const TAGS_OK = new Set(['P', 'STRONG', 'B', 'EM', 'I', 'U', 'BR', 'SUP', 'SUB', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'UL', 'OL', 'LI', 'SPAN']);
function limparHTML(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const raiz = doc.body.firstChild;
  (function walk(el) {
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 8) { n.remove(); continue; }
      if (n.nodeType !== 1) continue;
      walk(n);
      if (n.tagName === 'DIV') { // contenteditable cria <div> por linha: vira parágrafo padrão do SEI
        const p = doc.createElement('p');
        p.className = 'Texto_Corpo_11_Justificado_Recuo_Primeira_Linha';
        p.append(...n.childNodes); n.replaceWith(p); continue;
      }
      if (!TAGS_OK.has(n.tagName) || (n.tagName === 'SPAN' && !n.attributes.length)) { n.replaceWith(...n.childNodes); continue; }
      for (const a of [...n.attributes]) {
        const manter = (a.name === 'class' && /(^|\s)(Texto_|Item_|Tabela_|Paragrafo_|ancora_sei|infra-)|^table$/.test(a.value)) ||
                       ['colspan', 'rowspan'].includes(a.name);
        if (a.name === 'style') {
          // Só os estilos que os botões do CKEditor gravam: recuo (SEI) e fonte/tamanho/alinhamento
          // (extratos do Diário Oficial, que não conhece as classes do SEI). O resto é o que desconfigura.
          // Tabela/célula: largura e borda (sem width a tabela do DFD encolhe ao colar no SEI).
          // Cor de fundo/letra: cabeçalho preto da Declaração de Conformidade (célula e texto).
          const tabela = /^(TABLE|TD|TH)$/.test(n.tagName) ? '|width|min-width|border-collapse|border-color|border-spacing|margin|margin-right|padding|overflow-wrap|background-color'
            : n.tagName === 'SPAN' ? '|color|background-color' : '';
          const ok = a.value.split(';').map(s => s.trim()).filter(s => new RegExp(`^(margin-left|text-align|font-family|font-size${tabela})\\s*:`, 'i').test(s));
          ok.length ? n.setAttribute('style', ok.join(';')) : n.removeAttribute('style');
        } else if (!manter) n.removeAttribute(a.name);
      }
      if (n.tagName === 'SPAN' && !n.attributes.length) n.replaceWith(...n.childNodes);
    }
  })(raiz);
  return raiz.innerHTML.trim();
}

// comoFonte: copia o HTML como TEXTO, para colar no modo "Fonte" do Diário Oficial. A colagem normal lá
// passa por um filtro do CKEditor que mantém negrito mas descarta alinhamento e tamanho (testado 09/11/2026).
function copiar(comoFonte = false) {
  const m = modeloAtual();
  const html = preencher(m.html, 'copia');
  const tmp = document.createElement('div');
  tmp.innerHTML = html.replace(/<\/p>/g, '</p>\n');
  // Evento 'copy' em vez de navigator.clipboard: não pede permissão e funciona até em file://.
  const aoCopiar = comoFonte
    ? e => { e.clipboardData.setData('text/plain', html); e.preventDefault(); }
    : e => { e.clipboardData.setData('text/html', html); e.clipboardData.setData('text/plain', tmp.textContent); e.preventDefault(); };
  document.addEventListener('copy', aoCopiar);
  const ok = document.execCommand('copy');
  document.removeEventListener('copy', aoCopiar);
  if (!ok) return toast('Não consegui copiar. Tente de novo clicando no botão.');
  const f = faltando(m), aviso = f.length ? ` Atenção: ${f.length} campo(s) vazio(s) ficaram como [CAMPO].` : '';
  botaoFeito(comoFonte ? $('#btCopiarFonte') : $('#btCopiar'), 'Copiado');
  if (comoFonte) toast(`Código-fonte copiado! No ${m.grupo === 'extrato' ? 'Diário Oficial' : 'SEI'}: clique em "Fonte", cole (Ctrl+V) no lugar certo e clique em "Fonte" de novo.` + aviso);
  else toast(f.length ? `Copiado!${aviso}` : `Copiado! Cole no editor ${m.grupo === 'extrato' ? 'do Diário Oficial' : 'do SEI'} (Ctrl+V).`);
}

// ─── Render (interface 2) ─────────────────────────────────
const ic = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
// "[29]-41316585_Proposta_de_Orcamento.pdf" → título legível + nº SEI
function nomeLimpo(nome) {
  const m = String(nome).match(/^\[\d+\]-(\d{8})_(.+?)\.(\w+)$/);
  return m ? { titulo: m[2].replace(/_+/g, ' ').trim(), sei: m[1], ext: m[3].toLowerCase() } : { titulo: String(nome), sei: '', ext: '' };
}

// Janela própria no lugar de confirm()/prompt() do navegador. Devolve true/false, ou o texto (null se cancelar).
let fecharDialogo = null; // resolve a janela aberta: true = confirmou
// campos: [{ rot, valor, longo }] → devolve a lista de valores (ou null se cancelar)
function dialogo({ titulo, texto = '', entrada, ok = 'OK', perigo = false, campos }) {
  return new Promise(resolver => {
    const d = $('#dlg'), inp = $('#dlgEntrada'), pergunta = entrada !== undefined, cx = $('#dlgCampos');
    cx.hidden = !campos; d.classList.toggle('largo', !!campos);
    cx.innerHTML = (campos || []).map((c, i) => `<label>${esc(c.rot)}${c.opcoes ? `<select data-i="${i}">${c.opcoes.map(([v, r]) => `<option value="${esc(v)}" ${v === c.valor ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>` : c.longo ? `<textarea rows="${c.linhas || 4}" data-i="${i}">${esc(c.valor || '')}</textarea>` : `<input data-i="${i}" value="${esc(c.valor || '')}" autocomplete="off">`}</label>`).join('');
    if (fecharDialogo) fecharDialogo(false); // só uma janela por vez
    $('#dlgTitulo').textContent = titulo;
    $('#dlgTexto').textContent = texto; $('#dlgTexto').hidden = !texto;
    inp.hidden = !pergunta; inp.value = pergunta ? entrada : '';
    $('#dlgOk').textContent = ok; $('#dlgOk').classList.toggle('perigo', perigo);
    // Resolve direto no clique/Enter/Esc: o evento "close" do navegador pode chegar atrasado
    fecharDialogo = sim => { fecharDialogo = null; if (d.open) d.close();
      resolver(campos ? (sim ? [...cx.querySelectorAll('[data-i]')].map(x => x.value.trim()) : null) : pergunta ? (sim ? inp.value.trim() : null) : sim); };
    d.showModal();
    if (campos) cx.querySelector('[data-i]').focus(); else if (pergunta) { inp.focus(); inp.select(); } else $('#dlgOk').focus();
  });
}
$('#dlg').querySelector('form').onsubmit = e => { e.preventDefault(); fecharDialogo && fecharDialogo(true); };
$('#dlgCancelar').onclick = () => fecharDialogo && fecharDialogo(false);
$('#dlg').addEventListener('cancel', e => { e.preventDefault(); fecharDialogo && fecharDialogo(false); }); // Esc
const confirmar = (titulo, texto, ok = 'Continuar', perigo = false) => dialogo({ titulo, texto, ok, perigo });
const perguntar = (titulo, entrada = '', texto = '') => dialogo({ titulo, texto, entrada, ok: 'Salvar' });

// Painel "Certidões": vencida / vence antes do evento / vencendo / sem validade no documento / ok
const STATUS_CERT = {
  'vencida':      ['x', c => `vencida em ${c.validade}`],
  'antes-evento': ['alerta', c => `vence ${c.validade}, antes do evento`],
  'vencendo':     ['relogio', c => `vence em ${c.dias} dia${c.dias === 1 ? '' : 's'} (${c.validade})`],
  'sem-data':     ['duvida', c => `validade não informada no documento${c.emissao ? ` (emitida em ${c.emissao})` : ''}; confira`],
  'ok':           ['ok', c => `válida até ${c.validade}`],
  'informativo':  ['info', c => c.emissao ? `emitida em ${c.emissao}${c.validade ? `; recente até ${c.validade} (30 dias)` : ''}. Só para saber que é recente; não precisa atualizar no processo` : 'data de emissão não encontrada; confira'],
};
// Nome sugerido no SEI (quando o arquivo está com outro nome) e "Emitir de novo" (vencida, antes do evento,
// vencendo ou sem validade). O link só abre o site do órgão numa aba nova: o Maestro não acessa a internet.
const PEDE_NOVA = ['vencida', 'antes-evento', 'vencendo', 'sem-data'];
const nomeArquivoLimpo = n => Extrator.norm(n.replace(/^\[\d+\]-\d+_/, '').replace(/\.(pdf|html?|jpe?g|png|docx?|txt)$/i, '').replace(/_+/g, ' ')).replace(/[^a-z0-9]+/g, ' ').trim();
function extrasCertidao(c) {
  const info = Extrator.infoCertidao(c); if (!info) return '';
  const renomear = nomeArquivoLimpo(c.arquivo) !== nomeArquivoLimpo(info.nome);
  const emitir = info.link && PEDE_NOVA.includes(c.status);
  if (!renomear && !emitir) return '';
  return `<span class="cert-acoes">${emitir ? `<a class="btn mini neutro" href="${esc(info.link)}" target="_blank" rel="noopener noreferrer" title="Abre o site do órgão numa aba nova">${ic('reler')}Emitir de novo</a>` : ''}
    ${renomear ? `<button type="button" class="nome-sugerido" data-copiar-nome="${esc(info.nome)}" title="Nome sugerido para o documento no SEI (clique para copiar)">${ic('copiar')}<span>Nome no SEI: <code>${esc(info.nome)}</code></span></button>` : ''}</span>`;
}
$('#listaCertidoes').addEventListener('click', e => {
  const b = e.target.closest('[data-copiar-nome]'); if (!b) return;
  const txt = b.dataset.copiarNome, aoCopiar = ev => { ev.clipboardData.setData('text/plain', txt); ev.preventDefault(); };
  document.addEventListener('copy', aoCopiar); const ok = document.execCommand('copy'); document.removeEventListener('copy', aoCopiar);
  toast(ok ? `Copiado: ${txt}` : 'Não consegui copiar. Selecione o nome e copie com Ctrl+C.');
});
let resumoCert = null; // { texto, classe } para o chip da barra do processo
function renderCertidoes() {
  const lista = Extrator.situacaoCertidoes(estado.docs, estado.valores.EVENTO_DATA);
  const painel = $('#painelCertidoes');
  painel.hidden = !lista.length;
  resumoCert = null;
  if (lista.length) {
    const conta = s => lista.filter(c => c.status === s).length;
    const resumo = [['vencida', 'vencida'], ['antes-evento', 'antes do evento'], ['vencendo', 'vencendo'], ['sem-data', 'sem validade']]
      .map(([s, r]) => conta(s) ? `${conta(s)} ${r}${conta(s) > 1 && s === 'vencida' ? 's' : ''}` : '').filter(Boolean).join(', ');
    const grave = conta('vencida') + conta('antes-evento');
    resumoCert = { texto: resumo ? `Certidões: ${resumo}` : `${lista.length} certidões válidas`, classe: grave ? 'erro' : resumo ? 'alerta' : 'ok', icone: grave ? 'x' : resumo ? 'alerta' : 'ok' };
    $('#certResumo').textContent = resumo || 'todas válidas';
    $('#certResumo').className = resumo ? 'alerta' : 'ok';
    // processo salvo antes da v1.0.1: não guardou a validade lida do texto → só tem o nome do arquivo
    const semLeitura = estado.docs.some(d => d.texto === undefined && d.cert === undefined && Extrator.validadeCertidao(d.nome, ''));
    $('#listaCertidoes').innerHTML = (semLeitura ? `<li class="cert aviso-reler-cert">${ic('info')}<span>Este processo foi salvo numa versão
      anterior: as validades abaixo vêm só do <strong>nome dos arquivos</strong>. Abra o .zip do processo de novo (ou clique em <strong>Reler pasta</strong>)
      para ler o texto das certidões e depois salve o processo.</span></li>` : '') + lista.map(c => `<li class="cert ${c.status}" title="${esc(c.arquivo)}">
      ${ic(STATUS_CERT[c.status][0])}<span><strong>${esc(c.rotulo)}</strong>
      ${c.confirmacaoDespesa ? '<span class="tag cd">Confirmação de despesa</span>' : ''}
      <small>${esc(STATUS_CERT[c.status][1](c))}${c.fonte && c.fonte !== 'texto' && !c.informativo ? ` · ${c.fonte === 'nome do arquivo' ? 'pelo nome do arquivo' : esc(c.fonte) + (c.emissao ? `, emitida em ${esc(c.emissao)}` : '')}` : ''}${c.nomeDiz ? ` · <b class="nome-diz">o nome do arquivo diz ${esc(c.nomeDiz)}; vale a data escrita no documento; confira</b>` : ''}</small>${extrasCertidao(c)}</span></li>`).join('');
  }
  renderBarra();
}

// Quadro "Conferência do processo" (tela Arquivos): o que a varredura conferiu com as regras do Checklist,
// o que ainda falta e os prazos. Devolve a conferência (a barra do processo mostra o resumo).
const IC_NIVEL = { erro: 'x', aviso: 'alerta', lembrete: 'info', ok: 'ok' };
// De onde veio o ponto de atenção (v5.0.1): arquivo (pelo nome ou pelo nº SEI) ou documento do Maestro
function refPonto(ref) {
  if (!ref) return null;
  if (ref.modelo && estado.modelos.some(m => m.id === ref.modelo)) return { attrs: `data-modelo="${esc(ref.modelo)}"`, rot: 'ver o documento', dica: 'Abrir este documento na tela Documentos' };
  const doc = estado.docs.find(d => ref.arq ? d.nome === ref.arq : ref.sei && d.nome.includes('-' + ref.sei + '_'));
  return doc ? { attrs: `data-arquivo="${esc(doc.nome)}" data-valor="${esc(ref.valor || '')}"`, rot: 'ver o arquivo', dica: doc.nome + ': ver este arquivo' } : null;
}
$('#listaPontos').addEventListener('click', e => {
  const b = e.target.closest('.ponto-ir'); if (!b) return;
  if (b.dataset.modelo) { estado.modeloAtual = b.dataset.modelo; salvarModelos(); fecharEditor(); renderCampos(); renderModelos(); mostrarAba('documentos'); return; }
  irParaArquivo(b.dataset.arquivo, b.dataset.valor);
});
function renderConferencia() {
  const conf = Extrator.conferirProcesso(estado.valores, estado.extraidos);
  const painel = $('#painelConferencia');
  painel.hidden = !estado.docs.length;
  if (painel.hidden) return conf;
  const n = conf.pontos.filter(p => p.nivel !== 'lembrete').length;
  $('#confResumo').textContent = n ? `${n} ponto${n > 1 ? 's' : ''} de atenção` : 'nenhum ponto de atenção';
  $('#confResumo').className = conf.pontos.some(p => p.nivel === 'erro') ? 'alerta' : n ? 'aviso' : 'ok';
  $('#confEtapa').innerHTML = `Etapa: <strong>${esc(conf.etapa.nome)}</strong>${conf.etapa.proxima ? ` · próxima: ${esc(conf.etapa.proxima)}` : ''}`;
  $('#listaPontos').innerHTML = conf.pontos.length
    ? conf.pontos.map(p => { const r = refPonto(p.ref);
        return r ? `<li class="ponto ${p.nivel}"><button type="button" class="ponto-ir" ${r.attrs} title="${esc(r.dica)}">${ic(IC_NIVEL[p.nivel])}<span>${esc(p.texto)}</span><span class="ir">${r.rot}</span></button></li>`
          : `<li class="ponto ${p.nivel}">${ic(IC_NIVEL[p.nivel])}<span>${esc(p.texto)}</span></li>`; }).join('')
    : `<li class="ponto ok">${ic('ok')}<span>A varredura não achou nada fora do esperado. Continue conferindo o que depende de leitura (CNAE, material de consagração, exclusividade).</span></li>`;
  $('#listaFaltam').innerHTML = conf.faltam.length ? conf.faltam.map(f => `<li>${esc(f)}</li>`).join('') : '<li class="ok">Nada faltando para esta etapa.</li>';
  $('#contFaltam').textContent = conf.faltam.length || '';
  $('#listaPrazos').innerHTML = conf.prazos.length
    ? conf.prazos.map(p => `<li class="${p.nivel}"><b>${esc(p.rotulo)}</b><span>${esc(p.texto)}</span></li>`).join('')
    : '<li>Sem data de evento nem de assinatura ainda.</li>';
  return conf;
}

// Barra do processo: número, quem é, situação (credenciamento, certidões), salvo ou não
function renderBarra() {
  const v = estado.valores, tem = !!(estado.docs.length || v.PROCESSO || v.EMPRESA_NOME);
  $('#barraProcesso').hidden = !tem;
  if (!tem) return;
  $('#procTitulo').textContent = v.PROCESSO || 'Processo sem número';
  $('#procSub').textContent = [v.EMPRESA_NOME, v.ARTISTA && v.ARTISTA !== v.EMPRESA_NOME ? v.ARTISTA : '', v.EVENTO_DATA].filter(Boolean).join(' · ');
  const cred = (v.CREDENCIAMENTO || '').trim();
  const conf = renderConferencia();
  const graves = conf.pontos.filter(p => p.nivel === 'erro').length, atencao = conf.pontos.filter(p => p.nivel !== 'lembrete').length;
  $('#procChips').innerHTML = (estado.docs.length ? `<span class="chip" title="Etapa em que o processo está, pelos documentos que já tem${conf.etapa.proxima ? '. Próxima: ' + esc(conf.etapa.proxima) : ''}">${esc(conf.etapa.nome)}</span>` : '') +
    (atencao ? `<button type="button" class="chip ${graves ? 'erro' : 'alerta'}" data-ir="arquivos" title="Ver a conferência do processo">${ic('alerta')}${atencao} ponto${atencao > 1 ? 's' : ''} de atenção</button>` : '') +
    (cred ? `<span class="chip cred" title="Processo de credenciamento: sem nº de inexigibilidade nem Extrato de Inexigibilidade">${ic('estrela')}Credenciamento ${esc(cred)}</span>` : '') +
    (resumoCert ? `<button type="button" class="chip ${resumoCert.classe}" data-ir="arquivos" title="Ver as certidões">${ic(resumoCert.icone)}${esc(resumoCert.texto)}</button>` : '');
  const salvo = processos[estado.salvoId];
  $('#estadoSalvo').textContent = salvo ? `salvo em ${new Date(salvo.salvoEm).toLocaleDateString('pt-BR')}` : 'ainda não salvo';
  $('#btReler').disabled = !estado.pasta;
  $('#btReler').title = estado.pasta ? `Ler de novo todos os documentos da pasta "${estado.pasta}" (o que você corrigiu fica)` : 'Abra a pasta de um processo primeiro';
}

function renderDocs() {
  const tem = estado.docs.length > 0;
  $('#inicio').hidden = tem; $('#arquivos').hidden = !tem;
  $('#contArquivos').textContent = tem ? estado.docs.length : '';
  $('#contDocs').textContent = tem ? estado.docs.length : '';
  // Processo aberto da lista de salvos: o texto dos documentos não é guardado, então nada é relido
  $('#avisoReler').hidden = !(tem && estado.docs.every(d => d.texto === undefined));
  $('#listaDocs').innerHTML = estado.docs.map((d, i) => {
    const n = nomeLimpo(d.nome), rot = ROTULO_TIPO[d.tipo] || '…';
    const fonteDado = d.tipo && !['outro', 'sei_interno', 'empenho'].includes(d.tipo);
    const tag = d.status === 'lendo' ? '<span class="tag lendo">lendo…</span>'
      : d.status === 'erro' ? `<span class="tag erro" title="${esc(d.erro)}">não consegui ler</span>`
      : `<span class="tag ${fonteDado ? 'fonte-dado' : ''}">${esc(rot)}${d.status === 'OCR' ? ' · OCR' : ''}</span>`;
    return `<li data-arq="${esc(d.nome)}" data-busca="${esc(Extrator.norm(d.nome + ' ' + rot))}"><details><summary title="${esc(d.nome)}">${ic('seta')}
      <span class="nome">${esc(n.titulo)}${n.sei ? `<small>${n.sei} · ${n.ext}</small>` : ''}</span>${tag}</summary>
      ${d.texto !== undefined ? `<div class="detalhe"><label class="rotulo">Tipo do documento (troque se foi reconhecido errado)
        <select data-doc="${i}">${Object.entries(ROTULO_TIPO).map(([k, r]) => `<option value="${k}" ${k === d.tipo ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <div class="dica">${d.achou && d.achou.length ? 'Dados achados aqui: ' + esc(d.achou.join(', ')) : 'Nenhum dado achado neste documento.'}</div>
      <pre>${esc((d.texto || '(nenhum texto lido neste arquivo)').slice(0, 4000))}</pre></div>`
      // processo aberto da lista de salvos: o texto não é guardado — mostra o que há e como ver de novo
      : `<div class="detalhe"><div class="dica">Tipo: <strong>${esc(rot)}</strong> · ${d.achou && d.achou.length ? 'Dados achados aqui: ' + esc(d.achou.join(', ')) : 'nenhum dado achado neste documento.'}</div>
      <div class="dica">O texto lido não fica guardado nos processos salvos. Para ver o texto ou trocar o tipo, abra o .zip do processo de novo (o que você corrigiu é mantido).</div></div>`}
    </details></li>`; }).join('');
  filtrarLista('#buscaDocs', '#listaDocs > li');
  renderCertidoes();
}
// filtro simples de listas: esconde o que não tem o texto buscado em data-busca
function filtrarLista(busca, itens) {
  const q = Extrator.norm($(busca).value.trim());
  document.querySelectorAll(itens).forEach(el => { el.hidden = !!q && !(el.dataset.busca || '').includes(q); });
}
$('#buscaDocs').oninput = () => filtrarLista('#buscaDocs', '#listaDocs > li');

// ✓ em quantos documentos o valor aparece  ·  ⚠ quais documentos trouxeram outro valor
function conferencia(k, x) {
  if (!x || estado.editados.has(k)) return '';
  let h = '';
  if (x.confere && x.confere.length > 1)
    h += `<div class="fonte ok" title="${esc(x.confere.join('\n'))}">${ic('ok')} confere em ${x.confere.length} documentos</div>`;
  if (x.diverge && x.diverge.length)
    h += x.diverge.map(o => `<button type="button" class="fonte alerta" data-arquivo="${esc(o.fonte)}" data-valor="${esc(o.valor)}" title="Ver este arquivo na tela Arquivos">${ic('alerta')}<span>diferente em <u>${esc(nomeLimpo(o.fonte).titulo)}</u>: «${esc(o.valor)}»</span></button>`).join('');
  else if (!x.diverge && x.alternativas.length) // campos sem conferência (textos): só lista as outras opções
    h += `<div class="fonte" title="${esc(x.alternativas.join(' · '))}">outras opções achadas: ${esc(x.alternativas.join(' · '))}</div>`;
  return h;
}
const temAlerta = k => { const x = estado.extraidos[k]; return !!(x && x.diverge && x.diverge.length && !estado.editados.has(k)); };

// Campo que você alterou: o rótulo é um botão que desfaz a edição (volta ao valor lido do documento ou ao automático)
function rotEditado(k) {
  const x = estado.extraidos[k];
  return `<button type="button" class="fonte editado" data-desfazer="${k}" title="${x ? 'Voltar ao valor lido do documento: «' + esc(x.valor) + '»' : 'Desfazer a edição: volta ao valor automático (ou fica vazio)'}">${ic('editar')}<span>editado por você · <u>${x ? 'voltar ao do documento' : 'desfazer'}</u></span></button>`;
}
function desfazerEdicao(e) {
  const b = e.target.closest('[data-desfazer]'); if (!b) return;
  const k = b.dataset.desfazer, x = estado.extraidos[k];
  estado.editados.delete(k);
  if (x) estado.valores[k] = x.valor; else delete estado.valores[k];
  recalcular(); renderTudo();
  toast(x ? `${ROT_CAMPO(k)}: voltou ao valor do documento.` : `${ROT_CAMPO(k)}: edição desfeita.`);
}
// Um campo. pre = prefixo do id ("c_" na tela Dados, "d_" no painel da tela Documentos)
function campoHTML([k, rot, , longo], pre, trancado, usados) {
  const v = estado.valores[k] || '', x = estado.extraidos[k];
  const fonte = trancado ? `<span class="fonte">${ic('cadeado')} trancado</span>`
    : estado.editados.has(k) ? rotEditado(k)
    : x && estado.docs.some(d => d.nome === x.fonte) ? `<button type="button" class="fonte" data-arquivo="${esc(x.fonte)}" data-valor="${esc(x.valor)}" title="${esc(x.fonte)}: ver este arquivo na tela Arquivos">${ic('arquivo')} <u>${esc(nomeLimpo(x.fonte).titulo)}</u></button>`
    : x ? `<span class="fonte" title="${esc(x.fonte)}">${ic('arquivo')} ${esc(nomeLimpo(x.fonte).titulo)}</span>` : '';
  const alts = x && x.alternativas.length ? `<datalist id="dl_${pre}${k}">${x.alternativas.map(a => `<option value="${esc(a)}">`).join('')}</datalist>` : '';
  const ro = trancado ? 'readonly' : '';
  const ctl = longo
    ? `<textarea id="${pre}${k}" name="${k}" ${ro} rows="${Math.min(8, 2 + Math.ceil(v.length / 70))}">${esc(v)}</textarea>`
    : `<input id="${pre}${k}" name="${k}" ${ro} value="${esc(v)}" ${alts ? `list="dl_${pre}${k}"` : ''}>${alts}`;
  return `<div class="campo ${v ? '' : 'vazio'} ${usados.has(k) ? 'usado' : ''} ${longo ? 'longo' : ''}" data-k="${k}" data-busca="${esc(Extrator.norm(rot + ' ' + k))}" ${!trancado && temAlerta(k) ? 'data-alerta' : ''}>
    <label for="${pre}${k}"><span>${esc(rot)}</span><code>{{${k}}}</code></label>${ctl}${fonte}
    ${trancado ? '' : conferencia(k, x)}</div>`;
}

function renderCampos() {
  const m = modeloAtual(), usados = new Set(camposDoModelo(m.html));
  const conhecidos = new Set(CAMPOS.map(c => c[0]));
  const extras = [...new Set(estado.modelos.flatMap(mm => camposDoModelo(mm.html)))].filter(k => !conhecidos.has(k))
    .map(k => [k, k.replace(/_/g, ' ').toLowerCase(), 'Outros (criados nos modelos)', true]);
  const todos = [...CAMPOS, ...extras], grupos = {};
  for (const c of todos) if (!c[4]) (grupos[c[2]] ||= []).push(c);
  gruposAtuais = Object.fromEntries(Object.entries(grupos).map(([g, cs]) => [g, cs.map(c => c[0])]));

  // Tela Dados: todas as categorias, em grade; índice à esquerda
  const nomes = Object.keys(grupos);
  $('#campos').innerHTML = nomes.map((g, i) => { const trancado = !!travas[g]; return `
    <fieldset id="g_${i}" class="${trancado ? 'trancado' : ''}"><legend><span>${esc(g)}</span>
      <label class="trava" title="Trancar: os valores ficam fixos e não mudam com os documentos lidos nem ao trocar de processo">
        <input type="checkbox" data-trava="${esc(g)}" ${trancado ? 'checked' : ''}>${ic(trancado ? 'cadeado' : 'cadeado-aberto')}${trancado ? 'Trancado' : 'Trancar'}</label></legend>
      <div class="grade-campos">${grupos[g].map(c => campoHTML(c, 'c_', trancado, usados)).join('')}</div></fieldset>`; }).join('') +
    '<p class="sem-resultado" hidden>Nenhum dado com esse filtro.</p>';
  $('#indiceGrupos').innerHTML = nomes.map((g, i) => {
    const total = grupos[g].length, cheios = grupos[g].filter(c => (estado.valores[c[0]] || '').trim()).length;
    const faltaUsado = grupos[g].some(c => usados.has(c[0]) && !(estado.valores[c[0]] || '').trim());
    return `<a href="#g_${i}" data-grupo="g_${i}" class="${faltaUsado ? 'falta' : ''}"><span>${esc(g)}</span><small>${cheios}/${total}</small></a>`; }).join('');
  filtrarCampos();

  // Tela Documentos: só os dados que o documento aberto usa; o que falta vem primeiro
  const noModelo = new Set([...m.html.matchAll(RE_CAMPO)].map(x => x[1])); // inclui os opcionais
  const doDoc = todos.filter(c => noModelo.has(c[0]));
  const vazio = c => usados.has(c[0]) && !(estado.valores[c[0]] || '').trim();
  const faltam = doDoc.filter(vazio), resto = doDoc.filter(c => !vazio(c));
  const linha = c => campoHTML(c, 'd_', !!travas[c[2]], usados);
  $('#camposDoc').innerHTML = (faltam.length ? `<div class="secao falta">Faltam preencher (${faltam.length})</div>` + faltam.map(linha).join('') : '') +
    (!resto.length ? '' : faltam.length && document.documentElement.dataset.tema === 'didatico'
      ? `<details class="grupo-ok"><summary>Já preenchidos e opcionais <span class="cont">${resto.length}</span></summary>${resto.map(linha).join('')}</details>`
      : `<div class="secao">${faltam.length ? 'Já preenchidos e opcionais' : 'Tudo preenchido. Confira'}</div>` + resto.map(linha).join('')) +
    (!doDoc.length ? '<p class="dica">Este documento não usa nenhum dado do processo.</p>' : '');

  // aba Dados: quantos dados têm documento dizendo outra coisa
  const alertas = todos.filter(c => !travas[c[2]] && temAlerta(c[0])).length;
  $('#contDados').textContent = alertas || '';
}
function filtrarCampos() {
  const q = Extrator.norm($('#buscaCampos').value.trim()), soVazios = $('#soVazios').checked, soAlertas = $('#soAlertas').checked;
  let visiveis = 0;
  document.querySelectorAll('#campos fieldset').forEach(fs => {
    let n = 0;
    fs.querySelectorAll('.campo').forEach(c => {
      const mostra = (!q || c.dataset.busca.includes(q)) && (!soVazios || c.classList.contains('vazio')) && (!soAlertas || 'alerta' in c.dataset);
      c.hidden = !mostra; if (mostra) n++;
    });
    fs.hidden = !n; visiveis += n;
  });
  const vazio = $('#campos .sem-resultado'); if (vazio) vazio.hidden = visiveis > 0;
}
// Rola SÓ a área que contém o elemento. scrollIntoView() rolava também a página inteira e o cabeçalho
// sumia sem volta (achado pelo usuário na 4.0.0, ao clicar numa categoria da tela Dados).
function rolarAte(el, centro = false) {
  const area = el.closest('.vista:not(.docs), .painel-campos, .mesa, .lista-modelos');
  if (!area) return;
  const a = area.getBoundingClientRect(), e = el.getBoundingClientRect();
  const topo = area.scrollTop + (e.top - a.top) - (centro ? (a.height - e.height) / 2 : 8);
  area.scrollTo({ top: Math.max(0, topo), behavior: 'smooth' });
}
$('#buscaCampos').oninput = $('#soVazios').onchange = $('#soAlertas').onchange = filtrarCampos;
$('#indiceGrupos').onclick = e => {
  const a = e.target.closest('[data-grupo]'); if (!a) return;
  e.preventDefault();
  const fs = document.getElementById(a.dataset.grupo);
  if (fs && !fs.hidden) rolarAte(fs);
};

// Ordem da lista: Documentos SEI, Despachos, Extratos Diário Oficial
let reordenando = false;
function moverModelo(id, dir) {
  const L = estado.modelos, i = L.findIndex(m => m.id === id), g = L[i].grupo || 'sei';
  let j = i + dir;
  while (j >= 0 && j < L.length && (L[j].grupo || 'sei') !== g) j += dir; // pula modelos de outros grupos
  if (j < 0 || j >= L.length) return;
  [L[i], L[j]] = [L[j], L[i]];
  salvarModelos(); renderModelos();
  const bt = document.querySelector(`[data-mover="${CSS.escape(id)}"][data-dir="${dir}"]`);
  (bt && !bt.disabled ? bt : document.querySelector(`[data-mover="${CSS.escape(id)}"]:not([disabled])`))?.focus();
}
// arrastar e soltar (v5.2.0): solta antes ou depois do alvo, só dentro do mesmo grupo
function soltarModelo(id, alvo, depois) {
  const L = estado.modelos, de = L.findIndex(m => m.id === id);
  if (de < 0 || id === alvo || (L[de].grupo || 'sei') !== (L.find(m => m.id === alvo)?.grupo || 'sei')) return;
  const [m] = L.splice(de, 1);
  L.splice(L.findIndex(x => x.id === alvo) + (depois ? 1 : 0), 0, m);
  salvarModelos(); renderModelos();
}
let arrastando = null, grupoArrastado = null;
document.addEventListener('dragstart', e => { const it = e.target.closest?.('.m-ordem'); if (!it) return;
  arrastando = it.dataset.id; grupoArrastado = it.dataset.grupo; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', arrastando); it.classList.add('arrastando'); });
document.addEventListener('dragend', () => { arrastando = null; document.querySelectorAll('.m-ordem.arrastando, .m-ordem.antes, .m-ordem.depois').forEach(x => x.classList.remove('arrastando', 'antes', 'depois')); });
document.addEventListener('dragover', e => { const it = arrastando && e.target.closest?.('.m-ordem');
  if (!it || it.dataset.grupo !== grupoArrastado) return;
  e.preventDefault(); const r = it.getBoundingClientRect(), dep = e.clientY > r.top + r.height / 2;
  document.querySelectorAll('.m-ordem.antes, .m-ordem.depois').forEach(x => x !== it && x.classList.remove('antes', 'depois'));
  it.classList.toggle('depois', dep); it.classList.toggle('antes', !dep); });
document.addEventListener('drop', e => { const it = arrastando && e.target.closest?.('.m-ordem'); if (!it) return;
  e.preventDefault(); soltarModelo(arrastando, it.dataset.id, it.classList.contains('depois')); });
function modelosPorGrupo() {
  const de = g => estado.modelos.filter(m => (m.grupo || 'sei') === g);
  return { sei: de('sei'), desp: de('despacho'), ext: de('extrato') };
}
// modelo → item do Checklist: se o documento já está no processo, o modelo aparece como resolvido
// Credenciamento (art. 79 da Lei 14.133): cachê fixo da tabela do edital, sem Análise Técnica de Preços, sem nº de
// inexigibilidade (o contrato fica vinculado ao número do credenciamento) e sem Extrato de Inexigibilidade.
const NAO_SE_APLICA_CRED = new Set(['ext-inex', 'analise-tecnica', 'desp-dlc']);
const MODELO_ITEM = { memorando: 'memorando', tr: 'tr', etp: 'etp', du: 'unificada', dfd: 'dfd', 'minuta-inex': 'minuta',
  'confirmacao-despesa': 'confirmacao', 'declaracao-conformidade': 'conformidade', 'analise-tecnica': 'atp',
  'desp-homologacao': 'homolog', 'desp-dlc': 'd_dlc', 'desp-secon': 'registrado', 'desp-portaria': 'portaria', 'desp-empenho': 'empenho' };
const ROT_CAMPO = k => { const c = CAMPOS.find(x => x[0] === k); return c ? c[1].split(' (')[0] : k.replace(/_/g, ' ').toLowerCase(); };
function renderModelos() {
  // Lista à esquerda: documentos do SEI e extratos para o Diário Oficial
  // Credenciamento reconhecido: esmaece os modelos que não se aplicam (sem nº de inexigibilidade)
  const cred = (estado.valores.CREDENCIAMENTO || '').trim();
  const NAO_CRED = NAO_SE_APLICA_CRED;
  const achados = (estado.extraidos._checklist || {}).achados || {};
  // Reordenar (v5.1.0): setas sobem/descem o modelo dentro do grupo; a ordem fica salva com os modelos
  const itemOrdem = (m, i, lista) => `<div class="m-ordem" draggable="true" data-id="${esc(m.id)}" data-grupo="${esc(m.grupo || 'sei')}" title="Arraste para mudar de lugar">${ic('arrastar')}<span class="m-nome">${esc(m.nome)}</span>
    <button type="button" data-mover="${esc(m.id)}" data-dir="-1" title="Subir" aria-label="Subir ${esc(m.nome)}" ${i ? '' : 'disabled'}>${ic('sobe')}</button>
    <button type="button" data-mover="${esc(m.id)}" data-dir="1" title="Descer" aria-label="Descer ${esc(m.nome)}" ${i < lista.length - 1 ? '' : 'disabled'}>${ic('desce')}</button></div>`;
  const item = (m, i, lista) => {
    if (reordenando) return itemOrdem(m, i, lista);
    const f = faltando(m).length;
    const recomendado = false, naoSeAplica = cred && NAO_CRED.has(m.id);
    const feito = !!estado.feitos[m.id], noProc = !!achados[MODELO_ITEM[m.id]];
    const situacao = feito ? 'marcado como feito' : noProc ? 'já está no processo' : f ? `${f} campo${f > 1 ? 's' : ''} vazio${f > 1 ? 's' : ''}` : 'pronto para copiar';
    return `<button role="tab" data-modelo="${esc(m.id)}" aria-selected="${m.id === modeloAtual().id}" class="${naoSeAplica ? 'nao-aplica' : ''} ${feito || noProc ? 'feito' : ''}"
      title="${naoSeAplica ? `Não se aplica ao credenciamento (${esc(cred)}): cachê fixo da tabela do edital, sem nº de inexigibilidade e sem Extrato de Inexigibilidade` : esc(m.nome) + ': ' + situacao}">
      ${recomendado ? ic('estrela', 'estrela') : ''}<span class="m-nome">${esc(m.nome)}</span>${feito || noProc ? ic('feito', 'pronto') : f ? `<span class="falta">${f}</span>` : ic('ok', 'pronto')}</button>`;
  };
  const { sei, desp, ext } = modelosPorGrupo();
  // cada grupo = caixa com faixa de título colorida (v5.2.1: separação mais visível, pedido do usuário)
  const bloco = (cls, titulo, lista, g, icone) => `<div class="${cls} grupo-modelos g-${g}"><div class="rotulo-fileira">${ic(icone)}<span>${titulo}</span><b>${lista.length}</b></div>${lista.map(item).join('')}</div>`;
  const barraOrdem = `<button type="button" id="btOrdem" class="bt-ordem${reordenando ? ' ativo' : ''}" title="${reordenando ? 'Terminar de reordenar' : 'Mudar a ordem dos modelos nesta lista (vale para todos os processos)'}">${ic(reordenando ? 'ok' : 'ordenar')}<span>${reordenando ? 'Concluir' : 'Reordenar a lista'}</span></button>` +
    (reordenando ? '<p class="dica-ordem">Arraste cada modelo ou use as setas para subir ou descer, dentro do seu grupo.</p>' : '');
  $('#abasModelos').innerHTML = barraOrdem + (cred && !reordenando ? `<p class="aviso-cred">Processo do <strong>Edital de Credenciamento nº ${esc(cred)}</strong>: não há nº de inexigibilidade nem Extrato de Inexigibilidade, e o cachê é o fixo da tabela do edital (sem Análise Técnica de Preços). ` +
      `Confira se a minuta e o extrato de contrato seguem o seu edital.</p>` : '') +
    bloco('f-sei', 'Documentos SEI', sei, 'sei', 'arquivo') + (desp.length ? bloco('f-sei', 'Despachos', desp, 'despacho', 'lista') : '') + (ext.length ? bloco('f-dopa', 'Extratos', ext, 'extrato', 'livro') : '');

  const m = modeloAtual(), f = faltando(m), dopa = m.grupo === 'extrato', destino = dopa ? 'Diário Oficial' : 'SEI';
  $('#docTitulo').textContent = m.nome;
  const noProcesso = achados[MODELO_ITEM[m.id]], feito = !!estado.feitos[m.id];
  $('#docDestino').textContent = (dopa ? 'Extrato para colar no Diário Oficial' : m.grupo === 'despacho' ? 'Despacho para colar no editor do SEI' : 'Documento para colar no editor do SEI') +
    (noProcesso ? ` · já está no processo${noProcesso.sei ? ' (' + noProcesso.sei + ')' : ''}` : '');
  $('#btFeito').classList.toggle('marcado', feito);
  $('#btFeito').querySelector('span').textContent = feito ? 'Feito' : 'Marcar como feito';
  $('#btFeito').title = feito ? 'Clique para desmarcar' : 'Marque quando já tiver colado e salvo este documento no SEI ou no Diário Oficial (fica guardado neste processo)';
  const bt = $('#btCopiar');
  bt.dataset.rotulo = `Copiar para o ${destino}`;
  if (!bt.classList.contains('feito')) $('#btCopiarTxt').textContent = bt.dataset.rotulo;
  bt.title = `Copia o documento preenchido. Depois, no ${destino}: Ctrl+V dentro do editor`;
  bt.classList.toggle('dopa', dopa);
  // código-fonte: para os dois editores (SEI e Diário Oficial têm o botão "Fonte"); no Diário Oficial é o único jeito de manter a formatação
  $('#btCopiarFonte').title = `Copia o código-fonte. No ${destino}: clique em "Fonte", cole (Ctrl+V) e clique em "Fonte" de novo` + (dopa ? '. Em editores fora do SEI, é o jeito de manter o alinhamento e os tamanhos' : '');
  $('#previa').innerHTML = preencher(m.html, 'previa');
  $('#avisoFaltando').hidden = !f.length;
  $('#contDadosDoc').textContent = f.length || '';
  $('#avisoFaltando').innerHTML = `${ic('alerta')}<strong>${f.length} campo${f.length > 1 ? 's' : ''} vazio${f.length > 1 ? 's' : ''}</strong> neste documento:` +
    f.map(k => `<button type="button" class="pulo" data-foco="${k}" title="Ir para este campo">${esc(ROT_CAMPO(k))}</button>`).join('');
  // Análise Técnica: média das NFs ≥ proposta e mesma natureza do serviço (regra do usuário)
  const conf = m.id === 'analise-tecnica' ? Extrator.conferirBalizadoras(estado.valores) : [];
  $('#conferenciaBalizadoras').hidden = !conf.length;
  $('#conferenciaBalizadoras').innerHTML = conf.map(a => `<li class="${a.ok ? 'ok' : 'alerta'}">${ic(a.ok ? 'ok' : 'alerta')}<span>${esc(a.texto)}</span></li>`).join('');
}

// Partitura e Didático: "Dados deste documento" fica recolhido e abre à direita (classe painel-aberto na tela).
// No Didático abre sozinho ao chegar num documento com dado faltando.
const temPainel = () => ['partitura', 'didatico'].includes(document.documentElement.dataset.tema);
const abrirPainel = (sim = true) => $('#vDocumentos').classList.toggle('painel-aberto', sim);
function guiarPainel() { if (document.documentElement.dataset.tema === 'didatico') abrirPainel(faltando(modeloAtual()).length > 0); }
$('#btDadosDoc').onclick = () => abrirPainel(true);
$('#btFecharDados').onclick = () => abrirPainel(false);

// Leva o usuário até um campo (clique num trecho da prévia ou num aviso de campo vazio)
function focarCampo(k) {
  if (temPainel() && !$('#vDocumentos').hidden) abrirPainel(true);
  let el = document.getElementById('d_' + k);
  const grupo = el && el.closest('details'); if (grupo) grupo.open = true;
  if (!el || !el.offsetParent) { mostrarAba('dados'); $('#buscaCampos').value = ''; $('#soVazios').checked = $('#soAlertas').checked = false; filtrarCampos(); el = document.getElementById('c_' + k); }
  if (!el) return;
  rolarAte(el, true);
  el.focus({ preventScroll: true });
  const box = el.closest('.campo'); box.classList.remove('pisca'); void box.offsetWidth; box.classList.add('pisca');
}
$('#previa').onclick = e => { const mk = e.target.closest('mark[data-k]'); if (mk) focarCampo(mk.dataset.k); };
$('#avisoFaltando').onclick = e => { const b = e.target.closest('[data-foco]'); if (b) focarCampo(b.dataset.foco); };

// Checklist aberto acompanha o processo da tela (abrir da lista, novo, reler) — bug achado pelo usuário na 2.0.0
function renderTudo() { renderDocs(); renderCampos(); renderModelos(); if (!$('#abaChecklist').hidden) sincronizarChecklist(); }

let tToast;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tToast); tToast = setTimeout(() => t.classList.remove('on'), 4500); }
// Faixa de progresso da leitura. fracao (0–1) enche a barra; sem fracao, a barra fica "correndo".
function status(msg, fracao) {
  const p = $('#progresso');
  p.hidden = !msg;
  telaLeitura(msg, fracao);
  $('#statusLeitura').textContent = msg || '';
  p.classList.toggle('indefinido', fracao == null);
  $('#progressoBarra').style.width = fracao == null ? '' : Math.round(fracao * 100) + '%';
}
// Temas novos: a leitura ocupa a área das telas. "Lendo 3 de 40 — Proposta" vira contagem, barra e um item na lista.
// ponytail: a lista só cresce (o CSS mostra as últimas linhas); fica pequena mesmo com centenas de arquivos.
function telaLeitura(msg, fracao) {
  const t = $('#leitura'), m = (msg || '').match(/^Lendo (\d+) de (\d+): (.*)$/);
  if (!msg) { t.hidden = true; $('#ltLista').innerHTML = ''; $('#ltPauta').querySelectorAll('b').forEach(b => b.remove()); return; }
  if (!m) { if (t.hidden) return; $('#ltCont').textContent = msg; return; } // "Abrindo…", "Preparando a leitura de imagens…"
  t.hidden = false;
  $('#ltCont').textContent = `${m[1]} de ${m[2]} arquivos`;
  $('#ltBarra').style.width = Math.round((fracao || 0) * 100) + '%';
  $('#ltLista').insertAdjacentHTML('beforeend', `<li>${ic('ok')}<span>${esc(m[3])}</span></li>`);   // Caderno
  $('#ltArq').textContent = m[3];                                                                    // Partitura, Didático
  const fr = +m[1] / +m[2], alt = [52, 28, 64, 16, 40, 76, 4][m[3].length % 7];                      // Partitura: uma nota por arquivo
  $('#ltPauta').insertAdjacentHTML('beforeend', `<b class="nota-m${m[3].length % 2 ? ' baixo' : ''}" style="left:${4 + fr * 92}%;top:${alt}%"></b>`);
}
// Botão confirma que fez ("Copiado") e volta ao normal
function botaoFeito(b, txt) {
  const s = b.querySelector('span');
  b.dataset.rotulo ||= s.textContent;
  b.classList.add('feito'); s.textContent = txt;
  clearTimeout(b._t);
  b._t = setTimeout(() => { b.classList.remove('feito'); s.textContent = b.dataset.rotulo; }, 1800);
}

// ─── Editor de modelo ─────────────────────────────────────
let editandoId = null;
function abrirEditor(m) {
  editandoId = m.id;
  $('#edNome').value = m.nome;
  $('#edGrupo').value = m.grupo || 'sei';
  $('#edCorpo').innerHTML = m.html;
  $('#edHtml').value = m.html;
  $('#buscaChips').value = '';
  $('#chips').innerHTML = CAMPOS.map(c => `<button type="button" data-chip="${c[0]}" data-busca="${esc(Extrator.norm(c[0] + ' ' + c[1]))}" title="${esc(c[1])}">{{${c[0]}}}</button>`).join('');
  $('#editor').hidden = false; $('#previa').hidden = true;
  $('#docAvisos').hidden = true;
}
function fecharEditor() { editandoId = null; $('#editor').hidden = true; $('#previa').hidden = false; $('#docAvisos').hidden = false; }
$('#buscaChips').oninput = () => filtrarLista('#buscaChips', '#chips > button');
function inserirNoCursor(txt) {
  const sel = getSelection();
  if (!sel.rangeCount || !$('#edCorpo').contains(sel.anchorNode)) { $('#edCorpo').focus(); return toast('Clique no texto do modelo onde o campo deve entrar.'); }
  const r = sel.getRangeAt(0);
  r.deleteContents();
  r.insertNode(document.createTextNode(txt));
  r.collapse(false);
  $('#edHtml').value = $('#edCorpo').innerHTML;
}

// ─── Abrir processo ───────────────────────────────────────
// Lê uma pasta inteira. Pasta de um processo já salvo: retoma as suas edições, o grupo e o
// vínculo com o salvo; só o que você não editou é atualizado pelos documentos.
function carregarPasta(pasta, files) {
  novoProcesso();
  estado.pasta = pasta;
  const id = Object.keys(processos).find(k => processos[k].pasta && processos[k].pasta === pasta);
  if (id) {
    const p = processos[id];
    estado.salvoId = id;
    estado.editados = new Set(p.editados || []);
    estado.feitos = { ...(p.feitos || {}) };
    for (const k of estado.editados) estado.valores[k] = p.valores[k];
    toast(`Processo salvo "${p.nome}": o que você corrigiu foi mantido.`);
  }
  return processarArquivos(files);
}
$('#inPasta').onchange = e => {
  const files = [...e.target.files];
  carregarPasta(files[0] ? files[0].webkitRelativePath.split('/')[0] : '', files);
  e.target.value = '';
};

// ─── Pasta lembrada (Chrome/Edge): permite "Reler pasta" sem escolher de novo ──
// O identificador da pasta fica no IndexedDB do navegador (não copia nenhum arquivo).
// Navegador sem showDirectoryPicker: continua o seletor antigo, sem o reler.
const pastasIDB = (() => {
  let db;
  const abrir = () => db ||= new Promise((ok, erro) => {
    const r = indexedDB.open('mlivre', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pastas');
    r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
  });
  const op = (modo, f) => abrir().then(d => new Promise((ok, erro) => {
    const t = d.transaction('pastas', modo), r = f(t.objectStore('pastas'));
    t.oncomplete = () => ok(r.result); t.onerror = () => erro(t.error);
  }));
  return { get: k => op('readonly', s => s.get(k)), set: (k, v) => op('readwrite', s => s.put(v, k)) };
})();
async function arquivosDaPasta(dir) {
  const out = [];
  for await (const h of dir.values()) out.push(...(h.kind === 'file' ? [await h.getFile()] : await arquivosDaPasta(h)));
  return out;
}
async function lerPastaLembrada(dir) {
  if (await dir.queryPermission({ mode: 'read' }) !== 'granted' && await dir.requestPermission({ mode: 'read' }) !== 'granted')
    return toast('Sem permissão para ler a pasta. Clique em "Permitir" quando o navegador perguntar.');
  status('Listando os arquivos da pasta…');
  return carregarPasta(dir.name, await arquivosDaPasta(dir));
}
async function escolherPasta() {
  try {
    const dir = await showDirectoryPicker({ id: 'processos', mode: 'read' });
    await pastasIDB.set(dir.name, dir).catch(() => {}); // sem IndexedDB: só não terá o "Reler"
    await lerPastaLembrada(dir);
  } catch (err) { if (err.name !== 'AbortError') toast('Não consegui abrir a pasta: ' + err.message); }
}
const abrirSeletorPasta = () => window.showDirectoryPicker ? escolherPasta() : $('#inPasta').click();
$('#btReler').onclick = async () => {
  const dir = estado.pasta && await pastasIDB.get(estado.pasta).catch(() => null);
  if (!dir) { toast('Esta pasta ainda não foi lembrada (ou o processo veio de um .zip): escolha a pasta ou abra o .zip de novo.'); return mostrarAba('arquivos'); }
  lerPastaLembrada(dir);
};
$('#inArquivos').onchange = e => { abrirArquivos(e.target.files); e.target.value = ''; };
$('#inZip').onchange = e => { abrirArquivos(e.target.files); e.target.value = ''; };
// Botões "Escolher o .zip", "Abrir uma pasta", "Arquivos soltos" (na tela inicial e na de arquivos)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-abrir]');
  if (b) return b.dataset.abrir === 'zip' ? $('#inZip').click() : b.dataset.abrir === 'pasta' ? abrirSeletorPasta() : $('#inArquivos').click();
  const ir = e.target.closest('[data-ir]');
  if (ir) mostrarAba(ir.dataset.ir);
  // menus (details) fecham ao clicar fora ou ao escolher uma opção
  document.querySelectorAll('details.menu[open]').forEach(d => { if (!d.contains(e.target) || e.target.closest('.menu > div .btn')) d.open = false; });
});
// Soltar arquivos em qualquer lugar da tela
const arrastandoArquivos = e => [...(e.dataTransfer?.types || [])].includes('Files');
['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => {
  if (!arrastandoArquivos(e)) return;
  e.preventDefault(); $('#soltarTela').hidden = false; $('#soltar').classList.add('ativo');
}));
document.addEventListener('dragleave', e => { if (!e.relatedTarget) { $('#soltarTela').hidden = true; $('#soltar').classList.remove('ativo'); } });
document.addEventListener('drop', e => {
  e.preventDefault(); $('#soltarTela').hidden = true; $('#soltar').classList.remove('ativo');
  if (e.dataTransfer.files.length) abrirArquivos(e.dataTransfer.files);
});

function novoProcesso() {
  Object.assign(estado, { docs: [], pasta: '', extraidos: {}, valores: {}, editados: new Set(), feitos: {}, salvoId: null });
  recalcular(); renderTudo(); renderProcessos();
}

// ─── Processos salvos (gaveta à direita e lista da tela inicial) ────────────────
// ponytail: localStorage (~5 MB) cabe centenas de processos sem o texto dos documentos;
// se encher, exportar/limpar ou passar para IndexedDB.
const processos = LS.get('processos', {}); // id → {nome, salvoEm, pasta, valores, editados, extraidos, docs}
const nomeProcesso = v => [v.PROCESSO, v.EMPRESA_NOME, v.ARTISTA].filter(Boolean).join(' — ') || 'Processo sem nº';
// Grupos de processos: só um rótulo em cada processo salvo. Excluir um grupo não apaga processos
// (eles voltam para "Sem grupo").
const gruposProc = LS.get('gruposProc', []);
const salvarGrupos = mud => { unificarChecklist(mud); LS.set('gruposProc', gruposProc); LS.set('processos', processos); renderProcessos(); };

// Uma lista só (v4.2.0). O Checklist guarda os processos dele em outra chave do navegador; esta função iguala
// os dois lados: mesmos grupos (pelo nome) e mesmos processos (pelo nº SEI). Processo que só existe no
// Checklist entra na lista do Maestro sem documentos ("só no Checklist"). Daqui em diante quem manda é o
// Maestro: dentro dele o Checklist esconde a lista e os grupos próprios.
// mud = o que acabou de mudar aqui e precisa ser repetido lá: { renomeado: [antigo, novo], grupoExcluido, excluido: { chkId, sei } }
const CHK_KEY = 'mlivre-checklist-v1'; // onde o checklist.html guarda (mesma origem do Maestro)
function unificarChecklist(mud = {}) {
  let st = null; try { st = JSON.parse(localStorage.getItem(CHK_KEY) || 'null'); } catch {}
  if (!st || !st.procs) st = { procs: {}, current: null };
  st.grupos ||= {};
  const antesChk = JSON.stringify(st), antesMae = JSON.stringify([processos, gruposProc]);
  const idGrupo = nome => Object.keys(st.grupos).find(g => st.grupos[g].nome === nome);
  if (mud.renomeado) { const g = idGrupo(mud.renomeado[0]); if (g) st.grupos[g].nome = mud.renomeado[1]; }
  if (mud.grupoExcluido) { const g = idGrupo(mud.grupoExcluido); if (g) { delete st.grupos[g]; if (st.filtro === g) st.filtro = ''; for (const c of Object.values(st.procs)) if (c.grupo === g) c.grupo = ''; } }
  if (mud.excluido) for (const [cid, c] of Object.entries(st.procs)) if (cid === mud.excluido.chkId || (mud.excluido.sei && c.sei === mud.excluido.sei)) delete st.procs[cid];
  // grupos: os dois lados ficam com todos
  for (const g of Object.values(st.grupos)) if (g.nome && !gruposProc.includes(g.nome)) gruposProc.push(g.nome);
  gruposProc.forEach((nome, i) => { if (!idGrupo(nome)) st.grupos['g' + Date.now().toString(36) + i] = { nome }; });
  // processos do Maestro → Checklist
  const ligados = new Set();
  for (const p of Object.values(processos)) {
    const sei = (p.valores || {}).PROCESSO || '';
    let cid = p.chkId && st.procs[p.chkId] ? p.chkId : Object.keys(st.procs).find(k => sei && st.procs[k].sei === sei);
    if (!cid) {
      if (!sei) continue;
      cid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      st.procs[cid] = { nome: p.nome, tipo: ((p.extraidos || {})._checklist || {}).tipoContratado || 'mei', empresario: false, sei, evento: '', assinatura: '', itens: {}, extras: {}, criadoEm: new Date().toISOString() };
    } else if (!p.chkId && !p.grupo && st.grupos[st.procs[cid].grupo]) p.grupo = st.grupos[st.procs[cid].grupo].nome; // 1ª vez: aproveita o grupo que já tinha no Checklist
    p.chkId = cid; ligados.add(cid);
    const g = (p.grupo && idGrupo(p.grupo)) || '';
    if ((st.procs[cid].grupo || '') !== g) st.procs[cid].grupo = g;
  }
  // processos que só existem no Checklist → entram na lista do Maestro (sem documentos)
  for (const [cid, c] of Object.entries(st.procs)) {
    if (ligados.has(cid) || (!c.sei && c.nome === 'Novo processo' && !Object.values(c.itens || {}).some(o => Object.keys(o).length))) continue; // o vazio de fábrica não conta
    const br = (c.evento || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    processos[c.sei && !processos[c.sei] ? c.sei : 'chk_' + cid] = { nome: c.sei && !(c.nome || '').includes(c.sei) ? `${c.sei} — ${c.nome}` : c.nome || 'Processo do Checklist',
      grupo: (st.grupos[c.grupo] || {}).nome, salvoEm: c.criadoEm || new Date().toISOString(), pasta: '', chkId: cid,
      valores: { ...(c.sei ? { PROCESSO: c.sei } : {}), ...(br ? { EVENTO_DATA: `${br[3]}/${br[2]}/${br[1]}` } : {}) }, editados: [], extraidos: {}, docs: [] };
  }
  if (!st.procs[st.current]) st.current = Object.keys(st.procs)[0] || null;
  if (JSON.stringify([processos, gruposProc]) !== antesMae) { LS.set('gruposProc', gruposProc); LS.set('processos', processos); }
  if (JSON.stringify(st) !== antesChk) {
    try { localStorage.setItem(CHK_KEY, JSON.stringify(st)); } catch { return; }
    const fr = $('#frChecklist'); // o quadro guarda uma cópia na memória: recarrega para não gravar a antiga por cima
    if (fr.src) { fr.addEventListener('load', () => { if (!$('#abaChecklist').hidden) sincronizarChecklist(); }, { once: true }); fr.src = 'checklist.html'; }
  }
}

// Situação de um processo salvo, para o painel da tela inicial: etapa, evento, certidões e pontos de atenção.
// Tudo calculado do que ficou guardado (dados + validade das certidões), sem reler os arquivos.
function resumoProcesso(p) {
  const v = p.valores || {}, conf = Extrator.conferirProcesso(v, p.extraidos || {});
  const temChk = !!(p.extraidos && p.extraidos._checklist);
  const ev = ((v.EVENTO_DATA || '').match(/(\d{2})\/(\d{2})\/(\d{4})/) || []);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = ev.length ? Math.round((new Date(+ev[3], ev[2] - 1, +ev[1]) - hoje) / 864e5) : null;
  const certs = Extrator.situacaoCertidoes((p.docs || []).map(d => ({ ...d, texto: undefined })), v.EVENTO_DATA);
  const vencidas = certs.filter(c => c.status === 'vencida' || c.status === 'antes-evento').length;
  const pagamento = conf.etapa.i >= 10; // despesa confirmada: certidões e evento já não pedem ação
  const pontos = conf.pontos.filter(x => x.nivel !== 'lembrete').length;
  const chips = [
    temChk ? `<span class="chip">${esc(conf.etapa.nome)}</span>` : !(p.docs || []).length && p.chkId ? '<span class="chip" title="Criado no Checklist: abra o .zip deste processo e salve para o Maestro ler os documentos">só no Checklist</span>' : '<span class="chip" title="Salvo numa versão antiga: abra o .zip do processo de novo para ver a etapa">etapa não lida</span>',
    dias === null ? '' : dias < 0 ? `<span class="chip">evento em ${ev[0]}</span>` : `<span class="chip ${dias <= 7 ? 'alerta' : ''}">evento ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : 'em ' + dias + ' dias'}</span>`,
    vencidas && !pagamento ? `<span class="chip erro">${vencidas} certid${vencidas > 1 ? 'ões' : 'ão'} a renovar</span>` : '',
    pontos && !pagamento ? `<span class="chip alerta">${pontos} ponto${pontos > 1 ? 's' : ''} de atenção</span>` : '',
  ].join('');
  // urgência para ordenar: evento futuro mais próximo primeiro; depois os sem data; por último os já realizados
  return { chips, urgencia: dias === null ? 5000 : dias >= 0 ? dias : 10000 - dias };
}
function linhaProc(id) {
  const p = processos[id], [num, ...resto] = p.nome.split(' — ');
  return `<li data-busca="${esc(Extrator.norm(p.nome))}"><button type="button" class="proc ${id === estado.salvoId ? 'atual' : ''}" data-abrir-proc="${esc(id)}">
    <span class="p-nome"><b>${esc(num)}</b><span>${esc(resto.join(' — ') || '—')}</span></span>
    <span class="p-info">${resumoProcesso(p).chips}</span>
    <time title="Salvo em">${new Date(p.salvoEm).toLocaleDateString('pt-BR')}</time></button>
    <button type="button" class="mini" data-excluir-proc="${esc(id)}" title="Excluir da lista de salvos" aria-label="Excluir ${esc(p.nome)} da lista">${ic('lixo')}</button></li>`;
}
function renderProcessos() {
  const ids = Object.keys(processos).sort((a, b) => processos[b].salvoEm.localeCompare(processos[a].salvoEm));
  $('#contProcessos').textContent = ids.length || '';
  // tela inicial: os mais recentes
  $('#recentes').hidden = !ids.length;
  const porUrgencia = [...ids].sort((a, b) => resumoProcesso(processos[a]).urgencia - resumoProcesso(processos[b]).urgencia);
  $('#listaRecentes').innerHTML = porUrgencia.slice(0, 8).map(linhaProc).join('');
  $('#btVerTodos').hidden = ids.length <= 8;
  // gaveta: por grupo
  const semGrupo = ids.filter(id => !gruposProc.includes(processos[id].grupo));
  const secao = (cab, lista, vazio) => `<section>${cab}${lista.length ? `<ul class="lista-proc">${lista.map(linhaProc).join('')}</ul>` : vazio}</section>`;
  $('#listaProcessos').innerHTML = !ids.length && !gruposProc.length
    ? '<p class="grupo-vazio">Nenhum processo salvo ainda. Abra um processo e clique em "Salvar" para ele aparecer aqui.</p>'
    : [...gruposProc].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(g => {
        const i = gruposProc.indexOf(g), doGrupo = ids.filter(id => processos[id].grupo === g);
        return secao(`<div class="grupo-cab"><span>${esc(g)} (${doGrupo.length})</span>
          <button type="button" class="mini neutro" data-renomear="${i}" title="Renomear grupo" aria-label="Renomear grupo ${esc(g)}">${ic('editar')}</button>
          <button type="button" class="mini" data-excluir-grupo="${i}" title="Excluir grupo (os processos ficam, sem grupo)" aria-label="Excluir grupo ${esc(g)}">${ic('lixo')}</button></div>`,
          doGrupo, '<div class="grupo-vazio">Nenhum processo neste grupo. Abra um processo salvo e escolha o grupo no menu ⋯ da barra do processo.</div>');
      }).join('') + (semGrupo.length ? secao(gruposProc.length ? '<div class="grupo-cab"><span>Sem grupo (' + semGrupo.length + ')</span></div>' : '', semGrupo, '') : '');
  filtrarLista('#buscaProcessos', '#listaProcessos li');

  // grupo do processo aberto (menu ⋯ da barra do processo)
  const atual = processos[estado.salvoId];
  $('#selGrupoProc').innerHTML = `<option value="">Sem grupo</option>` + gruposProc.map(g => `<option ${atual && atual.grupo === g ? 'selected' : ''}>${esc(g)}</option>`).join('');
  $('#selGrupoProc').disabled = !atual;
  $('#dicaGrupoProc').textContent = atual ? (gruposProc.length ? '' : 'Crie grupos em "Processos salvos".') : 'Salve o processo para escolher o grupo dele.';
  renderBarra();
}
$('#buscaProcessos').oninput = () => filtrarLista('#buscaProcessos', '#listaProcessos li');
function abrirGaveta(abrir = true) {
  $('#painelProcessos').hidden = $('#fundoGaveta').hidden = !abrir;
  if (abrir) { $('#buscaProcessos').value = ''; unificarChecklist(); renderProcessos(); $('#buscaProcessos').focus(); }
}
$('#btProcessos').onclick = $('#btVerTodos').onclick = () => abrirGaveta();
$('#btFecharProcessos').onclick = $('#fundoGaveta').onclick = () => abrirGaveta(false);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#painelProcessos').hidden && !$('#dlg').open) abrirGaveta(false); });

async function abrirProcesso(id) {
  const p = processos[id]; if (!p) return;
  if (estado.docs.length && estado.salvoId !== id && !processos[estado.salvoId] &&
      !await confirmar(`Abrir "${p.nome}"?`, 'O processo que está na tela ainda não foi salvo e será substituído.', 'Abrir assim mesmo')) return;
  Object.assign(estado, { pasta: p.pasta, valores: { ...p.valores }, editados: new Set(p.editados), extraidos: p.extraidos || {}, feitos: { ...(p.feitos || {}) },
    docs: (p.docs || []).map(d => ({ ...d, texto: undefined })), salvoId: id });
  recalcular(); renderTudo(); renderProcessos();
  abrirGaveta(false); mostrarAba(estado.docs.length ? 'documentos' : 'checklist');
  toast(`Aberto: ${p.nome}`);
}
async function excluirProcesso(id) {
  const p = processos[id];
  if (!p || !await confirmar('Excluir este processo da lista?', `${p.nome}. Sai da lista de processos salvos e do Checklist (o que estava marcado lá se perde); os arquivos do processo não são apagados. Não dá para desfazer.`, 'Excluir', true)) return;
  delete processos[id];
  if (estado.salvoId === id) estado.salvoId = null;
  unificarChecklist({ excluido: { chkId: p.chkId, sei: (p.valores || {}).PROCESSO } });
  LS.set('processos', processos); renderProcessos();
  toast('Processo excluído da lista.');
}
async function cliqueProcessos(e) {
  const abrir = e.target.closest('[data-abrir-proc]'), exc = e.target.closest('[data-excluir-proc]');
  const ren = e.target.closest('[data-renomear]'), excG = e.target.closest('[data-excluir-grupo]');
  if (abrir) return abrirProcesso(abrir.dataset.abrirProc);
  if (exc) return excluirProcesso(exc.dataset.excluirProc);
  if (ren) {
    const i = +ren.dataset.renomear, antigo = gruposProc[i], novo = await perguntar('Renomear grupo', antigo);
    if (!novo || novo === antigo) return;
    if (gruposProc.includes(novo)) return toast('Já existe um grupo com esse nome.');
    gruposProc[i] = novo;
    for (const p of Object.values(processos)) if (p.grupo === antigo) p.grupo = novo;
    salvarGrupos({ renomeado: [antigo, novo] }); toast(`Grupo renomeado para "${novo}".`);
  } else if (excG) {
    const i = +excG.dataset.excluirGrupo, g = gruposProc[i], n = Object.values(processos).filter(p => p.grupo === g).length;
    if (!await confirmar(`Excluir o grupo "${g}"?`, n ? `Os ${n} processo(s) dele não são apagados: ficam em "Sem grupo".` : 'O grupo está vazio.', 'Excluir grupo', true)) return;
    gruposProc.splice(i, 1);
    for (const p of Object.values(processos)) if (p.grupo === g) delete p.grupo;
    salvarGrupos({ grupoExcluido: g }); toast(`Grupo "${g}" excluído; processos mantidos.`);
  }
}
$('#listaProcessos').onclick = $('#listaRecentes').onclick = cliqueProcessos;

// Backup dos processos salvos + grupos (ficam só no navegador; limpar dados do navegador apaga tudo)
$('#btExportarProc').onclick = () => {
  // leva também o Checklist e os modelos que você editou: é o que se usa para passar tudo de um jeito de
  // abrir para outro (ex.: do .bat para o "Abrir Maestro.html", que o navegador guarda em lugar separado)
  const n = Object.keys(processos).length, checklist = JSON.parse(localStorage.getItem(CHK_KEY) || 'null');
  if (!n && !checklist) return toast('Nada salvo para exportar.');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ tipo: 'mlivre-processos', versao: 1, versaoMaestro: VERSAO_MAESTRO, exportadoEm: new Date().toISOString(),
    grupos: gruposProc, processos, checklist, modelos: estado.modelos.filter(m => m.editado), ordemModelos: estado.modelos.map(m => m.id), travas, campos: camposUsuario,
    consulta: JSON.parse(localStorage.getItem(Consulta.CHAVE) || 'null') }, null, 2)], { type: 'application/json' }));
  a.download = `processos-maestro-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  toast(`${n} processo(s) e o Checklist exportados. Guarde o arquivo: ele tem dados dos contratados (CPF, endereço…).`);
};
$('#inImportarProc').onchange = async e => {
  try {
    const dados = JSON.parse(await e.target.files[0].text());
    // aceita também backups feitos quando o programa se chamava "Auto Preencher"
    if (!['mlivre-processos', 'maestro-processos', 'auto-preencher-processos'].includes(dados.tipo) || typeof dados.processos !== 'object') throw new Error('o arquivo não é uma exportação de processos deste programa');
    const ids = Object.keys(dados.processos), repetidos = ids.filter(id => processos[id]);
    if (repetidos.length && !await confirmar(`${repetidos.length} processo(s) já existem aqui`, 'Eles serão substituídos pela versão que está no arquivo.', 'Substituir')) return;
    for (const id of ids) {
      const p = dados.processos[id];
      if (!p || typeof p.valores !== 'object') continue;
      processos[id] = p;
      if (p.grupo && !gruposProc.includes(p.grupo)) gruposProc.push(p.grupo);
    }
    for (const g of dados.grupos || []) if (typeof g === 'string' && !gruposProc.includes(g)) gruposProc.push(g);
    salvarGrupos();
    // Checklist: junta os processos (os do arquivo substituem os de mesmo id); perfis e grupos também
    if (dados.checklist && dados.checklist.procs) {
      const atual = JSON.parse(localStorage.getItem(CHK_KEY) || 'null') || { procs: {} };
      for (const [id, p] of Object.entries(atual.procs)) if (p.nome === 'Novo processo' && !Object.keys(p.itens || {}).length) delete atual.procs[id]; // o vazio de fábrica
      const junto = { ...atual, ...dados.checklist, procs: { ...atual.procs, ...dados.checklist.procs },
        perfis: { ...(atual.perfis || {}), ...(dados.checklist.perfis || {}) }, grupos: { ...(atual.grupos || {}), ...(dados.checklist.grupos || {}) } };
      localStorage.setItem(CHK_KEY, JSON.stringify(junto));
      if ($('#frChecklist').src) $('#frChecklist').src = 'checklist.html'; // recarrega o quadro (por src: funciona aberto do arquivo)
      salvarGrupos(); // junta os processos e grupos que vieram no Checklist
    }
    for (const m of dados.modelos || []) { const i = estado.modelos.findIndex(x => x.id === m.id); i >= 0 ? estado.modelos[i] = m : estado.modelos.push(m); }
    if (dados.ordemModelos) { const pos = id => { const k = dados.ordemModelos.indexOf(id); return k < 0 ? 1e9 : k; };
      estado.modelos.sort((a, b) => pos(a.id) - pos(b.id)); }
    if ((dados.modelos || []).length || dados.ordemModelos) { salvarModelos(); renderModelos(); }
    if (dados.campos) { Object.assign(camposUsuario, { mud: dados.campos.mud || {}, novos: dados.campos.novos || [] }); salvarCampos(); }
    if (dados.travas) { Object.assign(travas, dados.travas); LS.set('travas', travas); recalcular(); renderCampos(); }
    if (dados.consulta) { localStorage.setItem(Consulta.CHAVE, JSON.stringify(dados.consulta)); renderConsulta(); } // as mudanças na Consulta vêm do arquivo
    toast(`${ids.length} processo(s) importado(s).`);
  } catch (err) { toast('Importação falhou: ' + err.message); }
  finally { e.target.value = ''; }
};

$('#btNovoGrupo').onclick = async () => {
  const nome = await perguntar('Novo grupo', '', 'Um nome para reunir processos, por exemplo "Vitrine Cultural 2026".');
  if (!nome) return;
  if (gruposProc.includes(nome)) return toast('Já existe um grupo com esse nome.');
  gruposProc.push(nome);
  const aberto = processos[estado.salvoId];
  if (aberto && !aberto.grupo && await confirmar(`Colocar o processo aberto no grupo "${nome}"?`, aberto.nome, 'Colocar no grupo')) aberto.grupo = nome;
  salvarGrupos(); toast(`Grupo "${nome}" criado.`);
};
$('#selGrupoProc').onchange = e => {
  const p = processos[estado.salvoId]; if (!p) return;
  p.grupo = e.target.value || undefined;
  salvarGrupos(); toast(p.grupo ? `Processo movido para "${p.grupo}".` : 'Processo agora está sem grupo.');
};
$('#btSalvarProc').onclick = () => {
  const v = estado.valores;
  if (!estado.docs.length && !v.PROCESSO && !v.EMPRESA_NOME) return toast('Nada para salvar: abra um processo primeiro.');
  const id = estado.salvoId || v.PROCESSO || estado.pasta || 'p' + Date.now();
  processos[id] = { nome: nomeProcesso(v), grupo: processos[id] && processos[id].grupo, chkId: processos[id] && processos[id].chkId, // salvar de novo não tira do grupo nem solta do Checklist
    salvoEm: new Date().toISOString(), pasta: estado.pasta, valores: { ...v },
    editados: [...estado.editados], extraidos: estado.extraidos, feitos: { ...estado.feitos },
    docs: estado.docs.map(metaDoc) };
  estado.salvoId = id;
  unificarChecklist();
  LS.set('processos', processos); renderProcessos();
  botaoFeito($('#btSalvarProc'), 'Salvo');
  toast(`Processo salvo: ${processos[id].nome}`);
};
// Resumo do processo numa página (menu ⋯ da barra do processo). Sem CPF, RG nem conta bancária: é para conferir e arquivar.
const CAMPOS_RESUMO = ['EMPRESA_NOME', 'CNPJ', 'REP_NOME', 'ARTISTA', 'EVENTO', 'EVENTO_DATA', 'EVENTO_HORARIO', 'EVENTO_LOCAL', 'VALOR', 'CREDENCIAMENTO',
  'NUM_INEX', 'NUM_CONTRATO', 'DATA_ASSINATURA', 'NUM_PRE_EMPENHO', 'NUM_EMPENHO', 'OBJETO_DETALHADO'];
function montarResumo() {
  const v = estado.valores, conf = Extrator.conferirProcesso(v, estado.extraidos);
  const certs = Extrator.situacaoCertidoes(estado.docs, v.EVENTO_DATA);
  const NIVEL = { erro: 'Erro', aviso: 'Confira', lembrete: 'Lembrete' };
  const feitos = estado.modelos.filter(m => estado.feitos[m.id]).map(m => m.nome);
  const lista = (itens, classe = '') => `<ul class="${classe}">${itens.map(i => `<li>${i}</li>`).join('')}</ul>`;
  $('#impressao').innerHTML = `<h1>Processo ${esc(v.PROCESSO || 'sem número')}</h1>
    <p class="sub">${esc([v.EMPRESA_NOME, v.ARTISTA].filter(Boolean).join(' · '))}</p>
    <p class="sub">Resumo gerado pelo Maestro Livre v${VERSAO_MAESTRO} em ${new Date().toLocaleDateString('pt-BR')}. Etapa: <b>${esc(conf.etapa.nome)}</b>${conf.etapa.proxima ? ' · próxima: ' + esc(conf.etapa.proxima) : ''}</p>
    <h2>Dados</h2><table>${CAMPOS_RESUMO.filter(k => (v[k] || '').trim()).map(k => `<tr><th>${esc(ROT_CAMPO(k))}</th><td>${esc(v[k])}</td></tr>`).join('')}</table>
    ${conf.prazos.length ? '<h2>Prazos</h2>' + lista(conf.prazos.map(p => `<b>${esc(p.rotulo)}:</b> ${esc(p.texto)}`)) : ''}
    <h2>Pontos de atenção</h2>${conf.pontos.length ? lista(conf.pontos.map(p => `<span class="${p.nivel === 'erro' ? 'grave' : ''}">${NIVEL[p.nivel]}:</span> ${esc(p.texto)}`)) : '<p>Nenhum.</p>'}
    <h2>Não achei no processo (${conf.faltam.length})</h2>${conf.faltam.length ? lista(conf.faltam.map(esc), 'colunas') : '<p>Nada faltando para esta etapa.</p>'}
    ${certs.length ? '<h2>Certidões e consultas</h2><table>' + certs.map(c => `<tr><th>${esc(c.rotulo)}</th><td class="${['vencida', 'antes-evento'].includes(c.status) ? 'grave' : ''}">${esc(STATUS_CERT[c.status][1](c))}</td></tr>`).join('') + '</table>' : ''}
    ${feitos.length ? '<h2>Documentos marcados como feitos</h2>' + lista(feitos.map(esc), 'colunas') : ''}`;
}
$('#btResumo').onclick = () => {
  if (!estado.docs.length && !estado.valores.PROCESSO) return toast('Abra um processo primeiro.');
  montarResumo(); $('#btResumo').closest('details').open = false; window.print();
};
$('#btNovo').onclick = async () => {
  const salvo = processos[estado.salvoId];
  if (!await confirmar('Começar outro processo?', salvo ? 'A tela é limpa. O processo salvo continua na lista.' : 'A tela é limpa. Este processo ainda não foi salvo: o que está aqui se perde.', 'Limpar a tela', !salvo)) return;
  novoProcesso(); mostrarAba('arquivos');
};

$('#listaDocs').addEventListener('change', e => {
  const i = e.target.dataset.doc;
  if (i == null) return;
  estado.docs[i].tipoForcado = e.target.value;
  extrair();
});

// Edição de um dado (tela Dados ou painel da tela Documentos: os dois formulários se espelham)
$('#campos').addEventListener('change', e => { if (e.target.dataset.trava) alternarTrava(e.target.dataset.trava, e.target.checked); });
function aoEditarCampo(e) {
  const k = e.target.name; if (!k || e.target.readOnly) return;
  estado.valores[k] = e.target.value;
  estado.editados.add(k);
  if (['CONTEXTO_EVENTO', 'RESULTADOS'].includes(k) && estado.valores.EVENTO) {
    (memoriaEventos[Extrator.norm(estado.valores.EVENTO)] ||= {})[k] = e.target.value;
    LS.set('eventos', memoriaEventos);
  }
  recalcular();
  // Atualiza derivados (e o mesmo campo no outro formulário) sem redesenhar onde o usuário está digitando
  for (const form of [$('#campos'), $('#camposDoc')]) for (const el of form.elements)
    if (el !== e.target && el.name && el.value !== (estado.valores[el.name] || '')) {
      el.value = estado.valores[el.name] || '';
      el.closest('.campo')?.classList.toggle('vazio', !el.value);
    }
  for (const box of document.querySelectorAll(`.campo[data-k="${k}"]`)) {
    box.classList.toggle('vazio', !e.target.value);
    box.removeAttribute('data-alerta');
    box.querySelectorAll('.fonte').forEach(f => f.remove());
    box.insertAdjacentHTML('beforeend', rotEditado(k));
  }
  renderModelos();
  if (k === 'EVENTO_DATA') renderCertidoes(); // "vence antes do evento" depende da data do evento
  else renderBarra();
}
$('#campos').addEventListener('input', aoEditarCampo);
$('#campos').addEventListener('click', desfazerEdicao);
// Arquivo de onde veio um dado (ou que traz outro valor): abre na tela Arquivos, com o valor marcado no texto lido (v5.0.1)
function irParaArquivo(nome, valor) {
  mostrarAba('arquivos');
  $('#buscaDocs').value = ''; filtrarLista('#buscaDocs', '#listaDocs > li');
  const li = [...document.querySelectorAll('#listaDocs > li')].find(x => x.dataset.arq === nome);
  if (!li) return toast('Esse arquivo não está mais na lista.');
  const det = li.querySelector('details'); det.open = true;
  const pre = det.querySelector('pre'), txt = pre ? pre.textContent : '', i = valor ? Extrator.norm(txt).indexOf(Extrator.norm(valor)) : -1;
  // norm não muda o tamanho do texto (só tira acento e põe em minúsculas): a posição vale para o texto original
  if (pre && i >= 0 && Extrator.norm(txt).length === txt.length) pre.innerHTML = esc(txt.slice(0, i)) + '<mark>' + esc(txt.slice(i, i + valor.length)) + '</mark>' + esc(txt.slice(i + valor.length));
  document.querySelectorAll('#listaDocs > li.destaque').forEach(x => x.classList.remove('destaque')); void li.offsetWidth; li.classList.add('destaque');
  requestAnimationFrame(() => { rolarAte(li); const mk = pre && pre.querySelector('mark'); if (mk) pre.scrollTop = mk.offsetTop - pre.clientHeight / 2; });
}
for (const form of [$('#campos'), $('#camposDoc')]) form.addEventListener('click', e => { const b = e.target.closest('[data-arquivo]'); if (b) { e.preventDefault(); irParaArquivo(b.dataset.arquivo, b.dataset.valor); } });
$('#camposDoc').addEventListener('click', desfazerEdicao);
$('#camposDoc').addEventListener('input', aoEditarCampo);

$('#abasModelos').onclick = e => {
  if (e.target.closest('#btOrdem')) { reordenando = !reordenando; renderModelos(); $('#btOrdem').focus(); return; }
  const mv = e.target.closest('[data-mover]'); if (mv) return moverModelo(mv.dataset.mover, +mv.dataset.dir);
  const b = e.target.closest('[data-modelo]'); if (!b) return;
  estado.modeloAtual = b.dataset.modelo; salvarModelos(); fecharEditor(); renderCampos(); renderModelos(); guiarPainel();
  $('.mesa').scrollTop = 0;
};
$('#btFeito').onclick = () => {
  const id = modeloAtual().id;
  if (estado.feitos[id]) delete estado.feitos[id]; else estado.feitos[id] = true;
  salvarProcesso(); renderModelos();
};
// Próximo documento ainda não resolvido (nem marcado como feito, nem já no processo), na ordem da lista
$('#btProximo').onclick = () => {
  const { sei, desp, ext } = modelosPorGrupo(), lista = [...sei, ...desp, ...ext];
  const achados = (estado.extraidos._checklist || {}).achados || {}, cred = (estado.valores.CREDENCIAMENTO || '').trim();
  const pendente = m => !estado.feitos[m.id] && !achados[MODELO_ITEM[m.id]] && !(cred && NAO_SE_APLICA_CRED.has(m.id));
  const i = lista.findIndex(m => m.id === modeloAtual().id);
  const prox = [...lista.slice(i + 1), ...lista.slice(0, i)].find(pendente);
  if (!prox) return toast('Não há outro documento pendente neste processo.');
  estado.modeloAtual = prox.id; salvarModelos(); fecharEditor(); renderCampos(); renderModelos(); guiarPainel(); $('.mesa').scrollTop = 0;
};
$('#btCopiar').onclick = () => copiar(false);
$('#btCopiarFonte').onclick = () => copiar(true);
$('#btEditar').onclick = () => abrirEditor(modeloAtual());
$('#btNovoModelo').onclick = () => {
  const m = { id: 'm' + Date.now(), nome: 'Novo modelo', grupo: modeloAtual().grupo, html: '<p class="Texto_Corpo_11_Justificado_Recuo_Primeira_Linha">Cole aqui o texto do SEI…</p>' };
  estado.modelos.push(m); estado.modeloAtual = m.id; salvarModelos(); renderCampos(); renderModelos(); abrirEditor(m);
};
$('#btDuplicar').onclick = () => {
  const m = { ...modeloAtual(), id: 'm' + Date.now(), nome: modeloAtual().nome + ' (cópia)' };
  estado.modelos.push(m); estado.modeloAtual = m.id; salvarModelos(); renderCampos(); renderModelos();
  toast(`Criado "${m.nome}".`);
};
$('#btExcluir').onclick = async () => {
  if (estado.modelos.length < 2) return toast('Precisa sobrar pelo menos um modelo.');
  if (!await confirmar(`Excluir o modelo "${modeloAtual().nome}"?`, 'Modelos de fábrica voltam com "Restaurar modelos de fábrica".', 'Excluir', true)) return;
  estado.modelos = estado.modelos.filter(m => m.id !== modeloAtual().id);
  estado.modeloAtual = estado.modelos[0].id; salvarModelos(); fecharEditor(); renderTudo();
};
$('#btRestaurar').onclick = async () => {
  if (!await confirmar('Restaurar os modelos de fábrica?', 'Os modelos que você criou continuam. Os de fábrica voltam ao original (o que você mudou neles se perde).', 'Restaurar')) return;
  const ids = new Set(MODELOS_PADRAO.map(m => m.id));
  estado.modelos = [...structuredClone(MODELOS_PADRAO), ...estado.modelos.filter(m => !ids.has(m.id))];
  salvarModelos(); renderTudo();
};
$('#btExportar').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(estado.modelos, null, 2)], { type: 'application/json' }));
  a.download = 'modelos-maestro.json'; a.click();
};
$('#inImportar').onchange = async e => {
  try {
    const lista = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(lista) || !lista.every(m => m.id && m.nome && typeof m.html === 'string')) throw new Error('arquivo não é uma lista de modelos');
    // importado = versão sua: m.editado impede que atualizações do programa sobrescrevam
    for (const m of lista) { m.html = limparHTML(m.html); m.editado = true; const i = estado.modelos.findIndex(x => x.id === m.id); i >= 0 ? estado.modelos[i] = m : estado.modelos.push(m); }
    salvarModelos(); renderTudo(); toast(`${lista.length} modelo(s) importado(s).`);
  } catch (err) { toast('Importação falhou: ' + err.message); }
  e.target.value = '';
};

$('#chips').onclick = e => { const k = e.target.dataset.chip; if (k) inserirNoCursor(`{{${k}}}`); };
$('#edCorpo').addEventListener('input', () => { $('#edHtml').value = $('#edCorpo').innerHTML; });
$('#edHtml').addEventListener('input', () => { $('#edCorpo').innerHTML = $('#edHtml').value; });
$('#btSalvarModelo').onclick = () => {
  const m = estado.modelos.find(x => x.id === editandoId);
  m.nome = $('#edNome').value.trim() || 'Sem nome';
  m.grupo = $('#edGrupo').value === 'sei' ? undefined : $('#edGrupo').value;
  m.editado = true; // a partir daqui, atualizações do programa não mexem neste modelo
  m.html = limparHTML($('#edCorpo').innerHTML);
  salvarModelos(); fecharEditor(); renderTudo(); toast('Modelo salvo.');
};
$('#btCancelar').onclick = fecharEditor;

// ─── Larguras da tela Documentos (arrastar a divisa; duplo clique volta ao padrão) ──
// --c1 = lista de modelos (esquerda) · --c2 = dados do documento (direita, cresce para a esquerda)
(function colunas() {
  const vista = $('#vDocumentos'), larg = LS.get('colunas2', {});
  const aplicar = () => ['1', '2'].forEach(c => larg[c] ? vista.style.setProperty('--c' + c, larg[c] + 'px') : vista.style.removeProperty('--c' + c));
  aplicar();
  document.querySelectorAll('.divisa').forEach(div => {
    const col = div.dataset.col, alvo = col === '1' ? div.previousElementSibling : div.nextElementSibling, sinal = col === '1' ? 1 : -1;
    div.addEventListener('pointerdown', e => {
      e.preventDefault(); div.setPointerCapture(e.pointerId); div.classList.add('arrastando');
      const x0 = e.clientX, w0 = alvo.getBoundingClientRect().width;
      div.onpointermove = ev => { larg[col] = Math.min(640, Math.max(180, Math.round(w0 + sinal * (ev.clientX - x0)))); aplicar(); };
      div.onpointerup = () => { div.onpointermove = div.onpointerup = null; div.classList.remove('arrastando'); LS.set('colunas2', larg); };
    });
    div.addEventListener('dblclick', () => { delete larg[col]; aplicar(); LS.set('colunas2', larg); });
  });
})();

// ─── Checklist ─────────────────────────────────────────────
// O Checklist de Inexigibilidade (checklist.html) roda num quadro. Ao abrir a tela, o Maestro manda o
// processo atual: nº SEI (acha ou cria o processo lá), tipo de contratado, datas e os itens cujos
// documentos achou na pasta, com nº SEI e validade. Itens que você criou no Checklist entram na
// varredura pelas palavras do nome (ver itensCriados). Nunca desmarca nada lá.
const ISO = d => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(d || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
// ponytail: item criado à mão casa se TODAS as palavras significativas (até 3) do nome aparecem no nome
// do arquivo ou no começo do texto; regra por item (editável) se isso errar muito
const PALAVRA_VAZIA = new Set(['para', 'pelo', 'pela', 'com', 'dos', 'das', 'documento', 'processo', 'assinado', 'assinada']);
function itensCriados(itens) {
  const achados = {};
  for (const it of itens.filter(i => i.custom)) {
    const ps = Extrator.norm(it.text).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !PALAVRA_VAZIA.has(w)).slice(0, 3);
    if (!ps.length) continue;
    const doc = estado.docs.find(d => { const alvo = Extrator.norm(d.nome + ' ' + (d.texto || '').slice(0, 400)); return ps.every(w => alvo.includes(w)); });
    const n = doc && (doc.nome.match(/(?:^|[\]\-_ ])(\d{8})_/) || [])[1];
    if (doc) achados[it.id] = { sei: n || '' };
  }
  return achados;
}
// Conversa com o quadro por mensagens (aberto direto do arquivo, acessar o quadro direto é bloqueado)
let chkSeq = 0; const chkEspera = {};
window.addEventListener('message', e => {
  const m = e.data;
  if (m && m.para === 'maestro' && e.source === $('#frChecklist').contentWindow && chkEspera[m.id]) { chkEspera[m.id](m.resposta); delete chkEspera[m.id]; }
});
const pedirChecklist = (acao, extra) => new Promise(ok => {
  const id = ++chkSeq; chkEspera[id] = ok;
  $('#frChecklist').contentWindow.postMessage({ para: 'checklist', id, acao, ...extra }, '*');
});
async function sincronizarChecklist() {
  if (!$('#frChecklist').src) return;
  const v = estado.valores, chk = estado.extraidos._checklist || {}, chkId = (processos[estado.salvoId] || {}).chkId;
  if (!v.PROCESSO && !chkId) { $('#chkStatus').textContent = 'Este processo ainda não tem nº do processo SEI: abra o processo (ou preencha o número na tela Dados) para o Checklist acompanhar. Abaixo está o último processo do Checklist.'; return; }
  const achados = { ...(chk.achados || {}), ...itensCriados(await pedirChecklist('itens', { sei: v.PROCESSO, chkId })) };
  const nome = (processos[estado.salvoId] && processos[estado.salvoId].nome) || v.ARTISTA || v.EMPRESA_NOME || v.PROCESSO;
  const r = await pedirChecklist('sincronizar', { dados: { id: chkId, sei: v.PROCESSO, nome, tipo: chk.tipoContratado, empresario: chk.empresario,
    evento: (v.EVENTO_DATA || '').match(/\d{2}\/\d{2}\/\d{4}/)?.[0], assinatura: v.DATA_ASSINATURA, achados } });
  const n = Object.keys(achados).length;
  $('#chkStatus').textContent = `Processo ${v.PROCESSO || ''} ${r.novo ? '(criado agora no Checklist) ' : ''}· ${n} item(ns) com documento no processo` +
    (r.marcados ? ` · ${r.marcados} marcado(s) agora` : ' · nada novo para marcar') + '. O que você marcar à mão aqui não é desfeito.';
}

// ─── Telas ─────────────────────────────────────────────────
const TELAS = ['arquivos', 'dados', 'documentos', 'checklist', 'consulta', 'config'];
function mostrarAba(aba) {
  if (!TELAS.includes(aba)) aba = 'documentos'; // 'maestro' = nome antigo (interface 1)
  document.querySelectorAll('#abasApp [data-aba]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
  document.querySelectorAll('main > [data-vista]').forEach(s => { s.hidden = s.dataset.vista !== aba; });
  $('#btConfig').setAttribute('aria-pressed', String(aba === 'config'));
  if (aba === 'config') renderConfig(); else LS.set('aba', aba);
  if (aba === 'documentos') guiarPainel();
  if (aba === 'consulta') renderConsulta(); // Configurações não vira a tela de reabertura
  if (aba !== 'checklist') return;
  const fr = $('#frChecklist');
  if (!fr.src) { fr.addEventListener('load', sincronizarChecklist, { once: true }); fr.src = 'checklist.html'; }
  else sincronizarChecklist();
}
// ─── Consulta: legislação e links (consulta.js guarda as mudanças à parte das de fábrica) ───
let consAba = null, consEditando = false;
function renderConsulta() {
  const abas = Consulta.lista(), q = Extrator.norm($('#consBusca').value.trim());
  if (!abas.some(a => a.id === consAba)) consAba = (abas[0] || {}).id;
  const aba = abas.find(a => a.id === consAba);
  const linha = (it, rotAba) => `<li><div><strong>${esc(it.t)}</strong>${rotAba ? `<span class="tag">${esc(rotAba)}</span>` : ''}${it.d ? `<p>${esc(it.d)}</p>` : ''}</div>
    <div class="acoes">${(it.l || []).filter(l => /^https?:\/\//i.test(l[1])).map(l => `<a class="btn" href="${esc(l[1])}" target="_blank" rel="noopener noreferrer" title="Abre numa aba nova">${esc(l[0])}</a>`).join('')}
      ${consEditando ? `<button type="button" class="btn ico" data-cons-editar="${esc(it.id)}" title="Editar" aria-label="Editar ${esc(it.t)}">${ic('editar')}</button>
        <button type="button" class="btn ico" data-cons-excluir="${esc(it.id)}" title="Excluir" aria-label="Excluir ${esc(it.t)}">${ic('lixo')}</button>` : ''}</div></li>`;
  $('#consEditar').setAttribute('aria-pressed', String(consEditando));
  $('#consEditar span').textContent = consEditando ? 'Concluir edição' : 'Editar a lista';
  if (q) { // busca em todas as abas
    const achados = abas.flatMap(a => a.items.filter(it => Extrator.norm(it.t + ' ' + (it.d || '')).includes(q)).map(it => linha(it, a.label)));
    $('#consAbas').hidden = $('#consAcoes').hidden = true;
    $('#consLista').innerHTML = `<li class="sem">${achados.length ? `${achados.length} resultado${achados.length > 1 ? 's' : ''} em todas as abas` : 'Nada com esse texto.'}</li>` + achados.join('');
    return;
  }
  $('#consAbas').hidden = false;
  $('#consAbas').innerHTML = abas.map(a => `<button type="button" role="tab" data-cons-aba="${esc(a.id)}" aria-selected="${a.id === consAba}">${esc(a.label)} <span class="cont">${a.items.length}</span></button>`).join('') +
    (consEditando ? `<button type="button" data-cons-nova-aba>${ic('mais')}Nova aba</button>` : '');
  $('#consAcoes').hidden = !consEditando;
  $('#consAcoes').innerHTML = !aba ? '' : `<button type="button" class="btn primario" data-cons-novo>${ic('mais')}Adicionar em "${esc(aba.label)}"</button>
    <button type="button" class="btn" data-cons-renomear>${ic('editar')}Renomear a aba</button>
    <button type="button" class="btn" data-cons-excluir-aba>${ic('lixo')}Excluir a aba</button>
    ${Consulta.mudou() ? `<button type="button" class="btn" data-cons-restaurar title="Desfaz todas as suas mudanças na Consulta">${ic('reler')}Voltar à lista original</button>` : ''}`;
  $('#consLista').innerHTML = aba && aba.items.length ? aba.items.map(it => linha(it)).join('') : '<li class="sem">Aba vazia. Use "Editar a lista" para adicionar.</li>';
}
const camposCons = it => [{ rot: 'Título', valor: it ? it.t : '' }, { rot: 'Descrição (para que serve, artigos que importam)', valor: it ? it.d : '', longo: true, linhas: 3 },
  { rot: 'Links, um por linha, assim: Nome | endereço', valor: it ? Consulta.linksTxt(it.l) : '', longo: true, linhas: 3 }];
const itemCons = r => ({ t: r[0], d: r[1], l: Consulta.linksDe(r[2]) });
$('#consBusca').oninput = renderConsulta;
$('#consEditar').onclick = () => { consEditando = !consEditando; renderConsulta(); };
$('#vConsulta').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset, achar = id => Consulta.lista().flatMap(a => a.items).find(x => x.id === id), aba = () => Consulta.lista().find(a => a.id === consAba);
  if (d.consAba) consAba = d.consAba;
  else if ('consNovaAba' in d) { const n = await perguntar('Nova aba', '', 'Nome da aba (ex.: Modelos, Contatos, Pareceres).'); if (!n) return; consAba = Consulta.novaAba(n); }
  else if ('consRenomear' in d) { const n = await perguntar('Renomear a aba', aba().label); if (!n) return; Consulta.renomearAba(consAba, n); }
  else if ('consExcluirAba' in d) { const a = aba(); if (!await confirmar(`Excluir a aba "${a.label}"?`, `Ela e os ${a.items.length} materiais dela saem da sua lista. "Voltar à lista original" desfaz.`, 'Excluir a aba', true)) return; Consulta.excluirAba(a.id); }
  else if ('consNovo' in d) { const r = await dialogo({ titulo: `Adicionar em "${aba().label}"`, campos: camposCons(), ok: 'Adicionar' }); if (!r || !r[0]) return; Consulta.novoItem(consAba, itemCons(r)); toast('Adicionado à Consulta.'); }
  else if (d.consEditar) { const r = await dialogo({ titulo: 'Editar material de consulta', campos: camposCons(achar(d.consEditar)), ok: 'Salvar' }); if (!r || !r[0]) return; Consulta.editarItem(d.consEditar, itemCons(r)); toast('Salvo.'); }
  else if (d.consExcluir) { const it = achar(d.consExcluir); if (!await confirmar('Excluir da consulta?', `"${it.t}" sai da sua lista.`, 'Excluir', true)) return; Consulta.excluirItem(it.id); }
  else if ('consRestaurar' in d) { if (!await confirmar('Voltar à lista original?', 'Tudo o que você incluiu, mudou ou excluiu na Consulta é desfeito.', 'Voltar à original', true)) return; Consulta.restaurar(); toast('A Consulta voltou à lista original.'); }
  else return;
  renderConsulta();
});

// ─── Configurações: tema e aparência (tema.js grava e aplica no <html>) ───
// nomes na tela (v5.0.3, pedido do usuário): classico = Abertura, caderno = Câmara, didatico = Ensaio; os ids não mudam (preferência salva)
const TEMAS = [
  ['classico', 'Abertura', 'O visual de sempre: abas no alto, papel claro e verde.', 'alto', '--l:#2f5d4f;--f:#f3f1ec;--a:#2f5d4f;--t:#dcd6ca', true],
  ['caderno', 'Câmara', 'Calmo e neutro: coluna lateral clara, poucas caixas, o documento em destaque.', '', '--l:#f0f0ec;--f:#fff;--a:#2f5d4f;--t:#dcdcd6', true],
  ['partitura', 'Partitura', 'Coluna azul-noite, luz âmbar e títulos com caráter. A folha é a protagonista.', '', '--l:#141829;--f:#f2f3f7;--a:#e9a530;--t:#cdd2e0', true],
  ['didatico', 'Ensaio', 'Maior e mais explicado: passos numerados e dicas para quem está começando.', '', '--l:#fff;--f:#eef0f6;--a:#2553c9;--t:#ccd2df', true]];
function renderConfig() {
  const c = MaestroTema.ler();
  $('#cfgTemas').innerHTML = TEMAS.map(([id, nome, desc, cls, cores, pronto]) => `<button type="button" role="radio" data-tema="${id}" aria-checked="${c.tema === id}" ${pronto ? '' : 'disabled'}>
    <span class="tema-mini ${cls}" style="${cores}" aria-hidden="true"><i></i><b></b><b></b><b></b></span><strong>${nome}</strong><small>${desc}</small>${pronto ? '' : '<span class="breve">em preparação</span>'}</button>`).join('');
  document.querySelectorAll('#cfgModo [data-modo]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.modo === c.modo)));
  renderCamposCfg();
}
const COMO_ACHAR = [['manual', 'Preencher à mão'], ['sei', 'Nº SEI do documento cujo nome tem uma palavra'],
  ['rotulo', 'Texto que vem depois de um rótulo'], ['formato', 'Primeiro CPF, CNPJ, data, valor ou e-mail encontrado']];
const FORMATOS_CAMPO = [['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['data', 'Data'], ['valor', 'Valor (R$)'], ['email', 'E-mail']];
const regraTexto = r => { r = r || {}; const em = r.arquivo ? ` em "${r.arquivo}"` : '';
  return r.tipo === 'sei' ? `nº SEI do arquivo com "${r.arquivo}"` : r.tipo === 'rotulo' ? `texto depois de "${r.rotulo}"${em}`
    : r.tipo === 'formato' ? `primeiro ${(FORMATOS_CAMPO.find(f => f[0] === r.formato) || ['', 'dado'])[1]}${em}` : 'preenchido à mão'; };
function renderCamposCfg() {
  const grupos = {};
  for (const c of CAMPOS) (grupos[c[2]] ||= []).push(c);
  $('#cfgCampos').innerHTML = Object.entries(grupos).map(([g, cs]) => `<details class="cfg-grupo"${cs.some(c => c[5]) ? ' open' : ''}>
    <summary>${esc(g)} <span class="cont">${cs.length}</span></summary><ul>${cs.map(c => { const novo = camposUsuario.novos.find(n => n.k === c[0]);
      return `<li class="${c[4] ? 'oculto' : ''}"><span class="cc-nome">${esc(c[1])}<code>{{${c[0]}}}</code>${novo ? `<small>${esc(regraTexto(novo.regra))}</small>` : c[4] ? '<small>escondido na tela Dados</small>' : ''}</span>
        <button type="button" class="btn" data-campo-editar="${c[0]}">Editar</button>
        ${novo ? `<button type="button" class="btn" data-campo-excluir="${c[0]}">Excluir</button>`
          : `<button type="button" class="btn" data-campo-ocultar="${c[0]}">${c[4] ? 'Mostrar' : 'Esconder'}</button>`}</li>`; }).join('')}</ul></details>`).join('');
}
async function editarCampo(k) {
  const fab = k && CAMPOS_FABRICA.find(c => c[0] === k), novo = k && camposUsuario.novos.find(n => n.k === k), atual = k && CAMPOS.find(c => c[0] === k);
  const base = [{ rot: 'Nome na tela', valor: atual ? atual[1] : '' }, { rot: 'Categoria', valor: atual ? atual[2] : 'Meus campos' }];
  if (fab) {
    const r = await dialogo({ titulo: 'Editar campo', texto: `Código nos modelos: {{${k}}}. O jeito de achar este campo é o do programa.`, ok: 'Salvar', campos: base });
    if (!r) return;
    camposUsuario.mud[k] = { ...camposUsuario.mud[k], rot: r[0] && r[0] !== fab[1] ? r[0] : undefined, cat: r[1] && r[1] !== fab[2] ? r[1] : undefined };
    return salvarCampos();
  }
  const rg = (novo && novo.regra) || { tipo: 'manual' };
  const r = await dialogo({ titulo: novo ? 'Editar campo' : 'Novo campo', ok: novo ? 'Salvar' : 'Criar',
    texto: novo ? `Código nos modelos: {{${k}}}` : 'Depois de criado, o campo aparece na tela Dados. Para ele entrar num documento, escreva o código dele no modelo.',
    campos: [...base, { rot: 'Como achar', opcoes: COMO_ACHAR, valor: rg.tipo }, { rot: 'Palavra no nome do arquivo (ex.: Parecer)', valor: rg.arquivo || '' },
      { rot: 'Rótulo, para "texto depois de um rótulo" (ex.: Matrícula:)', valor: rg.rotulo || '' }, { rot: 'Formato, para "primeiro … encontrado"', opcoes: FORMATOS_CAMPO, valor: rg.formato || 'cpf' }] });
  if (!r) return;
  const [rot, cat, tipo, arquivo, rotulo, formato] = r;
  if (!rot) return toast('Dê um nome ao campo.');
  if (tipo === 'sei' && !arquivo) return toast('Para o nº SEI, diga uma palavra do nome do arquivo.');
  if (tipo === 'rotulo' && !rotulo) return toast('Diga o rótulo que vem antes do valor.');
  const regra = { tipo, arquivo, rotulo, formato };
  if (novo) Object.assign(novo, { rot, cat: cat || 'Meus campos', regra });
  else {
    let k2 = Extrator.norm(rot).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'CAMPO';
    while (CAMPOS.some(c => c[0] === k2)) k2 += '_2';
    camposUsuario.novos.push({ k: k2, rot, cat: cat || 'Meus campos', regra });
    toast(`Campo criado. Nos modelos, use {{${k2}}}. Ele é procurado na próxima leitura da pasta.`);
  }
  salvarCampos();
}
$('#btNovoCampo').onclick = () => editarCampo('');
$('#cfgCampos').onclick = async e => {
  const ed = e.target.closest('[data-campo-editar]'), ex = e.target.closest('[data-campo-excluir]'), oc = e.target.closest('[data-campo-ocultar]');
  if (ed) return editarCampo(ed.dataset.campoEditar);
  if (oc) { const k = oc.dataset.campoOcultar; camposUsuario.mud[k] = { ...camposUsuario.mud[k], oculto: !(camposUsuario.mud[k] || {}).oculto }; return salvarCampos(); }
  if (ex) { const k = ex.dataset.campoExcluir;
    if (!await confirmar('Excluir o campo?', `O código {{${k}}} deixa de ser procurado. Se algum modelo usar esse código, ele continua aparecendo no grupo "Outros".`, 'Excluir', true)) return;
    camposUsuario.novos = camposUsuario.novos.filter(n => n.k !== k); salvarCampos(); }
};
$('#cfgTemas').onclick = e => { const b = e.target.closest('[data-tema]'); if (b && !b.disabled) { MaestroTema.gravar({ tema: b.dataset.tema }); renderConfig(); renderCampos(); abrirPainel(false); } };
$('#cfgModo').onclick = e => { const b = e.target.closest('[data-modo]'); if (b) { MaestroTema.gravar({ modo: b.dataset.modo }); renderConfig(); } };
$('#btConfig').onclick = () => mostrarAba($('#btConfig').getAttribute('aria-pressed') === 'true' ? LS.get('aba', 'arquivos') : 'config');
$('#abasApp').addEventListener('click', e => { const b = e.target.closest('[data-aba]'); if (b) mostrarAba(b.dataset.aba); });

// ─── Início: retoma o último processo aberto ───────────────
(function iniciar() {
  $('#versao').textContent = 'v' + VERSAO_MAESTRO;
  document.title = `Maestro Livre v${VERSAO_MAESTRO}`;
  const p = LS.get('processo', null);
  if (p) Object.assign(estado, { salvoId: p.salvoId || null, pasta: p.pasta, valores: p.valores || {}, editados: new Set(p.editados || []), feitos: p.feitos || {},
    extraidos: p.extraidos || {}, docs: (p.docs || []).map(d => ({ ...d, texto: undefined })) });
  unificarChecklist();
  recalcular(); renderTudo(); renderProcessos();
  mostrarAba(estado.docs.length ? LS.get('aba', 'documentos') : 'arquivos'); // sem processo: tela de abrir
})();
