// Teste do extrator. Rodar:  node testes/teste-extrator.js
// Dados FICTÍCIOS, mas no mesmo formato dos documentos reais (proposta, cartão CNPJ,
// tela de banco lida por OCR, CNH lida por OCR). Se uma regra quebrar, falha aqui.
const assert = require('assert');
const X = require('../app/extrator.js');
X.definirOrgao('98.765.432/0001-10'); // órgão fictício dos testes
const v = (docs, pasta) => Object.fromEntries(Object.entries(X.extrairTudo(docs, pasta).campos).map(([k, o]) => [k, o.valor]));

// ─── valor por extenso ───
assert.strictEqual(X.porExtenso('R$ 1.500,00'), 'mil e quinhentos reais');
assert.strictEqual(X.porExtenso('R$ 20.000,00'), 'vinte mil reais');
assert.strictEqual(X.porExtenso('R$ 36.520,00'), 'trinta e seis mil quinhentos e vinte reais');
assert.strictEqual(X.porExtenso('R$ 100,00'), 'cem reais');
assert.strictEqual(X.porExtenso('R$ 2.500,50'), 'dois mil e quinhentos reais e cinquenta centavos');
assert.strictEqual(X.porExtenso('R$ 1.000.000,00'), 'um milhão de reais');

// ─── CPF mascarado (padrão LGPD comum: dígitos 7 a 9 visíveis) ───
assert.strictEqual(X.mascaraCPF('123.456.789-09'), '***.***.789-**');
assert.strictEqual(X.mascaraCPF('***.***.080-**'), '***.***.080-**');
assert.strictEqual(X.mascaraCPF('XXX.XXX.810-XX'), '***.***.810-**');     // pedido do usuário: sempre * e não X
assert.strictEqual(X.protegeCPFs('Sr. Fulano, CPF XXX.XXX.810-XX, e Beltrano, CPF 123.456.789-09; CNPJ 11.222.333/0001-81'),
  'Sr. Fulano, CPF ***.***.810-**, e Beltrano, CPF ***.***.789-**; CNPJ 11.222.333/0001-81');

// ─── datas: ignora a data da carta, pega as do evento ───
assert.deepStrictEqual(X.datasEvento('Cidade Exemplo, 15 de Agosto de 2026. Show no dia 10 de Outubro de 2026.'), ['10/10/2026']);
assert.deepStrictEqual(X.datasEvento('Data: 17 e 19 de setembro de 2026'), ['17/09/2026', '19/09/2026']);

// ─── número SEI pelo nome do arquivo exportado ───
assert.deepStrictEqual(X.numeroSEI('[04]-41599108_Proposta.pdf'), { DOC_PROPOSTA: '41599108' });
assert.strictEqual(X.numeroProcesso('SEI_26.0.000153676_0'), '26.0.000153676-0');

// ─── proposta em texto corrido ───
const proposta = {
  nome: 'Proposta.pdf',
  texto: `ARTE VIVA PRODUCOES LTDA CNPJ: 11.222.333/0001-81
ORÇAMENTO PARA O MUNICÍPIO DE CIDADE EXEMPLO CNPJ: 98.765.432/0001-10
À Secretaria de Cultura Serviço a ser prestado: Espetáculo Artístico Fulana e Banda no dia 10 de Outubro de 2026, das 16hs às 17:30hs no Evento Cultural, Festival da Primavera, local Avenida Exemplo 100, Bairro Centro - Cidade Exemplo/RS. Valor total: R$ 20.000,00 Validade 30 dias
Cidade Exemplo, 15 de Agosto de 2026.
FULANA DE TAL SILVA
RG: 1234567890`,
};
let r = v([proposta]);
assert.strictEqual(r.CNPJ, '11.222.333/0001-81');               // não o da prefeitura
assert.strictEqual(r.VALOR, 'R$ 20.000,00');
assert.strictEqual(r.EVENTO_DATA, '10/10/2026');
assert.strictEqual(r.EVENTO_HORARIO, '16h às 17h30');
assert.strictEqual(r.EVENTO, 'Festival da Primavera');
assert.strictEqual(r.EVENTO_LOCAL, 'Avenida Exemplo 100, Bairro Centro - Cidade Exemplo/RS');
assert.strictEqual(r.ARTISTA, 'Fulana e Banda');
assert.strictEqual(r.REP_NOME, 'Fulana de Tal Silva');
assert.strictEqual(r.REP_RG, '1234567890');

// ─── cartão CNPJ com posição (valor 9 unidades abaixo do rótulo) ───
const it = (str, x, y) => ({ str, x, y, w: str.length * 4, pag: 1 });
const itens = [
  it('CADASTRO NACIONAL DA PESSOA JURÍDICA', 140, 742),
  it('NÚMERO DE INSCRIÇÃO', 44, 715), it('11.222.333/0001-81', 44, 706),
  it('NOME EMPRESARIAL', 44, 677), it('ARTE VIVA PRODUCOES LTDA', 44, 668),
  it('LOGRADOURO', 44, 492), it('EST DO MORRO', 44, 483), it('NÚMERO', 287, 492), it('50', 287, 483),
  it('COMPLEMENTO', 343, 492), it('CASA 2', 343, 483),
  it('CEP', 44, 462), it('91.000-000', 44, 453), it('BAIRRO/DISTRITO', 137, 462), it('RESTINGA', 137, 453),
  it('MUNICÍPIO', 287, 462), it('CIDADE EXEMPLO', 287, 453), it('UF', 473, 462), it('RS', 473, 453),
];
const cartao = { nome: 'CNPJ.pdf', itens, texto: X.itensParaTexto(itens) };
r = v([cartao]);
assert.strictEqual(r.EMPRESA_NOME, 'ARTE VIVA PRODUCOES LTDA');
assert.strictEqual(r.ENDERECO, 'Estrada do Morro, 50, Casa 2, bairro Restinga, Cidade Exemplo/RS, CEP 91.000-000');

// cartão vence a proposta no nome; proposta vira alternativa
const tudo = X.extrairTudo([proposta, cartao], 'SEI_26.0.000999999_1').campos;
assert.strictEqual(tudo.CNPJ.fonte, 'CNPJ.pdf');
assert.strictEqual(tudo.PROCESSO.valor, '26.0.000999999-1');

// ─── tela de app de banco lida por OCR (valor na linha de baixo, lixo de ícone) ───
r = v([{ nome: 'Documento.jpg', texto: 'Agência O\n0001\n\nConta O\n12345678-9\n\nBanco O\n0260\n\nNu Pagamentos S.A. - Instituição de O\nPagamento\n' }]);
assert.strictEqual(r.AGENCIA, '0001');
assert.strictEqual(r.CONTA, '12345678-9');
assert.strictEqual(r.BANCO, 'Nu Pagamentos S.A. (0260)');

// ─── CNH lida por OCR: CPF sem rótulo só vale com dígito verificador certo ───
r = v([{ nome: 'Documento.pdf', texto: 'SENATRAN\nCARTEIRA NACIONAL DE HABILITAÇÃO\n1234567890 SSP/PC RS\n123.456.789-09 )/09/10/1981\n987.654.321-00' }]);
assert.strictEqual(r.REP_CPF, '123.456.789-09');
assert.strictEqual(r.REP_RG, '1234567890');
assert.strictEqual(r.REP_NASCIMENTO, '09/10/1981');   // sem rótulo: data mais antiga de adulto
r = v([{ nome: 'CNH.pdf', texto: 'CARTEIRA NACIONAL DE HABILITAÇÃO\nVALIDADE 15/05/2034 1ª HABILITAÇÃO 28/10/2002\n12/03/1990 nascimento?' }]);
assert.strictEqual(r.REP_NASCIMENTO, '12/03/1990');
assert.strictEqual(v([proposta, { nome: 'p2.pdf', texto: 'Proposta. Fulana, nascida em 01/02/1985, CPF 123.456.789-09' }]).REP_NASCIMENTO, '01/02/1985');
// nº do processo pelo rodapé dos documentos do SEI quando não há nome de pasta
assert.strictEqual(X.extrairTudo([{ nome: 'a.html', texto: 'cita 25.0.000178805-4\n26.0.000999999-1 41000001v3' },
  { nome: 'b.html', texto: '26.0.000999999-1 41000002v1' }]).campos.PROCESSO.valor, '26.0.000999999-1');

