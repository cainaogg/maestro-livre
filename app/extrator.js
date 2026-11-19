// ============================================================
// Extrator — acha os campos nos documentos usando só regras (sem IA).
// Roda no navegador (index.html) e no Node (teste.js).
//
// Entrada de cada documento: { nome, texto, itens? }
//   itens = pedaços de texto do pdf.js com posição {str,x,y,pag}; só
//   existem em PDF com texto. O cartão CNPJ usa a posição (valor fica
//   logo abaixo do rótulo), que é muito mais confiável que o texto corrido.
// ============================================================
(function (root) {

  const semAcento = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = s => semAcento(s).toLowerCase();
  const limpa = s => (s || '').replace(/\s+/g, ' ').trim();
  const MESES = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  // CNPJ do órgão contratante (campo ORGAO_CNPJ). A tela chama Extrator.definirOrgao() antes de ler a pasta.
  // Vazio: nenhum CNPJ é tratado como "do órgão" (a NF da despesa é reconhecida pela data e pelo valor).
  let CNPJ_ORGAO = '';
  // arquivo do contrato assinado: "[51]-41000020_Contrato.pdf", "…_Contrato_Assinado.pdf", "…_Contrato_Registrado_….html", "…_Contrato_120_2026.pdf"
  const RE_CONTRATO = /(?:^|\d{8}_)contrato(?:_registrado|_assinado|_n?[o°º]?_?\d|\.\w+$)/;
  const ehContrato = nome => RE_CONTRATO.test(norm(nome).replace(/[ -]+/g, '_'));
  const definirOrgao = cnpj => { CNPJ_ORGAO = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(cnpj || '') ? cnpj.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)[0] : ''; };

  // ─── Texto ─────────────────────────────────────────────────
  // Junta os itens do pdf.js em linhas (mesmo y = mesma linha).
  // ponytail: busca linear por linha, O(n²); cartões e propostas têm poucas centenas de itens.
  function itensParaTexto(itens) {
    const linhas = [];
    for (const it of itens) {
      if (!it.str.trim()) continue;
      let l = linhas.find(l => l.pag === it.pag && Math.abs(l.y - it.y) < 3);
      if (!l) linhas.push(l = { pag: it.pag, y: it.y, its: [] });
      l.its.push(it);
    }
    linhas.sort((a, b) => a.pag - b.pag || b.y - a.y);
    // pdf.js às vezes parte uma palavra em dois itens colados ("ALM"+"ADA"); só põe espaço se houver vão
    return linhas.map(l => limpa(l.its.sort((a, b) => a.x - b.x).map((i, k, arr) => {
      const ant = arr[k - 1];
      const colado = ant && ant.w != null && i.x - (ant.x + ant.w) < 1 && !/\s$/.test(ant.str);
      return (k && !colado ? ' ' : '') + i.str;
    }).join(''))).join('\n');
  }

  // Título com caixa mista: "EST CHACARA DO BANCO" → "Est Chacara do Banco"
  const MINUSC = new Set(['de','da','do','das','dos','e','em','na','no']);
  function titulo(s) {
    return limpa(s).toLowerCase().split(' ').map((p, i) =>
      i > 0 && MINUSC.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  const ABREV = { est: 'Estrada', r: 'Rua', rua: 'Rua', av: 'Avenida', avenida: 'Avenida', tv: 'Travessa',
    al: 'Alameda', pc: 'Praça', pca: 'Praça', praca: 'Praça', rod: 'Rodovia', bc: 'Beco', lgo: 'Largo', estr: 'Estrada' };
  function logradouro(s) {
    const t = titulo(s);
    const [p1, ...resto] = t.split(' ');
    const ext = ABREV[norm(p1).replace('.', '')];
    return ext ? [ext, ...resto].join(' ') : t;
  }

  // ─── Formatações ──────────────────────────────────────────
  const soDigitos = s => (s || '').replace(/\D/g, '');
  function formataCPF(s) {
    const d = soDigitos(s);
    return d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : limpa(s);
  }
  // Padrão LGPD comum na administração pública: ***.***.830-** (mostra só os dígitos 7 a 9)
  // Aceita qualquer jeito de mascarar ("XXX.XXX.810-XX", "***.***810-**") e devolve sempre ***.***.810-**
  const RE_CPF_MASC = /[*X]{3}\.?[*X]{3}\.?(\d{3})\s?[-–]?\s?[*X]{2}/gi;
  function mascaraCPF(s) {
    const m = new RegExp(RE_CPF_MASC.source, 'i').exec(s || '');
    if (m) return `***.***.${m[1]}-**`;
    const d = soDigitos(s);
    return d.length === 11 ? `***.***.${d.slice(6,9)}-**` : '';
  }
  // CPF achado num documento: completo fica completo (coluna 2), mascarado fica no padrão ***.***.xxx-**
  const cpfNorm = s => /[*X]/i.test(s) ? mascaraCPF(s) : formataCPF(s);
  // Proteção LGPD ao preencher modelo: todo CPF dentro de um texto sai mascarado nesse padrão.
  const protegeCPFs = s => String(s)
    .replace(RE_CPF_MASC, (_, d) => `***.***.${d}-**`)
    .replace(/\b\d{3}\.\d{3}\.(\d{3})-\d{2}\b/g, (_, d) => `***.***.${d}-**`);
  function formataCEP(s) {
    const d = soDigitos(s);
    return d.length === 8 ? `${d.slice(0,2)}.${d.slice(2,5)}-${d.slice(5)}` : limpa(s);
  }

  // R$ 1.500,00 → "mil e quinhentos reais"
  function porExtenso(valorTexto) {
    const m = /([\d.]+),(\d{2})/.exec(valorTexto || '');
    if (!m) return '';
    const reais = parseInt(m[1].replace(/\./g, ''), 10), cent = parseInt(m[2], 10);
    const U = ['','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
    const D = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
    const C = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
    const ate999 = n => {
      if (n === 100) return 'cem';
      const c = Math.floor(n / 100), r = n % 100, partes = [];
      if (c) partes.push(C[c]);
      if (r < 20) { if (r) partes.push(U[r]); }
      else { partes.push(D[Math.floor(r / 10)]); if (r % 10) partes.push(U[r % 10]); }
      return partes.join(' e ');
    };
    const grupos = [];
    const mi = Math.floor(reais / 1e6), mil = Math.floor(reais / 1000) % 1000, un = reais % 1000;
    if (mi) grupos.push(ate999(mi) + (mi === 1 ? ' milhão' : ' milhões'));
    if (mil) grupos.push(mil === 1 ? 'mil' : ate999(mil) + ' mil');
    if (un) grupos.push(ate999(un));
    let txt = '';
    grupos.forEach((g, i) => {
      if (i === 0) txt = g;
      else {
        // "mil e quinhentos", mas "trinta e seis mil quinhentos e vinte" (como nos memorandos)
        const ultimo = i === grupos.length - 1, n = ultimo ? un : mil;
        txt += (ultimo && (n < 100 || n % 100 === 0)) ? ' e ' + g : ' ' + g;
      }
    });
    if (reais) txt += (mi && !mil && !un ? ' de' : '') + (reais === 1 ? ' real' : ' reais');
    if (cent) txt += (reais ? ' e ' : '') + ate999(cent) + (cent === 1 ? ' centavo' : ' centavos');
    return txt;
  }

  const QTD_EXT = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];

  // ─── Datas ────────────────────────────────────────────────
  // Acha datas de evento: "10/10/2026", "10 de Outubro de 2026", "17 e 19 de setembro de 2026".
  // Ignora a data da carta ("Cidade, 15 de agosto de 2026"), validade e assinatura.
  function datasEvento(texto) {
    const t = semAcento(texto);
    const achadas = [];
    // "Nome da Cidade, 15 de agosto…" = data da carta (dia da semana com vírgula não conta)
    const cidade = antes => { const m = antes.match(/([A-Z][a-z]+(?: (?:d[aeo]s? )?[A-Z][a-z]+)*)(?:\/[A-Z]{2})?,\s*$/);
      return !!m && !/^(Domingo|Segunda|Terca|Quarta|Quinta|Sexta|Sabado)/.test(m[1]); };
    const ignorar = idx => /(\brs|\bdata da emissao|emitido no dia|validade|dados|assinado|em)\s*[,:]?\s*$/i
      .test(t.slice(Math.max(0, idx - 25), idx)) || cidade(t.slice(Math.max(0, idx - 40), idx));
    const re1 = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
    for (let m; (m = re1.exec(t));) if (!ignorar(m.index)) achadas.push({ i: m.index, d: [+m[1]], mes: +m[2], ano: +m[3] });
    const re2 = new RegExp(`\\b(\\d{1,2}(?:\\s*(?:,|e|a)\\s*\\d{1,2})*)\\s+de\\s+(${MESES.join('|')})\\s+de\\s+(\\d{4})`, 'gi');
    for (let m; (m = re2.exec(t));) if (!ignorar(m.index))
      achadas.push({ i: m.index, d: m[1].split(/\D+/).map(Number), mes: MESES.indexOf(m[2].toLowerCase()) + 1, ano: +m[3] });
    const vistas = new Set(), out = [];
    for (const a of achadas.sort((x, y) => x.i - y.i))
      for (const d of a.d) {
        const s = `${String(d).padStart(2,'0')}/${String(a.mes).padStart(2,'0')}/${a.ano}`;
        if (d >= 1 && d <= 31 && !vistas.has(s)) { vistas.add(s); out.push(s); }
      }
    return out;
  }
  const juntaLista = l => l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1];
  function dataExtenso(s) {
    const [d, m, a] = s.split('/').map(Number);
    return `${d} de ${['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][m - 1]} de ${a}`;
  }

  // ─── Classificação ────────────────────────────────────────
  function classificar(nome, texto) {
    // quebras de linha viram espaço: "Certificado da Condição de\nMicroempreendedor" (CCMEI) não casava (v5.0.2)
    const n = norm(nome).replace(/[_-]+/g, ' '), t = norm(texto).replace(/\s+/g, ' ').slice(0, 3000);
    // HTML só vem do SEI (contratado não manda HTML). Antes caía em "RG/CNH" porque
    // "habilitação no Edital de Credenciamento" casava com a regra de CNH.
    if (/\.html?$/.test(n)) return 'sei_interno';
    // Pré-empenho / nota de empenho: só fornecem a dotação orçamentária
    if (/empenho/.test(n) || /^\s*prefeitura (?:municipal )?de [a-zà-ú ]+?\s+(pre-?empenho|nota empenho)/.test(t)) return 'empenho';
    // Documentos que nunca são fonte de dados do contratado (PCA, certidões, grid SALIC...)
    if (/relatorio|certid|\bcnd\b|consulta (?!cnpj)|fgts|nota fiscal|balizador|grid|issqn|despacho|analise tecnica/.test(n) ||
        /item orcamentario|salic|plano de contratacoes anual|nota de empenho|pre-?empenho|tabelas? de cache|nfs-e/.test(t.slice(0, 1500))) return 'outro';
    if (/dados bancarios|comprovante bancario/.test(n)) return 'bancario';
    if (/cadastro nacional da pessoa juridica/.test(t) && /nome empresarial/.test(t)) return 'cnpj';
    if (/quadro de socios/.test(t)) return 'qsa';
    if (/proposta|orcamento|plano de trabalho/.test(n)) return 'proposta';
    if (/curricul|portf|release|consagra/.test(n)) return 'curriculo';
    if (/carteira (de identidade|nacional de habilitacao)|registro geral|senatran|\bidentidade\b/.test(t) ||
        /\b(rg|cnh|identidade)\b/.test(n.replace(/[_-]/g, ' '))) return 'identidade';
    if (t.length < 2500 && (/(dados banc|comprovante banc|conta corrente)/.test(t + ' ' + n) ||
        (/\bagencia\b/.test(t) && /\bconta\b|\bc\/?c\b/.test(t)))) return 'bancario'; // v5.0.2: "Cc:" do cartão
    if (/contrato.social|estatuto|requerimento de empresario|certificado da condicao de microempreendedor|\bccmei\b/.test(n + ' ' + t.slice(0, 400))) return 'contrato_social';
    if (/proposta|orcamento|valor total|cache/.test(t.slice(0, 600))) return 'proposta';
    return 'outro';
  }

  // ─── Extratores por tipo ──────────────────────────────────
  // Cartão CNPJ: valor fica 5–15 unidades abaixo do rótulo, mesma coluna.
  function abaixoDoRotulo(itens, rotulo) {
    const r = itens.find(i => rotulo.test(limpa(norm(i.str))));
    if (!r) return '';
    const v = itens.filter(i => i.pag === r.pag && Math.abs(i.x - r.x) < 4 && i.y < r.y - 3 && i.y > r.y - 16)
      .sort((a, b) => b.y - a.y)[0];
    return v ? limpa(v.str) : '';
  }
  // Fallback para cartão fotografado (OCR): valor na linha seguinte ao rótulo.
  function linhaAposRotulo(texto, rotulo) {
    const ls = texto.split('\n').map(limpa).filter(Boolean);
    const i = ls.findIndex(l => rotulo.test(norm(l)));
    return i >= 0 && ls[i + 1] ? ls[i + 1] : '';
  }

  function extrairCNPJ(doc) {
    const pega = r => (doc.itens && doc.itens.length ? abaixoDoRotulo(doc.itens, r) : '') || linhaAposRotulo(doc.texto, r);
    const out = {};
    // Rótulo com casamento exato: "^numero$" não pode pegar "NÚMERO DE INSCRIÇÃO" (bug achado no teste).
    const cnpj = (pega(/^numero de inscricao/).match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) ||
                  doc.texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || [])[0];
    if (cnpj) out.CNPJ = cnpj;
    const nome = pega(/^nome empresarial/); if (nome) out.EMPRESA_NOME = nome;
    const fant = pega(/^titulo do estabelecimento/); if (fant && !/^\*+$/.test(fant)) out.NOME_FANTASIA = fant;
    const lg = pega(/^logradouro$/), nu = pega(/^numero$/), co = pega(/^complemento$/),
          cep = pega(/^cep$/), ba = pega(/^bairro/), mu = pega(/^municipio$/), uf = pega(/^uf$/);
    if (lg) {
      const partes = [logradouro(lg)];
      if (nu) partes.push(nu);
      if (co && !/^\*+$/.test(co)) partes.push(titulo(co));
      if (ba) partes.push('bairro ' + titulo(ba));
      if (mu) partes.push(titulo(mu) + (uf ? '/' + uf.toUpperCase() : ''));
      if (cep) partes.push('CEP ' + formataCEP(cep));
      out.ENDERECO = partes.join(', ');
    }
    const sit = pega(/^situacao cadastral$/); if (sit) out.SITUACAO_CADASTRAL = sit;
    return out;
  }

  // Nome próprio: palavras com inicial maiúscula (aceita de/da/do/e no meio)
  const NOME = "[A-ZÀ-Ý][A-Za-zÀ-ÿ'.]+(?:\\s+(?:(?:de|da|do|dos|das|e)\\s+)?[A-ZÀ-Ý][A-Za-zÀ-ÿ'.]+){1,6}";
  const reCPF = /\b(\d{3})\s?\.?\s?(\d{3})\s?\.?\s?(\d{3})\s?[-–/.]?\s?(\d{2})\b/;

  // Dígitos verificadores: sem isso, qualquer número de 11 dígitos (OCR, protocolo) passaria como CPF.
  function cpfValido(s) {
    const d = soDigitos(s);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); return (s * 10 % 11) % 10; };
    return dv(9) === +d[9] && dv(10) === +d[10];
  }
  function cpfDoTexto(t) {
    const rotulado = t.match(new RegExp('CPF\\s*(?:n[º°o.]*)?\\s*:?\\s*' + reCPF.source, 'i'));
    if (rotulado) return rotulado.slice(1).join('');
    // sem rótulo (RG/CNH lidos por OCR): só aceita se o dígito verificador bater
    for (const m of t.matchAll(new RegExp(reCPF.source, 'g'))) if (cpfValido(m.slice(1).join(''))) return m.slice(1).join('');
    const mascarado = t.match(/[*X]{3}\.[*X]{3}\.\d{3}-[*X]{2}/i);
    return mascarado ? mascarado[0] : '';
  }

  function extrairPessoa(t, out) {
    const cpf = cpfDoTexto(t);
    if (cpf) { out.REP_CPF = cpfNorm(cpf); }
    const rg = t.match(/\b(?:R\.?G\.?|registro geral|carteira de identidade|doc(?:umento)?\.? de identidade|identidade)\s*(?:n[º°o.]*)?\s*:?\s*(\d[\d.\-\/xX]{5,14})/i);
    // CNH/RG: o número vem colado no órgão emissor ("4076472028 SSP/PC RS")
    const rg2 = rg || t.match(/\b(\d[\d.\-]{5,14}\d)\s*(?:SSP|SJS|IGP|SESP|PC|DETRAN|SDS)\b/);
    if (rg2) out.REP_RG = rg2[1].replace(/[.\/-]$/, '');
    const rep = t.match(new RegExp(`representad[ao]\\s+(?:legalmente\\s+)?(?:pel[oa]|por)\\s+(?:(?:Sr|Sra|Dr|Dra)\\.?(?:\\(a\\))?\\s+)?(${NOME})`)) ||
                // sem flag 'i': o rótulo aceita as duas caixas, mas o NOME precisa de maiúscula de verdade
                t.match(new RegExp(`(?:[Ss][oó]cio(?:[- ]administrador)?|[Rr]espons[aá]vel legal|[Ff]avorecido|FAVORECIDO|[Tt]itular)\\s*:?\\s*(${NOME})`));
    if (rep) out.REP_NOME = titulo(rep[1]).replace(/(?:\s+(?:Banco|Ag[eê]ncia|Conta|Cpf|Cnpj|Pix|Chave|Data|Endere[cç]o|Telefone|E-?mail|Raz[aã]o))+$/i, ''); // v5.0.2
    const nasc = t.match(/(?:data\s+de\s+nascimento|nascid[oa](?:\s*\(a\))?(?:\s+em|\s+aos)?|nascimento|birth)[^\d\n]{0,25}(\d{2})\s*[\/.-]\s*(\d{2})\s*[\/.-]\s*(\d{4})/i);
    if (nasc) out.REP_NASCIMENTO = `${nasc[1]}/${nasc[2]}/${nasc[3]}`;
  }

  // RG/CNH por OCR quase nunca traz o rótulo "Data de nascimento" legível. Todas as outras
  // datas do documento (expedição, validade, 1ª habilitação) são posteriores ao nascimento,
  // então a mais antiga que seja de alguém adulto é a data de nascimento.
  function nascimentoPelaDataMaisAntiga(t) {
    const limite = new Date().getFullYear() - 16;
    const datas = [...t.matchAll(/\b(\d{2})\s*[\/.-]\s*(\d{2})\s*[\/.-]\s*(\d{4})\b/g)]
      .filter(m => +m[1] >= 1 && +m[1] <= 31 && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1920 && +m[3] <= limite)
      .sort((a, b) => (a[3] + a[2] + a[1]).localeCompare(b[3] + b[2] + b[1]));
    return datas.length ? `${datas[0][1]}/${datas[0][2]}/${datas[0][3]}` : '';
  }

  function extrairIdentidade(doc) {
    const t = doc.texto, out = {};
    extrairPessoa(t, out);
    if (!out.REP_NASCIMENTO) { const n = nascimentoPelaDataMaisAntiga(t); if (n) out.REP_NASCIMENTO = n; }
    // RG/CNH: o nome vem na linha abaixo do rótulo "NOME"
    const ls = t.split('\n').map(limpa).filter(Boolean);
    const i = ls.findIndex(l => /^nome(\s+e\s+sobrenome|\s+civil)?\s*:?$/i.test(semAcento(l)));
    if (i >= 0 && ls[i + 1] && /^[A-ZÀ-Ý ]{6,}$/.test(ls[i + 1])) out.REP_NOME = titulo(ls[i + 1]);
    // Sem rótulo legível (comum no OCR do RG novo): 1ª linha que começa com 3+ palavras em
    // maiúsculas e não é cabeçalho. Pode vir com erro ("ROGÉRIO DA SHVALARA"): é só sugestão,
    // perde para o nome de certidão/proposta (peso baixo).
    if (!out.REP_NOME) {
      const CABECALHO = /CONFECCION|RECURSOS|TRABALHO|PREVID|REP[UÚ]BLICA|ESTADO|SECRETARIA|GOVERNO|FEDERAL|BRASIL|CARTEIRA|IDENTIDADE|REGISTRO|GERAL|NACIONAL|HABILITA|MINIST|SEGURAN|DEPARTAMENTO|INSTITUTO|POL[IÍ]CIA|V[AÁ]LIDA|TERRIT|ASSINATURA|DOCUMENTO|DETRAN|SENATRAN|PERMISS|NATURALIDADE|NASCIMENTO|EXPEDI|[OÓ]RG[AÃ]O/;
      for (const l of ls) {
        if (/^FILIA/i.test(semAcento(l))) break; // dali pra baixo são os nomes dos pais
        const m = l.match(/^((?:[A-ZÀ-Ý]{2,}|D[AEO]S?|E)(?: (?:[A-ZÀ-Ý]{2,}|D[AEO]S?|E)){2,6})\b/);
        if (m && !CABECALHO.test(m[1]) && m[1].replace(/ /g, '').length >= 10) { out.REP_NOME = titulo(m[1]); break; }
      }
    }
    return out;
  }

  // Captura de tela de app de banco (via OCR): rótulo numa linha, valor na de baixo,
  // com lixo de ícone ("Agência O", "Conta Corrente a)"). Lê o resto da linha ou a seguinte.
  function aposRotuloEmLinhas(texto, reRotulo, reValor) {
    const ls = texto.split('\n').map(limpa).filter(Boolean);
    for (let i = 0; i < ls.length; i++) {
      const m = ls[i].match(reRotulo);
      if (!m) continue;
      const resto = ls[i].slice(m.index + m[0].length).replace(/^[\s:.\-–]*(?:[a-zO°º]\)?\s+)?/i, '');
      for (const cand of [resto, ls[i + 1] || '']) { const v = cand.match(reValor); if (v) return v[1] || v[0]; }
    }
    return '';
  }
  function extrairBancoLinhas(texto) {
    const out = {};
    const ag = aposRotuloEmLinhas(texto, /^ag[eê]ncia\b/i, /^(\d{3,5}(?:-\d)?)\b/); if (ag) out.AGENCIA = ag;
    const ct = aposRotuloEmLinhas(texto, /^conta(?:\s+corrente|\s+poupan[cç]a|\s+pagamento)?\b/i, /^(\d[\d.\-]{3,20}[\dxX])\b/); if (ct) out.CONTA = ct;
    const cod = aposRotuloEmLinhas(texto, /^(?:c[oó]digo do banco|banco)\b/i, /^(\d{3,4})\b/);
    const inst = aposRotuloEmLinhas(texto, /^institui[cç][aã]o\b/i, /^([A-Za-zÀ-ÿ][\wÀ-ÿ .&-]{2,40})$/) ||
                 (texto.match(/^.*(?:\bS\.?A\.?|\bPagamentos|\bBank|\bCooperativa|\bSicredi|\bSicoob|\bBanco\s+(?:d[oa]\s+)?[A-Z][\wÀ-ÿ]{2,}).*$/m) || [''])[0];
    const nomeBanco = limpa(inst).replace(/\s*-\s*Institui[cç][aã]o.*$/i, '').replace(/\s+[a-zO]\)?$/, '').replace(/^banco\s*:?\s*(?:\d{3,4}\s*-\s*)?/i, ''); // v5.0.2: sem "Banco: 0260 -"
    if (nomeBanco || cod) out.BANCO = [nomeBanco, cod && `(${cod})`].filter(Boolean).join(' ');
    return out;
  }

  function extrairBanco(t) {
    const out = {};
    const b = t.match(/\bbanco\s*:?\s*([^\n:]{2,40}?)(?=\s+ag[eê]ncia|\s+conta|\s+favorecido|\s+pix|\n|$)/i);
    if (b && !/^(de dados|do brasil s\.?a\.?)$/i.test(b[1])) out.BANCO = (/^d[oa]s?\s/i.test(b[1]) ? 'Banco ' : '') + limpa(b[1]); // "Banco do Brasil" sem perder o "Banco"
    const ag = t.match(/\bag[eê]ncia\s*(?:n[º°o.]*)?\s*:?\s*(\d[\d-]{2,8})/i); if (ag) out.AGENCIA = ag[1];
    const ct = t.match(/\bconta(?:\s+corrente|\s+poupan[cç]a)?\s*(?:n[º°o.]*)?\s*:?\s*(\d[\d.\-xX]{2,20})/i); if (ct) out.CONTA = ct[1];
    const px = t.match(/\bpix\s*(?:\([^)]*\))?\s*:?\s*([^\s,;]{5,80})/i); if (px) out.PIX = px[1];
    return out;
  }

  function extrairProposta(doc) {
    const t = doc.texto, t1 = limpa(t), out = {};
    const cnpjs = (t1.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || []).filter(c => c !== CNPJ_ORGAO);
    if (cnpjs[0]) out.CNPJ = cnpjs[0];
    const emp = t1.match(/em nome de\s+([^,]{3,80}),/i) ||
                t.match(/^\s*([A-ZÀ-Ý0-9][A-ZÀ-Ý0-9 .&-]{3,80}?)\s+CNPJ\s*:/m);
    if (emp) out[/nome fantasia/i.test(t1.slice(emp.index || 0, (emp.index || 0) + emp[0].length + 120)) ? 'NOME_FANTASIA' : 'EMPRESA_NOME'] = limpa(emp[1]); // v5.0.2
    extrairPessoa(t1, out);
    // assinatura: linha em caixa alta seguida de "RG:"/"CPF:"
    if (!out.REP_NOME) {
      const ass = t.match(/\n\s*([A-ZÀ-Ý]{2,}(?: [A-ZÀ-Ý]{2,}){1,6})\s*\n\s*(?:RG|CPF)\b/);
      if (ass) out.REP_NOME = titulo(ass[1]);
    }
    Object.assign(out, extrairBanco(t1));

    // Valor: "valor total" / "totalizando" ganha; senão o maior R$ do documento
    const vt = t1.match(/(?:valor total|totalizando|total de|total geral|valor global)[^R]{0,25}R\$\s*([\d.]+,\d{2})/i);
    const todos = [...t1.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map(m => m[1]);
    const num = v => parseFloat(v.replace(/\./g, '').replace(',', '.'));
    const valor = vt ? vt[1] : todos.sort((a, b) => num(b) - num(a))[0];
    if (valor) out.VALOR = 'R$ ' + valor;

    const datas = datasEvento(t1);
    if (datas.length) { out.EVENTO_DATAS = datas; out.EVENTO_DATA = juntaLista(datas); }

    const h = t1.match(/(?:das?\s+|hor[aá]rio\s*(?:da apresenta[cç][aã]o)?\s*:?\s*)(\d{1,2})\s*(?:h|hs|:)\s*(\d{2})?\s*(?:hs?)?\s*(?:às|as|a|-|até)\s*(\d{1,2})\s*(?:h|hs|:)\s*(\d{2})?/i);
    if (h) out.EVENTO_HORARIO = `${h[1]}h${h[2] && h[2] !== '00' ? h[2] : ''} às ${h[3]}h${h[4] && h[4] !== '00' ? h[4] : ''}`;

    const PARA_ANTES_DE_ROTULO = "(?=\\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{1,25}:\\s|\\.\\s|\\.$|$)";
    const loc = t1.match(new RegExp(`(?:(?<!respons[aá]vel\\s)\\blocal\\s*:|,\\s*local)\\s+(?!a combinar|e\\s)(.+?)${PARA_ANTES_DE_ROTULO}`, 'i'));
    if (loc) out.EVENTO_LOCAL = limpa(loc[1]).replace(/[,;]$/, '');

    const ev = t1.match(new RegExp(`\\bevento(?:\\s+cultural)?\\s*[:,]?\\s+(?!do piquete|da prefeitura)(.+?)(?=,\\s*(?:local|no dia|nos dias|em|na|no)\\b|${PARA_ANTES_DE_ROTULO.slice(3)}`, 'i'));
    if (ev && ev[1].length < 120) out.EVENTO = limpa(ev[1]).replace(/^(de|do|da)\s+/i, '');

    const art = t1.match(/espet[aá]culo(?: art[ií]stico| musical)?\s+(?:do |da |de )?(.+?)\s+(?:no|nos|na|em|dia)\s/i) ||
                t1.match(/\bshow(?: musical)?\s+(?:do|da|de)\s+(.+?)(?:[.,]|\s+(?:no|nos|na|em|dia)\s)/i) ||
                t1.match(/apresenta[cç][aã]o(?: art[ií]stica| musical)?\s+(?:do|da|de)\s+(?!servi)(.+?)(?:[.,]|\s+(?:no|nos|na|em|dia)\s)/i) ||
                t1.match(new RegExp(`contrata[cç][aã]o d[aoe]s?\\s+(${NOME})\\s+para`)) ||
                t1.match(new RegExp(`\\b(?:m[uú]sico|artista|cantora?|grupo|banda)\\s+(${NOME})`)) ||
                t1.match(new RegExp(`PROPONENTE\\s*:\\s*(${NOME})`));
    if (art && art[1].length < 80) out.ARTISTA = limpa(art[1]);
    return out;
  }

  // ─── Currículo / Material de Consagração → resumo de um parágrafo (sem IA) ──
  // Resumo EXTRATIVO: pontua as frases pelo que pesa numa justificativa artística (carreira,
  // prêmios, festivais, discos, shows, mídia, reconhecimento) e junta as melhores na ordem
  // original. Currículo em formato de CV ("[2013-2015] Instituição – Cargo") vira frases
  // por seção. É sugestão: o usuário revisa na coluna 2.
  const RELEVANTE = /pr[eê]mi|festiva|[aá]lbu|\bdisco|\bcds?\b|dvd|grava[cdç]|turn[eê]|\bshows?\b|apresenta|carreira|\banos\b|reconhec|destaque|consagr|trajet[oó]ria|nacional|internacional|\btv\b|televis|r[aá]dio|spotify|ouvintes|compositor|int[eé]rprete|cantor|m[uú]sic|fund[ao]u|orquestra|particip|palcos?|p[uú]blico|cr[ií]tica|lan[cç]|repert[oó]rio|cultura/gi;
  const LIMITE_RESUMO = 650;
  const tiraRepetido = s => s.replace(/(.{8,80}?)(?:\s*\1){1,}/g, '$1'); // "COMO TUDO COMEÇOU...COMO TUDO COMEÇOU..."

  // lixo comum de portfólio: barra de gêneros "| MPB | CHORO |" e sumário "Apresentação 1 Currículo 2 Repertório 3"
  const tiraMenus = s => s
    .replace(/(?:\|\s*[^|\n.]{1,40}\s*){2,}\|?/g, ' ')
    .replace(/\bConte[uú]do\b/g, ' ')
    .replace(/(?:\b[A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+[a-zà-ÿ]{1,3})?(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]+)?\s+\d{1,3}\s+){3,}/g, ' ');
  // Junta as linhas do PDF em parágrafos. Linha curta solta (título, item de lista tipo
  // "Show: Semana da Restinga") fecha o parágrafo e é descartada — senão grudava na frase
  // anterior e a lista "ganhava" a pontuação (bug achado no currículo do processo 153676).
  function paragrafos(texto) {
    const blocos = [];
    let atual = '';
    for (const l of texto.split('\n').map(limpa)) {
      const fimDeFrase = /[.!?]["”)]?$/;
      if (!l) { if (atual) blocos.push(atual); atual = ''; continue; }
      if (l.length < 60 && !(atual && !fimDeFrase.test(atual) && fimDeFrase.test(l))) { if (atual) blocos.push(atual); atual = ''; continue; }
      atual += (atual ? ' ' : '') + l;
    }
    if (atual) blocos.push(atual);
    return blocos;
  }
  function resumoProsa(texto) {
    const frases = paragrafos(tiraMenus(tiraRepetido(texto)))
      .flatMap(b => b.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"“])/)).map(limpa)
      .map(f => f.replace(/^(?:[A-ZÀ-Ý]{2,}\s+){3,}(?=[A-ZÀ-Ý][a-zà-ÿ])/, '')) // título em maiúsculas grudado no início
      .filter(f => f.length >= 50 && f.length <= 450 && !/https?:|www\.|@|\(\d{2}\)\s?\d{4}|^[^a-z]*$/.test(f) && !/:\s*$/.test(f)
        && (f.match(/:/g) || []).length < 3);
    if (!frases.length) return '';
    // cada palavra-chave conta UMA vez por frase: uma lista com "Show… Show… Show…" não vence um parágrafo de verdade
    const pontua = f => new Set((f.match(RELEVANTE) || []).map(norm)).size * 3;
    const pontos = frases.map((f, i) => ({ f, i, p: pontua(f) + (i === 0 ? 5 : 0) - (f.length > 300 ? 2 : 0) }));
    const escolhidas = [];
    let tam = 0;
    for (const x of [...pontos].sort((a, b) => b.p - a.p || a.i - b.i)) {
      if (x.p <= 0 && escolhidas.length) continue;
      if (tam + x.f.length > LIMITE_RESUMO && escolhidas.length) continue;
      escolhidas.push(x); tam += x.f.length + 1;
      if (tam > LIMITE_RESUMO * 0.75) break;
    }
    return escolhidas.sort((a, b) => a.i - b.i).map(x => x.f).join(' ');
  }

  // CV com itens "[ano] Instituição – detalhe – cidade": pega os primeiros itens de cada seção
  const SECOES_CV = [
    [/forma[cç][aã]o|educa[cç][aã]o|escolaridade/i, 'Formação'],
    [/experi[eê]ncias? profissiona|atua[cç][aã]o profissional|trabalhos/i, 'Atuação profissional'],
    [/festiva/i, 'Participou de festivais como'],
    [/pr[eê]mios?|premia[cç]/i, 'Recebeu prêmios e distinções como'],
    [/grava[cç]/i, 'Principais gravações'],
  ];
  function resumoCV(texto) {
    const t = limpa(texto);
    if ((t.match(/\[\d{4}/g) || []).length < 4) return '';
    const cab = /(Educa[cç][aã]o|Forma[cç][aã]o[^\[]{0,20}|Especializa[cç][oõ]es|Experi[eê]ncias? [^\[]{0,30}|Participa[cç][oõ]es em [^\[]{0,40}|Pr[eê]mios|Principais Grava[cç][oõ]es|Experi[eê]ncia de Ensino)(?=\s*\[|\s+CD)/g;
    const partes = [];
    let m, ult = null;
    while ((m = cab.exec(t))) { if (ult) partes.push([ult[1], t.slice(ult.index + ult[0].length, m.index)]); ult = m; }
    if (ult) partes.push([ult[1], t.slice(ult.index + ult[0].length)]);
    const frases = [];
    for (const [re, rotulo] of SECOES_CV) {
      const sec = partes.find(([h]) => re.test(h));
      if (!sec) continue;
      const itens = sec[1].split(/\s*\[[^\]]*\]\s*|\s+(?=CD)/).map(limpa).filter(i => i.length > 8)
        .slice(0, 3).map(i => i.split(/\s+[–-]\s+/).slice(0, 2).join(' – ').replace(/[.;,]$/, ''));
      if (itens.length) frases.push(`${rotulo}: ${itens.join('; ')}.`.replace(/como: /, 'como '));
    }
    let s = '';
    for (const f of frases) if (s.length + f.length <= LIMITE_RESUMO + 150) s += (s ? ' ' : '') + f;
    return s;
  }

  function extrairCurriculo(doc) {
    // CV: texto inteiro (os cabeçalhos "Educação", "Prêmios" são linhas curtas e não podem sumir)
    const linhas = doc.texto.split('\n');
    while (linhas.length && limpa(linhas[0]).length < 40) linhas.shift(); // prosa: tira título / nome solto no topo
    const s = resumoCV(doc.texto) || resumoProsa(linhas.join('\n'));
    return s ? { CURRICULO_TRECHO: s } : {};
  }

  // ─── Documentos do próprio SEI (Memorando, TR, ETP, DU, DFD já escritos) ──
  // Trazem o texto que o usuário já redigiu (objeto, justificativa, explicação do
  // evento): reaproveitar isso nos outros modelos é o que mais poupa digitação.
  // Sem flag 'i': texto-modelo é escrito em MAIÚSCULAS ("NOME DO REPRESENTANTE"); com 'i', a
  // instrução "inserir no processo relatório…" do DFD fazia o DFD inteiro ser descartado.
  // "XXX" sozinho é texto-modelo; "XXX.XXX.810-XX" é CPF mascarado (LGPD) e não conta (bug: o Contrato
  // Registrado do processo 117326 era ignorado inteiro por causa do CPF mascarado)
  const PLACEHOLDER = /\b(NOME DO|NOME DA|INDICAR|XXX(?![.\d])|CPF DO REPRESENTANTE|ENDERE[CÇ]O \(|DESCREVER|INSERIR)\b/;
  const tiraMaisDetalhes = s => s.replace(/\s*Mais (?:detalhes|informa[cç][oõ]es) no Curr[ií]culo.*$/i, '').trim();
  function docsCitados(s, out) {
    const cur = s.match(/Curr[ií]culo[^.\d]{0,60}?(?:doc\.?\s*)?(\d{8})/i); if (cur) out.DOC_CURRICULO = cur[1];
    const por = s.match(/Portf[oó]lio[^.\d]{0,20}?(?:doc\.?\s*)?(\d{8})/i); if (por) out.DOC_PORTFOLIO = por[1];
    const at = s.match(/an[aá]lise t[eé]cnica de pre[cç]os,?\s*doc\.?\s*(\d{8})/i); if (at) out.DOC_ANALISE_TECNICA = at[1];
    const pca = s.match(/plano de contrata[cç][oõ]es anual,?\s*doc\.?\s*(\d{8})/i); if (pca) out.DOC_PCA = pca[1];
    const orc = s.match(/or[cç]amento da empresa,?\s*doc\.?\s*(\d{8})/i); if (orc) out.DOC_PROPOSTA = orc[1];
  }
  // Texto entre um rótulo ("OBJETO:", "1. Descrição da necessidade…") e o próximo rótulo.
  function secao(linhas, reInicio, reFim) {
    const i = linhas.findIndex(l => reInicio.test(l));
    if (i < 0) return '';
    const fim = linhas.findIndex((l, j) => j > i && reFim.test(l));
    return linhas.slice(i + 1, fim < 0 ? undefined : fim).join('\n').trim();
  }
  // rodapé do SEI: assinaturas, autenticidade, nº do processo e versão do documento ("41996815v2")
  const RODAPE = /^(Documento assinado eletronicamente|A autenticidade do documento|Refer[eê]ncia: Processo|\d{2}\.\d\.\d{9}-\d|\d{8}v\d+$)/i;

  function extrairSEI(doc) {
    const n = norm(doc.nome).replace(/[_-]+/g, ' '), out = {};
    const linhas = doc.texto.split('\n').map(limpa).filter(l => l && !RODAPE.test(l));
    const t1 = linhas.join(' ');
    if (PLACEHOLDER.test(t1) && !/memorando|termo de referencia|estudo tecnico/.test(n)) return out; // modelo ainda não preenchido
    docsCitados(t1, out);

    if (/memorando/.test(n)) {
      const i = linhas.findIndex(l => /^Solicitamos/i.test(l));
      if (i < 0) return out;
      if (i > 0 && linhas[i - 1].length < 60 && /secret|senhor|ilustr|prezad/i.test(linhas[i - 1])) out.TRATAMENTO = linhas[i - 1];
      const s = linhas[i];
      const emp = s.match(/empresa\s+(.+?),\s*(?:inscrita no\s+)?CNPJ\s*(?:n[º°]\s*)?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
      if (emp) { out.EMPRESA_NOME = emp[1].trim(); out.CNPJ = emp[2]; }
      const rep = s.match(/representad[oa](?:\(a\))?\s+pel[oa](?:\(a\))?\s+(?:Sr\.?(?:\(a\))?a?\.?\s+|Sra\.?\s+)?(.+?),\s*(?:RG\s*[\d.\-X]+,\s*)?CPF\s*([\d*X.\-\/]{11,14})/i);
      if (rep) { out.REP_NOME = titulo(rep[1]); out.REP_CPF = cpfNorm(rep[2]); }
      const end = s.match(/com sede (?:na|no|à|no endere[cç]o)\s+(.+?),\s*para\s/i); if (end) out.ENDERECO = end[1].trim();
      const obj = s.match(/,\s*para\s+(.+)$/i);
      if (obj) out.OBJETO_DETALHADO = obj[1].charAt(0).toUpperCase() + obj[1].slice(1);
      const ctx = linhas[i + 1];
      if (ctx && !/^(Justifica|O contrato|Este Coorden|Atenciosamente)/i.test(ctx)) out.CONTEXTO_EVENTO = ctx;
      const jus = linhas.find(l => /^Justifica-se/i.test(l)); if (jus) out.JUSTIFICATIVA = tiraMaisDetalhes(jus);
      const val = t1.match(/valor total de\s+R\$\s*([\d.]+,\d{2})/i); if (val) out.VALOR = 'R$ ' + val[1];
    } else if (/termo de referencia/.test(n)) {
      const ROT = /^[A-ZÀ-Ý ÇÃÕÉÍÓÚ]{4,}:$/;
      const o = secao(linhas, /^OBJETO:$/i, ROT); if (o && !PLACEHOLDER.test(o)) out.OBJETO = o;
      const d = secao(linhas, /^DESCRI[CÇ][AÃ]O DO OBJETO:$/i, ROT); if (d && !PLACEHOLDER.test(d)) out.OBJETO_DETALHADO = d;
      const j = secao(linhas, /^JUSTIFICATIVA:$/i, ROT); if (j && !PLACEHOLDER.test(j)) out.JUSTIFICATIVA = tiraMaisDetalhes(j);
    } else if (/estudo tecnico/.test(n)) {
      const ITEM = k => new RegExp(`^${k}\\.\\s`);
      const c = secao(linhas, ITEM(1), ITEM(2)); if (c && !PLACEHOLDER.test(c)) out.CONTEXTO_EVENTO = c;
      const r = secao(linhas, ITEM(9), ITEM(10)); if (r && !PLACEHOLDER.test(r)) out.RESULTADOS = r;
      const cc = secao(linhas, ITEM(11), ITEM(12)); if (cc && !PLACEHOLDER.test(cc)) out.CONTRATACOES_CORRELATAS = cc;
    } else if (/declaracao unificada/.test(n)) {
      const m = t1.match(new RegExp(`Eu,\\s+(${NOME}),\\s*CPF\\s*([\\d*X.\\-]{11,14})`));
      if (m) { out.REP_NOME = titulo(m[1]); out.REP_CPF = cpfNorm(m[2]); }
    } else if (/dfd|formalizacao de demanda/.test(n)) {
      const o = secao(linhas, /^4\.\s*OBJETO DA DEMANDA/i, /^5\./); if (o && !PLACEHOLDER.test(o)) out.OBJETO_DETALHADO = o;
      const r = secao(linhas, /^7\.\s*RESULTADOS/i, /^8\./); if (r && !PLACEHOLDER.test(r)) out.RESULTADOS = r;
      const dt = secao(linhas, /^6\.\s*DATA ESPERADA/i, /^7\./).match(/\d{2}\/\d{2}\/\d{4}/g); if (dt) out.EVENTO_DATA = juntaLista(dt);
      // quadro 2 (ordenador de despesa) e 11 (contato): "Rótulo: valor" por linha
      const rot = (txt, re) => { const m = txt.match(new RegExp(`^${re}\\s*:\\s*(.+)$`, 'im')); return m && !PLACEHOLDER.test(m[1]) ? limpa(m[1]) : ''; };
      const ord = secao(linhas, /^2\.\s*IDENTIFICA/i, /^3\./);
      const camposOrd = { ORDENADOR_NOME: 'Nome', ORDENADOR_MATRICULA: 'Matr[ií]cula', ORDENADOR_CARGO: 'Cargo',
        ORDENADOR_EMAIL: 'E-?mail', ORDENADOR_TELEFONE: 'Telefone', ORDENADOR_PUBLICACAO: 'N[uú]mero do documento SEI da publica[cç][aã]o do ordenador de despesas' };
      for (const [k, re] of Object.entries(camposOrd)) { const v = rot(ord, re); if (v) out[k] = k === 'ORDENADOR_NOME' ? titulo(v) : v; }
      const con = secao(linhas, /^11\.\s*CONTATO/i, /^12\./);
      const camposCon = { CONTATO_NOME: 'Servidor', CONTATO_MATRICULA: 'Matr[ií]cula', CONTATO_LOTACAO: 'Lota[cç][aã]o', CONTATO_RAMAL: 'Ramal', CONTATO_EMAIL: 'Observa[cç][oõ]es' };
      for (const [k, re] of Object.entries(camposCon)) { const v = rot(con, re); if (v) out[k] = v; }
    }
    // Contrato assinado ("Contrato nº 120/2026"), termo aditivo ou apostilamento.
    // A data de assinatura é a da última assinatura eletrônica do documento registrado.
    if (ehContrato(doc.nome) || /minuta de termo (aditivo|de apostilamento)|termo (aditivo|de apostilamento)/.test(n)) {
      const reg = t1.match(/Contrato(?: Registrado)?(?: [A-Z]{2,8})? N[º°o.]*\s*(\d+)\s*\/\s*(\d{4})/i);
      const num = reg ? `${reg[1]}/${reg[2]}` : '';
      // vale a ÚLTIMA assinatura (quando o termo fica formalizado); as outras datas vão como alternativa
      const datasAssin = [...new Set([...doc.texto.matchAll(/assinado eletronicamente por[^\n]*?em (\d{2}\/\d{2}\/\d{4})/gi)].map(m => m[1]))]
        .sort((a, b) => a.split('/').reverse().join('').localeCompare(b.split('/').reverse().join('')));
      const assin = datasAssin.pop();
      if (datasAssin.length) out._outrasDatasAssinatura = datasAssin;
      const ehAditivo = /\bAditivo ao Contrato|^Termo Aditivo/im.test(doc.texto) || /termo aditivo/.test(n);
      const ehApost = /Apostilamento ao Contrato/i.test(doc.texto) || /apostilamento/.test(n);
      const base = t1.match(/(?:Aditivo|Apostilamento) ao Contrato[^.]*?n(?:[uú]mero|[º°o.])\s*(\d+)\s*\/\s*(\d{4})/i);
      if (base) out.NUM_CONTRATO = `${base[1]}/${base[2]}`;
      // objeto do termo: 1ª linha ("Correção da CLÁUSULA …:") + a nova redação, como no extrato publicado
      const iObj = linhas.findIndex(l => /^Objeto:?$/i.test(l));
      let objTermo = '';
      if (iObj >= 0) {
        const iNova = linhas.findIndex((l, j) => j > iObj && /^Passa(m)? a ter a seguinte reda/i.test(l));
        const fim = linhas.findIndex((l, j) => j > iObj && /^([A-ZÀ-Ú][a-zà-ú]+(?: [a-zà-úA-ZÀ-Ú]+)*, \d{1,2} de |processo administrativo)/i.test(l));
        const novas = linhas.slice(iNova >= 0 ? iNova + 1 : iObj + 2, fim < 0 ? undefined : fim);
        objTermo = [linhas[iObj + 1], ...novas].filter(Boolean).join(' ');
      }
      if (ehAditivo) {
        if (num) out.NUM_ADITIVO = num;
        if (assin && reg) out.DATA_ASSINATURA_ADITIVO = assin;
        if (objTermo) out.OBJETO_ADITIVO = objTermo;
      } else if (ehApost) {
        if (num) out.NUM_APOSTILAMENTO = num;
        if (assin && reg) out.DATA_ASSINATURA_APOSTILAMENTO = assin;
        if (objTermo) out.OBJETO_APOSTILAMENTO = objTermo;
      } else {
        if (num) out.NUM_CONTRATO = num;
        if (assin) out.DATA_ASSINATURA = assin;
        // Contrato assinado é a fonte mais confiável de valor e objeto (pedido do usuário, 13/11/2026: o
        // valor de um pré-empenho que englobava outras contratações tinha vencido o do contrato).
        // Credenciamento não traz valor no contrato (remete ao Edital): fica o da proposta.
        const v = t1.match(/totalizando\s+R\$\s*([\d.]+,\d{2})/i) || t1.match(/valor total de\s+R\$\s*([\d.]+,\d{2})/i);
        if (v) out.VALOR = 'R$ ' + v[1];
        const o = t1.match(/tem por objeto:?\s+(.+?)(?:,?\s+de acordo com as especifica[cç][oõ]es.*?)?(?=\s+\d+\.\d+\.?\s|\s+CL[AÁ]USULA|$)/i);
        if (o) out.OBJETO_DETALHADO = o[1].replace(/^(a|o)\s+/i, '').replace(/^./, c => c.toUpperCase()).replace(/[;,]$/, '').replace(/([^.])$/, '$1.');
      }
    }
    // DFD e minuta citam a dotação; o empenho (peso maior) vence se estiver na pasta
    const dot = t1.match(/Dota[cç][aã]o Or[cç]ament[aá]ria:?\s+(\d{3,5}-\d{3,6}-\d{2}\.\d{2}\.\d{2}\.\d{2}-.+?)(?=\.\s|\s+A Dota|\s+CL[AÁ]USULA|$)/i);
    if (dot) out.DOTACAO = dot[1].trim();
    return out;
  }

  // Dotação no formato (exemplo de um município; adapte a regex ao seu):
  // "unidade orçamentária-subação-elemento da despesa-fonte de recursos"
  // ex.: 1001-2421-33.90.39.23-1.5.00.001001 0001 - RECURSO LIVRE ADM DIRETA - IMPOSTOS E TRANSFERÊNCIAS
  // Pré-empenho e nota de empenho trazem cada parte num quadro rotulado; os zeros à esquerda
  // da UO (01001) e da subação (002421) caem.
  function extrairEmpenho(doc) {
    const t = doc.texto, out = {};
    const depois = (re, val) => { const i = t.search(re); return i < 0 ? null : t.slice(i).match(val); };
    const uo = depois(/Unidade Or[cç]ament[aá]ria/i, /\b(0\d{4})\b/);
    const sub = depois(/Suba[cç][aã]o/i, /\b(\d{6})\b/);
    const nat = depois(/Natureza (?:da )?Despesa/i, /\b(\d{2}\.\d{2}\.\d{2}\.\d{2})\b/);
    const f = t.match(/(\d\.\d\.\d{2}\.\d{6}\s+\d{4})\s*-\s*([^\n]+)(?:\n([^\n]+))?/);
    if (uo && sub && nat && f) {
      let desc = limpa(f[2]);
      if (/-$/.test(desc) && f[3]) desc += ' ' + limpa(f[3]); // descrição quebrada em duas linhas na nota de empenho
      out.DOTACAO = `${+uo[1]}-${+sub[1]}-${nat[1]}-${limpa(f[1])} - ${desc}`;
    }
    return out;
  }

  // Certidões de CPF (Receita, TCU, CGU) trazem nome oficial + CPF juntos:
  // "Nome: FULANO CPF: …", "certifica … que FULANO, CPF: …", "Consultado: FULANO CPF/CNPJ: …".
  const NOME_MAIUSC = "[A-ZÀ-Ý][A-ZÀ-Ý']+(?: (?:D[AEO]S? |E )?[A-ZÀ-Ý][A-ZÀ-Ý']+){1,6}";
  function extrairOutro(doc) {
    const out = {}, t = limpa(doc.texto);
    const par = t.match(new RegExp(`(?:Nome:|Consultado:|\\bque)\\s+(${NOME_MAIUSC}),?\\s+CPF(?:\\/CNPJ)?\\s*(?:n[º°]\\s*)?:?\\s*${reCPF.source}`));
    if (par) { out.REP_NOME = titulo(par[1]); out.REP_CPF = formataCPF(par.slice(2).join('')); return out; }
    const cpf = t.match(new RegExp('CPF\\s*:?\\s*' + reCPF.source, 'i'));
    if (cpf) out.REP_CPF = formataCPF(cpf.slice(1).join(''));
    return out;
  }

  // ─── Números SEI pelo nome do arquivo exportado ───────────
  // "[04]-41599108_Proposta.pdf" → DOC_PROPOSTA = 41599108
  const DOC_POR_NOME = [
    [/proposta|orcamento/, 'DOC_PROPOSTA'], [/cnpj/, 'DOC_CNPJ'], [/curricul/, 'DOC_CURRICULO'],
    [/portf/, 'DOC_PORTFOLIO'], [/analise_tecnica/, 'DOC_ANALISE_TECNICA'], [/relatorio/, 'DOC_PCA'],
    [/memorando/, 'DOC_MEMORANDO'], [/termo_de_referencia/, 'DOC_TR'], [/estudo_tecnico/, 'DOC_ETP'],
    [/dfd|formalizacao_de_demanda/, 'DOC_DFD'], [RE_CONTRATO, 'DOC_CONTRATO'], [/pre_empenho/, 'DOC_PRE_EMPENHO'],
    [/declaracao_unificada/, 'DOC_DU'], [/portaria/, 'DOC_PORTARIA'], [/minuta_de_contrato/, 'DOC_MINUTA'],
    [/exclusividade/, 'DOC_EXCLUSIVIDADE'], [/balanco/, 'DOC_BALANCO'],

  ];
  function numeroSEI(nome) {
    const m = nome.match(/(?:^|[\]\-_ ])(\d{8})_/);
    if (!m) return {};
    const n = norm(nome);
    const par = DOC_POR_NOME.find(([re]) => re.test(n));
    return par ? { [par[1]]: m[1] } : {};
  }
  function numeroProcesso(texto) {
    const m = (texto || '').match(/(\d{2})\.(\d)\.(\d{9})[_-](\d)/);
    return m ? `${m[1]}.${m[2]}.${m[3]}-${m[4]}` : '';
  }

  // ─── Junta tudo ───────────────────────────────────────────
  // Quanto maior o peso, mais confiável a fonte para aquele campo.
  // sei_interno = texto que o próprio usuário escreveu: vale mais que tudo para os textos
  // (objeto, justificativa, evento), mas o cartão CNPJ/RG ainda vencem nos dados cadastrais.
  const PESO = { cnpj: 5, empenho: 5, identidade: 4, qsa: 4, bancario: 4, proposta: 3, sei_interno: 2, contrato_social: 2, curriculo: 1, outro: 0 };
  // Nome por OCR é ruidoso (perde). Nome+CPF de certidão é o dado oficial da Receita/TCU: ganha da proposta.
  const DO_CONTRATO = new Set(['VALOR', 'OBJETO_DETALHADO']);
  const PESO_CAMPO = { REP_NOME: { identidade: 1, outro: 3.5 }, REP_CPF: { outro: 3.5 } };

  function extrairDoc(doc) {
    const tipo = doc.tipoForcado || classificar(doc.nome, doc.texto); // o usuário pode corrigir o tipo na tela
    const fn = { cnpj: extrairCNPJ, identidade: extrairIdentidade, proposta: extrairProposta, curriculo: extrairCurriculo, sei_interno: extrairSEI, empenho: extrairEmpenho,
                 bancario: d => {
                   const linhas = extrairBancoLinhas(d.texto);
                   const o = Object.keys(linhas).length >= 2 ? linhas : Object.assign(linhas, extrairBanco(limpa(d.texto)));
                   extrairPessoa(limpa(d.texto), o); return o;
                 },
                 qsa: d => { const o = {}; extrairPessoa(d.texto, o); return o; } }[tipo] || extrairOutro;
    const campos = Object.assign(fn(doc), numeroSEI(doc.nome));
    // cartão CNPJ reconhecido pelo conteúdo, salvo no SEI com nome genérico ("Consulta", "Documento", "Certificado"):
    // o nº SEI vem do nome do arquivo mesmo assim (v5.0.4)
    if (tipo === 'cnpj' && !campos.DOC_CNPJ && nSEI(doc.nome)) campos.DOC_CNPJ = nSEI(doc.nome);
    return { tipo, campos };
  }
  const nSEI = nome => ((nome || '').match(/(?:^|[\]\-_ ])(\d{8})_/) || [])[1];

  // docs: [{nome, texto, itens}] → { campos: {CAMPO: {valor, fonte, alternativas}}, docs: [{nome,tipo}] }
  function extrairTudo(docs, nomePasta) {
    const campos = {}, resumo = [], vistos = {}; // vistos: todo valor achado, com o documento, para a conferência
    for (const d of docs) {
      const { tipo, campos: c } = extrairDoc(d);
      resumo.push({ nome: d.nome, tipo, achou: Object.keys(c) });
      for (let [k, v] of Object.entries(c)) {
        if (k === 'EVENTO_DATAS' || k.startsWith('_')) continue;
        v = typeof v === 'string' ? limpa(v) : v;
        if (!v) continue;
        (vistos[k] ||= []).push({ valor: v, fonte: d.nome });
        // valor e objeto do contrato assinado vencem tudo, até o pré-empenho
        const peso = DO_CONTRATO.has(k) && ehContrato(d.nome) ? 6
          : (PESO_CAMPO[k] && PESO_CAMPO[k][tipo] != null) ? PESO_CAMPO[k][tipo] : PESO[tipo];
        const atual = campos[k];
        if (!atual) campos[k] = { valor: v, fonte: d.nome, peso, alternativas: [] };
        else {
          if (v !== atual.valor && !atual.alternativas.includes(v)) atual.alternativas.push(v);
          // empate entre propostas: a mais recente (vem depois na pasta) é a que vale
          // aditivo/apostilamento: vale o mais recente (2º aditivo substitui o 1º)
          if (peso > atual.peso || (peso === atual.peso && (tipo === 'proposta' || /ADITIVO|APOSTILAMENTO/.test(k)))) {
            atual.alternativas = atual.alternativas.filter(a => a !== v);
            if (atual.valor !== v) atual.alternativas.push(atual.valor);
            Object.assign(atual, { valor: v, fonte: d.nome, peso });
          }
        }
      }
      if (c.EVENTO_DATAS && (!campos._datas || PESO[tipo] >= 3)) campos._datas = c.EVENTO_DATAS;
      // datas das outras assinaturas do mesmo termo: ficam como opção no campo (lista do datalist)
      const kd = ['DATA_ASSINATURA', 'DATA_ASSINATURA_ADITIVO', 'DATA_ASSINATURA_APOSTILAMENTO'].find(x => c[x]);
      if (kd && campos[kd] && c._outrasDatasAssinatura)
        for (const d of c._outrasDatasAssinatura) if (d !== campos[kd].valor && !campos[kd].alternativas.includes(d)) campos[kd].alternativas.push(d);
    }
    let proc = numeroProcesso(nomePasta), fonteProc = 'nome da pasta';
    if (!proc) {
      // Sem nome de pasta (arquivos arrastados/adicionados): o rodapé de todo documento do SEI
      // traz o nº do processo. Usa o mais frequente — o texto pode citar outros processos.
      const cont = {};
      for (const d of docs) if (/\.html?$/i.test(d.nome))
        for (const m of (d.texto || '').matchAll(/\b(\d{2})\.(\d)\.(\d{9})-(\d)\b/g)) { const p = `${m[1]}.${m[2]}.${m[3]}-${m[4]}`; cont[p] = (cont[p] || 0) + 1; }
      proc = Object.keys(cont).sort((a, b) => cont[b] - cont[a])[0];
      fonteProc = 'rodapé dos documentos do SEI';
    }
    if (proc && !campos.PROCESSO) campos.PROCESSO = { valor: proc, fonte: fonteProc, alternativas: [] };
    // Processo de credenciamento: qualquer documento que cite o Edital de Credenciamento
    // (memorando, TR, DFD, justificativa). Usado para destacar os modelos "(Cred.)".
    if (!campos.CREDENCIAMENTO) for (const d of docs) {
      const m = (d.texto || '').match(/Edital de Credenciamento\s*n[º°o.]*\s*(\d{1,3})\s*\/\s*(\d{4})/i);
      if (m) { campos.CREDENCIAMENTO = { valor: `${m[1].padStart(3, '0')}/${m[2]}`, fonte: d.nome, alternativas: [] }; break; }
    }
    const checklist = documentosDoProcesso(docs, resumo, campos);
    // Pessoa física não tem cartão CNPJ: "Inscrição no CPF ou no CNPJ" (Confirmação de Despesa) = documento de identidade
    if (!campos.DOC_CNPJ && checklist.tipoContratado === 'pf') {
      const i = resumo.findIndex(r => r.tipo === 'identidade' && nSEI(r.nome));
      if (i >= 0) campos.DOC_CNPJ = { valor: nSEI(resumo[i].nome), fonte: resumo[i].nome + ' (pessoa física: documento de identidade)', alternativas: [] };
    }
    conferir(campos, docs, vistos);
    return { campos, docs: resumo, checklist };
  }

  // ─── Nota fiscal (DANFSe nacional v1/v2 e um modelo antigo de NFS-e municipal) ──
  function extrairNF(texto) {
    const t = texto || '', L = t.split('\n').map(limpa), nf = {};
    const D = '(\\d{2}\\/\\d{2}\\/\\d{4})';
    const i = L.findIndex(l => /^n[uú]mero da nfs-e/i.test(l));
    const m = i >= 0 ? (L[i + 1] || '').match(new RegExp(`^(\\d+)\\s+${D}\\s+${D}`))
      : t.match(new RegExp(`N[º°o]:\\s*\\d{4}\\/(\\d+)\\s+${D}[^\\n]*?${D}`)); // "Nº:2025/14 22/09/2025 às 19:30 22/09/2025"
    if (!m) return null;
    nf.num = m[1]; nf.emissao = i >= 0 ? m[3] : m[2]; nf.competencia = i >= 0 ? m[2] : m[3];
    nf.cnpj = (t.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || [''])[0];
    nf.tomador = ((t.split(/TOMADOR/i)[1] || '').match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || [''])[0];
    // nome: palavras sem minúscula logo abaixo de "Nome / Nome Empresarial" (o resto da linha é e-mail/município)
    const j = i >= 0 ? L.findIndex(l => /^Nome \/ Nome Empresarial/i.test(l)) : L.findIndex(l => /^N[º°o]:\s*\d{4}\//.test(l));
    const toks = [];
    for (const w of (L[j + 1] || '').split(' ')) { if (/[a-zà-ÿ@]/.test(w)) break; toks.push(w); }
    nf.nome = toks.join(' ').replace(/\s*-$/, '');
    const k = L.findIndex(l => /^(Descri[cç][aã]o do Servi[cç]o|Discrimina[cç][aã]o do\(s\) Servi[cç]o)/i.test(l));
    if (k >= 0) {
      const desc = [];
      for (const l of L.slice(k + 1)) { if (!l || /^(TRIBUTA|INFORMA|VALOR TOTAL|C[oó]digo de Tributa)/.test(l)) break; desc.push(l); }
      nf.descricao = desc.join(' ').slice(0, 400); // como está na NF (maiúsculas ficam: nomes próprios)
    }
    // v1 "Valor do Serviço", v2 "VALOR DA OPERAÇÃO / SERVIÇO" (valor na linha de baixo); antiga "Valor dos serviços: R$"
    const V = '([\\d.]+[,.]\\d{2})';
    const v = t.match(new RegExp(`(?:Valor do Servi[cç]o|VALOR TOTAL DA NFS-e)[^\\n]*\\n\\s*R\\$\\s*${V}`, 'i')) || t.match(new RegExp(`Valor dos servi[cç]os:\\s*R\\$\\s*${V}`, 'i'));
    nf.mei = /Microempreendedor Individual/i.test(t);
    nf.valor = v ? 'R$ ' + v[1].replace(/\.(\d{2})$/, ',$1') : ''; // "1.250.00" (erro de digitação na NF)
    return nf;
  }

  // Grid SALIC ("Item orçamentário por produto"): linha "Cachê … mínimo médio máximo" → médio
  function extrairGrid(t) {
    const c = t.match(/Cach[eê]\D*?([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})/);
    const item = t.match(/Item Or[cç]ament[aá]rio\s*:\s*([^\n]+)/i);
    return c ? { valor: 'R$ ' + c[2], item: item ? limpa(item[1]) : '' } : null;
  }

  // Anexo I do Credenciamento ("TABELAS DE CACHÊ"): nível cujo valor bate com o da proposta
  function nivelCache(t, valor, pf) {
    const alvo = (valor.match(/[\d.]+,\d{2}/) || [''])[0];
    const partes = t.split(/CACHE N[IÍ]VEL\s*(\d+)/i);
    for (let i = 1; i < partes.length; i += 2) {
      const f = (partes[i + 1].match(/P\.\s*F[ií]sica:\s*([\d.]+,\d{2})/i) || [])[1];
      const j = (partes[i + 1].match(/P\.\s*Jur[ií]dica:\s*([\d.]+,\d{2})/i) || [])[1];
      const [v, quem] = pf ? [f, 'Física'] : [j, 'Jurídica'];
      if (v && v === alvo) return { nivel: partes[i], valor: 'R$ ' + v, quem };
    }
    return null;
  }

  // Nº SEI de cada documento, para a Declaração de Conformidade, a Confirmação de Despesa e a
  // Análise Técnica. Certidões: a mais recente de cada tipo (CNPJ e CPF juntas, "41316548, 41316552").
  // Nota fiscal depois do Contrato Registrado = a da despesa; antes (ou "Balizadora") = balizadora.
  const DOC_CERTIDAO = { 'CND Municipal': 'DOC_CND_MUNICIPAL', 'CND Estadual': 'DOC_CND_ESTADUAL', 'CND Federal': 'DOC_CND_FEDERAL',
    'CND Trabalhista': 'DOC_CND_TRABALHISTA', 'Certificado FGTS': 'DOC_FGTS', 'TCU – Licitantes Inidôneos': 'DOC_TCU_INIDONEOS',
    'TCU – Consulta Consolidada': 'DOC_TCU_CONSOLIDADA', 'CNJ – Improbidade e Inelegibilidade': 'DOC_CNJ',
    'CGU – CEIS/Correcional': 'DOC_CEIS', 'Certidão Cível / Falência': 'DOC_FALENCIA', 'Comprovante ISSQN': 'DOC_ISSQN' };
  // ─── Balizadoras (regra do usuário, 11/11/2026) ──
  // A NF balizadora tem de ser da MESMA natureza do serviço contratado (não se baliza apresentação
  // musical com nota de oficina) e a média delas tem de dar igual ou maior que o valor da proposta.
  // Natureza única, testada nesta ordem: "Oficina no Festival X" é oficina, não apresentação.
  // ponytail: palavras-chave; natureza nova (ex.: audiovisual) = nova linha aqui
  const NATUREZAS = [
    ['oficina / formação', /oficin|\bcursos?\b|\baulas?\b|workshop|capacita|palestra|ministrar|forma[cç][aã]o (de|em|art)/i],
    ['curadoria / coordenação / produção', /curadori|coordena[cç][aã]o|produ[cç][aã]o (executiva|de evento)|dire[cç][aã]o art/i],
    ['apresentação artística', /\bshows?\b|apresenta[cç][aã]o|espet[aá]culo|m[uú]sic|banda|cantor|concerto|cach[eê]|declama|dan[cç]a|teatr|art[ií]stic/i],
  ];
  const natureza = t => (NATUREZAS.find(([, re]) => re.test(t || '')) || [null])[0];
  const numero = s => +((s || '').match(/[\d.]+,\d{2}/) || ['0'])[0].replace(/\./g, '').replace(',', '.');
  const reais = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // v = valores dos campos → [{ok, texto}] para mostrar junto da Análise Técnica
  function conferirBalizadoras(v) {
    const nfs = [1, 2, 3].filter(n => v[`BAL${n}_VALOR`] || v[`BAL${n}_DESCRICAO`]);
    if (!nfs.length) return [];
    const out = [], obj = natureza(v.OBJETO_DETALHADO || v.OBJETO);
    const vals = nfs.map(n => numero(v[`BAL${n}_VALOR`])).filter(Boolean);
    if (vals.length && v.VALOR) {
      const media = vals.reduce((a, b) => a + b, 0) / vals.length, prop = numero(v.VALOR);
      out.push(media >= prop
        ? { ok: true, texto: `Média das ${vals.length} NF balizadoras: ${reais(media)} — igual ou maior que a proposta (${reais(prop)}).` }
        : { ok: false, texto: `Média das ${vals.length} NF balizadoras (${reais(media)}) é MENOR que a proposta (${reais(prop)}). Troque ou acrescente notas.` });
    }
    for (const n of nfs) {
      const nat = natureza(v[`BAL${n}_DESCRICAO`]);
      if (!nat) out.push({ ok: false, n, texto: `NF balizadora ${n} (${v[`BAL${n}_NF`] || ''}): não deu para saber a natureza do serviço pela descrição — confira.` });
      else if (obj && nat !== obj) out.push({ ok: false, n, texto: `NF balizadora ${n} (${v[`BAL${n}_NF`] || ''}) é de ${nat}, mas a contratação é de ${obj}. Use nota da mesma natureza.` });
    }
    if (obj && out.every(a => a.ok || !/natureza/.test(a.texto))) out.push({ ok: true, texto: `Natureza das NFs igual à da contratação (${obj}).` });
    return out;
  }

  // ─── Conferência do processo (v4.1.0) ────────────────────────
  // A varredura aplica as regras que o Checklist de Inexigibilidade explica em cada item ("quando",
  // "não se aplica", "atenção") — pedido do usuário, 14/11/2026: o conhecimento do Checklist tem de
  // estar na varredura, não só para ler lá. Só entra o que dá para verificar com o que foi lido;
  // CNAE compatível, qualidade do material de consagração e exclusividade ficam para o olho humano.
  // Etapas do processo, na ordem; a etapa atual é a mais adiantada cujo documento já está no processo.
  const ETAPAS = [
    [null, 'Instrução'], ['homolog', 'Homologado'], ['minuta', 'Minuta e conformidade'], ['d_dlc', 'Inexigibilidade numerada'],
    ['registrado', 'Contrato registrado'], ['assinado', 'Contrato assinado'], ['portaria', 'Portaria de fiscais'], ['empenho', 'Empenhado'],
    ['ordem_inicio', 'Ordem de Início'], ['nf_servico', 'Nota fiscal recebida'], ['confirmacao', 'Despesa confirmada'], ['preparo', 'Pagamento solicitado'],
  ];
  // Itens exigidos: [id do Checklist, nome, tipos de contratado (null = todos), etapa em que já devia existir]
  // Mesmos itens e mesma aplicabilidade do checklist.html (GROUPS: t = tipos). Manter os dois iguais.
  const TODOS = null, PJ = ['mei', 'pj'];
  const EXIGIDOS = [
    ['memorando', 'Memorando', TODOS, 1], ['tr', 'Termo de Referência', TODOS, 1], ['etp', 'Estudo Técnico Preliminar', TODOS, 1],
    ['preempenho', 'Pré-Empenho', TODOS, 1], ['atp', 'Análise Técnica de Preços', TODOS, 1], ['dfd', 'DFD', TODOS, 1], ['pca', 'Relatório PCA', TODOS, 1],
    ['cnpj', 'Cartão CNPJ', PJ, 1], ['rg', 'RG ou CNH do representante', TODOS, 1], ['contrato_social', 'Contrato Social, Estatuto ou CCMEI', PJ, 1],
    ['curriculo', 'Currículo Material de Consagração', TODOS, 1], ['nf1', 'Notas fiscais balizadoras', TODOS, 1], ['proposta', 'Proposta de Orçamento', TODOS, 1],
    ['grid', 'Comprovante Grid Orçamentário (SALIC)', TODOS, 1], ['banco', 'Dados bancários', TODOS, 1], ['balanco', 'Balanço patrimonial (2 últimos exercícios)', ['pj'], 1],
    ['cnd_mun', 'CND Municipal', TODOS, 1], ['cnd_est', 'CND Estadual', PJ, 1], ['cnd_fed_cnpj', 'CND Federal (CNPJ)', PJ, 1], ['cnd_fed_cpf', 'CND Federal (CPF)', TODOS, 1],
    ['cndt', 'CND Trabalhista', TODOS, 1], ['fgts', 'Certificado FGTS', PJ, 1], ['falencia', 'Certidão Cível / Falência', PJ, 1],
    ['improb_cnpj', 'Improbidade CNJ (CNPJ)', PJ, 1], ['improb_cpf', 'Improbidade CNJ (CPF)', PJ, 1], ['inid_cnpj', 'Licitantes Inidôneos TCU (CNPJ)', PJ, 1],
    ['inid_cpf', 'Licitantes Inidôneos TCU (CPF)', PJ, 1], ['contas_cnpj', 'Contas Julgadas Irregulares TCU (CNPJ)', PJ, 1], ['contas_cpf', 'Contas Julgadas Irregulares TCU (CPF)', PJ, 1],
    ['ceis_cnpj', 'CEIS / Correcional CGU (CNPJ)', PJ, 1], ['ceis_cpf', 'CEIS / Correcional CGU (CPF)', PJ, 1], ['tcu_consolidada', 'Consulta Consolidada TCU', PJ, 1],
    ['issqn', 'Comprovante ISSQN', PJ, 1], ['unificada', 'Declaração Unificada', TODOS, 1],
    ['conformidade', 'Declaração de Conformidade', TODOS, 2], ['minuta', 'Minuta do Contrato', TODOS, 2], ['in004', 'Parecer jurídico ou dispensa', TODOS, 3],
    ['portaria', 'Portaria de fiscais', TODOS, 6], ['empenho', 'Nota de Empenho', TODOS, 7], ['ordem_inicio', 'Ordem de Início', TODOS, 8], ['confirmacao', 'Confirmação de Despesa', TODOS, 10],
  ];
  const LIMITE_DISPENSA = 65492.11; // art. 75, II, valores de 2026 (Decreto 12.807/2025): atualizar todo ano
  const diasUteis = (d, n) => { const r = new Date(d); while (n > 0) { r.setDate(r.getDate() + 1); if (r.getDay() % 6) n--; } return r; }; // só sábado/domingo; feriado: conferir
  const fmtData = d => ddmmaaaa(d.getDate(), d.getMonth() + 1, d.getFullYear());

  // v = valores dos campos · x = extraídos (para divergências e x._checklist) · hoje
  // → { etapa: {i, nome, proxima}, pontos: [{nivel: 'erro'|'aviso'|'lembrete', texto}], faltam: [nomes], prazos: [{rotulo, texto, nivel}] }
  function conferirProcesso(v, x = {}, hoje = new Date()) {
    const chk = x._checklist || {}, achados = chk.achados || {}, fatos = chk.fatos || {}, tipo = chk.tipoContratado || '';
    const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const pontos = [], P = (nivel, texto, ref) => pontos.push(ref ? { nivel, texto, ref } : { nivel, texto }); // ref: de onde veio (a tela leva até lá)
    const cred = (v.CREDENCIAMENTO || '').trim();
    const org = ((v.ORGAO_CNPJ || '').match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || [CNPJ_ORGAO])[0];
    const temDocs = Object.keys(achados).length > 0;

    // etapa atual
    let i = 0;
    ETAPAS.forEach(([k], n) => { if (k && achados[k]) i = n; });
    const etapa = { i, nome: ETAPAS[i][1], proxima: ETAPAS[i + 1] ? ETAPAS[i + 1][1] : '' };

    // itens exigidos que ainda não estão no processo (os da etapa atual e da próxima)
    const faltam = !temDocs ? [] : EXIGIDOS.filter(([id, , tipos, fase]) => fase <= i + 1 && !achados[id] && (!tipos || !tipo || tipos.includes(tipo))
      && !(cred && ['nf1', 'proposta'].includes(id))) // credenciamento: cachê fixo da Tabela de Cachê (Anexo I do edital) — sem balizadoras nem proposta (usuário, 15/11/2026)
      .map(([, nome]) => nome);

    // Cartão CNPJ: situação ATIVA; filial pede certidões no CNPJ da matriz
    if (v.SITUACAO_CADASTRAL && !/^ATIVA/i.test(v.SITUACAO_CADASTRAL.trim())) P('erro', `Situação cadastral do CNPJ é "${v.SITUACAO_CADASTRAL}": precisa estar ATIVA para contratar.`, x.SITUACAO_CADASTRAL && { arq: x.SITUACAO_CADASTRAL.fonte, valor: v.SITUACAO_CADASTRAL });
    if (v.CNPJ && !/\/0001-/.test(v.CNPJ)) P('lembrete', 'O CNPJ é de filial: as certidões federal e trabalhista devem ser emitidas no CNPJ da matriz.');
    // Mesmo CNPJ e mesmo CPF em todos os documentos
    const diverge = k => (x[k] && x[k].diverge) || [];
    for (const o of diverge('CNPJ')) P('erro', `CNPJ diferente em ${nomeCurto(o.fonte)}: ${o.valor} (o do processo é ${v.CNPJ}). O mesmo CNPJ deve aparecer em todos os documentos.`, { arq: o.fonte, valor: o.valor });
    for (const o of diverge('REP_CPF')) P('aviso', `CPF do representante diferente em ${nomeCurto(o.fonte)}: confira se as certidões em CPF são da mesma pessoa.`, { arq: o.fonte, valor: o.valor });
    // Valor: proposta × memorando × contrato × nota fiscal
    for (const o of diverge('VALOR')) P('aviso', `Valor diferente em ${nomeCurto(o.fonte)}: ${o.valor} (o do processo é ${v.VALOR}).`, { arq: o.fonte, valor: o.valor });
    const nf = fatos.nfDespesa;
    if (nf) {
      // nota menor que o contrato pode ser parcela (contrato com mais de uma apresentação): avisa, não acusa
      if (nf.valor && v.VALOR && numero(nf.valor) !== numero(v.VALOR)) P(numero(nf.valor) > numero(v.VALOR) ? 'erro' : 'aviso', `A nota fiscal do serviço (${nf.valor}) não bate com o valor do processo (${v.VALOR})${numero(nf.valor) < numero(v.VALOR) ? ': se o pagamento é em parcelas, está certo; se não, confira' : ''}.`, { arq: nf.arq, valor: nf.valor });
      if (nf.cnpj && v.CNPJ && soDigitos(nf.cnpj) !== soDigitos(v.CNPJ)) P('erro', `A nota fiscal do serviço foi emitida por outro CNPJ (${nf.cnpj}); deve ser do contratado (${v.CNPJ}).`, { arq: nf.arq, valor: nf.cnpj });
      const nNF = natureza(nf.descricao), nObj = natureza(v.OBJETO_DETALHADO || v.OBJETO);
      if (nNF && nObj && nNF !== nObj) P('aviso', `A descrição da nota fiscal do serviço parece de ${nNF}, e a contratação é de ${nObj}: confira se é compatível com o objeto.`, { arq: nf.arq });
    }
    // Notas balizadoras: média e natureza (já conferidas na Análise Técnica) + quem emitiu, para quem e quando
    for (const c of conferirBalizadoras(v)) if (!c.ok) P('aviso', c.texto, c.n ? { sei: v[`BAL${c.n}_DOC`] } : { modelo: 'analise-tecnica' }); // a média: na Análise Técnica
    const ev = ((v.EVENTO_DATA || '').match(/\d{2}\/\d{2}\/\d{4}/) || [])[0];
    const assin = ((v.DATA_ASSINATURA || '').match(/\d{2}\/\d{2}\/\d{4}/) || [])[0]; // v5.0.2: sem evento, a data da contratação
    const ref = ev ? paraData(ev) : assin ? paraData(assin) : h, umAnoAntes = new Date(ref.getFullYear() - 1, ref.getMonth(), ref.getDate());
    (fatos.balizadoras || []).forEach((b, n) => {
      const qual = `Nota balizadora ${n + 1}${b.num ? ` (nº ${b.num})` : ''}`;
      if (b.cnpj && v.CNPJ && soDigitos(b.cnpj) !== soDigitos(v.CNPJ)) P('aviso', `${qual} foi emitida por outro CNPJ (${b.cnpj}): as balizadoras devem ser do próprio contratado.`, { arq: b.arq, valor: b.cnpj });
      if (b.data && paraData(b.data) < umAnoAntes) P('lembrete', `${qual} é de ${b.data}, mais de 1 ano antes ${ev ? 'do evento' : assin ? 'da assinatura do contrato' : 'de hoje'}: a regra pede notas de até 1 ano antes da contratação.`, { arq: b.arq, valor: b.data });
      if (org && b.tomador === org) P('lembrete', `${qual} foi emitida para o próprio órgão: a regra pede notas emitidas para outros contratantes.`, { arq: b.arq });
    });
    // Conta bancária em nome do contratado
    if (fatos.bancoTitular === false) P('aviso', 'Não achei o nome nem o CNPJ do contratado no documento dos dados bancários: confira se a conta é dele (conta de sócio ou de terceiro não é aceita).', { arq: fatos.bancoArq });
    // Proposta: data, local, horário e valor
    if (achados.proposta && (v.EVENTO || natureza(v.OBJETO_DETALHADO || v.OBJETO) === 'apresentação artística')) { // v5.0.2: troféus, assistente de direção… não
      const sem = [['EVENTO_DATA', 'data'], ['EVENTO_LOCAL', 'local'], ['EVENTO_HORARIO', 'horário'], ['VALOR', 'valor total']].filter(([k]) => !(v[k] || '').trim()).map(([, r]) => r);
      if (sem.length) P('aviso', `A proposta deve trazer data, local, horário e valor total: não achei ${sem.join(', ').replace(/, ([^,]*)$/, ' e $1')}.`, { arq: fatos.propostaArq });
    }
    // Balanço (empresa que não é MEI) e limite da dispensa de análise jurídica
    const valor = numero(v.VALOR);
    if (tipo === 'pj' && temDocs && !achados.balanco) P('lembrete', 'Empresa que não é MEI: o balanço dos 2 últimos exercícios é exigido' +
      (valor && valor < LIMITE_DISPENSA / 4 ? `. Como o valor está abaixo de ${reais(LIMITE_DISPENSA / 4)}, a dispensa é possível, mas precisa ser justificada no processo ; confirme com o setor financeiro.` : ' (ser do Simples Nacional não dispensa).'));
    // Sede do contratado: as certidões municipal, estadual e de falência são as do lugar da sede

    // Prazos (dias úteis contam só sábado e domingo — confira feriados)
    const prazos = [];
    if (ev) {
      const dias = Math.round((paraData(ev) - h) / 864e5);
      prazos.push({ rotulo: 'Evento', texto: dias > 1 ? `${ev} — faltam ${dias} dias` : dias === 1 ? `${ev} — é amanhã` : dias === 0 ? `${ev} — é hoje` : `${ev} — já aconteceu`, nivel: dias >= 0 && dias <= 7 ? 'aviso' : '' });
      if (temDocs && dias >= 0 && dias <= 7 && i < 7) P('erro', `O evento é ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : 'em ' + dias + ' dias'} e o processo ainda não tem empenho (etapa: ${etapa.nome}). O empenho vem antes da execução do serviço.`);
      else if (temDocs && dias >= 0 && dias <= 3 && i < 8) P('aviso', `O evento é ${dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : 'em ' + dias + ' dias'} e ainda falta a Ordem de Início, que deve ser assinada antes da execução.`);
    }
    const ass = ((v.DATA_ASSINATURA || '').match(/\d{2}\/\d{2}\/\d{4}/) || [])[0];
    if (ass) {
      const pncp = diasUteis(paraData(ass), 10);
      prazos.push({ rotulo: 'PNCP', texto: `até ${fmtData(pncp)}: 10 dias úteis da assinatura (confira se foi enviado)`, nivel: '' });
    }
    const ordem = { erro: 0, aviso: 1, lembrete: 2 };
    pontos.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
    return { etapa, pontos, faltam, prazos };
  }
  // "[29]-41316585_Proposta_de_Orcamento.pdf" → "Proposta de Orcamento"
  const nomeCurto = f => { const m = String(f).match(/^\[\d+\]-\d{8}_(.+?)\.\w+$/); return m ? m[1].replace(/_+/g, ' ').trim() : String(f); };

  // Sem Contrato Registrado na pasta: a NF que o contratado manda para receber pelo serviço já
  // prestado = tomador é o órgão (se o CNPJ dele estiver nos campos), prestador é o contratado e a data é do dia do evento em diante
  // (sem data do evento: valor igual ao da proposta). Balizadora é de serviço anterior ao processo.
  function ehNFdaDespesa(nf, campos) {
    const val = k => campos[k] && campos[k].valor;
    if ((CNPJ_ORGAO && nf.tomador !== CNPJ_ORGAO) || (val('CNPJ') && soDigitos(nf.cnpj) !== soDigitos(val('CNPJ')))) return false;
    const ev = ((val('EVENTO_DATA') || '').match(/\d{2}\/\d{2}\/\d{4}/) || [])[0];
    const data = nf.competencia || nf.emissao;
    if (ev && data) return paraData(data) >= paraData(ev);
    return !!val('VALOR') && (val('VALOR').match(/[\d.]+,\d{2}/) || [])[0] === (nf.valor.match(/[\d.]+,\d{2}/) || [])[0];
  }
  function documentosDoProcesso(docs, resumo, campos) {
    const poe = (k, valor, fonte) => { if (valor && !campos[k]) campos[k] = { valor, fonte, alternativas: [] }; };
    const nSEI = nome => (nome.match(/(?:^|[\]\-_ ])(\d{8})_/) || [])[1];
    const ultima = {}, curriculos = [], balizadoras = [];
    let depoisDoContrato = false, despesa = null, mei = false, nfMEI = false, empenho = null, fiscal = null, fiscais = null, bancoTitular = null, bancoArq = '', propostaArq = '';
    const achados = {}, certChk = {}; // checklist: item → { sei, val }
    docs.forEach((d, i) => {
      const n = nSEI(d.nome), nome = norm(d.nome), t = d.texto || '', tipo = resumo[i].tipo;
      if (ehContrato(d.nome)) depoisDoContrato = true;
      if (!n) return;
      if (tipo === 'curriculo' && !/portf/.test(nome)) curriculos.push(n);
      const c = tipo !== 'cnpj' && validadeCertidao(d.nome, t);
      // CND Federal: a de CNPJ vai na Confirmação de Despesa; a de CPF (sócio majoritário) é campo à parte
      const k = c && (c.rotulo === 'CND Federal (CPF)' ? 'DOC_CND_FEDERAL_CPF' : DOC_CERTIDAO[c.rotulo.replace(/ \(.*/, '')]);
      if (k) ultima[c.rotulo] = { n, nome: d.nome, k, validade: c.validade };
      if (c && (CERT_CHECKLIST[c.rotulo.replace(/ \(.*/, '')] || c.informativo)) certChk[c.rotulo] = { n, validade: c.validade };
      for (const [re, item] of CHECKLIST_POR_NOME) if (re.test(nome) && !achados[item]) achados[item] = { sei: n };
      const item = { identidade: 'rg', contrato_social: 'contrato_social', bancario: 'banco', proposta: 'proposta' }[tipo];
      if (item && !achados[item]) achados[item] = { sei: n };
      if (/ccmei/.test(nome) || /condi[cç][aã]o\s+de\s+microempreendedor\s+individual/i.test(t.slice(0, 400))) mei = true;
      if (/\.html?$/.test(nome) && !campos.DOC_HOMOLOGACAO && /Gabinete do Secret[aá]rio/i.test(t) && /\bhomologo\b/i.test(t) && /Memorando|Termo de Refer/i.test(t))
        poe('DOC_HOMOLOGACAO', n, d.nome);
      const g = /item or[cç]ament[aá]rio por produto/i.test(t) && extrairGrid(t);
      if (g) { poe('DOC_GRID', n, d.nome); poe('GRID_VALOR', g.valor, d.nome); poe('GRID_ITEM', g.item, d.nome); }
      if (/TABELAS? DE CACH/i.test(t.slice(0, 500))) {
        poe('DOC_TABELA_CACHE', n, d.nome);
        const nv = campos.VALOR && nivelCache(t, campos.VALOR.valor, !campos.CNPJ);
        if (nv) {
          const ed = campos.CREDENCIAMENTO ? `, conforme Edital de Credenciamento nº ${+campos.CREDENCIAMENTO.valor.split('/')[0]}/${campos.CREDENCIAMENTO.valor.split('/')[1]}` : '';
          poe('CACHE_DESCRICAO', `Apresentação Musical Cachê Nível ${nv.nivel}: Pessoa ${nv.quem}${ed}`, d.nome);
          poe('CACHE_VALOR', nv.valor, d.nome);
        }
      }
      // Ordem de Início: nº da Nota de Empenho (nome do arquivo "…_2026NE000911.pdf" ou texto) — vale a mais recente
      const ne = tipo === 'empenho' && !/pre.?empenho/.test(nome) && ((nome.match(/(\d{4})ne(\d{6})/) || []).slice(1).join('NE') || (t.match(/\b(\d{4}NE\d{6})\b/) || [])[1]);
      if (ne) empenho = { ne, nome: d.nome };
      // fiscal de serviço (Ordem de Início): linha "Fiscal de Serviço | NOME | matrícula/1 | cargo" da Portaria
      const fs = /portaria/.test(nome) && limpa(t).match(/Fiscal de\s*Servi[cç]o\s+(.+?)\s+(\d{5,8})(?:\/\d+)?\b/i);
      if (fs) fiscal = { nome: fs[1].trim(), mat: fs[2], arq: d.nome };
      // tabela de fiscais inteira (Portaria ou despacho à EEP com a minuta): cada célula numa linha —
      // "Fiscal de Contrato | titular | matrícula/1 | cargo | suplente | matrícula/1 | cargo". Vale a mais recente.
      if (/\.html?$/.test(nome) && /Fiscal de\s*Servi/i.test(t)) {
        const cel = t.split('\n').map(limpa).filter(Boolean).join(' | ');
        const linha = qual => cel.match(new RegExp(`Fiscal de[\\s|]*${qual}\\s*\\|\\s*([^|]+?)\\s*\\|\\s*(\\d{5,8})(?:\\/\\d+)?\\s*\\|\\s*([^|]+?)\\s*\\|\\s*([^|]+?)\\s*\\|\\s*(\\d{5,8})(?:\\/\\d+)?\\s*\\|\\s*([^|]+?)\\s*(?:\\||$)`, 'i'));
        const c = linha('Contrato'), sv = linha('Servi[cç]o');
        if (c || sv) fiscais = { CONTRATO: c, SERVICO: sv, arq: d.nome };
      }
      const pe = tipo === 'empenho' && /pre.?empenho/.test(nome) && ((nome.match(/(\d{4})pe(\d{6})/) || []).slice(1).join('PE') || (t.match(/\b(\d{4}PE\d{6})\b/) || [])[1]);
      if (pe) poe('NUM_PRE_EMPENHO', pe, d.nome);
      if (/publicacao/.test(nome) && (/inexigibilidade/.test(nome) || /EXTRATO DE INEXIGIBILIDADE/i.test(t))) poe('DOC_PUB_INEX', n, d.nome);
      // Conta bancária em nome do contratado? (regra do Checklist: conta de sócio ou de terceiro não é aceita)
      if (tipo === 'proposta' && !propostaArq) propostaArq = d.nome;
      if (tipo === 'bancario' && t.trim()) {
        bancoArq = bancoArq || d.nome;
        const alvo = norm(t), cnpjD = soDigitos((campos.CNPJ || {}).valor || '');
        const nomes = [(campos.EMPRESA_NOME || {}).valor, (campos.REP_NOME || {}).valor].filter(Boolean)
          .map(x => norm(x).replace(/^[\d. ]+|[\d ]+$/g, '').trim()).filter(x => x.length >= 6);
        const achou = (cnpjD.length === 14 && soDigitos(t).includes(cnpjD)) || nomes.some(x => alvo.includes(x));
        bancoTitular = bancoTitular || achou;
      }
      const nf = /nota.fiscal|nfs.?e/.test(nome) || /nfs-e/i.test(t.slice(0, 300)) ? extrairNF(t) : null;
      if (nf && nf.mei && campos.CNPJ && soDigitos(nf.cnpj) === soDigitos(campos.CNPJ.valor)) nfMEI = true;
      if (nf) ((!/balizador/.test(nome) && (depoisDoContrato || ehNFdaDespesa(nf, campos))) ? (despesa = { ...nf, n, fonte: d.nome }) : balizadoras.push({ ...nf, n, fonte: d.nome }));
    });
    // certidão: CNPJ e CPF do mesmo tipo juntas, em ordem
    const porCampo = {};
    for (const c of Object.values(ultima)) (porCampo[c.k] ||= []).push(c);
    for (const [k, cs] of Object.entries(porCampo)) poe(k, cs.map(c => c.n).sort().join(', '), cs.map(c => c.nome).join(' + '));
    if (curriculos.length) poe('DOC_CURRICULOS', curriculos.join(', '), 'currículos da pasta');
    if (empenho) poe('NUM_EMPENHO', empenho.ne, empenho.nome);
    if (fiscais) for (const f of ['CONTRATO', 'SERVICO']) {
      const m = fiscais[f]; if (!m) continue;
      ['NOME', 'MATRICULA', 'CARGO', 'SUP_NOME', 'SUP_MATRICULA', 'SUP_CARGO'].forEach((k, i) => poe(`FISCAL_${f}_${k}`, m[i + 1].trim(), fiscais.arq));
    }
    if (fiscal) { poe('FISCAL_SERVICO_NOME', fiscal.nome, fiscal.arq); poe('FISCAL_SERVICO_MATRICULA', fiscal.mat, fiscal.arq); }
    if (despesa) {
      const f = despesa.fonte;
      poe('DOC_NF', despesa.n, f); poe('NF_NUMERO', despesa.num, f); poe('NF_VALOR', despesa.valor, f);
      poe('NF_RECEBIDA', despesa.emissao, f + ' (data de emissão — confira o dia do recebimento)');
    }
    // mais de 3 NFs: primeiro as da mesma natureza da contratação (ordem da pasta mantida entre iguais)
    const val = k => campos[k] && campos[k].valor;
    const obj = natureza(val('OBJETO_DETALHADO') || val('OBJETO')) || (val('ARTISTA') ? 'apresentação artística' : null);
    // escolhidas as 3, voltam à ordem da pasta: "Nota Fiscal Balizadora 1/2/3" no SEI segue a ordem do processo (v5.1.1)
    balizadoras.forEach((b, i) => { b.ordem = i; });
    if (obj) balizadoras.sort((a, b) => (natureza(b.descricao) === obj) - (natureza(a.descricao) === obj));
    balizadoras.splice(3); balizadoras.sort((a, b) => a.ordem - b.ordem);
    balizadoras.forEach((b, i) => {
      const p = `BAL${i + 1}_`;
      poe(p + 'NF', `${b.num}/${b.emissao.slice(-4)}`, b.fonte);
      poe(p + 'EMPRESA', b.nome + (b.cnpj ? ` / CNPJ ${b.cnpj}` : ''), b.fonte);
      poe(p + 'DESCRICAO', b.descricao, b.fonte); poe(p + 'DATA', b.competencia, b.fonte);
      poe(p + 'VALOR', b.valor, b.fonte); poe(p + 'DOC', b.n, b.fonte);
    });
    // ── Checklist (v2.0): item → documento achado ──
    const doCampo = { memorando: 'DOC_MEMORANDO', tr: 'DOC_TR', etp: 'DOC_ETP', preempenho: 'DOC_PRE_EMPENHO',
      atp: 'DOC_ANALISE_TECNICA', dfd: 'DOC_DFD', pca: 'DOC_PCA', homolog: 'DOC_HOMOLOGACAO', cnpj: 'DOC_CNPJ',
      curriculo: 'DOC_CURRICULOS', exclusividade: 'DOC_EXCLUSIVIDADE', nf1: 'BAL1_DOC', nf2: 'BAL2_DOC', nf3: 'BAL3_DOC',
      proposta: 'DOC_PROPOSTA', grid: 'DOC_GRID', balanco: 'DOC_BALANCO', unificada: 'DOC_DU', minuta: 'DOC_MINUTA',
      registrado: 'DOC_CONTRATO', portaria: 'DOC_PORTARIA', nf_servico: 'DOC_NF' };
    for (const [item, k] of Object.entries(doCampo)) if (val(k)) achados[item] = { sei: val(k) };
    if (val('DATA_ASSINATURA')) achados.assinado = {};
    for (const [rot, c] of Object.entries(certChk)) {
      const base = rot.replace(/ \(.*/, ''), cpf = / \(CPF\)$/.test(rot);
      if (base === 'Consulta CNPJ') { achados.cnpj ||= { sei: c.n }; continue; }
      const [cnpjId, cpfId] = CERT_CHECKLIST[base];
      // sem (CNPJ)/(CPF) no rótulo: um documento só para os dois (ex.: "Consulta_CEIS_CNPJ_e_CPF")
      for (const id of cpf ? [cpfId] : / \(CNPJ\)$/.test(rot) || !cpfId ? [cnpjId] : [cnpjId, cpfId])
        if (id) achados[id] = { sei: c.n, ...(c.validade ? { val: c.validade } : {}) };
    }
    // tipo de contratado: MEI (CCMEI, nome começando com o nº do CNPJ, NF "Microempreendedor Individual"), PJ, PF
    const nomeEmp = val('EMPRESA_NOME') || '';
    // LTDA/associação vence a NF antiga "Optante MEI" (empresa que era MEI e virou LTDA, processo 042386)
    const tipoContratado = mei || /^\d{2}\.\d{3}\.\d{3} |\b\d{11}$/.test(nomeEmp) ? 'mei'
      : /\b(LTDA|S\.?\s?A\.?|EIRELI|ASSOCIA[CÇ][AÃ]O|INSTITUTO|FUNDA[CÇ][AÃ]O|COOPERATIVA)\b/i.test(nomeEmp) ? 'pj'
      : nfMEI ? 'mei'
      : val('CNPJ') ? 'pj' : val('REP_CPF') ? 'pf' : '';
    const resumoNF = b => ({ arq: b.fonte, num: b.num, cnpj: b.cnpj, tomador: b.tomador, data: b.competencia || b.emissao, valor: b.valor, descricao: b.descricao });
    const fatos = { nfDespesa: despesa ? resumoNF(despesa) : null, balizadoras: balizadoras.slice(0, 3).map(resumoNF), bancoTitular, bancoArq, propostaArq };
    return { achados, tipoContratado, empresario: !!val('DOC_EXCLUSIVIDADE'), fatos };
  }
  // Checklist: certidão (rótulo do quadro de validade) → [item CNPJ, item CPF] do Checklist de Inexigibilidade
  const CERT_CHECKLIST = { 'CND Municipal': ['cnd_mun'], 'CND Estadual': ['cnd_est'], 'CND Federal': ['cnd_fed_cnpj', 'cnd_fed_cpf'],
    'CND Trabalhista': ['cndt'], 'Certificado FGTS': ['fgts'], 'Certidão Cível / Falência': ['falencia'],
    'CNJ – Improbidade e Inelegibilidade': ['improb_cnpj', 'improb_cpf'], 'TCU – Licitantes Inidôneos': ['inid_cnpj', 'inid_cpf'],
    'TCU – Contas Julgadas Irregulares': ['contas_cnpj', 'contas_cpf'], 'CGU – CEIS/Correcional': ['ceis_cnpj', 'ceis_cpf'],
    'TCU – Consulta Consolidada': ['tcu_consolidada'], 'Comprovante ISSQN': ['issqn'] };
  // Checklist: documentos que só se reconhecem pelo nome do arquivo exportado do SEI
  const CHECKLIST_POR_NOME = [
    [/declaracao_conf/, 'conformidade'], [/dispensa_de_analise|parecer_juridico/, 'in004'],
    [/nota_de_empenho/, 'empenho'],
    [/ordem_de_inicio/, 'ordem_inicio'], [/confirmacao_d[ae]_despesa/, 'confirmacao'], [/preparo_de_pagamento/, 'preparo'],
  ];

  // ─── Conferência cruzada ──────────────────────────────────
  // Para cada dado cadastral escolhido: em quais documentos ele aparece (reforça que está
  // certo) e quais documentos trouxeram outro valor (discrepância). Procura no texto de
  // TODOS os documentos, inclusive os "Outro" — uma certidão ou o plano de trabalho que
  // cita o nome do sócio confirma o nome mesmo sem ser fonte principal.
  const CONFERIR = ['EMPRESA_NOME', 'CNPJ', 'REP_NOME', 'REP_CPF', 'REP_RG', 'REP_NASCIMENTO', 'VALOR', 'AGENCIA', 'CONTA'];
  const DIGITOS = new Set(['CNPJ', 'REP_RG', 'REP_NASCIMENTO', 'VALOR', 'AGENCIA', 'CONTA']);
  const meioCPF = v => (/[*X]/i.test(v) ? (v.match(/(\d{3})/) || [])[1] : soDigitos(v).slice(6, 9)) || '';
  // chave de comparação: ignora acento, caixa, pontuação e o CNPJ que o MEI leva no nome
  function chave(k, v) {
    if (k === 'REP_CPF') return meioCPF(v);
    if (DIGITOS.has(k)) return soDigitos(v);
    return norm(v).replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function aparece(k, v, texto) {
    if (k === 'REP_CPF') {
      const d = soDigitos(v), m = meioCPF(v);
      const cheio = d.length === 11 && new RegExp(d.split('').join('[.\\-/ ]?')).test(texto);
      return cheio || new RegExp(`[*X]{3}\\.?[*X]{3}\\.?${m}\\s?-?\\s?[*X]{2}`, 'i').test(texto);
    }
    if (DIGITOS.has(k)) {
      const d = k === 'VALOR' ? (v.match(/[\d.]+,\d{2}/) || [''])[0] : soDigitos(v);
      if (d.length < 4) return false; // agência "0001" etc. aparece em qualquer lugar
      return k === 'VALOR' ? texto.includes(d) : new RegExp(`(^|\\D)${d.split('').join('[.\\-/ ]?')}(\\D|$)`).test(texto);
    }
    const c = chave(k, v);
    return c.length >= 6 && chave(k, texto).includes(c);
  }
  function conferir(campos, docs, vistos) {
    for (const k of CONFERIR) {
      const c = campos[k];
      if (!c) continue;
      c.confere = docs.filter(d => d.texto && aparece(k, c.valor, d.texto)).map(d => d.nome);
      const base = chave(k, c.valor), ja = new Set([base]);
      c.diverge = [];
      for (const o of vistos[k] || []) {
        const ch = chave(k, o.valor);
        // CPF completo × mascarado com os mesmos 3 dígitos do meio não é discrepância
        // nome parcial ("Denis Lima" × "Denis Lima Santos") também não é discrepância
        if (!ch || ja.has(ch) || (!DIGITOS.has(k) && k !== 'REP_CPF' && (ch.includes(base) || base.includes(ch)))) continue;
        const palavras = s => s.split(' ').filter(w => w.length >= 3);
        if (k === 'REP_NOME' && !palavras(ch).some(w => palavras(base).includes(w))) continue; // v5.0.2: "Dia Toca Eufdenscvento" (OCR) não é outra pessoa
        ja.add(ch); c.diverge.push(o);
      }
    }
  }

  // Campos montados a partir dos outros (o usuário pode sobrescrever qualquer um).
  function derivados(v) {
    const d = {};
    if (v.REP_CPF) d.REP_CPF_MASCARADO = mascaraCPF(v.REP_CPF);
    if (v.VALOR) d.VALOR_EXTENSO = porExtenso(v.VALOR);
    const datas = (v.EVENTO_DATA || '').match(/\d{2}\/\d{2}\/\d{4}/g) || [];
    if (datas.length) d.EVENTO_DATA_EXTENSO = juntaLista(datas.map(dataExtenso));
    const n = Math.max(datas.length, 1);
    d.QUANTIDADE = `${n} (${QTD_EXT[n] || n}) apresenta${n > 1 ? 'ções' : 'ção'}`;
    if (v.ARTISTA) {
      d.OBJETO = `Realizar a apresentação musical de ${v.ARTISTA}.`;
      const partes = [`Realizar a apresentação musical de ${v.ARTISTA}`];
      if (v.EVENTO) partes.push(`no evento ${v.EVENTO}`);
      if (datas.length) partes.push(`${datas.length > 1 ? 'nos dias' : 'no dia'} ${v.EVENTO_DATA}`);
      if (v.EVENTO_HORARIO) partes.push(`das ${v.EVENTO_HORARIO}`);
      if (v.EVENTO_LOCAL) partes.push(`em ${v.EVENTO_LOCAL}`);
      d.OBJETO_DETALHADO = partes.join(', ') + '.';
    }
    if (v.EMPRESA_NOME) {
      d.JUSTIFICATIVA = `Justifica-se a contratação da empresa ${v.EMPRESA_NOME}, pois tem reconhecido mérito no meio artístico.` +
        (v.CURRICULO_TRECHO ? ' ' + v.CURRICULO_TRECHO : '');
    }
    // Declaração de Conformidade, linha da Fazenda: Municipal, Estadual, Federal da empresa (CNPJ) e do
    // sócio (CPF) — tudo num campo só, para não faltar nenhuma (achado pelo usuário, v1.1.1)
    const faz = [v.DOC_CND_MUNICIPAL, v.DOC_CND_ESTADUAL, v.DOC_CND_FEDERAL, v.DOC_CND_FEDERAL_CPF].filter(Boolean);
    if (faz.length) d.DOC_REGULARIDADE_FAZENDA = faz.join(', ');
    // Justificativa de preço da Análise Técnica (texto de análises reais)
    const fim = ' Levando-se em conta tal fator, esta proposta parece-nos acessível e vantajosa à contratação pela Administração.';
    if (v.VALOR && v.CREDENCIAMENTO) {
      const [n, a] = v.CREDENCIAMENTO.split('/');
      d.JUSTIFICATIVA_PRECO = `O valor de ${v.VALOR} por apresentação da empresa está na média dos valores praticados no mercado e dentro do cachê que consta no Edital de Credenciamento nº ${+n}/${a}` +
        (v.DOC_TABELA_CACHE ? ` (${v.DOC_TABELA_CACHE})` : '') + ', conforme comprovantes balizadores de prestação de contas de cachês de apresentações artísticas do site VERSALIC de projetos da Lei de Incentivo à Cultura.' + fim;
    } else if (v.VALOR && v.EMPRESA_NOME) {
      d.JUSTIFICATIVA_PRECO = `O valor de ${v.VALOR} da empresa ${v.EMPRESA_NOME}${v.CNPJ ? ', CNPJ ' + v.CNPJ : ''}, está na média dos valores praticados no mercado, conforme notas fiscais balizadoras e comprovante balizador de prestação de contas de cachês de apresentações artísticas do site VERSALIC de projetos da Lei de Incentivo à Cultura.` + fim;
    }
    return d;
  }

  // ─── Validade das certidões ─────────────────────────────────
  // Fonte principal: o TEXTO do documento ("Válida até 01/04/2027", "Validade: 08/05/2027",
  // FGTS "Validade: 29/10/2026 a 27/11/2026", Estadual "é válida até 7/1/2027"). O nome do arquivo
  // ("val._09.12.2026") é só reserva — nem todo mundo coloca. Sem nenhum dos dois, NÃO inventa
  // prazo (CND Municipal varia de cidade para cidade): devolve só a data de emissão para conferir.
  // ordem importa: as específicas antes da Federal (o texto da CND Municipal cita a Receita Federal)
  // 4º item true = informativo: Consulta CNPJ ganha 30 dias só para saber que é recente; não
  // precisa ser atualizada no processo depois de incluída (pedido do usuário, 11/11/2026)
  const TIPOS_CERTIDAO = [
    [/comprovante de inscri[cç][aã]o\s+e\s+de\s+situa[cç][aã]o|consulta.cnpj|cart[aã]o.cnpj/i, 'Consulta CNPJ', false, true],
    // antes da CND Municipal: o comprovante de ISSQN também diz "Secretaria Municipal da Fazenda" (v5.0.1)
    [/cadastro de issqn|comprovante.issqn/i, 'Comprovante ISSQN'],
    // outras cidades escrevem "Prefeitura de X" / "débitos municipais" (o ISSQN, que também cita a prefeitura, é testado antes)
    [/fazenda p[uú]blica municipal|secretaria municipal da fazenda|tributos municipais|d[eé]bitos municipais|prefeitura (municipal )?de [a-zà-ú]|cnd.municipal/i, 'CND Municipal', true],
    [/receita estadual|fazenda estadual|secretaria da fazenda.{0,40}rio grande do sul|cnd.estadual/i, 'CND Estadual', true],
    [/d[eé]bitos trabalhistas|justi[cç]a do trabalho|\bcndt\b|trabalhist/i, 'CND Trabalhista', true],
    [/\bfgts\b|regularidade do fgts|\bcrf\b/i, 'Certificado FGTS', true],
    // TCU/CNJ/CGU antes da Federal: a Consulta Consolidada cita a "Receita Federal" (virava CND Federal, processo 153676)
    [/consulta consolidada/i, 'TCU – Consulta Consolidada'],
    [/licitantes inid[oô]neos/i, 'TCU – Licitantes Inidôneos'],
    [/contas julgadas irregulares|cadirreg/i, 'TCU – Contas Julgadas Irregulares'],
    [/improbidade/i, 'CNJ – Improbidade e Inelegibilidade'],
    [/\bceis\b|correcional|cnep|cepim/i, 'CGU – CEIS/Correcional'],
    [/tributos federais|d[ií]vida ativa da uni[aã]o|receita federal|cnd.federal/i, 'CND Federal', true],
    [/fal[eê]ncia|c[ií]vel/i, 'Certidão Cível / Falência'],
    [/issqn/i, 'Comprovante ISSQN'],
  ];
  const ddmmaaaa = (d, m, a) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(a).length === 2 ? '20' + a : a}`;
  function validadeCertidao(nome, texto) {
    const n = norm(nome).replace(/[_]+/g, ' '), t = limpa(texto || '');
    const ehCertidao = /\bcnd\b|certid|certificado|fgts|consulta|\bcrf\b|issqn/.test(n) ||
      /^.{0,300}(certid[aã]o|certificado de regularidade|comprovante de inscri[cç][aã]o\s+e\s+de\s+situa|comprovante de inscri[cç][aã]o no cadastro de issqn)/i.test(t);
      // ↑ v5.0.1: o comprovante de ISSQN da SMF vem do SEI só como "Comprovante.pdf" (achado pelo usuário: o nº não era achado)
    // CCMEI ("Certificado da Condição de Microempreendedor Individual") e currículo não têm validade
    // .html = documento do próprio SEI (despacho que cita "certidão"), nunca a certidão em si
    if (!ehCertidao || /\.html?$/.test(n) || /curricul|portf|ccmei/.test(n) || /microempreendedor\s+individual|item or[cç]ament[aá]rio por produto/i.test(t.slice(0, 300))) return null; // Grid do SALIC vem como "Consulta.pdf"
    // tipo: pelo nome quando ele já diz (o SEI exporta "CND_Municipal"); pelo texto quando é genérico ("Certidao.pdf")
    const tipo = TIPOS_CERTIDAO.find(([re]) => re.test(n)) || TIPOS_CERTIDAO.find(([re]) => re.test(t.slice(0, 1500)));
    // nome não diz CPF/CNPJ (ex.: dois "CND_Federal.pdf"): o 1º nº de CPF/CNPJ do texto decide
    const id = (t.slice(0, 1500).match(/\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || [''])[0];
    const doc = /\bcpf\b/.test(n) && !/\bcnpj\b/.test(n) ? ' (CPF)' : /\bcnpj\b/.test(n) && !/\bcpf\b/.test(n) ? ' (CNPJ)'
      : /\bcpf\b|\bcnpj\b/.test(n) || !tipo || (tipo[2] && !/Federal/.test(tipo[1])) ? '' // Municipal/Estadual/FGTS/Trabalhista: só CNPJ
      : id.includes('/') ? ' (CNPJ)' : id ? ' (CPF)' : '';
    const rotulo = tipo ? tipo[1] + (tipo[3] || /ISSQN/.test(tipo[1]) ? '' : doc) // ISSQN é sempre do CNPJ: sem "(CNPJ)"
      : limpa(nome.replace(/^\[\d+\]-\d+_/, '').replace(/[_]+/g, ' ').replace(/\s*val\..*$/i, '').replace(/\.(pdf|html?|jpe?g|png)$/i, ''));
    const D = '(\\d{1,2})\\s*\\/\\s*(\\d{1,2})\\s*\\/\\s*(\\d{4}|\\d{2})(?!\\d)'; // ano com 4 ou 2 dígitos (CND de Canoas: 27/12/26)
    let validade = '', fonte = '';
    const intervalo = t.match(new RegExp(`validade\\s*:?\\s*${D}\\s*a\\s*${D}`, 'i'));
    const ate = t.match(new RegExp(`v[aá]lid[ao]\\s+at[eé]\\s*:?\\s*(?:o dia\\s*)?${D}`, 'i')) ||
                t.match(new RegExp(`(?:validade|prazo de validade)\\s*:?\\s*(?:at[eé]\\s*)?${D}`, 'i'));
    // validade em tabela: o rótulo "VALIDADE" e, logo depois, as datas da linha (protocolo, validade, expedição).
    // A validade é a mais adiante delas (nunca vem antes da expedição).
    const tabela = !intervalo && !ate && (t.match(/\bvalidade\b[^\d]{0,60}((?:\d+\s*)?(?:\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})(?!\d)\s*){2,4})/i) || [])[1];
    const datasTabela = tabela ? [...tabela.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/g)].map(m => ddmmaaaa(m[1], m[2], m[3])) : [];
    if (intervalo) { validade = ddmmaaaa(intervalo[4], intervalo[5], intervalo[6]); fonte = 'texto'; }
    else if (ate) { validade = ddmmaaaa(ate[1], ate[2], ate[3]); fonte = 'texto'; }
    else if (datasTabela.length >= 2) { validade = datasTabela.reduce((a, b) => paraData(b) > paraData(a) ? b : a); fonte = 'texto'; }
    const vn = n.match(/val[. ]*(\d{2})[. ](\d{2})[. ](\d{2,4})\b/), noNome = vn ? ddmmaaaa(vn[1], vn[2], vn[3]) : '';
    if (!validade && noNome) { validade = noNome; fonte = 'nome do arquivo'; }
    const nomeDiz = noNome && fonte === 'texto' && noNome !== validade ? noNome : ''; // v5.0.2: o nome do arquivo diz outra data
    // Data de emissão — cada órgão escreve de um jeito (conferido nas certidões reais):
    // "emitida em", "Expedição:", "certifica, em", "nesta data (", "Gerado em:", "Dados da consulta:",
    // "Consulta realizada em:", "Emitido na Internet, em", "aos 09 dias do mês de NOVEMBRO…",
    // e a Cível do TJRS só traz a data por extenso: "9 de novembro de 2026, às 15:00:42".
    const em = t.match(new RegExp(`(?:emitida em|emitido(?: na internet)?,? em|emiss[aã]o:?|expedi[cç][aã]o:?|emitid[ao] [^.]{0,30}?do dia|emitid[ao] no dia|certifica,? em|nesta data \\(|gerado em:?|dados da consulta:?|consulta realizada em:?)\\s*${D}`, 'i'));
    const emAos = t.match(/aos (\d{1,2}) dias do m[eê]s de ([a-zà-ú]+) do ano de (\d{4})/i); // [a-zà-ú]: \w não pega o ç de março
    const emExtenso = t.match(/\b(\d{1,2}) de ([a-zà-ú]+) de (\d{4}),? [àa]s \d{1,2}:\d{2}/i);
    const MES = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const deExtenso = m => m && MES.includes(norm(m[2])) ? ddmmaaaa(m[1], MES.indexOf(norm(m[2])) + 1, m[3]) : '';
    const emissao = em ? ddmmaaaa(em[1], em[2], em[3]) : deExtenso(emAos) || deExtenso(emExtenso);
    const confirmacaoDespesa = !!(tipo && tipo[2]);
    // Sem validade escrita: emissão + prazo que o próprio documento informar ("validade de 90 dias a
    // partir da data de sua emissão") ou 30 dias — para todas as certidões, certificados e consultas,
    // inclusive as CNDs da Confirmação de Despesa (regra do usuário, 11/11/2026 e 15/11/2026).
    if (!validade && emissao) {
      const prazo = t.match(/(?:validade de|v[aá]lid[ao] por|prazo de validade de)\s*(\d{1,3})\s*(?:\([^)]*\))?\s*dias/i); // "validade de 90 dias", "válida por 60 dias"
      {
        const dias = prazo ? +prazo[1] : 30;
        const v = paraData(emissao); v.setDate(v.getDate() + dias);
        validade = ddmmaaaa(v.getDate(), v.getMonth() + 1, v.getFullYear());
        fonte = prazo ? `emissão + ${dias} dias (prazo do documento)` : 'emissão + 30 dias (padrão)';
      }
    }
    return { rotulo, validade, fonte, emissao, confirmacaoDespesa, informativo: !!(tipo && tipo[3]), ...(nomeDiz ? { nomeDiz } : {}) };
  }
  function paraData(s) { const [d, m, a] = s.split('/').map(Number); return new Date(a, m - 1, d); }
  // situação de cada certidão em relação a hoje e à data do evento (a mais nova de cada tipo vale)
  const ORDEM = ['vencida', 'antes-evento', 'vencendo', 'sem-data', 'ok', 'informativo'];
  // Onde emitir de novo e como nomear no SEI ("Nome na Árvore"), por tipo de certidão. Os endereços são os do
  // Checklist; os nomes seguem o costume dos processos ("Certificado FGTS val. 02.12.2026", "Consulta CEIS CNPJ val. …").
  const INFO_CERTIDAO = {
    'Consulta CNPJ': ['Consulta CNPJ', 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/'],
    'CND Municipal': ['CND Municipal', ''], // município da sede do contratado
    'CND Estadual': ['CND Estadual', ''], // estado da sede do contratado
    'CND Federal': ['CND Federal', 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home'],
    'CND Trabalhista': ['CND Trabalhista', 'https://cndt-certidao.tst.jus.br/inicio.faces'],
    'Certificado FGTS': ['Certificado FGTS', 'https://consulta-crf.caixa.gov.br/'],
    'TCU – Consulta Consolidada': ['Consulta Consolidada TCU', 'https://certidoes-apf.apps.tcu.gov.br/'],
    'TCU – Licitantes Inidôneos': ['Certidão Negativa de Licitantes Inidôneos', 'https://certidoes.apps.tcu.gov.br/emitir-certidao-inidoneos'],
    'TCU – Contas Julgadas Irregulares': ['Certidão Negativa de Contas Julgadas Irregulares', ''],
    'CNJ – Improbidade e Inelegibilidade': ['Certidão Negativa de Improb. Admin e Ineleg.', 'https://www.cnj.jus.br/improbidade_adm/consultar_requerido.php'],
    'CGU – CEIS/Correcional': ['Consulta CEIS', 'https://certidoes.cgu.gov.br/'],
    'Certidão Cível / Falência': ['Certidão Judicial Cível Negativa - Falência 1º Grau', ''], // Tribunal de Justiça do estado da sede
    'Comprovante ISSQN': ['Comprovante ISSQN', ''],
  };
  // c = item de situacaoCertidoes/validadeCertidao → { nome: nome sugerido no SEI, link: onde emitir } (ou null)
  function infoCertidao(c) {
    const m = (c.rotulo || '').match(/^(.*?)(?: \((CPF|CNPJ)\))?$/), base = INFO_CERTIDAO[m[1]];
    if (!base) return null;
    const val = !c.informativo && c.validade ? ' val. ' + c.validade.replace(/\//g, '.') : '';
    return { nome: base[0] + (m[2] ? ' ' + m[2] : '') + val, link: base[1] };
  }
  function situacaoCertidoes(docs, dataEvento, hoje = new Date()) {
    const porTipo = {};
    for (const d of docs) {
      // d.cert = validade já lida do texto e guardada no processo salvo (que não guarda o texto);
      // sem isso, um processo reaberto da lista só teria o nome do arquivo (bug da v1.0.0)
      const c = d.texto === undefined && d.cert !== undefined ? d.cert : validadeCertidao(d.nome, d.texto);
      if (!c) continue;
      const atual = porTipo[c.rotulo];
      if (!atual || (c.validade && (!atual.validade || paraData(c.validade) > paraData(atual.validade)))) porTipo[c.rotulo] = { ...c, arquivo: d.nome };
    }
    const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const ev = (dataEvento || '').match(/\d{2}\/\d{2}\/\d{4}/);
    const evento = ev ? paraData(ev[0]) : null;
    return Object.values(porTipo).map(c => {
      let status = 'sem-data';
      if (c.validade) {
        const v = paraData(c.validade), dias = Math.round((v - h) / 864e5);
        status = v < h ? 'vencida' : evento && v < evento ? 'antes-evento' : dias <= 7 ? 'vencendo' : 'ok';
        c.dias = dias;
      }
      if (c.informativo) status = 'informativo'; // Consulta CNPJ: nunca cobra atualização
      return { ...c, status };
    }).sort((a, b) => ORDEM.indexOf(a.status) - ORDEM.indexOf(b.status));
  }

  // ─── Campos criados pelo usuário (Maestro Livre, tela Configurações → Campos) ──
  // regra: { tipo: 'sei' | 'rotulo' | 'formato', arquivo: palavra no nome do arquivo (opcional),
  //          rotulo: texto que vem antes do valor (tipo 'rotulo'), formato: 'cpf' | 'cnpj' | 'data' | 'valor' | 'email' }
  // Vale o documento mais recente (o último da pasta) que tiver o dado. Devolve { CAMPO: { valor, fonte } }.
  const FORMATOS = { cpf: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, cnpj: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/, data: /\b\d{2}\/\d{2}\/\d{4}\b/,
    valor: /R\$\s*[\d.]+,\d{2}/, email: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/ };
  function aplicarRegras(campos, docs) {
    const out = {};
    for (const c of campos || []) {
      const r = c.regra || {};
      if (!c.k || !['sei', 'rotulo', 'formato'].includes(r.tipo)) continue;
      const palavra = norm(r.arquivo || '').replace(/[\s_-]+/g, ' ').trim();
      const alvo = docs.filter(d => !palavra || norm(d.nome).replace(/[\s_-]+/g, ' ').includes(palavra));
      for (const d of alvo.slice().reverse()) {
        const t = d.texto || '';
        let valor = '';
        if (r.tipo === 'sei') valor = palavra ? nSEI(d.nome) || '' : '';
        else if (r.tipo === 'rotulo' && r.rotulo) {
          const i = norm(t).indexOf(norm(r.rotulo).trim());
          if (i >= 0) valor = limpa(t.slice(i + r.rotulo.trim().length).split('\n')[0]).replace(/^[:\s-]+/, '').slice(0, 300);
        } else if (r.tipo === 'formato' && FORMATOS[r.formato]) valor = (t.match(FORMATOS[r.formato]) || [''])[0];
        if (valor) { out[c.k] = { valor, fonte: d.nome }; break; }
      }
    }
    return out;
  }

  const api = { definirOrgao, aplicarRegras, itensParaTexto, extrairTudo, extrairDoc, classificar, derivados, porExtenso, mascaraCPF, protegeCPFs,
                datasEvento, numeroSEI, numeroProcesso, titulo, norm, validadeCertidao, situacaoCertidoes, infoCertidao, conferirBalizadoras, conferirProcesso, ETAPAS };
  if (typeof module !== 'undefined') module.exports = api; else root.Extrator = api;
})(this);
