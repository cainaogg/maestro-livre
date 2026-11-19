// Consulta (v5.0.0): legislação, decretos, sistemas e links usados nos processos de inexigibilidade.
// Comum ao Maestro (tela Consulta) e ao Checklist (seção "Legislação e links", quando aberto sozinho).
// FABRICA = a lista que vem com o programa (era LINK_TABS do Checklist). As mudanças do usuário ficam À PARTE,
// em localStorage "mlivre-consulta", e vão no "Exportar tudo":
//   { novasAbas: [{id, label}], abas: {id: {label?, removida?}}, novos: [{id, aba, t, d, l}], itens: {id: {t, d, l} | null} }
// Assim uma versão nova do programa pode trazer leis novas sem apagar o que o usuário mudou.
// Item de fábrica tem id "aba|título" (título de fábrica não muda); item criado pelo usuário, "n…".
(function () {
  const FABRICA = [
    { id:"leis", label:"Leis", items:[
      ["Lei Federal nº 14.133/2021", "Licitações e Contratos. Arts. 23, 53, 66 a 72, 74, 75, 91 a 95 e 117", [["Planalto","https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm"]]],
      ["Lei Federal nº 13.726/2018", "Desburocratização: dispensa reconhecimento de firma e autenticação de cópia (art. 3º)", [["Planalto","https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13726.htm"]]],
      ["Constituição Federal", "Art. 195, § 3º: quem deve à seguridade social não contrata com o poder público", [["Planalto","https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm"]]],
      ["Código Civil, Lei nº 10.406/2002", "Arts. 45 e 54 (associações), 997 e 1.054 (sociedades), 1.065, 1.078 e 1.179 (balanço)", [["Planalto","https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm"]]],
      ["Código Tributário Nacional, Lei nº 5.172/1966", "Arts. 205 e 206: certidão negativa e positiva com efeitos de negativa", [["Planalto","https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm"]]],
      ["Lei Complementar nº 123/2006", "ME, EPP, MEI e Simples Nacional. Arts. 18-A, 27 e 68", [["Planalto","https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm"]]],
      ["Lei nº 4.320/1964", "Normas de direito financeiro: empenho (art. 60) e liquidação (art. 63)", [["Planalto","https://www.planalto.gov.br/ccivil_03/leis/l4320.htm"]]],
      ["Lei nº 8.036/1990", "FGTS. Art. 27: exigência do CRF para contratar com o poder público", [["Planalto","https://www.planalto.gov.br/ccivil_03/leis/l8036consol.htm"]]],
      ["CLT, Decreto-Lei nº 5.452/1943", "Art. 642-A: Certidão Negativa de Débitos Trabalhistas", [["Planalto","https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm"]]],
      ["Lei nº 8.429/1992", "Improbidade administrativa. Art. 12: proibição de contratar", [["Planalto","https://www.planalto.gov.br/ccivil_03/leis/l8429.htm"]]],
      ["Lei nº 8.443/1992", "Lei Orgânica do TCU. Art. 46: declaração de inidoneidade", [["Planalto","https://www.planalto.gov.br/ccivil_03/leis/l8443.htm"]]],
      ["Lei nº 12.846/2013", "Lei Anticorrupção (CNEP)", [["Planalto","https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12846.htm"]]],
      ["Decreto-Lei nº 9.295/1946", "Profissão contábil. Art. 12: registro no CRC", [["Planalto","https://www.planalto.gov.br/ccivil_03/decreto-lei/del9295.htm"]]]
    ]},
    { id:"decretos", label:"Decretos", items:[
      ["Decreto Federal nº 12.807/2025", "Atualiza os valores da Lei 14.133 para 2026 (dispensa: R$ 65.492,11 para serviços)", [["Planalto","https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/D12807.htm"]]]
    ]},
    { id:"outras", label:"Normas contábeis", items:[
      ["NBC TG 1002 (CFC)", "Contabilidade para Microentidades. Item 3.6: balanço, DRE e lucros ou prejuízos acumulados", [["PDF","https://www1.cfc.org.br/sisweb/SRE/docs/NBCTG1002.pdf"]]]
    ]},
    { id:"sistemas", label:"Sistemas e consultas", items:[
      ["Comparar, Ministério da Cultura", "Item orçamentário por produto, valor médio (comprovante balizador)", [["Abrir","https://aplicacoes.cultura.gov.br/comparar/grid_ItemOrcamentario_PorProduto_ValorMedio/grid_ItemOrcamentario_PorProduto_ValorMedio.php"]]],
      ["Pesquisa de Preços, Compras.gov.br", "Preços de contratações públicas", [["Abrir","https://www.gov.br/compras/pt-br/sistemas/conheca-o-compras/pesquisa-de-precos/pesquisa-de-precos/"]]],
      ["VERSALIC", "Projetos das Leis de Incentivo à Cultura e seus orçamentos", [["Abrir","http://versalic.cultura.gov.br/#/projetos?sort=PRONAC:asc&limit=12&offset=0"]]],
      ["Consulta CCMEI", "Certificado do MEI (login gov.br)", [["Abrir","https://mei.receita.economia.gov.br/certificado/consulta"]]],
      ["Portal Nacional de Contratações Públicas (PNCP)", "Consulta de contratos publicados", [["Abrir","https://www.gov.br/pncp/pt-br"]]],
      ["Tutorial: SEI, Bloco de Assinatura", "Vídeo (YouTube)", [["Abrir","https://www.youtube.com/watch?v=lTQZtulcf9g"]]]
    ]},
    { id:"certidoes", label:"Certidões", items:[
      ["Consulta CNPJ", "Comprovante de Inscrição e Situação Cadastral, Receita Federal", [["Abrir","https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/"]]],
      ["Certidão municipal", "Certidão de débitos do município sede do contratado (inclua o link do seu município)", []],
      ["Comprovante ISSQN", "Inscrição municipal do contratado (inclua o link do seu município)", []],
      ["Certidão estadual", "Secretaria da Fazenda do estado sede do contratado (inclua o link do seu estado)", []],
      ["Certidão federal (CNPJ e CPF)", "Receita Federal e PGFN", [["Abrir","https://servicos.receitafederal.gov.br/servico/certidoes/#/home"]]],
      ["Certidão trabalhista (CNDT)", "TST", [["Abrir","https://cndt-certidao.tst.jus.br/inicio.faces"]]],
      ["Certificado FGTS (CRF)", "Caixa. Preencher só \"Inscrição\" e salvar a página em PDF", [["Abrir","https://consulta-crf.caixa.gov.br/"]]],
      ["Certidão de falência", "Tribunal de Justiça do estado sede: certidão cível de falência (inclua o link do seu estado)", []],
      ["Improbidade administrativa", "CNJ, CNPJ e CPF", [["Abrir","https://www.cnj.jus.br/improbidade_adm/consultar_requerido.php"]]],
      ["Licitantes inidôneos", "TCU, CNPJ e CPF", [["Abrir","https://certidoes.apps.tcu.gov.br/emitir-certidao-inidoneos"]]],
      ["Certidão correcional (CEIS, CNEP, CEPIM)", "CGU, selecionar \"Ente Privado\"", [["Abrir","https://certidoes.cgu.gov.br/"]]],
      ["Consulta Consolidada de Pessoa Jurídica", "TCU", [["Abrir","https://certidoes-apf.apps.tcu.gov.br/"]]]
    ]}
  ];

  const CHAVE = 'mlivre-consulta';
  const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } };
  function mudar(fn) {
    const m = ler(); m.novasAbas ||= []; m.abas ||= {}; m.novos ||= []; m.itens ||= {};
    fn(m); localStorage.setItem(CHAVE, JSON.stringify(m));
  }
  const nid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  // a lista como o usuário vê: [{id, label, nova, items: [{id, t, d, l, novo}]}]
  function lista() {
    const m = ler(), ab = m.abas || {}, it = m.itens || {};
    const abas = FABRICA.map(a => ({ id: a.id, label: a.label, items: a.items.map(x => ({ id: a.id + '|' + x[0], t: x[0], d: x[1], l: x[2] })) }))
      .concat((m.novasAbas || []).map(a => ({ id: a.id, label: a.label, nova: true, items: [] })));
    for (const a of abas) {
      if (ab[a.id] && ab[a.id].label) a.label = ab[a.id].label;
      a.items = (m.novos || []).filter(n => n.aba === a.id).map(n => ({ ...n, novo: true })).concat(a.items)
        .filter(x => it[x.id] !== null).map(x => it[x.id] ? { ...x, ...it[x.id] } : x);
    }
    return abas.filter(a => !(ab[a.id] && ab[a.id].removida));
  }
  // Links escritos "Nome | endereço", um por linha (só http/https)
  const linksDe = txt => String(txt || '').split('\n').map(l => l.split('|').map(x => x.trim())).filter(l => l[0] && /^https?:\/\//i.test(l[1] || '')).map(l => [l[0], l[1]]);
  const linksTxt = ls => (ls || []).map(l => l[0] + ' | ' + l[1]).join('\n');
  window.Consulta = {
    CHAVE, lista, linksDe, linksTxt, mudou: () => !!localStorage.getItem(CHAVE),
    novoItem: (aba, v) => mudar(m => m.novos.unshift({ id: nid('n'), aba, t: v.t, d: v.d, l: v.l })),
    editarItem: (id, v) => mudar(m => { const n = m.novos.find(x => x.id === id); if (n) Object.assign(n, v); else m.itens[id] = v; }),
    excluirItem: id => mudar(m => { const i = m.novos.findIndex(x => x.id === id); if (i >= 0) m.novos.splice(i, 1); else m.itens[id] = null; }),
    novaAba: label => { const id = nid('a'); mudar(m => m.novasAbas.push({ id, label })); return id; },
    renomearAba: (id, label) => mudar(m => { m.abas[id] = { ...m.abas[id], label }; }),
    excluirAba: id => mudar(m => {
      const i = m.novasAbas.findIndex(a => a.id === id);
      if (i >= 0) { m.novasAbas.splice(i, 1); m.novos = m.novos.filter(n => n.aba !== id); } else m.abas[id] = { removida: true };
    }),
    restaurar: () => localStorage.removeItem(CHAVE),
  };
})();