// ─── documentos do próprio SEI (HTML exportado) ───
// HTML nunca é RG/CNH, mesmo com "habilitação no Edital" no texto (bug de 09/11/2026)
assert.strictEqual(X.classificar('[01]-41000001_Memorando___SEI.html', 'pela sua habilitação no Edital'), 'sei_interno');
const memo = { nome: '[01]-41000001_Memorando___SEI.html', texto: [
  'Secretaria de Cultura', 'Memorando - SEI - nº 41000001 / 2026 Cidade Exemplo, 1 de setembro de 2026.',
  'Sr.(a) Secretária:',
  'Solicitamos sua autorização para contratação direta da empresa ARTE VIVA PRODUCOES LTDA, CNPJ 11.222.333/0001-81, nesse ato representado pelo Sr. FULANA DE TAL, CPF ***.***.789-**, com sede na Rua Exemplo, 10, Centro, Cidade Exemplo/RS, para realizar apresentação musical de Fulana e Banda, na praça central.',
  'O Festival da Primavera é uma iniciativa da Coordenação de Música.',
  'Justifica-se a contratação do artista Fulana pela sua habilitação no Edital. Mais detalhes no Currículo Material de Consagração, com Currículo 41000010 e Portfolio 41000011.',
  'O contrato será firmado no valor total de R$ 1.500,00 (mil e quinhentos reais), a serem pagos em conta corrente.',
  'Atenciosamente,', 'Documento assinado eletronicamente por Alguém', '26.0.000999999-1 41000001v3'].join('\n') };
const tr = { nome: '[02]-41000002_Termo_de_Referencia.html', texto: 'OBJETO:\nRealizar 1 (uma) apresentação de Fulana e Banda.\nDESCRIÇÃO DO OBJETO:\nRealizar apresentação musical.\nJUSTIFICATIVA:\nJustifica-se.\nTIPO DE SELEÇÃO:\nInexigibilidade:' };
const etp = { nome: '[03]-41000003_Estudo_Tecnico_Preliminar.html', texto: '1. Descrição da necessidade.\nTexto do evento.\n2. Demonstração.\nConforme relatório analítico do plano de contratações anual, doc 41000020.\n9. Demonstrativo dos resultados.\nPúblico de 600 pessoas.\n10. Providências.\nObter documentos.' };
const du = { nome: '[24]-41000004_Declaracao_Unificada.html', texto: 'Eu, NOME DO REPRESENTANTE, CPF DO REPRESENTANTE, declaro' };
r = v([memo, tr, etp, du]);
assert.strictEqual(r.TRATAMENTO, 'Sr.(a) Secretária:');
assert.strictEqual(r.EMPRESA_NOME, 'ARTE VIVA PRODUCOES LTDA');
assert.strictEqual(r.REP_NOME, 'Fulana de Tal');                    // DU com texto-modelo é ignorada
assert.strictEqual(r.REP_CPF, '***.***.789-**');
assert.strictEqual(r.ENDERECO, 'Rua Exemplo, 10, Centro, Cidade Exemplo/RS');
assert.strictEqual(r.OBJETO_DETALHADO, 'Realizar apresentação musical de Fulana e Banda, na praça central.');
assert.strictEqual(r.OBJETO, 'Realizar 1 (uma) apresentação de Fulana e Banda.');
assert.strictEqual(r.CONTEXTO_EVENTO, 'O Festival da Primavera é uma iniciativa da Coordenação de Música.');
assert.strictEqual(r.JUSTIFICATIVA, 'Justifica-se a contratação do artista Fulana pela sua habilitação no Edital.');
assert.strictEqual(r.DOC_CURRICULO, '41000010');
assert.strictEqual(r.DOC_PORTFOLIO, '41000011');
assert.strictEqual(r.DOC_PCA, '41000020');
assert.strictEqual(r.RESULTADOS, 'Público de 600 pessoas.');
assert.strictEqual(r.VALOR, 'R$ 1.500,00');

// ─── nome do representante: certidão de CPF > proposta > OCR do RG (bug de 09/11/2026) ───
const rgOCR = { nome: '[12]-41000005_Documento.pdf', texto: 'CARTEIRA DE IDENTIDADE E: . Er\n“ ri cíeco nr o\nFULANO DA SHVA PEREIRA k SRTA ES\nRegistro Geral - CPF' };
assert.strictEqual(v([rgOCR]).REP_NOME, 'Fulano da Shva Pereira');           // sugestão, mesmo com erro de OCR
const cndCPF = { nome: '[16]-41000006_CND_Federal_CPF_val._28.02.2027.pdf', texto: 'CERTIDÃO NEGATIVA\nNome: FULANO DA SILVA PEREIRA CPF: 123.456.789-09\nRessalvado o direito' };
const tcuCPF = { nome: '[21]-41000007_Certidao_TCU_CPF.pdf', texto: 'O Tribunal de Contas da União certifica, em 01/09/2026, que FULANO DA SILVA PEREIRA, CPF: 123.456.789-09, NÃO CONSTA' };
r = v([rgOCR, cndCPF, tcuCPF]);
assert.strictEqual(r.REP_NOME, 'Fulano da Silva Pereira');
assert.strictEqual(r.REP_CPF, '123.456.789-09');

// ─── conferência cruzada: confirma em outros documentos e aponta discrepâncias ───
const plano = { nome: '[05]-41000008_Plano_de_Trabalho.pdf', texto: 'Responsável: Fulano da Silva Pereira. Valor da Demanda: R$ 25.000,00' };
const memoCPF = { nome: '[01]-41000009_Memorando___SEI.html', texto: 'Solicitamos ... representado pelo Sr. Fulano, CPF XXX.XXX.789-XX, com sede na Rua X, para realizar algo.' };
const c = X.extrairTudo([rgOCR, cndCPF, tcuCPF, plano, memoCPF]).campos;
assert.strictEqual(c.REP_NOME.valor, 'Fulano da Silva Pereira');
assert.deepStrictEqual(c.REP_NOME.confere, [cndCPF.nome, tcuCPF.nome, plano.nome]);          // plano "Outro" também confirma
assert.deepStrictEqual(c.REP_NOME.diverge.map(o => o.fonte), [rgOCR.nome]);                  // OCR "Shva" = discrepância
assert.ok(c.REP_CPF.confere.includes(memoCPF.nome));                                         // mascarado com mesmo meio confere
assert.strictEqual(c.REP_CPF.diverge.length, 0);                                             // completo × mascarado não é discrepância

// ─── dotação (Dec. 22.505/2024: UO-subação-elemento-fonte) do pré-empenho / nota de empenho ───
const preEmp = { nome: '[33]-41000010_Pre_Empenho.pdf', texto: 'PREFEITURA DE CIDADE EXEMPLO Pré-Empenho\nUnidade Orçamentária\n01001 SECRETARIA MUNICIPAL DA CULTURA\nSubação\n002421 DESCENTRALIZAÇÃO\nFonte Recurso\n1.5.00.001001 0001 - RECURSO LIVRE ADM DIRETA - IMPOSTOS E TRANSFERÊNCIAS\nNatureza Despesa\n33.90.39.23 Apresentações Artísticas' };
const notaEmp = { nome: '[52]-41000011_Nota_de_Empenho_2026NE000911.pdf', texto: 'Esfera Unidade Orçamentária Programa Trabalho\nFiscal 01001 13 392 0198 3731 002421\nSubação Fonte Recurso\n002421 DESCENTRALIZAÇÃO 1.5.00.001001 0001 - RECURSO LIVRE ADM DIRETA -\nIMPOSTOS E TRANSFERÊNCIAS\nNatureza Despesa\n33.90.39.23 Apresentações' };
const DOT = '1001-2421-33.90.39.23-1.5.00.001001 0001 - RECURSO LIVRE ADM DIRETA - IMPOSTOS E TRANSFERÊNCIAS';
assert.strictEqual(X.classificar(preEmp.nome, preEmp.texto), 'empenho');
assert.strictEqual(v([preEmp]).DOTACAO, DOT);
assert.strictEqual(v([notaEmp]).DOTACAO, DOT);                                  // descrição quebrada em 2 linhas
// DFD já escrito: ordenador, contato e dotação (instrução "inserir no processo…" não descarta mais o DFD)
const dfd = { nome: '[32]-41000012_Documento_de_Formalizacao_de_Demanda__DFD_.html', texto: [
  '2. IDENTIFICAÇÃO E CIÊNCIA DO ORDENADOR DE DESPESA', 'Nome: FULANO ORDENADOR', 'Matrícula: 123456/7', '3. JUSTIFICATIVA', 'x',
  '9. PREVISÃO NO PLANO DE CONTRATAÇÕES ANUAL inserir no processo relatório do SisconP',
  'Dotação orçamentária: 1003-2573-33.90.39.23-1.5.00.001001 0001 - RECURSO LIVRE ADM DIRETA - IMPOSTOS', 'A Dotação orçamentária deve ter',
  '11. CONTATO PARA INFORMAÇÕES', 'Servidor: Beltrano', 'Ramal: 1234', '12. AUTORIZAÇÃO'].join('\n') };
r = v([dfd]);
assert.strictEqual(r.ORDENADOR_NOME, 'Fulano Ordenador');
assert.strictEqual(r.ORDENADOR_MATRICULA, '123456/7');
assert.strictEqual(r.CONTATO_NOME, 'Beltrano');
assert.strictEqual(r.CONTATO_RAMAL, '1234');
assert.strictEqual(r.DOTACAO, '1003-2573-33.90.39.23-1.5.00.001001 0001 - RECURSO LIVRE ADM DIRETA - IMPOSTOS');
assert.strictEqual(v([dfd, preEmp]).DOTACAO, DOT);                             // empenho vence o DFD

// ─── números para os extratos: contrato, aditivo e apostilamento ───
const regContrato = { nome: '[51]-41000020_Contrato_Registrado_100001.html', texto: [
  'Contrato Nº 100001 / 2026 - SEI Nº 26.0.000999999-1', 'Contrato 1', 'CONTRATO', 'Contrato administrativo…',
  'Documento assinado eletronicamente por Fulano, Representante, em 08/09/2026, às 10:00',
  'Documento assinado eletronicamente por Beltrana, Secretária, em 09/09/2026, às 11:00'].join('\n') };
const regAditivo = { nome: '[81]-41000021_Contrato_Registrado_100002.html', texto: [
  'Contrato Nº 100002 / 2026 - SEI Nº 26.0.000999999-1', 'Termo Aditivo 1',
  'Aditivo ao Contrato nº 100001 / 2026, para correção.',
  'Objeto:', 'Correção da CLÁUSULA SEGUNDA – DO PRAZO:', 'CLÁUSULA SEGUNDA – DO PRAZO', '2.1 texto antigo.',
  'Passam a ter a seguinte redação:', 'CLÁUSULA SEGUNDA – DO PRAZO', '2.1 texto novo.',
  'Documento assinado eletronicamente por Beltrana, Secretária, em 20/10/2026, às 11:00'].join('\n') };
const regApost = { nome: '[70]-41000022_Contrato_Registrado_100003.html', texto: [
  'Contrato Nº 100003 / 2026 - SEI Nº 26.0.000999999-1',
  'Apostilamento ao Contrato nº 100001 / 2026.',
  'Objeto:', 'Correção da CLÁUSULA QUARTA:', '4.1 valor errado.', 'Passa a ter a seguinte redação:', '4.1 valor certo.', 'Cidade Exemplo, 18 de setembro de 2026',
  'Documento assinado eletronicamente por Beltrano, Secretário em exercício, em 22/09/2026, às 11:01'].join('\n') };
r = v([regContrato, regApost, regAditivo]);
assert.strictEqual(r.NUM_CONTRATO, '100001/2026');
assert.strictEqual(r.DATA_ASSINATURA, '09/09/2026');                       // última assinatura do contrato
assert.strictEqual(r.NUM_ADITIVO, '100002/2026');
assert.strictEqual(r.DATA_ASSINATURA_ADITIVO, '20/10/2026');
assert.strictEqual(r.OBJETO_ADITIVO, 'Correção da CLÁUSULA SEGUNDA – DO PRAZO: CLÁUSULA SEGUNDA – DO PRAZO 2.1 texto novo.');
assert.strictEqual(r.NUM_APOSTILAMENTO, '100003/2026');
assert.strictEqual(r.DATA_ASSINATURA_APOSTILAMENTO, '22/09/2026');
assert.strictEqual(r.OBJETO_APOSTILAMENTO, 'Correção da CLÁUSULA QUARTA: 4.1 valor certo.');

// ─── resumo do Currículo Material de Consagração (extrativo, sem IA) ───
const cvProsa = { nome: '[23]-41000030_Curriculo_Material_de_Consagracao.pdf', texto: [
  'Fulana de Tal',
  'Fulana de Tal é cantora nascida em Cidade Exemplo e começou sua trajetória musical em 2005, com prêmios',
  'estaduais e nacionais em festivais de música.',
  'Mora atualmente em Canoas com a família e gosta muito de cozinhar aos domingos para os amigos dela.',
  'Lançou três álbuns e fez turnê pela Argentina, com participação em programas de TV e rádio de todo o país.',
  'Show: Praça Central', 'Show: Festa de Natal', 'Show: Semana da Restinga', 'Show: Bloco de Carnaval',
].join('\n') };
r = v([cvProsa]);
assert.ok(r.CURRICULO_TRECHO.startsWith('Fulana de Tal é cantora'), 'abertura do artista entra');   // frase de abertura vem primeiro
assert.ok(r.CURRICULO_TRECHO.includes('três álbuns'), 'frase com discos/turnê entra');
assert.ok(!/Show:/.test(r.CURRICULO_TRECHO), 'lista de shows não entra');                           // bug do processo 153676
assert.ok(!/cozinhar/.test(r.CURRICULO_TRECHO), 'frase sem relevância fica de fora');
const cvCV = { nome: 'Curriculo.pdf', texto: 'CURRICULUM VITAE\nNome completo: Fulano\nEducação\n[2013-2015] Universidade X – Mestrado em Música – Cidade [2009-2012] Universidade Y – Bacharelado em Música – Cidade\n' +
  'Experiências Profissionais\n[2018-2021] Orquestra Z – Músico – Cidade\nPrêmios\n[2024] Concurso W – Finalista – online [2018] Festival K – 2º lugar' };
assert.strictEqual(v([cvCV]).CURRICULO_TRECHO,
  'Formação: Universidade X – Mestrado em Música; Universidade Y – Bacharelado em Música. Atuação profissional: Orquestra Z – Músico. Recebeu prêmios e distinções como Concurso W – Finalista; Festival K – 2º lugar.');
assert.ok(v([{ nome: 'Curriculo.pdf', texto: 'x\nAPRESENTAÇÃO DO MÚSICO FULANO DE TAL No ano de 1992 fundou a banda e fez shows em festivais por todo o país.' }]).CURRICULO_TRECHO.startsWith('No ano de 1992'));

// ─── validade das certidões: texto primeiro, nome do arquivo como reserva, sem inventar prazo ───
const vc = (nome, texto) => X.validadeCertidao(nome, texto);
assert.strictEqual(vc('[10]-41000040_CND_Federal_CNPJ_val..pdf', 'CERTIDÃO NEGATIVA DE DÉBITOS RELATIVOS AOS TRIBUTOS FEDERAIS … Válida até 01/04/2027.').validade, '01/04/2027');
assert.strictEqual(vc('[09]-41000041_CND_Estadual.pdf', 'RECEITA ESTADUAL Certificamos que, aos 09 dias do mês de NOVEMBRO do ano de 2026 … Esta certidão é válida até 7/1/2027').validade, '07/01/2027');
assert.strictEqual(vc('[13]-41000042_Certificado_FGTS.pdf', 'Certificado de Regularidade do FGTS - CRF Validade: 29/10/2026 a 27/11/2026').validade, '27/11/2026');
assert.strictEqual(vc('[12]-41000043_CND_Trabalhista.pdf', 'CERTIDÃO NEGATIVA DE DÉBITOS TRABALHISTAS Expedição: 09/11/2026 Validade: 08/05/2027 - 180 dias').validade, '08/05/2027');
// texto vence o nome (nome digitado errado: "08.05.2026")
assert.strictEqual(vc('[11]-41000044_CND_Federal_CPF_val._08.05.2026.pdf', 'Receita Federal … Válida até 08/05/2027.').validade, '08/05/2027');
// sem validade no texto: usa o nome; sem nenhum dos dois: emissão + 30 dias (regra do usuário, 15/11/2026: vale também para a CND Municipal)
let cm = vc('[08]-41000045_CND_Municipal_val._09.12.2026.pdf', 'Secretaria Municipal da Fazenda … Certidão emitida em 09/11/2026');
assert.deepStrictEqual([cm.validade, cm.fonte, cm.rotulo, cm.confirmacaoDespesa], ['09/12/2026', 'nome do arquivo', 'CND Municipal', true]);
cm = vc('[08]-41000046_Certidao.pdf', 'CERTIDÃO … Fazenda Pública Municipal … Certidão emitida em 09/11/2026');
assert.deepStrictEqual([cm.validade, cm.emissao, cm.rotulo], ['09/12/2026', '09/11/2026', 'CND Municipal']); // tipo pelo texto
assert.strictEqual(vc('[28]-41000047_Certificado.pdf', 'Certificado da Condição de Microempreendedor Individual'), null); // CCMEI não é certidão
assert.strictEqual(vc('[04]-41000048_Proposta.pdf', 'Proposta comercial'), null);
// situação: vencida / vence antes do evento / ok / sem data
const sit = X.situacaoCertidoes([
  { nome: 'CND_Municipal.pdf', texto: 'Secretaria Municipal da Fazenda' }, // sem validade e sem emissão: sem data
  { nome: 'CND_Estadual.pdf', texto: 'Receita Estadual é válida até 5/11/2026' },
  { nome: 'CND_Trabalhista.pdf', texto: 'débitos trabalhistas Validade: 20/11/2026' },
  { nome: 'Certificado_FGTS.pdf', texto: 'FGTS Validade: 01/11/2026 a 30/12/2026' },
], '25/11/2026', new Date(2026, 10, 11));
const st = Object.fromEntries(sit.map(s => [s.rotulo, s.status]));
assert.deepStrictEqual(st, { 'CND Estadual': 'vencida', 'CND Trabalhista': 'antes-evento', 'CND Municipal': 'sem-data', 'Certificado FGTS': 'ok' });
assert.strictEqual(sit[0].rotulo, 'CND Estadual');                                                           // mais grave primeiro
// sem validade escrita: emissão + prazo do documento, ou 30 dias (desde 15/11/2026 também para as CNDs da confirmação de despesa)
let ce = vc('[14]-41000060_Certidao_Judicial_Civel_Negativa.pdf', 'PODER JUDICIÁRIO CERTIDÃO JUDICIAL CÍVEL NEGATIVA … 9 de novembro de 2026, às 15:00:42 … Esta certidão possui validade de 90 dias a partir da data de sua emissão.');
assert.deepStrictEqual([ce.emissao, ce.validade], ['09/11/2026', '07/02/2027']);                          // 90 dias
ce = vc('[17]-41000061_Certidao_Negativa_de_Improb._Admin_e_Ineleg._CNPJ_val..pdf', 'Certidão Negativa Certifico que nesta data (09/11/2026 às 16:01) NÃO CONSTA no Cadastro … improbidade');
assert.deepStrictEqual([ce.emissao, ce.validade, ce.fonte], ['09/11/2026', '09/12/2026', 'emissão + 30 dias (padrão)']);
assert.strictEqual(vc('CEIS.pdf', 'Certidão Correcional CEIS Dados da consulta: 09/11/2026 15:01:10').validade, '09/12/2026');
assert.strictEqual(vc('[23]-41000063_Consulta_Consolidada_TCU_CNPJ.pdf', 'Consulta Consolidada de Pessoa Jurídica Consulta realizada em: 09/11/2026 15:06:22').validade, '09/12/2026');
assert.strictEqual(vc('[08]-41000062_Certidao.pdf', 'Fazenda Pública Municipal … Certidão emitida em 09/11/2026').validade, '09/12/2026');  // CND: 30 dias também

// processo salvo (sem texto): usa a validade guardada (cert), não só o nome "val..pdf" (bug da v1.0.0)
const lida = X.validadeCertidao('[10]-41000049_CND_Federal_CNPJ_val..pdf', 'Receita Federal … Válida até 01/04/2027.');
const salvo = X.situacaoCertidoes([{ nome: '[10]-41000049_CND_Federal_CNPJ_val..pdf', texto: undefined, cert: lida }], '', new Date(2026, 10, 11));
assert.deepStrictEqual([salvo[0].validade, salvo[0].status, salvo[0].fonte], ['01/04/2027', 'ok', 'texto']);
// sem cert guardado (salvo em versão antiga): cai no nome do arquivo, sem data
assert.strictEqual(X.situacaoCertidoes([{ nome: '[10]-41000049_CND_Federal_CNPJ_val..pdf', texto: undefined }], '')[0].status, 'sem-data');

// ─── reconhece processo de credenciamento pelo texto dos documentos ───
assert.strictEqual(X.extrairTudo([{ nome: '[01]-41000050_Memorando___SEI.html', texto: 'Justifica-se … pela sua habilitação no  Edital de Credenciamento nº 19/2025.' }]).campos.CREDENCIAMENTO.valor, '019/2025');
assert.strictEqual(X.extrairTudo([{ nome: '[01]-41000051_Memorando___SEI.html', texto: 'contratação por inexigibilidade, art. 74, II' }]).campos.CREDENCIAMENTO, undefined);

// ─── nº SEI dos documentos: Declaração de Conformidade, Confirmação de Despesa, Análise Técnica ───
const nfTexto = (num, comp, emis, cnpj, nome, tomador, desc, valor) => [
  'DANFSe v1.0', 'Número da NFS-e Competência da NFS-e Data e Hora da emissão da NFS-e', `${num} ${comp} ${emis} 10:00:00`,
  'EMITENTE DA NFS-e CNPJ / CPF / NIF Inscrição Municipal Telefone', `Prestador do Serviço ${cnpj} - -`,
  'Nome / Nome Empresarial E-mail', `${nome} fulano@exemplo.com`,
  'TOMADOR DO SERVIÇO CNPJ / CPF / NIF', `${tomador} - -`, 'Descrição do Serviço', desc, 'TRIBUTAÇÃO MUNICIPAL',
  'Valor do Serviço Desconto Incondicionado', `R$ ${valor} - -`].join('\n');
const proc = X.extrairTudo([
  { nome: '[03]-41000101_CND_Federal.pdf', texto: 'Receita Federal CERTIDÃO NEGATIVA … Nome: FULANA DE TAL CPF: 123.456.789-09 Válida até 01/04/2027.' },
  { nome: '[04]-41000102_CND_Federal.pdf', texto: 'Receita Federal CERTIDÃO NEGATIVA … Nome: BANDA FICTICIA LTDA CNPJ: 11.222.333/0001-81 Válida até 01/04/2027.' },
  { nome: '[05]-41000103_Certificado_FGTS.pdf', texto: 'Certificado de Regularidade do FGTS - CRF Validade: 01/10/2026 a 30/10/2026' },
  { nome: '[06]-41000104_Proposta.pdf', texto: 'PROPOSTA DE ORÇAMENTO Valor total: R$ 1.500,00 CNPJ 11.222.333/0001-81' },
  { nome: '[07]-41000105_Nota_Fiscal_Balizadora_1.pdf', texto: nfTexto(12, '20/09/2024', '23/09/2024', '11.222.333/0001-81', 'BANDA FICTICIA LTDA', '90.256.660/0001-20', 'Show da Banda Fictícia no Festival X.', '5.000,00') },
  { nome: '[08]-41000106_Nota_Fiscal.pdf', texto: nfTexto(30, '10/03/2025', '11/03/2025', '11.222.333/0001-81', 'BANDA FICTICIA LTDA', '98.765.432/0001-10', 'Show na Praça.', '2.000,00') },
  { nome: '[09]-41000107_Comprovante.pdf', texto: 'Item orçamentário por produto - valor médio\nItem Orçamentário : Banda/Grupo local\nCachê Porto 400,00 7.287,66 85.000,00\nAlegre' },
  { nome: '[10]-41000108_Anexo.pdf', texto: 'ANEXO I - TABELAS DE CACHÊ\nCACHE NÍVEL 1:\nP. Física: 1.200,00\nP. Jurídica: 1.500,00\nCACHE NÍVEL 2:\nP. Física: 2.200,00\nP. Jurídica: 2.500,00' },
  { nome: '[11]-41000109_Despacho.html', texto: 'Coordenação de Música - SEC Despacho Ao Gabinete, Segue para homologação: Memorando - SEI 41000100' },
  { nome: '[12]-41000110_Despacho.html', texto: 'Gabinete do Secretário - SEC Despacho À Coordenação, Homologo os documentos: Memorando - SEI 41000100' },
  { nome: '[13]-41000111_Memorando___SEI.html', texto: 'habilitação no Edital de Credenciamento nº 19/2025' },
  { nome: '[14]-41000112_Contrato_Registrado_104999.html', texto: 'CONTRATO' },
  { nome: '[15]-41000113_Certificado_FGTS.pdf', texto: 'Certificado de Regularidade do FGTS - CRF Validade: 01/11/2026 a 30/11/2026' },
  { nome: '[16]-41000114_Nota_Fiscal.pdf', texto: nfTexto(38, '05/11/2026', '06/11/2026', '11.222.333/0001-81', '11.222.333 BANDA FICTICIA', '98.765.432/0001-10', 'Apresentação musical.', '1.500,00') },
]).campos;
const pv = k => proc[k] && proc[k].valor;
// CNPJ (Confirmação de Despesa) e CPF do sócio (pedido do financeiro) separados; nome do arquivo não diz: pelo texto
assert.deepStrictEqual([pv('DOC_CND_FEDERAL'), pv('DOC_CND_FEDERAL_CPF')], ['41000102', '41000101']);
// sem Contrato Registrado na pasta: NF do contratado ao Município, do dia do evento em diante = NF da despesa
const semContrato = X.extrairTudo([
  { nome: '[01]-41000201_Proposta.pdf', texto: 'PROPOSTA DE ORÇAMENTO Apresentação no dia 05/11/2026. Valor total: R$ 1.500,00' },
  { nome: '[02]-41000202_CNPJ.pdf', texto: 'CADASTRO NACIONAL DA PESSOA JURIDICA NOME EMPRESARIAL BANDA FICTICIA LTDA NÚMERO DE INSCRIÇÃO 11.222.333/0001-81' },
  { nome: '[03]-41000203_Nota_Fiscal.pdf', texto: nfTexto(10, '10/03/2025', '11/03/2025', '11.222.333/0001-81', 'BANDA FICTICIA LTDA', '98.765.432/0001-10', 'Show antigo.', '1.500,00') },
  { nome: '[04]-41000204_Nota_Fiscal.pdf', texto: nfTexto(38, '05/11/2026', '06/11/2026', '11.222.333/0001-81', 'BANDA FICTICIA LTDA', '98.765.432/0001-10', 'Apresentação musical.', '1.500,00') },
]).campos;
assert.deepStrictEqual([semContrato.DOC_NF && semContrato.DOC_NF.valor, semContrato.BAL1_DOC && semContrato.BAL1_DOC.valor, semContrato.BAL2_DOC], ['41000204', '41000203', undefined]);
assert.strictEqual(pv('DOC_FGTS'), '41000113');                         // o mais recente
assert.strictEqual(pv('DOC_HOMOLOGACAO'), '41000110');                  // despacho do Gabinete que homologa
assert.strictEqual(pv('DOC_CONTRATO'), '41000112');
// NF antes do contrato = balizadora (mesmo com tomador = Município); depois = a da despesa
assert.deepStrictEqual(['NF', 'EMPRESA', 'DATA', 'VALOR', 'DOC'].map(k => pv('BAL1_' + k)),
  ['12/2024', 'BANDA FICTICIA LTDA / CNPJ 11.222.333/0001-81', '20/09/2024', 'R$ 5.000,00', '41000105']);
assert.strictEqual(pv('BAL1_DESCRICAO'), 'Show da Banda Fictícia no Festival X.');
assert.strictEqual(pv('BAL2_NF'), '30/2025');
assert.strictEqual(pv('BAL3_NF'), undefined);
// v5.1.1: balizadora 1/2/3 = ordem da pasta (como "Nota Fiscal Balizadora 1/2/3" no SEI), mesmo que a 2ª seja da mesma natureza
const ordemBal = X.extrairTudo([
  { nome: '[01]-41000301_Proposta.pdf', texto: 'PROPOSTA DE ORÇAMENTO Realizar a apresentação artística do grupo no evento. Valor total: R$ 1.500,00' },
  { nome: '[02]-41000302_Nota_Fiscal.pdf', texto: nfTexto(5, '02/06/2026', '02/06/2026', '11.222.333/0001-81', 'GRUPO FICTICIO LTDA', '90.256.660/0001-20', 'Recreação e animação', '1.400,00') },
  { nome: '[03]-41000303_Nota_Fiscal.pdf', texto: nfTexto(4, '02/06/2026', '02/06/2026', '11.222.333/0001-81', 'GRUPO FICTICIO LTDA', '90.256.660/0001-20', 'Recreação e animação', '1.700,00') },
  { nome: '[04]-41000304_Nota_Fiscal.pdf', texto: nfTexto(2, '26/05/2026', '26/05/2026', '11.222.333/0001-81', 'GRUPO FICTICIO LTDA', '90.256.660/0001-20', 'Espetáculo Teatral no Festival X', '4.000,00') },
]).campos;
assert.deepStrictEqual([1, 2, 3].map(n => [ordemBal[`BAL${n}_NF`].valor, ordemBal[`BAL${n}_DOC`].valor]),
  [['5/2026', '41000302'], ['4/2026', '41000303'], ['2/2026', '41000304']]);
assert.deepStrictEqual(['DOC_NF', 'NF_NUMERO', 'NF_VALOR', 'NF_RECEBIDA'].map(pv), ['41000114', '38', 'R$ 1.500,00', '06/11/2026']);
assert.deepStrictEqual(['DOC_GRID', 'GRID_VALOR', 'GRID_ITEM'].map(pv), ['41000107', 'R$ 7.287,66', 'Banda/Grupo local']);
assert.deepStrictEqual(['DOC_TABELA_CACHE', 'CACHE_VALOR', 'CACHE_DESCRICAO'].map(pv),
  ['41000108', 'R$ 1.500,00', 'Apresentação Musical Cachê Nível 1: Pessoa Jurídica, conforme Edital de Credenciamento nº 19/2025']);
// justificativa de preço: credenciamento cita o edital e a tabela de cachê
const jp = X.derivados({ VALOR: 'R$ 1.500,00', CREDENCIAMENTO: '019/2025', DOC_TABELA_CACHE: '41000108', EMPRESA_NOME: 'Banda' }).JUSTIFICATIVA_PRECO;
assert.ok(jp.startsWith('O valor de R$ 1.500,00 por apresentação da empresa está na média') && jp.includes('Edital de Credenciamento nº 19/2025 (41000108)'));
assert.ok(X.derivados({ VALOR: 'R$ 4.000,00', EMPRESA_NOME: 'Banda Fictícia', CNPJ: '11.222.333/0001-81' }).JUSTIFICATIVA_PRECO.includes('da empresa Banda Fictícia, CNPJ 11.222.333/0001-81, está na média'));
// linha da Fazenda (Declaração de Conformidade): as 4 certidões, CNPJ e CPF da Federal
assert.strictEqual(X.derivados({ DOC_CND_MUNICIPAL: '1', DOC_CND_ESTADUAL: '2', DOC_CND_FEDERAL: '3', DOC_CND_FEDERAL_CPF: '4' }).DOC_REGULARIDADE_FAZENDA, '1, 2, 3, 4');
assert.strictEqual(X.derivados({ DOC_CND_MUNICIPAL: '1', DOC_CND_FEDERAL: '3' }).DOC_REGULARIDADE_FAZENDA, '1, 3');
// balizadoras: média >= proposta e mesma natureza (oficina não baliza apresentação musical)
const cb = X.conferirBalizadoras({ VALOR: 'R$ 4.000,00', OBJETO_DETALHADO: 'Realizar a apresentação musical de Fulana.',
  BAL1_NF: '1/2025', BAL1_DESCRICAO: 'Show da Fulana no Festival X', BAL1_VALOR: 'R$ 5.000,00',
  BAL2_NF: '2/2025', BAL2_DESCRICAO: 'Oficina de violão no Festival X', BAL2_VALOR: 'R$ 2.000,00' });
assert.ok(cb.some(c => !c.ok && /MENOR/.test(c.texto)));                  // média 3.500 < 4.000
assert.ok(cb.some(c => !c.ok && c.texto.includes('2/2025) é de oficina')));
assert.ok(!cb.some(c => c.texto.includes('1/2025')));                      // a do show está certa
// Consulta CNPJ: 30 dias só para saber que é recente; nunca "vencida" (não precisa atualizar no processo)
const cc = X.validadeCertidao('[04]-41000070_Consulta_CNPJ.pdf', 'CADASTRO NACIONAL DA PESSOA JURÍDICA COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL … Emitido no dia 03/11/2026 às 15:58:38');
assert.deepStrictEqual([cc.rotulo, cc.validade, cc.informativo], ['Consulta CNPJ', '03/12/2026', true]);
assert.strictEqual(X.situacaoCertidoes([{ nome: '[04]-41000070_Consulta_CNPJ.pdf', texto: 'COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL Emitido no dia 03/01/2026 às 10:00:00' }], '', new Date(2026, 10, 11))[0].status, 'informativo');
assert.strictEqual(X.validadeCertidao('[04]-41000071_CNPJ.pdf', 'COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL Emitido no dia 03/11/2026 às 15:58:38').rotulo, 'Consulta CNPJ');
assert.ok(X.conferirBalizadoras({ VALOR: 'R$ 4.000,00', OBJETO: 'Apresentação musical', BAL1_DESCRICAO: 'Espetáculo da banda', BAL1_VALOR: 'R$ 4.000,00' }).every(c => c.ok));
// despacho do SEI que cita "certidão" não é certidão
assert.strictEqual(X.validadeCertidao('[83]-41516043_Despacho.html', 'Certidão Negativa Municipal … emitida em 01/10/2026'), null);

// ─── v2.0: itens do Checklist achados na pasta ───
const ck = X.extrairTudo([
  { nome: '[01]-41000301_Memorando___SEI.html', texto: 'Solicitamos…' },
  { nome: '[02]-41000302_CNPJ.pdf', texto: ['CADASTRO NACIONAL DA PESSOA JURIDICA', 'NÚMERO DE INSCRIÇÃO', '11.222.333/0001-81',
    'COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO', 'NOME EMPRESARIAL', '11.222.333 FULANA DE TAL', 'Emitido no dia 03/11/2026 às 10:00:00'].join('\n') },
  { nome: '[03]-41000303_CND_Federal_CNPJ_val._01.04.2027.pdf', texto: 'Receita Federal CERTIDÃO NEGATIVA Válida até 01/04/2027.' },
  { nome: '[04]-41000304_Consulta_CEIS_CNPJ_e_CPF.pdf', texto: 'Certidão Correcional CEIS Dados da consulta: 09/11/2026 15:01:10' },
  { nome: '[05]-41000305_Nota_de_Empenho_2026NE000001.pdf', texto: 'PREFEITURA DE CIDADE EXEMPLO NOTA EMPENHO' },
]).checklist;
assert.deepStrictEqual([ck.achados.memorando, ck.achados.cnpj, ck.achados.empenho], [{ sei: '41000301' }, { sei: '41000302' }, { sei: '41000305' }]);
assert.deepStrictEqual(ck.achados.cnd_fed_cnpj, { sei: '41000303', val: '01/04/2027' });
assert.deepStrictEqual([ck.achados.ceis_cnpj.sei, ck.achados.ceis_cpf.sei], ['41000304', '41000304']);   // um arquivo para CNPJ e CPF
assert.strictEqual(ck.tipoContratado, 'mei');                                                            // nome começa com o nº do CNPJ

// ─── nota de empenho e fiscal de serviço (Portaria) ───
const oi = X.extrairTudo([
  { nome: '[50]-41000400_Portaria___SEI.html', texto: 'DESIGNA … Função Titular Matrícula Cargo Suplente Matrícula Cargo Fiscal de Contrato FULANO DE TAL 1234567/1 Coordenador BELTRANA SILVA 7654321/1 Assistente Fiscal de Serviço CICRANO SOUZA 1112223/1 Assistente Administrativo' },
  { nome: '[51]-41000401_Nota_de_Empenho.pdf', texto: 'PREFEITURA DE CIDADE EXEMPLO NOTA EMPENHO Número 2026NE000123' },
]).campos;
assert.deepStrictEqual(['NUM_EMPENHO', 'FISCAL_SERVICO_NOME', 'FISCAL_SERVICO_MATRICULA'].map(k => oi[k] && oi[k].valor), ['2026NE000123', 'CICRANO SOUZA', '1112223']);

// ─── Contrato assinado: valor e objeto vencem proposta/memorando (pedido do usuário, 13/11/2026) ───
const ctr = v([
  { nome: '[01]-41000601_Memorando___SEI.html', texto: 'Solicitamos … O contrato será firmado no valor total de R$ 9.000,00 (nove mil reais)' },
  { nome: '[02]-41000602_Proposta.pdf', texto: 'PROPOSTA DE ORÇAMENTO Show da Banda Fictícia. Valor total: R$ 9.000,00' },
  { nome: '[03]-41000603_Contrato_Registrado_109999.html', texto: 'Contrato Nº 109999 / 2026 … e a empresa BANDA FICTICIA LTDA, CNPJ 11.222.333/0001-81, ' +
    'neste ato representada por Fulano de Tal, CPF XXX.XXX.123-XX, doravante denominada CONTRATADA … CLÁUSULA PRIMEIRA – DO OBJETO 1.1. O presente Contrato tem por objeto: ' +
    'Realizar apresentação musical da Banda Fictícia, no dia 10/10/2026, na Praça X. 1.2. Integram este contrato … 4.1. o CONTRATANTE pagará à CONTRATADA o valor total de R$ 3.000,00 (três mil reais).' },
]);
assert.deepStrictEqual([ctr.VALOR, ctr.NUM_CONTRATO], ['R$ 3.000,00', '109999/2026']);      // CPF mascarado não faz o contrato ser ignorado
assert.strictEqual(ctr.OBJETO_DETALHADO, 'Realizar apresentação musical da Banda Fictícia, no dia 10/10/2026, na Praça X.');
// credenciamento: "a prestação de serviços de …, de acordo com as especificações…" e sem valor no contrato
const ctrCred = v([{ nome: '[03]-41000604_Contrato_Registrado_109998.html', texto: 'Contrato Nº 109998 / 2026 CLÁUSULA PRIMEIRA – OBJETO 1.1 – O presente Contrato tem por objeto a prestação de serviços de apresentação musical de Duo Fictício, na Praça X, de acordo com as especificações e os detalhamentos constantes no PROJETO BÁSICO. 1.2 – …' }]);
assert.deepStrictEqual([ctrCred.OBJETO_DETALHADO, ctrCred.VALOR], ['Prestação de serviços de apresentação musical de Duo Fictício, na Praça X.', undefined]);

// ─── campos derivados ───
const d = X.derivados({ ARTISTA: 'Fulana e Banda', EVENTO: 'Festival da Primavera', EVENTO_DATA: '10/10/2026', VALOR: 'R$ 1.500,00', REP_CPF: '123.456.789-09' });
assert.strictEqual(d.OBJETO, 'Realizar a apresentação musical de Fulana e Banda.');
assert.strictEqual(d.OBJETO_DETALHADO, 'Realizar a apresentação musical de Fulana e Banda, no evento Festival da Primavera, no dia 10/10/2026.');
assert.strictEqual(d.QUANTIDADE, '1 (uma) apresentação');
assert.strictEqual(d.REP_CPF_MASCARADO, '***.***.789-**');

// ─── fiscais da Portaria, pré-empenho, publicação e conferência do processo ───
const r41 = X.extrairTudo([
  { nome: '[01]-41000701_Memorando___SEI.html', texto: 'Solicitamos a contratação …' },
  { nome: '[02]-41000702_Pre_Empenho_2026PE000123.pdf', texto: 'PRÉ-EMPENHO' },
  { nome: '[05]-41000705_Publicacao_Extrato_de_Inexigibilidade.pdf', texto: 'EXTRATO DE INEXIGIBILIDADE DE LICITAÇÃO' },
  { nome: '[06]-41000706_Portaria___SEI.html', texto: ['Função', 'Titular', 'Matrícula', 'Cargo', 'Suplente', 'Matrícula', 'Cargo',
    'Fiscal de Contrato', 'Fulano de Tal', '1234567/1', 'Assistente Administrativo', 'Beltrana de Tal', '7654321/2', 'Administradora',
    'Fiscal de Serviço', 'Sicrano de Tal', '1112223/1', 'Produtor Cultural', 'Outra Pessoa', '3332221/1', 'Monitora'].join('\n') },
], 'SEI_26.0.000999999_9');
const c41 = Object.fromEntries(Object.entries(r41.campos).map(([k, o]) => [k, o.valor]));
assert.deepStrictEqual([c41.NUM_PRE_EMPENHO, c41.DOC_PUB_INEX], ['2026PE000123', '41000705']);
assert.deepStrictEqual([c41.FISCAL_CONTRATO_NOME, c41.FISCAL_CONTRATO_MATRICULA, c41.FISCAL_CONTRATO_CARGO, c41.FISCAL_CONTRATO_SUP_NOME, c41.FISCAL_CONTRATO_SUP_MATRICULA, c41.FISCAL_CONTRATO_SUP_CARGO],
  ['Fulano de Tal', '1234567', 'Assistente Administrativo', 'Beltrana de Tal', '7654321', 'Administradora']);
assert.deepStrictEqual([c41.FISCAL_SERVICO_NOME, c41.FISCAL_SERVICO_SUP_CARGO], ['Sicrano de Tal', 'Monitora']);
assert.ok('fatos' in r41.checklist && r41.checklist.fatos.bancoTitular === null);

// conferência: etapa, o que falta, pontos de atenção e prazos (data de "hoje" fixa: sábado, 14/11/2026)
const hoje41 = new Date(2026, 10, 14);
const conf = (v, chk, ext = {}) => X.conferirProcesso(v, { ...ext, _checklist: chk }, hoje41);
const base41 = { CNPJ: '11.222.333/0001-81', VALOR: 'R$ 4.000,00', ENDERECO: 'Rua das Flores, 100, Cidade Exemplo/RS', EVENTO_DATA: '25/11/2026' };
const k1 = conf({ ...base41, SITUACAO_CADASTRAL: 'BAIXADA' }, { achados: { memorando: {}, homolog: {} }, tipoContratado: 'mei', fatos: { bancoTitular: false } },
  { VALOR: { diverge: [{ fonte: '[03]-41000003_Pre_Empenho.pdf', valor: 'R$ 9.000,00' }] } });
assert.deepStrictEqual([k1.etapa.nome, k1.etapa.proxima], ['Homologado', 'Minuta e conformidade']);
assert.strictEqual(k1.pontos[0].nivel, 'erro');                                    // erros primeiro
assert.ok(/ATIVA/.test(k1.pontos[0].texto));
assert.ok(k1.pontos.some(p => p.nivel === 'aviso' && /R\$ 9\.000,00/.test(p.texto)));
assert.ok(k1.pontos.some(p => /dados bancários/.test(p.texto)));
assert.ok(k1.faltam.includes('Proposta de Orçamento') && !k1.faltam.some(f => /Balanço/.test(f)));   // MEI não tem balanço
assert.ok(/faltam 11 dias/.test(k1.prazos.find(p => p.rotulo === 'Evento').texto));
// balizadora antiga ou emitida para o próprio órgão = só lembrete
const k2 = conf({ ...base41, VALOR: 'R$ 70.000,00' }, { achados: { memorando: {} }, tipoContratado: 'pj',
  fatos: { balizadoras: [{ num: '12', cnpj: '11.222.333/0001-81', data: '01/01/2024', valor: 'R$ 70.000,00' }] } });
assert.ok(k2.pontos.some(p => p.nivel === 'lembrete' && /mais de 1 ano/.test(p.texto)));
// evento em 4 dias sem empenho = erro; prazo do PNCP (10 dias úteis) a partir da assinatura
const k3 = conf({ ...base41, EVENTO_DATA: '18/11/2026', DATA_ASSINATURA: '02/11/2026' }, { achados: { memorando: {}, registrado: {} }, tipoContratado: 'mei' });
assert.ok(k3.pontos.some(p => p.nivel === 'erro' && /empenho/.test(p.texto)));
assert.ok(/até 16\/11\/2026/.test(k3.prazos.find(p => p.rotulo === 'PNCP').texto));
// nota do serviço menor que o contrato = aviso (pode ser parcela); maior = erro
const nfD = valor => conf(base41, { achados: { memorando: {} }, tipoContratado: 'mei', fatos: { nfDespesa: { valor } } }).pontos.find(p => /nota fiscal do serviço/.test(p.texto)).nivel;
assert.deepStrictEqual([nfD('R$ 1.000,00'), nfD('R$ 5.000,00')], ['aviso', 'erro']);
// v5.0.1: cada ponto diz de onde veio (a tela leva até o arquivo)
assert.deepStrictEqual(k1.pontos.find(p => /R\$ 9\.000,00/.test(p.texto)).ref, { arq: '[03]-41000003_Pre_Empenho.pdf', valor: 'R$ 9.000,00' });
assert.deepStrictEqual(k2.pontos.find(p => /mais de 1 ano/.test(p.texto)).ref, { arq: undefined, valor: '01/01/2024' });
// v5.0.1: comprovante de ISSQN com nome genérico ("Comprovante.pdf") é reconhecido pelo texto; vale 30 dias da emissão
const issTxt = 'Emitido na Internet, em 20/08/2026 às 20:27:13 PREFEITURA DE CIDADE EXEMPLO SECRETARIA MUNICIPAL DA FAZENDA Comprovante de inscrição no cadastro de ISSQN IDENTIFICAÇÃO Nº INSCRIÇÃO CNPJ SITUAÇÃO CADASTRAL 111.111.1.1 11.222.333/0001-81 Ativa';
assert.deepStrictEqual([X.validadeCertidao('[20]-41000020_Comprovante.pdf', issTxt).rotulo, X.validadeCertidao('[20]-41000020_Comprovante.pdf', issTxt).validade], ['Comprovante ISSQN', '19/09/2026']);
assert.strictEqual(v([{ nome: '[20]-41000020_Comprovante.pdf', texto: issTxt }]).DOC_ISSQN, '41000020');
assert.strictEqual(X.validadeCertidao('[30]-41000030_Comprovante.pdf', 'Item orçamentário por produto - valor médio Produto : Apresentação Musical'), null); // o do Grid não é certidão
// v5.0.2 (auditoria): CCMEI com a frase quebrada em duas linhas; CCMEI só pelo nome
assert.strictEqual(X.classificar('[06]-41000006_Contrato.pdf', 'Certificado da Condição de\nMicroempreendedor Individual Empresário(a)'), 'contrato_social');
assert.strictEqual(X.classificar('[35]-41000035_Certificado_CCMEI.pdf', ''), 'contrato_social');
// CND em tabela com ano de 2 dígitos (formato de Canoas): validade = a data mais adiante da linha
const canoas = X.validadeCertidao('[07]-41000007_CND_Municipal.pdf', 'PREFEITURA MUNICIPAL DE CANOAS SECRETARIA MUNICIPAL DA FAZENDA CERTIDÃO NEGATIVA DE DÉBITO PROTOCOLO VALIDADE DATA DE EXPEDIÇÃO 0 28/09/26 27/12/26 28/09/26 Certidão emitida as 12:50:41 do dia 28/09/2026');
assert.deepStrictEqual([canoas.validade, canoas.fonte], ['27/12/2026', 'texto']);
// emissão por extenso com "março" + "validade de 90 dias"
const fal = X.validadeCertidao('[11]-41000011_Certidao.pdf', 'CERTIDÃO JUDICIAL CÍVEL NEGATIVA ... falimentar ... 18 de março de 2026, às 09:21:53 OBSERVAÇÕES ... Esta certidão possui validade de 90 dias a partir da data de sua emissão');
assert.deepStrictEqual([fal.emissao, fal.validade], ['18/03/2026', '16/06/2026']);
// sem validade escrita: 30 dias, também para as CNDs da Confirmação de Despesa (regra do usuário, 15/11/2026)
assert.strictEqual(X.validadeCertidao('[07]-41000007_CND_Municipal.pdf', 'CERTIDÃO NEGATIVA DE DÉBITOS Secretaria Municipal da Fazenda emitida em 01/10/2026').validade, '31/10/2026');
// outros formatos (pedido do usuário: valer para casos novos, não só Canoas)
const outra = (t) => X.validadeCertidao('[07]-41000070_Certidao.pdf', t);
assert.deepStrictEqual([outra('CERTIDÃO NEGATIVA DE DÉBITOS Prefeitura de Cidade X Validade: 15/01/27 Expedição: 16/10/26').rotulo, outra('CERTIDÃO NEGATIVA DE DÉBITOS Prefeitura de Cidade X Validade: 15/01/27 Expedição: 16/10/26').validade], ['CND Municipal', '15/01/2027']);
assert.strictEqual(outra('CERTIDÃO NEGATIVA DE DÉBITOS MUNICIPAIS Data de emissão 03/11/26 Data de validade 02/12/26').validade, '02/12/2026');
assert.strictEqual(outra('CERTIDÃO Fazenda Pública Municipal Esta certidão é válida por 60 dias a contar da emissão. Emitida em 10/10/2026').validade, '09/12/2026');
assert.strictEqual(outra('CERTIDÃO NEGATIVA Prefeitura Municipal de Cidade Y emitida aos 5 dias do mês de março do ano de 2026').validade, '04/04/2026');
// v5.0.2 (auditoria, itens 5–13)
// 6: titular seguido de "Banco:" e banco com "Banco: 0260 -"
const banco = v([{ nome: '[23]-41000023_Documento.pdf', texto: 'Declaração de Conta Ativa - Conta PJ\nTitular: Fulana de Tal Banco: 0260 - Nu Pagamentos S.A. - Instituição de Pagamento\nAgência: 0001\nConta: 1234567-8' }]);
assert.deepStrictEqual([banco.REP_NOME, banco.AGENCIA], ['Fulana de Tal', '0001']);
assert.ok(!/^Banco/.test(banco.BANCO || ''), 'banco com rótulo: ' + banco.BANCO);
// 5: nome do OCR sem nenhuma palavra em comum não é "diferente"
const ocrNome = X.extrairTudo([
  { nome: '[09]-41000009_CND_Federal.pdf', texto: 'CERTIDÃO NEGATIVA tributos federais Nome: FULANA DE TAL CPF: 123.456.789-09 Válida até 01/01/2027' },
  { nome: '[05]-41000005_Documento.pdf', texto: 'CARTEIRA NACIONAL DE HABILITAÇÃO\nNOME\nDIA TOCA EUFDENSCVENTO' }], 'x').campos.REP_NOME;
assert.strictEqual((ocrNome.diverge || []).length, 0);
// 9: cartão com "Cc:"
assert.strictEqual(X.classificar('[28]-41000028_Documento.pdf', 'Banco do Brasil Agencia 2821-5 Cc: 12345-6 PRODUTORA X'), 'bancario');
// 10: "Em nome de X, … nome fantasia" → nome fantasia
const pf = v([{ nome: '[21]-41000021_Proposta.pdf', texto: 'CARTA PROPOSTA Em nome de Eventos Fictícios, inscrita sob CNPJ 11.222.333/0001-81, nome fantasia, nesse ato representada por Fulana de Tal' }]);
assert.deepStrictEqual([pf.NOME_FANTASIA, pf.EMPRESA_NOME], ['Eventos Fictícios', undefined]);
// 11: "data, local, horário" só para apresentação; 12: sem evento, 1 ano conta da assinatura
const semEvento = X.conferirProcesso({ CNPJ: '11.222.333/0001-81', OBJETO_DETALHADO: 'Realizar a confecção de troféus', DATA_ASSINATURA: '15/10/2026' },
  { _checklist: { achados: { proposta: {} }, fatos: { balizadoras: [{ num: '1', cnpj: '11.222.333/0001-81', data: '06/11/2025' }] } } }, new Date(2026, 10, 15));
assert.ok(!semEvento.pontos.some(p => /data, local/.test(p.texto) || /mais de 1 ano/.test(p.texto)));
// 14: credenciamento (cachê fixo da Tabela de Cachê): sem proposta nem balizadoras na lista do que falta
const cred = X.conferirProcesso({ CREDENCIAMENTO: '7/2026' }, { _checklist: { achados: { memorando: {} }, tipoContratado: 'mei' } }, new Date(2026, 10, 15));
assert.ok(!cred.faltam.some(f => /Proposta|balizadoras/.test(f)) && cred.faltam.includes('Dados bancários'));
// 13: validade do nome ≠ texto
assert.strictEqual(X.validadeCertidao('[10]-41000010_CND_Federal_CNPJ_val._24.02.2027.pdf', 'Receita Federal CERTIDÃO tributos federais Válida até 19/10/2026').nomeDiz, '24/02/2027');
// o Grid do SALIC salvo como "Consulta.pdf" não é certidão
assert.strictEqual(X.validadeCertidao('[26]-41000026_Consulta.pdf', 'Item orçamentário por produto - valor médio Produto : Apresentação Musical'), null);
// sem documentos lidos: nada "faltando" e nenhum ponto inventado
assert.deepStrictEqual([conf({}, {}).faltam, conf({}, {}).pontos], [[], []]);

// ─── v4.3.0: nome sugerido no SEI e onde emitir de novo ───
assert.deepStrictEqual(X.infoCertidao({ rotulo: 'Certificado FGTS', validade: '02/12/2026' }), { nome: 'Certificado FGTS val. 02.12.2026', link: 'https://consulta-crf.caixa.gov.br/' });
assert.strictEqual(X.infoCertidao({ rotulo: 'CGU – CEIS/Correcional (CNPJ)', validade: '10/10/2026' }).nome, 'Consulta CEIS CNPJ val. 10.10.2026');
assert.strictEqual(X.infoCertidao({ rotulo: 'Consulta CNPJ', informativo: true, validade: '03/12/2026' }).nome, 'Consulta CNPJ');   // sem "val.": não vence
assert.strictEqual(X.infoCertidao({ rotulo: 'CND Federal (CPF)', validade: '' }).nome, 'CND Federal CPF');
assert.strictEqual(X.infoCertidao({ rotulo: 'Declaração qualquer' }), null);
// o rótulo que a leitura dá a cada tipo tem nome sugerido
for (const [nome, txt] of [['CND_Municipal.pdf', ''], ['Certidao.pdf', 'CERTIDÃO NEGATIVA licitantes inidôneos CNPJ 11.222.333/0001-81'], ['Certidao.pdf', 'Certidão Judicial Cível Negativa falência'],
  ['Consulta.pdf', 'Consulta Consolidada de Pessoa Jurídica'], ['Certidao.pdf', 'Certidão de improbidade administrativa CPF 123.456.789-09'], ['Comprovante_ISSQN.pdf', '']])
  assert.ok(X.infoCertidao(X.validadeCertidao(nome, txt)), 'sem nome sugerido: ' + nome + ' ' + txt);

// v5.0.4: cartão CNPJ salvo no SEI com nome genérico ("Consulta", "Documento") também dá o DOC_CNPJ (Confirmação de Despesa)
for (const nome of ['[05]-41000104_Consulta.pdf', '[05]-41000104_Documento.pdf', '[05]-41000104_Certificado.pdf'])
  assert.strictEqual(v([{ ...cartao, nome }]).DOC_CNPJ, '41000104', nome);
// pessoa física (sem cartão CNPJ): "Inscrição no CPF ou CNPJ" = documento de identidade
r = v([{ nome: '[06]-41000105_Documento.pdf', texto: 'REPÚBLICA FEDERATIVA DO BRASIL CARTEIRA DE IDENTIDADE REGISTRO GERAL 1234567890 NOME FULANO EXEMPLO DE TAL CPF 123.456.789-09 DATA DE NASCIMENTO 01/01/1980' }]);
assert.strictEqual(r.DOC_CNPJ, '41000105');

console.log('teste-extrator: tudo ok');

// ─── Maestro Livre: contrato com nome genérico; órgão sem CNPJ informado ───
assert.strictEqual(v([{ nome: '[40]-41000940_Contrato.html', texto: 'Contrato nº 120/2026 … valor total de R$ 2.000,00' }]).NUM_CONTRATO, '120/2026');
X.definirOrgao('');
const semOrgao = X.extrairTudo([
  { nome: '[01]-41000951_Proposta.pdf', texto: 'PROPOSTA DE ORÇAMENTO Apresentação no dia 05/11/2026. Valor total: R$ 1.500,00' },
  { nome: '[02]-41000952_Nota_Fiscal.pdf', texto: nfTexto(38, '05/11/2026', '06/11/2026', '11.222.333/0001-81', 'BANDA FICTICIA LTDA', '55.444.333/0001-22', 'Apresentação musical.', '1.500,00') },
]).campos;
assert.strictEqual(semOrgao.DOC_NF && semOrgao.DOC_NF.valor, '41000952');   // NF do dia do evento = a da despesa, mesmo sem CNPJ do órgão
X.definirOrgao('98.765.432/0001-10');
console.log('teste-extrator (Maestro Livre): casos novos ok');

// ─── Maestro Livre: campos criados pelo usuário (regras simples) ───
const docsR = [
  { nome: '[01]-41000961_Parecer_Juridico.pdf', texto: 'PARECER\nMatrícula: 998877\nCPF do parecerista 111.222.333-44' },
  { nome: '[02]-41000962_Oficio.pdf', texto: 'Ofício nº 12/2026 emitido em 03/11/2026 contato@exemplo.gov.br' },
];
const regras = X.aplicarRegras([
  { k: 'DOC_PARECER', regra: { tipo: 'sei', arquivo: 'parecer juridico' } },
  { k: 'MATRICULA_PARECER', regra: { tipo: 'rotulo', arquivo: 'parecer', rotulo: 'Matrícula' } },
  { k: 'DATA_OFICIO', regra: { tipo: 'formato', arquivo: 'oficio', formato: 'data' } },
  { k: 'EMAIL', regra: { tipo: 'formato', formato: 'email' } },
  { k: 'A_MAO', regra: { tipo: 'manual' } },
], docsR);
assert.deepStrictEqual(Object.fromEntries(Object.entries(regras).map(([k, o]) => [k, o.valor])),
  { DOC_PARECER: '41000961', MATRICULA_PARECER: '998877', DATA_OFICIO: '03/11/2026', EMAIL: 'contato@exemplo.gov.br' });
console.log('teste-extrator (Maestro Livre): campos do usuário ok');
