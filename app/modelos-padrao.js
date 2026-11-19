// ============================================================
// Modelos que vêm de fábrica. Montados a partir de documentos reais de contratação por
// inexigibilidade (art. 74, II, da Lei 14.133/2021), usando as MESMAS classes
// de parágrafo que o editor do SEI usa — é isso que impede o CKEditor de
// desconfigurar a formatação ao colar.
//
// Sintaxe: {{CAMPO}}  ·  {{CAMPO|min}} 1ª letra minúscula  ·  {{CAMPO|mai}} tudo maiúsculo
//          {{CAMPO|sempt}} sem ponto final  ·  filtros encadeiam: {{CAMPO|min|sempt}}
// Só o CORPO do documento entra aqui; cabeçalho, título e número o SEI já gera.
// ============================================================
const JR = 'Texto_Corpo_11_Justificado_Recuo_Primeira_Linha';
const J  = 'Texto_Corpo_11_Justificado';
const p  = (cls, html) => `<p class="${cls}">${html}</p>`;

// Minutas: classes e recuos copiados de minutas reais. O recuo de subitem (margin-left:40px) é o que o próprio
// botão "aumentar recuo" do CKEditor grava, por isso é o único estilo mantido.
const CE = 'Texto_Corpo_12_Alinhado_Esquerda';
const c  = html => p(CE, html);
const cl = titulo => p(CE, `<strong>${titulo}</strong>`);
const it = (n, html) => p(CE, `<strong>${n} </strong>– ${html}`);
const sub = (n, html) => `<p class="${CE}" style="margin-left:40px">` + `<strong>${n} </strong>– ${html}</p>`;

const MODELOS_PADRAO = [
  {
    id: 'memorando',
    nome: 'Memorando - SEI',
    html: [
      p(JR, '{{TRATAMENTO}}'),
      p(JR, 'Solicitamos sua autorização para contratação direta da empresa <strong>{{EMPRESA_NOME}}, CNPJ {{CNPJ}}</strong>, nesse ato representada pelo(a) <strong>Sr.(a) {{REP_NOME}}, CPF {{REP_CPF_MASCARADO}}</strong>, com sede na <strong>{{ENDERECO}}</strong>, para {{OBJETO_DETALHADO|min}}'),
      p(JR, '{{CONTEXTO_EVENTO}}'),
      p(JR, '{{JUSTIFICATIVA}} Mais informações no Currículo Material de Consagração {{DOC_CURRICULO}}.'),
      p(JR, 'O contrato será firmado no valor total de <strong>{{VALOR}} ({{VALOR_EXTENSO}})</strong>, a serem pagos em uma parcela, por meio de crédito em conta corrente, mediante a confirmação da efetiva e integral realização do serviço.'),
      p(JR, 'Esta unidade registra que o valor cobrado é considerado justo para a prestação de serviços desta natureza, bem como de acordo com os valores de mercado.'),
      p(JR, 'Atenciosamente,'),
    ].join('\n'),
  },
  {
    id: 'tr',
    nome: 'Termo de Referência',
    html: [
      p(J, '<strong>OBJETO:</strong>'),
      p(J, '{{OBJETO}}'),
      p(J, '<strong>DESCRIÇÃO DO OBJETO:</strong>'),
      p(J, '{{OBJETO_DETALHADO}}'),
      p(J, '<strong>JUSTIFICATIVA:</strong>'),
      p(JR, '{{JUSTIFICATIVA}} Mais informações no Currículo Material de Consagração {{DOC_CURRICULO}}.'),
      p(J, '<strong>TIPO DE SELEÇÃO:</strong>'),
      p(J, 'Inexigibilidade:'),
      p(JR, 'A unidade demandante compreende que a empresa <strong>{{EMPRESA_NOME}}</strong> tem reconhecido mérito no meio artístico por possuir experiência na área artística, e por tratar-se de profissional consagrado pela opinião pública, conforme material em anexo. Justifica-se a contratação da mesma por ser essa a mais indicada para esse trabalho. Esta contratação busca seu amparo no embasamento legal no inciso II do artigo 74 da Lei Federal n.º 14.133/21, e suas alterações, que assim dispõe: “Art. 74. É inexigível a licitação quando inviável a competição, em especial nos casos de: (...) II - contratação de profissional do setor artístico, diretamente ou por meio de empresário exclusivo, desde que consagrado pela crítica especializada ou pela opinião pública.”'),
      p(J, '<strong>JUSTIFICATIVA DE PREÇOS:</strong>'),
      p(JR, 'Os preços praticados seguem os parâmetros de mercado no segmento, garantindo as especificações técnicas necessárias e apresentando valores acessíveis à contratação pela Administração, conforme comprovado com as notas fiscais balizadoras anexas a este processo e o grid SALIC, na análise técnica de preços, doc. {{DOC_ANALISE_TECNICA}}.'),
    ].join('\n'),
  },
  {
    id: 'etp',
    nome: 'Estudo Técnico Preliminar',
    html: [
      p(J, '<strong>1. Descrição da necessidade da contratação, considerado o problema a ser resolvido sob a perspectiva do interesse público.</strong>'),
      p(JR, '{{CONTEXTO_EVENTO}}'),
      p(J, '<strong>2. Demonstração da previsão da contratação no plano de contratações anual, sempre que elaborado, de modo a indicar o seu alinhamento com o planejamento da Administração.</strong>'),
      p(JR, 'Conforme relatório analítico do plano de contratações anual, doc. {{DOC_PCA}}.'),
      p(J, '<strong>3. Requisitos da contratação.</strong>'),
      p(JR, 'Qualificação artística para apresentação em eventos, gerando entretenimento e divertimento ao público.'),
      p(J, '<strong>4. Estimativas das quantidades para a contratação, acompanhadas das memórias de cálculo e dos documentos que lhes dão suporte, que considerem interdependências com outras contratações, de modo a possibilitar economia de escala.</strong>'),
      p(JR, '{{QUANTIDADE}}, para {{OBJETO_DETALHADO|min}} Conforme memorando e termo de referência anexos a este processo.'),
      p(J, '<strong>5. Levantamento de mercado, que consiste na análise das alternativas possíveis, e justificativa técnica e econômica da escolha do tipo de solução a contratar.</strong>'),
      p(JR, '{{JUSTIFICATIVA}} Mais informações no Currículo Material de Consagração {{DOC_CURRICULO}}.'),
      p(J, '<strong>6. Estimativa do valor da contratação, acompanhada dos preços unitários referenciais, das memórias de cálculo e dos documentos que lhe dão suporte, que poderão constar de anexo classificado, se a Administração optar por preservar o seu sigilo até a conclusão da licitação.</strong>'),
      p(JR, 'Orçamento da empresa, doc. {{DOC_PROPOSTA}}, e análise técnica de preços, doc. {{DOC_ANALISE_TECNICA}}, nos autos deste processo.'),
      p(J, '<strong>7. Descrição da solução como um todo, inclusive das exigências relacionadas à manutenção e à assistência técnica, quando for o caso.</strong>'),
      p(JR, 'Com base no inciso II do art. 74 da Lei nº 14.133/2021, torna-se viável a contratação, por inexigibilidade de licitação, por inviabilidade de competição.'),
      p(J, '<strong>8. Justificativas para o parcelamento ou não da contratação.</strong>'),
      p(JR, 'O objeto não é composto por itens/serviços divisíveis.'),
      p(J, '<strong>9. Demonstrativo dos resultados pretendidos em termos de economicidade e de melhor aproveitamento dos recursos humanos, materiais e financeiros disponíveis.</strong>'),
      p(JR, '{{RESULTADOS}}'),
      p(J, '<strong>10. Providências a serem adotadas pela Administração previamente à celebração do contrato, inclusive quanto à capacitação de servidores ou de empregados para fiscalização e gestão contratual.</strong>'),
      p(JR, 'Obter a documentação necessária para a contratação.'),
      p(J, '<strong>11. Contratações correlatas e/ou interdependentes.</strong>'),
      p(JR, '{{CONTRATACOES_CORRELATAS}}'),
      p(J, '<strong>12. Descrição de possíveis impactos ambientais e respectivas medidas mitigadoras, incluídos requisitos de baixo consumo de energia e de outros recursos, bem como logística reversa para desfazimento e reciclagem de bens e refugos, quando aplicável.</strong>'),
      p(JR, 'Não foram verificados possíveis impactos ambientais para esta contratação.'),
      p(J, '<strong>13. Posicionamento conclusivo sobre a adequação da contratação para o atendimento da necessidade a que se destina.</strong>'),
      p(JR, '{{RESULTADOS}}'),
      p(JR, 'O valor de {{VALOR}} pela apresentação está dentro dos valores praticados no mercado, conforme a tabela de Grid Orçamentário Salic web do Ministério da Cultura e os preços pagos por {{UNIDADE_SIGLA}} em contratações anteriores em eventos similares.'),
      p(JR, 'Assim, esta unidade endossa e recomenda esta contratação com a certeza de que obterá o melhor resultado possível e que atenderá às expectativas da organização e do público.'),
    ].join('\n'),
  },
  {
    id: 'du',
    nome: 'Declaração Unificada',
    html: [
      p('Texto_Corpo_10_Justificado', 'Eu, <strong>{{REP_NOME}}</strong>, CPF {{REP_CPF_MASCARADO}}, declaro, sob as penas da lei, que a <strong>{{EMPRESA_NOME}}</strong>, inscrita no CNPJ sob o nº {{CNPJ}}, com sede na {{ENDERECO}}:'),
      p('Texto_Corpo_10_Justificado', 'a) não se encontra impedida de contratar sob nenhuma das hipóteses previstas no art. 14 da Lei Federal nº 14.133, de 2021;'),
      p('Texto_Corpo_10_Justificado', 'b) cumpre as exigências de reserva de cargos para pessoa com deficiência e para reabilitado da Previdência Social, previstas em lei e em outras normas específicas;'),
      p('Texto_Corpo_10_Justificado', 'c) cumpre com o disposto no inc. XXXIII do art. 7º da Constituição Federal, bem como comunicará à Administração qualquer fato ou evento superveniente que venha alterar a atual situação;'),
      p('Texto_Corpo_10_Justificado', 'd) tomou conhecimento de todas as informações e das condições locais para o cumprimento das obrigações contratadas.'),
    ].join('\n'),
  },
];

// Minuta de contrato "normal" de inexigibilidade (art. 74, II), de uma minuta real. Original veio colado com estilo inline e sem classe; aqui usa a classe
// do SEI com a mesma aparência (Arial 11 justificado). Alíneas a), b)… sem recuo, como no original.
const k = html => p(J, html);
const ck = t => p(J, `<strong>${t}</strong>`);
const C = '<strong>CONTRATANTE</strong>', CD = '<strong>CONTRATADA</strong>';
MODELOS_PADRAO.push({
  id: 'minuta-inex',
  nome: 'Minuta de Contrato (Inex)',
  html: [
    p('Texto_Corpo_12_Centralizado_Maiusculas', 'processo administrativo {{PROCESSO}}'),
    p('Texto_Corpo_12_Centralizado_Maiusculas', '<strong>CONTRATO</strong>'),
    k('Contrato administrativo que entre si fazem <strong>{{ORGAO_NOME|mai}}</strong> e a empresa <strong>{{EMPRESA_NOME}}, CNPJ {{CNPJ}}</strong> para a prestação de serviços para {{UNIDADE_NOME}}.'),
    k('<strong>{{ORGAO_NOME|mai}}</strong>, CNPJ n.º {{ORGAO_CNPJ}}, neste ato representado(a) por {{SECRETARIA_CARGO}}, <strong>{{SECRETARIA_NOME}}</strong>, doravante denominado simplesmente CONTRATANTE, e a empresa <strong>{{EMPRESA_NOME}}, CNPJ {{CNPJ}}</strong>, com sede na <strong>{{ENDERECO}}</strong>, neste ato representada por <strong>{{REP_NOME}}, CPF {{REP_CPF_MASCARADO}}</strong>, doravante denominada CONTRATADA, celebram o presente CONTRATO, mediante INEXIGIBILIDADE DE LICITAÇÃO, com embasamento legal no art. 74, II, da <strong>Lei Federal n.º 14.133/2021</strong> e demais normas pertinentes à matéria, o qual será regido pelos termos da proposta da CONTRATADA e pelo Termo de Referência constantes no processo administrativo n.º {{PROCESSO}}, que fazem parte do presente instrumento como se nele estivessem transcritos, e pelas seguintes cláusulas e condições:'),
    ck('CLÁUSULA PRIMEIRA – DO OBJETO'),
    k('1.1. O presente Contrato tem por objeto: {{OBJETO_DETALHADO|sempt}}, no valor total de <strong>{{VALOR}}</strong>.'),
    k('1.2. Os serviços deverão obedecer às condições estabelecidas no Termo de Referência constante no Anexo I deste instrumento.'),
    k(`1.3. Nenhuma modificação poderá ser introduzida, sem o consentimento prévio e expresso do ${C}, através de {{UNIDADE_SIGLA}}.`),
    k('1.4. É vedada a subcontratação dos serviços.'),
    ck('CLÁUSULA SEGUNDA – DO PRAZO E DA VIGÊNCIA'),
    // Pedido do usuário: vigência amarrada à Ordem de Início, sem datas fixas — atraso na assinatura não exige termo aditivo.
    k(`2.1. <strong>Este Contrato terá vigência a contar da data de assinatura da Ordem de Início a {{VIGENCIA_FIM}}</strong>, devendo a Ordem de Início ser entregue pela fiscalização do Contrato e recebida formalmente pela ${CD}, por intermédio do documento “Ordem de Início”.`),
    k(`2.2. O prazo de vigência poderá ser prorrogado e o evento reagendado, mediante Termo Aditivo, quando o objeto não for executado na data estabelecida, ressalvadas as providências cabíveis no caso de culpa da ${CD}.`),
    k('2.3. A Ordem de Início dos serviços somente poderá ser entregue após a emissão da nota de empenho e publicação do Extrato de Contrato no {{DIARIO_OFICIAL}}.'),
    ck('CLÁUSULA TERCEIRA – DA EXECUÇÃO CONTRATUAL'),
    k('3.1. O regime de execução contratual, na forma disciplinada no art. 92, IV, da Lei Federal n.º 14.133/2021, deve observar a forma descrita no Termo de Referência.'),
    k('<strong>3.2. O recebimento definitivo será efetuado pelo servidor responsável, ou comissão de recebimento, designada pela autoridade competente, mediante termo detalhado que comprove o atendimento das exigências contratuais, conforme alínea “b” do inciso I do art. 140 da Lei Federal nº 14.133/2021.</strong>'),
    k('<strong>3.3. O recebimento definitivo não excluirá a responsabilidade civil pela solidez e pela segurança do serviço nem a responsabilidade ético-profissional pela perfeita execução do Contrato.</strong>'),
    ck('CLÁUSULA QUARTA – DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO'),
    k(`<strong>4.1.</strong> Pela prestação dos serviços objeto do presente Contrato, o ${C} pagará à ${CD}, em moeda corrente nacional, o valor total de <strong>{{VALOR}} ({{VALOR_EXTENSO}})</strong>, a serem pagos em parcela única mediante a confirmação da efetiva e integral realização do serviço.`),
    k('4.1.1. O pagamento deverá ser efetuado após a regular liquidação da despesa, observados o art. 63 da Lei Federal n.º 4.320/1964 e os arts. 141 a 146 da Lei Federal n.º 14.133/2021, no prazo de 30 (trinta) dias, contados da data do protocolo do documento de cobrança junto a {{UNIDADE_SIGLA}}.'),
    k('4.1.2. O pagamento será realizado em razão dos serviços efetivamente executados e aceitos.'),
    k('4.1.3. A liquidação da despesa será realizada mediante a apresentação de nota fiscal ou documento de cobrança equivalente, contendo a descrição do objeto e ateste emitido pela fiscalização, os quais serão objeto de verificação pelo setor competente.'),
    k(`4.1.4. Havendo erro na apresentação da nota fiscal ou instrumento de cobrança equivalente, ou circunstância que impeça a liquidação da despesa, esta ficará sobrestada até que a ${CD} providencie as medidas saneadoras, reiniciando-se o prazo após a comprovação da regularização da situação, sem ônus ao ${C}.`),
    k('4.1.5. A nota fiscal ou instrumento de cobrança equivalente deverá ser obrigatoriamente acompanhado da comprovação da regularidade fiscal mediante consulta aos sítios eletrônicos oficiais ou à documentação mencionada no art. 68 da Lei Federal n.º 14.133/2021.'),
    k(`4.2. Os pagamentos serão efetuados mediante crédito em conta corrente, devendo a ${CD} informar o número do banco, da agência e da conta bancária.`),
    k('4.3. Por ocasião do pagamento serão procedidas às retenções cabíveis na forma da legislação vigente.'),
    k('<strong>4.4.</strong> O preço fixado no item <strong>4.1</strong> deste Contrato é considerado completo, abrangendo todos os tributos (Impostos, Taxas, Emolumentos, Contribuições Fiscais e Parafiscais) fornecimento de mão de obra especializada, leis sociais, administração, lucros, equipamento e ferramental, transporte de material e de pessoal e quaisquer despesas, acessórias e/ou necessárias, não especificadas no Termo de Referência ou neste Contrato.'),
    ck('CLÁUSULA QUINTA – DAS OBRIGAÇÕES DO CONTRATANTE'),
    k(`5.1. Compete ao ${C}:`),
    k(`a) emitir prévio empenho anteriormente ao início da prestação de serviços da ${CD};`),
    k(`b) atender as solicitações de esclarecimentos da ${CD};`),
    k('c) inspecionar a execução e a qualificação do objeto contratado, conforme especificações do Termo de Referência;'),
    k(`d) transmitir, por escrito, todas as ordens de serviços ou comunicações para a ${CD}, a fim de que produza efeitos;`),
    k('e) efetuar o pagamento no modo e no prazo ajustado;'),
    k(`f) aplicar à ${CD} as sanções previstas na Lei e neste Contrato;`),
    k('g) fornecer as orientações necessárias para a correta execução dos serviços, através da realização de reuniões, sempre que necessário;'),
    k(`h) acompanhar a execução dos serviços contratados e verificar se os mesmos estão de acordo com o cronograma a ser apresentado à ${CD}, se for o caso;`),
    k('i) decidir sobre casos omissos nas especificações;'),
    k(`j) registrar quaisquer deficiências na execução dos serviços, encaminhando cópia para a ${CD};`),
    k(`k) disponibilizar para a ${CD}, através da equipe de fiscalização dos serviços, informações e orientações sobre procedimentos a serem adotados;`),
    k(`l) providenciar a rescisão do Contrato quando a ${CD} deixar de cumprir os prazos e demais exigências necessárias à execução dos serviços, bem como aplicar as medidas cabíveis;`),
    k('m) providenciar a publicação do Extrato de Contrato e de seus eventuais Termos Aditivos no {{DIARIO_OFICIAL}} e no Portal Nacional de Contratações Públicas, nos termos do art. 94 da Lei Federal n.º 14.133/2021; e'),
    k('n) promover, caso seja necessário, em qualquer fase do Contrato, diligência destinada a esclarecer ou complementar a instrução do processo.'),
    k(`5.2. O ${C} não responderá por quaisquer compromissos assumidos pela ${CD} com terceiros, ainda que vinculados à execução do Contrato, bem como por qualquer dano causado a terceiros em decorrência de ato da ${CD}, de seus empregados, prepostos ou subordinados.`),
    ck('CLÁUSULA SEXTA – DAS OBRIGAÇÕES DA CONTRATADA'),
    k(`6.1. Compete à ${CD}:`),
    k(`a) prestar os serviços na forma ajustada e dentro do melhor padrão técnico aplicável, no intuito de sua perfeita execução e em atendimento às disposições deste instrumento, às especificações do ${C} e à proposta apresentada;`),
    k('b) cumprir as obrigações previstas no Termo de Referência e demais documentos integrantes do presente Contrato;'),
    k('c) reparar e corrigir, às suas expensas, no total ou em parte, o objeto do presente Contrato, quando se verificarem vícios, defeitos ou incorreções, resultantes da execução dos serviços ou dos materiais empregados, se houver;'),
    k(`d) responsabilizar-se pelos vícios e danos decorrentes da execução do objeto, de acordo com o Código de Defesa do Consumidor (Lei Federal nº 8.078/1990), bem como por todo e qualquer dano causado à Administração ou terceiros, não reduzindo essa responsabilidade a fiscalização ou o acompanhamento da execução contratual pelo ${C}, que ficará autorizado a descontar dos pagamentos devidos o valor correspondente aos danos sofridos;`),
    k('e) não contratar, durante a vigência do Contrato, cônjuge, companheiro ou parente em linha reta, colateral ou por afinidade, até o terceiro grau, de dirigente do contratante ou que desempenhe função na licitação ou atue na fiscalização ou na gestão do Contrato, nos termos do artigo 48, parágrafo único, da Lei Federal n.º 14.133/2021;'),
    k('f) não contratar empregado para prestar serviços para a contratante que seja familiar de agente público que exerça cargo em comissão ou função de confiança na contratante, em conformidade com o disposto no art. 7.º do Decreto Federal n.º 7.203/10;'),
    k('f.1) considera-se familiar o cônjuge, ou companheiro ou parente em linha reta ou colateral, por consanguinidade ou afinidade, até o terceiro grau.'),
    k('g) obedecer, no cumprimento das obrigações, às disposições da Lei Federal n.º 13.709/18 (Lei Geral de Proteção de Dados);'),
    k('h) assumir responsabilidades legais, administrativas e técnicas pela execução dos serviços;'),
    k(`i) submeter-se à fiscalização do ${C}, através do servidor designado por {{UNIDADE_NOME}};`),
    k(`j) acatar prontamente as exigências e observações da fiscalização do ${C};`),
    k(`k) prestar as informações solicitadas pelo ${C}, dentro dos prazos estipulados;`),
    k('l) sanar imediatamente quaisquer irregularidades comunicadas pela fiscalização do Contrato;'),
    k('m) consultar o órgão fiscalizador, com antecedência, quando houver necessidade de verificação de quaisquer situações, a fim de não causar transtorno ou atraso quanto à prestação de serviço;'),
    k('n) submeter-se às disposições legais em vigor;'),
    k('o) apresentar durante a execução do Contrato, se solicitado, documentos que comprovem estar cumprindo a legislação em vigor quanto às obrigações assumidas na presente contratação, em especial, encargos sociais, trabalhistas, previdenciários, tributários, fiscais e comerciais;'),
    k('p) assumir inteira responsabilidade pelos encargos trabalhistas, previdenciários, fiscais e comerciais eventualmente resultantes da execução do Contrato;'),
    k('q) responsabilizar-se pelo cumprimento das obrigações previstas em Acordo, Convenção, Dissídio Coletivo de Trabalho ou equivalentes das categorias abrangidas pelo Contrato, por todas as obrigações trabalhistas, sociais, previdenciárias, tributárias e as demais previstas em legislação específica, cuja inadimplência não transfere a responsabilidade ao Contratante;'),
    k('r) cumprir com o disposto no inciso XXXIII, do art. 7.º da CF/88, de acordo com a Lei Federal n.º 9.854/1999, (proibição de trabalho noturno, perigoso ou insalubre aos menores de dezoito anos e de qualquer trabalho a menores de dezesseis anos, salvo na condição de aprendiz a partir de quatorze anos);'),
    k('s) responsabilizar-se, civil e/ou criminalmente, por todos os atos e omissões que seus empregados, direta ou indiretamente, cometerem na área de fornecimento do objeto contratado, indenizando, se for o caso, a parte prejudicada;'),
    k('t) manter-se durante toda a execução deste Contrato em compatibilidade com as obrigações por ela assumidas e às condições de habilitação e qualificações exigidas na contratação; e'),
    k('u) responsabilizar-se pela quantificação e qualificação dos serviços a serem executados.'),
    ck('CLÁUSULA SÉTIMA – DA FISCALIZAÇÃO'),
    k('7.1. A fiscalização do Contrato será exercida através de responsável técnico designado por {{UNIDADE_SIGLA}}.'),
    k('7.2. A fiscalização deverá observar e fazer cumprir as legislações pertinentes e relativas à matéria.'),
    k('7.2.1. Compete à fiscalização disponibilizar todas as informações sobre os serviços, na internet, para que a sociedade possa auxiliar no controle e na fiscalização do serviço prestado.'),
    k('7.3. {{UNIDADE_SIGLA}} terá pleno poder para fiscalizar e acompanhar os serviços contratados, diretamente através de sua fiscalização, objetivando:'),
    k('a) sustar a execução de serviços contratados, total ou parcialmente, bem como diligenciar para que sejam aplicadas à empresa as penalidades previstas em cláusula contratual; e'),
    k('b) constatar que as solicitações de providências, à empresa, estão sendo cumpridas.'),
    k(`7.4. A fiscalização de que trata esta cláusula não exclui nem reduz a responsabilidade da ${CD} pelos danos causados diretamente à Administração ou a terceiros em razão da execução do Contrato nem implica em corresponsabilidade do ${C} ou de seus agentes e prepostos, em conformidade com o art. 120 da Lei Federal n.º 14.133/2021.`),
    k('7.5. A fiscalização do Contrato e a fiscalização dos serviços serão exercidas através de servidores designados por {{UNIDADE_SIGLA}}.'),
    ck('CLÁUSULA OITAVA – DAS SANÇÕES ADMINISTRATIVAS'),
    k('8.1. Comete infração administrativa, nos termos da Lei n.º 14.133/21, a CONTRATADA que:'),
    k('a) der causa à inexecução parcial do Contrato;'),
    k('b) der causa à inexecução parcial do Contrato que cause grave dano à Administração ou ao funcionamento dos serviços públicos ou ao interesse coletivo;'),
    k('c) der causa à inexecução total do Contrato;'),
    k('d) ensejar o retardamento da execução ou da entrega do objeto da contratação sem motivo justificado;'),
    k('e) apresentar documentação falsa ou prestar declaração falsa durante a execução do Contrato;'),
    k('f) praticar ato fraudulento na execução do Contrato;'),
    k('g) comportar-se de modo inidôneo ou cometer fraude de qualquer natureza;'),
    k('h) praticar ato lesivo previsto no art. 5.º da Lei Federal n.º 12.846/13.'),
    k('8.2. Serão aplicadas à CONTRATADA que incorrer nas infrações acima descritas as seguintes sanções:'),
    k('a) Advertência, quando a CONTRATADA der causa à inexecução parcial do Contrato, sempre que não se justificar a imposição de penalidade mais grave;'),
    k('b) Impedimento de licitar e contratar, quando praticadas as condutas descritas nas alíneas “b”, “c” e “d” do item 8.1 acima, sempre que não se justificar a imposição de penalidade mais grave;'),
    k('c) Declaração de inidoneidade para licitar e contratar, quando praticadas as condutas descritas nas alíneas “e”, “f”, “g” e “h” do item 8.1 acima, bem como nas alíneas “b”, “c” e “d”, que justifiquem a imposição de penalidade mais grave;'),
    k('d) Multa compensatória de até 10% (dez por cento) sobre o valor total do Contrato, no caso de inexecução total ou parcial do Contrato.'),
    k('8.3. A aplicação das sanções previstas neste Contrato não exclui, em hipótese alguma, a obrigação de reparação integral do dano causado ao CONTRATANTE.'),
    k('8.4. Todas as sanções previstas neste Contrato poderão ser aplicadas cumulativamente com a multa.'),
    k('8.4.1. Antes da aplicação da multa, será facultada a defesa do interessado no prazo de 15 (quinze) dias úteis, contado da data de sua intimação.'),
    k('8.4.2. Se a multa aplicada e as indenizações cabíveis forem superiores ao valor do pagamento eventualmente devido pelo CONTRATANTE à CONTRATADA, além da perda desse valor, a diferença será descontada da garantia prestada, se houver, ou será cobrada judicialmente.'),
    k('8.4.3. Previamente ao encaminhamento à cobrança judicial, a multa poderá ser recolhida administrativamente, no prazo máximo de 30 (trinta) dias, a contar da data do recebimento da comunicação enviada pela autoridade competente.'),
    k('8.5. A aplicação das sanções realizar-se-á em processo administrativo que assegure o contraditório e a ampla defesa à CONTRATADA, observando-se o procedimento previsto no caput e parágrafos do art. 158 da Lei Federal n.º 14.133/21, para as penalidades de impedimento de licitar e contratar e de declaração de inidoneidade para licitar ou contratar.'),
    k('8.6. Na aplicação das sanções serão considerados:'),
    k('a) a natureza e a gravidade da infração cometida;'),
    k('b) as peculiaridades do caso concreto;'),
    k('c) as circunstâncias agravantes ou atenuantes;'),
    k('d) os danos que dela provierem para o CONTRATANTE;'),
    k('e) a implantação ou o aperfeiçoamento de programa de integridade, conforme normas e orientações dos órgãos de controle.'),
    k('8.7. Os atos previstos como infrações administrativas na Lei Federal n.º 14.133/21, ou em outras leis de licitações e Contratos da Administração Pública que também sejam tipificados como atos lesivos na Lei Federal n.º 12.846/13, serão apurados e julgados conjuntamente, nos mesmos autos, observados o rito procedimental e autoridade competente definidos na referida Lei.'),
    k('8.8. A personalidade jurídica da CONTRATADA poderá ser desconsiderada sempre que utilizada com abuso do direito para facilitar, encobrir ou dissimular a prática dos atos ilícitos previstos neste Contrato ou para provocar confusão patrimonial, e, nesse caso, todos os efeitos das sanções aplicadas à pessoa jurídica serão estendidos aos seus administradores e sócios com poderes de administração, à pessoa jurídica sucessora ou à empresa do mesmo ramo com relação de coligação ou controle, de fato ou de direito, com a CONTRATADA, observados, em todos os casos, o contraditório, a ampla defesa e a obrigatoriedade de análise jurídica prévia.'),
    k('8.9. O CONTRATANTE deverá, no prazo máximo 15 (quinze) dias úteis, contado da data de aplicação da sanção, informar e manter atualizados os dados relativos às sanções por ele aplicadas, para fins de publicidade no Cadastro Nacional de Empresas Inidôneas e Suspensas (Ceis) e no Cadastro Nacional de Empresas Punidas (Cnep), instituídos no âmbito do Poder Executivo Federal.'),
    k('8.10. As sanções de impedimento de licitar e contratar e declaração de inidoneidade para licitar ou contratar são passíveis de reabilitação na forma do art. 163 da Lei Federal n.º 14.133/21.'),
    k('8.11. Os débitos da CONTRATADA para com o CONTRATANTE, resultantes de multa administrativa e/ou indenizações, não inscritos em dívida ativa, poderão ser compensados, total ou parcialmente, com os créditos devidos pelo CONTRATANTE decorrentes deste mesmo Contrato ou de outros Contratos administrativos que a CONTRATADA possua com o CONTRATANTE, na forma da Instrução Normativa SEGES/ME n.º 26, de 13 de abril de 2022.'),
    ck('CLÁUSULA NONA – DA EXTINÇÃO'),
    k('9.1. O Contrato se extingue quando cumpridas as obrigações de ambas as partes, ainda que isso ocorra antes do prazo estipulado para tanto.'),
    k('9.2. Se as obrigações não forem cumpridas no prazo estipulado, a vigência ficará prorrogada até a conclusão do objeto, caso em que deverá o CONTRATANTE providenciar a readequação do cronograma fixado para o Contrato.'),
    k('9.3. Quando a não conclusão do Contrato referida no item anterior decorrer de culpa da CONTRATADA:'),
    k('a) ficará ela constituído em mora, sendo-lhe aplicáveis as respectivas sanções administrativas; e'),
    k('b) poderá o CONTRATANTE optar pela extinção do Contrato e, nesse caso, adotará as medidas admitidas em lei para a continuidade da execução contratual, se for o caso.'),
    k('9.4. O Contrato pode ser extinto antes de cumpridas as obrigações nele estipuladas, ou antes do prazo nele fixado, por algum dos motivos previstos no artigo 137 da Lei Federal n.º 14.133/21, bem como amigavelmente, assegurados o contraditório e a ampla defesa.'),
    k('9.4.1. Nesta hipótese, aplicam-se também os artigos 138 e 139 da mesma Lei.'),
    k('9.5. A alteração social ou a modificação da finalidade ou da estrutura da empresa não ensejará a rescisão se não restringir sua capacidade de concluir o Contrato.'),
    k('9.5.1. Se a operação implicar mudança da pessoa jurídica CONTRATADA, deverá ser formalizado Termo Aditivo para alteração subjetiva.'),
    ck('CLÁUSULA DÉCIMA – DA DOTAÇÃO ORÇAMENTÁRIA'),
    k('10.1. A despesa decorrente da contratação correrá por conta da Dotação Orçamentária {{DOTACAO}}'),
    ck('CLÁUSULA DÉCIMA PRIMEIRA – DA JUSTIFICATIVA DE CONTRATAÇÃO'),
    k('11.1. A presente contratação é levada a efeito mediante inexigibilidade de licitação, com embasamento legal no art. 74, II, da <strong>Lei Federal n.º 14.133/2021</strong>, conforme justificativa e autorização constantes no processo administrativo n.º {{PROCESSO}}.'),
    ck('CLÁUSULA DÉCIMA SEGUNDA – DAS DISPOSIÇÕES GERAIS'),
    k(`12.1. Para todos os efeitos legais, visando a exata caracterização do objeto contratual, além de estabelecer procedimentos e normas decorrentes das obrigações ora contraídas, bem assim elencar as responsabilidades da ${CD}, integram este Contrato, como se nele estivessem transcritos, com todos os seus anexos, os seguintes documentos, aos quais a ${CD} fica vinculada até a extinção do presente ajuste:`),
    k('a) Termo de Referência {{DOC_TR}};'),
    k(`b) Proposta da ${CD} {{DOC_PROPOSTA}};`),
    k('12.2. Os documentos referidos na presente Cláusula são considerados suficientes para, em complemento a este Contrato, definir a sua extensão, as suas obrigações, e, desta forma, reger a execução do objeto contratado.'),
    ck('CLÁUSULA DÉCIMA TERCEIRA – DO FORO'),
    k('13.1. Para dirimir eventuais dúvidas e/ou conflitos oriundos do presente Contrato, fica eleito o Foro da Comarca de {{FORO}}, com renúncia a quaisquer outros por mais privilegiados que possam ser.'),
    k(`E assim, por estarem justos e acordados, é firmado o presente Contrato, por meio do Sistema Eletrônico de Informações (SEI) do ${C}.`),
    // Anexo I — Termo de Referência
    ck('ANEXO I - Termo de Referência'),
    ck('OBJETO:'), k('{{OBJETO}}'),
    ck('DESCRIÇÃO DO OBJETO:'), k('{{OBJETO_DETALHADO}}'),
    ck('JUSTIFICATIVA:'), k('{{JUSTIFICATIVA}} Mais informações no Currículo Material de Consagração {{DOC_CURRICULO}}.'),
    ck('TIPO DE SELEÇÃO:'), k('Inexigibilidade:'),
    k('A unidade demandante compreende que a empresa <strong>{{EMPRESA_NOME}}</strong>, tem reconhecido mérito no meio artístico por possuir experiência na área artística, e por tratar-se de profissional consagrado pela opinião pública, conforme material em anexo. Justifica-se a contratação da mesma por ser essa a mais indicada para esse trabalho. Esta contratação busca seu amparo no embasamento legal no inciso II do artigo 74 da Lei Federal n.º 14.133/21, e suas alterações, que assim dispõe: “Art. 74. É inexigível a licitação quando inviável a competição, em especial nos casos de: (...) II - contratação de profissional do setor artístico, diretamente ou por meio de empresário exclusivo, desde que consagrado pela crítica especializada ou pela opinião pública.”'),
    ck('JUSTIFICATIVA DE PREÇOS:'),
    k('Os preços praticados seguem os parâmetros de mercado no segmento garantindo as especificações técnicas necessárias e apresentando valores acessíveis à contratação pela Administração conforme comprovado com as notas fiscais balizadoras anexas a este processo, e grid SALIC, na Análise Técnica de Preços ({{DOC_ANALISE_TECNICA}}).'),
  ].join('\n'),
});

// ─── Extratos para o Diário Oficial ──────────────────────────
// Se o seu Diário Oficial também usa CKEditor, ele, mas não conhece as classes do SEI. Por isso os extratos usam
// a marcação que o próprio CKEditor gera nos botões de fonte/tamanho/alinhamento.
// Padrão dos extratos publicados: título Arial 14 maiúsculo centralizado; corpo Arial 10;
// RÓTULO em maiúsculas e negrito; valor normal terminando em "."; local/data e assinatura no fim.
const ARIAL = 'font-family:Arial,Helvetica,sans-serif';
// Formato conferido num extrato colado num Diário Oficial com CKEditor: título e PROCESSO juntos e
// centralizados; campos em linhas coladas (um parágrafo com quebras), só o NOME do campo em
// negrito ("**CONTRATANTE**: Município…"); data e assinatura centralizadas.
const ext = {
  cabecalho: (titulo, processo) => `<p style="text-align:center"><span style="${ARIAL}"><span style="font-size:14pt"><strong>${titulo}</strong></span>` +
    (processo ? `<br><span style="font-size:10pt"><strong>PROCESSO ${processo}</strong></span>` : '') + `</span></p>`,
  corpo: campos => `<p style="text-align:justify"><span style="${ARIAL}"><span style="font-size:10pt">` +
    campos.map(([rot, val]) => `<strong>${rot}</strong>: ${val}.`).join('<br>') + `</span></span></p>`,
  fim: [
    `<p style="text-align:center"><span style="${ARIAL}"><span style="font-size:10pt">{{CIDADE}}, {{DATA_EXTRATO}}.</span></span></p>`,
    `<p style="text-align:center"><span style="${ARIAL}"><span style="font-size:10pt"><strong>{{ASSINANTE_NOME|mai}}</strong>, {{ASSINANTE_CARGO|sempt}}.</span></span></p>`,
  ].join('\n'),
};
const VIG = 'A contar da data de assinatura da Ordem de Início até {{VIGENCIA_FIM}}';
const CONTRATADO = '{{EMPRESA_NOME}}, CNPJ {{CNPJ}}';
const DOT = [['DOTAÇÃO ORÇAMENTÁRIA', '{{DOTACAO|cod}}'], ['ORIGEM DE RECURSOS', '{{DOTACAO|desc}}']];
const VALOR_EXT = ['VALOR', '{{VALOR}} ({{VALOR_EXTENSO}})'];
MODELOS_PADRAO.push(
  {
    id: 'ext-contrato', grupo: 'extrato', nome: 'Extrato de Contrato',
    html: [ext.cabecalho('EXTRATO DE CONTRATO {{NUM_CONTRATO}}', '{{PROCESSO}}'), ext.corpo([
      ['CONTRATANTE', '{{ORGAO_NOME}}'], ['CONTRATADO', CONTRATADO],
      ['MODALIDADE', 'Inexigibilidade nº {{NUM_INEX}}'], ['OBJETO', '{{OBJETO_DETALHADO|sempt}}'],
      ['DATA DA ASSINATURA', '{{DATA_ASSINATURA}}'], ['VIGÊNCIA DO CONTRATO', VIG], VALOR_EXT,
      ['BASE LEGAL', 'Lei Federal nº 14.133/2021'], ...DOT]), ext.fim].join('\n'),
  },
  {
    id: 'ext-inex', grupo: 'extrato', nome: 'Extrato de Inexigibilidade',
    html: [ext.cabecalho('EXTRATO DE INEXIGIBILIDADE {{NUM_INEX}}'), ext.corpo([
      ['CONTRATANTE', '{{ORGAO_NOME}}'], ['PROCESSO', '{{PROCESSO}}'], ['CONTRATADO', CONTRATADO],
      ['CONTRATO', '{{NUM_CONTRATO}}'], ['OBJETO', '{{OBJETO_DETALHADO|sempt}}'], VALOR_EXT,
      ['BASE LEGAL', 'Inciso II do Artigo 74 da Lei Federal nº 14.133/21'], ...DOT]), ext.fim].join('\n'),
  },
  {
    id: 'ext-apostilamento', grupo: 'extrato', nome: 'Extrato de Termo de Apostilamento',
    html: [ext.cabecalho('EXTRATO DE TERMO DE APOSTILAMENTO', '{{PROCESSO}}'), ext.corpo([
      ['CONTRATO Nº', '{{NUM_CONTRATO}}'], ['APOSTILAMENTO Nº', '{{NUM_APOSTILAMENTO}}'],
      ['CONTRATANTE', '{{ORGAO_NOME}}'], ['CONTRATADA', CONTRATADO],
      ['OBJETO DO CONTRATO', '{{OBJETO_DETALHADO|sempt}}'], ['OBJETO DO TERMO DE APOSTILAMENTO', '{{OBJETO_APOSTILAMENTO|sempt}}'],
      ['MODALIDADE', 'Inexigibilidade nº {{NUM_INEX}}'], ['DATA DA ASSINATURA', '{{DATA_ASSINATURA_APOSTILAMENTO}}'],
      ['VIGÊNCIA DO CONTRATO', VIG], VALOR_EXT, ...DOT, ['BASE LEGAL', 'Lei Federal nº 14.133/2021']]), ext.fim].join('\n'),
  },
  {
    id: 'ext-aditivo', grupo: 'extrato', nome: 'Extrato de Termo Aditivo',
    html: [ext.cabecalho('EXTRATO DE TERMO ADITIVO', '{{PROCESSO}}'), ext.corpo([
      ['CONTRATO Nº', '{{NUM_CONTRATO}}'], ['ADITIVO Nº', '{{NUM_ADITIVO}}'],
      ['CONTRATANTE', '{{ORGAO_NOME}}'], ['CONTRATADA', CONTRATADO],
      ['OBJETO DO CONTRATO', '{{OBJETO_DETALHADO|sempt}}'], ['OBJETO DO TERMO ADITIVO', '{{OBJETO_ADITIVO|sempt}}'],
      ['MODALIDADE', 'Inexigibilidade nº {{NUM_INEX}}'], ['DATA DA ASSINATURA', '{{DATA_ASSINATURA_ADITIVO}}'],
      ['VIGÊNCIA DO CONTRATO', VIG], VALOR_EXT, ['BASE LEGAL', 'Lei Federal nº 14.133/2021'], ...DOT]), ext.fim].join('\n'),
  },
);

// DFD: 12 quadros (tabela de 1 célula cada), como num DFD real.
const D10 = 'Texto_Corpo_10_Justificado';
// Largura/borda: estilos copiados do código-fonte do DFD no editor do SEI. Sem width:860px a
// tabela colada encolhe para o tamanho do texto e fica centralizada (achado no teste de 11/11/2026).
const TAB = 'border-collapse:collapse;border-color:#000000;border-spacing:0px;margin:0.9em auto;width:860px';
const CEL = 'border-color:#000000;min-width:2em;overflow-wrap:break-word;padding:0.2em';
const quadro = (...ps) => `<table class="table infra-editor__table infra-doc-tabela" style="${TAB}"><tbody><tr><td colspan="2" style="${CEL}">${ps.map(x => p(D10, x)).join('')}</td></tr></tbody></table>`;
const espaco = p('Texto_Corpo_08_Justificado', '&nbsp;');
MODELOS_PADRAO.push({
  id: 'dfd',
  nome: 'DFD',
  html: [
    quadro('<strong>1. ÁREA REQUISITANTE DA DEMANDA</strong>', 'Órgão: {{ORGAO_NOME}}', 'Unidade: {{UNIDADE_NOME}}'), espaco,
    quadro('<strong>2. IDENTIFICAÇÃO E CIÊNCIA DO ORDENADOR DE DESPESA</strong>', 'Nome: {{ORDENADOR_NOME|mai}}', 'Matrícula: {{ORDENADOR_MATRICULA}}',
      'Cargo: {{ORDENADOR_CARGO}}', 'E-mail: {{ORDENADOR_EMAIL}}', 'Telefone: {{ORDENADOR_TELEFONE}}',
      'Número do documento SEI da publicação do ordenador de despesas: {{ORDENADOR_PUBLICACAO}}'), espaco,
    quadro('<strong>3. JUSTIFICATIVA</strong>', '{{JUSTIFICATIVA}} Mais informações no Currículo Material de Consagração, com Currículo {{DOC_CURRICULO}} e Portfolio {{DOC_PORTFOLIO}}.'), espaco,
    quadro('<strong>4. OBJETO DA DEMANDA</strong>', '{{OBJETO_DETALHADO}}'), espaco,
    quadro('<strong>5. QUANTITATIVO DO OBJETO A SER ADQUIRIDO/CONTRATADO</strong>', '{{QUANTIDADE}}.'), espaco,
    quadro('<strong>6. DATA ESPERADA PARA O INÍCIO DOS SERVIÇOS/ AQUISIÇÃO</strong>', 'Data estimada para {{EVENTO_DATA}}.'), espaco,
    quadro('<strong>7. RESULTADOS A SEREM ALCANÇADOS</strong>', '{{RESULTADOS}}'), espaco,
    quadro('<strong>8. CONTRATAÇÕES ANTERIORES</strong>', 'Há contratação vigente para esta aquisição / serviço? (   ) sim     ( x ) não',
      'Se há, qual vencimento? xx / xx/ xxxx', 'Número do processo da aquisição / contratação anterior (vigente ou vencida): '), espaco,
    quadro('<strong>9. PREVISÃO NO PLANO DE CONTRATAÇÕES ANUAL </strong>inserir no processo o relatório do PCA com a demanda do exercício em que o objeto será executado',
      '9.1. O(s) item(ns) consta(m) no PCA do órgão/entidade? (   ) sim     ( x ) não',
      '9.1.1. Número documento SEI: XXXXX, página XX, item XX.',
      'Relatório PCA {{DOC_PCA}}'), espaco,
    quadro('<strong>10. FONTE DE RECURSOS</strong>', 'Há recursos federais na contratação/ aquisição? ( ) sim ( X ) não<br>Exige publicação no DOU? ( ) sim ( X ) não', '&nbsp;',
      'Há recursos estaduais na contratação / aquisição? ( ) sim ( X ) não', 'Exige publicação no DOE? ( ) sim ( X ) não', '&nbsp;',
      'Há recursos de outras esferas na contratação/ aquisição? ( ) sim ( X ) não', 'Exige publicação específica? ( ) sim ( X ) não', 'Se sim, qual?', '&nbsp;',
      'Dotação orçamentária: {{DOTACAO}}'), espaco,
    quadro('<strong>11. CONTATO PARA INFORMAÇÕES</strong>', 'Servidor: {{CONTATO_NOME}}', 'Matrícula: {{CONTATO_MATRICULA}}', 'Lotação: {{CONTATO_LOTACAO}}',
      'Ramal: {{CONTATO_RAMAL}}', 'Observações: {{CONTATO_EMAIL}}'), espaco,
    quadro('<strong>12. AUTORIZAÇÃO DO TITULAR DA PASTA PARA INÍCIO DO PROCESSO</strong>', '( x ) Autorizo o início do processo de aquisição/contratação.'),
  ].join('\n'),
});

// ─── Confirmação de Despesa - Serviços em Geral (formulário da fiscalização) ──
const t10 = html => p(D10, html);
MODELOS_PADRAO.push({
  id: 'confirmacao-despesa',
  nome: 'Confirmação de Despesa',
  html: [
    p('Texto_Corpo_11_Centralizado', '<strong>CONFIRMAÇÃO DE DESPESA- Serviços em Geral</strong>'),
    t10('Para fins de autorização de pagamento, atesto a autenticidade dos documentos abaixo citados e anexados, e confirmo que os serviços prestados no dia {{EVENTO_DATA}} foram executados de acordo com as especificações contratadas em Contrato nº {{NUM_CONTRATO}} ({{DOC_CONTRATO}}). Deste modo, confirmo a despesa da Nota Fiscal nº {{NF_NUMERO}} ({{DOC_NF}}), cujo valor é de {{NF_VALOR}}, a qual foi recebida no dia {{NF_RECEBIDA}}.'),
    t10('<strong>1. REGULARIDADE FISCAL, DECLARAÇÕES E GUIAS</strong>'),
    t10('<strong>1.1. REGULARIDADE FISCAL -</strong> Documentações relativas ao período de execução do serviço:'),
    t10('1.1.1. Certidão Conjunta Tributos Federais ({{DOC_CND_FEDERAL}});'),
    t10('1.1.2. Certificado de Regularidade FGTS ({{DOC_FGTS}});'),
    t10('1.1.3. Certidão Negativa de Débitos Trabalhistas ({{DOC_CND_TRABALHISTA}});'),
    t10('1.1.4. Certidão Negativa de Débitos Municipais ({{DOC_CND_MUNICIPAL}});'),
    t10('1.1.5. Certidão Negativa de Débitos Estaduais ({{DOC_CND_ESTADUAL}});'),
    t10('1.1.6. Declarações ({{DOC_DU}}).'),
    t10('<strong>1.2. DOCUMENTOS TRABALHISTAS E PREVIDENCIÁRIOS - Declarações e Guias </strong>(Preencher quando a apresentação for obrigatória. Caso contrário, informar “não se aplica”) Não se aplica'),
    t10('1.2.1. Recibo de Entrega da Declaração de Débitos e Créditos Tributos Federais e Previdenciários - DCTFWeb (nº doc. SEI);'),
    t10('1.2.2. Documento de Arrecadação de Receitas Federais - DARF, com comprovante de pagamento (nº docs. SEI);'),
    t10('1.2.3. Documentação do FGTS Digital (com detalhamento de trabalhadores do Tomador do órgão correspondente) (nº doc. SEI);'),
    t10('1.2.4. GFD – Guia do FGTS Digital, com comprovante de pagamento (nº docs. SEI).'),
    t10('<strong>2. PORTARIA FISCALIZAÇÃO</strong>'),
    t10('2.1. Portaria de designação da fiscalização do contrato ({{DOC_PORTARIA}}).'),
    t10('<strong>3. SUBCONTRATAÇÃO</strong> (Preencher quando ocorrer subcontratação. Caso contrário, informar “não se aplica”) não se aplica'),
    t10('3.1. Anuência prévia da Administração, por parte da autoridade que autorizou a contratação (n° doc. SEI);'),
    t10('3.2. Contrato entre contratada e subcontratada para realização da obra ou serviço (n° doc. SEI);'),
    t10('3.3. Cópia da Nota Fiscal da subcontratada, com destaque da retenção para a Previdência Social, ISS e IRRF, se for o caso; (n° doc. SEI);'),
    t10('3.4. Regularidade fiscal e trabalhista da empresa subcontratada - item 1.1 (n° doc. SEI);'),
    t10('3.5. DARF paga com o CNPJ da subcontratada, referente à retenção da Previdência Social e/ou IRRF, na Nota Fiscal, se for o caso (n° doc. SEI);'),
    t10('3.6. Comprovante de pagamento de ISS retido da subcontratada, se for o caso; (n° doc. SEI).'),
    t10('<strong>Obs.: é proibida a alteração ou exclusão de itens deste formulário, somente permitida complementação de informações, se for o caso.</strong>'),
  ].join('\n'),
});

// ─── Declaração de Conformidade (contratação direta, Lei 14.133/2021) ──
// Tabelas com os estilos de um documento real. Coluna "se aplica" = nº SEI;
// "não se aplica" = X. {{CAMPO|opc}} some se vazio; {{CAMPO|x}} vira X quando o campo está vazio
// (contrato de exclusividade e balanço: só existem em alguns processos — MEI/PF nunca tem balanço).
const DC_CEL = 'padding:0px';
const dcLinha = (item, sim, nao = '&nbsp;') => `<tr><td style="${DC_CEL}">${t10(item)}</td><td style="${DC_CEL}">${t10(sim)}</td><td style="${DC_CEL}">${t10(nao)}</td></tr>`;
const dcNA = item => dcLinha(item, '&nbsp;', 'X');
const dcOpc = (item, campo) => dcLinha(item, `{{${campo}|opc}}`, `{{${campo}|x}}`);
const dcCab = (txt, cor) => txt.map(s => `<p class="Texto_Corpo_12_Centralizado"><span style="background-color:#000000;color:${cor(s)}"><strong>${s}</strong></span></p>`).join('');
MODELOS_PADRAO.push({
  id: 'declaracao-conformidade',
  nome: 'Declaração de Conformidade',
  html: [
    `<table class="table" style="margin-left:auto;margin-right:auto;width:1100px"><tbody>`,
    ...[['NÚMERO DO PROCESSO:', '{{PROCESSO}}'], ['ÓRGÃO REQUISITANTE:', '{{UNIDADE_SIGLA}}'], ['OBJETO A SER CONTRATADO:', '{{OBJETO_DETALHADO}}']]
      .map(([r, v]) => `<tr><td style="padding:0px;width:212px">${p('Texto_Corpo_10_Alinhado_Esquerda', r)}</td><td style="padding:0px;width:882px">${p('Texto_Corpo_10_Alinhado_Esquerda', v)}</td></tr>`),
    `</tbody></table>`,
    p('Texto_Corpo_06_Alinhado_Direita', '&nbsp;'),
    `<table class="table" style="margin-left:auto;margin-right:auto;width:1100px"><tbody>`,
    `<tr><td style="background-color:#000000;padding:0px;width:763px">${p('Texto_Corpo_12_Centralizado', '<span style="color:#FFFFFF"><strong>ITENS DE VERIFICAÇÃO</strong></span>')}</td>` +
      `<td style="background-color:#000000;padding:0px;width:168px">${dcCab(['SE APLICA', 'Informar o link', 'do documento'], s => s === 'SE APLICA' ? '#FFD700' : '#FFFFFF')}</td>` +
      `<td style="background-color:#000000;padding:0px;width:158px">${dcCab(['NÃO SE APLICA', 'Marcar com', '“X”'], s => s === 'NÃO SE APLICA' ? '#FFD700' : '#FFFFFF')}</td></tr>`,
    dcLinha('Documento de formalização de demanda:', '{{DOC_DFD}}'),
    dcLinha('Previsão/Compatibilidade com o Plano Anual de Contratações Públicas:', '{{DOC_PCA}}'),
    dcLinha('Estudo técnico preliminar, análise de riscos, termo de referência, projeto básico ou projeto executivo:', '{{DOC_ETP}}'),
    dcLinha('Autorização da autoridade competente para a celebração do contrato por dispensa/inexigilibilidade:', '{{DOC_HOMOLOGACAO}}'),
    dcLinha('Parecer técnico do Órgão requisitante demonstrando o atendimento dos requisitos exigidos:', '{{DOC_ETP}}'),
    dcLinha('PL na condição de autorizado/aprovado com recursos suficientes dando suporte total a despesa:', '{{DOC_PRE_EMPENHO}}'),
    `<tr><td style="background-color:#000000;padding:0px" colspan="3">${p('Texto_Corpo_10_Centralizado', '<span style="color:#FFFFFF"><strong>Documentos que comprovem que o contratado preenche os requisitos de habilitação e qualificação mínima necessária para a contratação pretendida:</strong></span>')}</td></tr>`,
    dcLinha('Justificativa que motivou a escolha do contratado com indicação do dispositivo legal aplicável:', '{{DOC_TR}}'),
    dcLinha('Justificativa de preço:', '{{DOC_ANALISE_TECNICA}}'),
    dcNA('Caracterização da situação emergencial ou calamitosa que justifique a dispensa, quando se tratar da hipótese prevista no inciso VIII do caput do art. 75 da Lei Federal nº 14.133/2021:'),
    dcNA('Atestado de exclusividade, contrato de exclusividade, declaração do fabricante ou outro documento idôneo capaz de comprovar que o objeto é fornecido ou prestado por produtor, empresa ou representante comercial exclusivos, vedada a preferência por marca específica:'),
    dcLinha('Diligências que demonstrem que o profissional a ser contratado do setor artístico, é efetivamente consagrado pela crítica especializada ou pela opinião pública:', '{{DOC_CURRICULOS}}'),
    dcNA('Para casos de contratação de serviços técnicos especializados, diligências que verifiquem que o profissional ou a empresa cujo conceito no campo de sua especialidade, decorrente de desempenho anterior, estudos, experiência, publicações, organização, aparelhamento, equipe técnica ou outros requisitos relacionados com suas atividades, permita inferir que o seu trabalho é essencial e reconhecidamente adequado à plena satisfação do objeto do contrato'),
    dcNA('Declaração do servidor no processo ou juntada de documentos que atestem a diligência realizada para verificar se de fato a empresa é exclusiva e se efetivamente no mercado é a única prestadora do serviço:'),
    dcOpc('Contrato de exclusividade do empresário com o artista contratado (se houver empresário):', 'DOC_EXCLUSIVIDADE'),
    dcNA('Planilha com a composição de todos os custos unitários da contratação:'),
    dcLinha('Consulta ao Cadastro Nacional de Empresas Inidôneas e Suspensas – CEIS (em nome da empresa licitante e sócio majoritário):', '{{DOC_CEIS}}'),
    dcLinha('Consulta ao Cadastro Nacional de Condenações Cíveis por Atos de Improbidade Administrativa, mantido pelo Conselho Nacional de Justiça (em nome da empresa licitante e sócio majoritário):', '{{DOC_CNJ}}'),
    dcLinha('Consulta à Relação de Inidôneos, mantida pelo Tribunal de Contas da União – TCU (em nome da empresa licitante e sócio majoritário):', '{{DOC_TCU_INIDONEOS}}'),
    dcLinha('Consulta Consolidada de Pessoa Jurídica do TCU:', '{{DOC_TCU_CONSOLIDADA}}'),
    dcLinha('Inscrição no Cadastro de Pessoas Físicas (CPF) ou no Cadastro Nacional da Pessoa Jurídica (CNPJ):', '{{DOC_CNPJ}}'),
    dcLinha('Inscrição no cadastro de contribuintes estadual e/ou municipal, se houver, relativo ao domicílio ou sede do licitante, pertinente ao seu ramo de atividade e compatível com o objeto contratual:', '{{DOC_ISSQN}}'),
    dcLinha('Regularidade perante a Fazenda federal, estadual e municipal do domicílio ou sede do licitante, ou outra equivalente, na forma da lei:', '{{DOC_REGULARIDADE_FAZENDA}}'),
    dcLinha('Regularidade relativa à Seguridade Social e ao FGTS, que demonstre cumprimento dos encargos sociais instituídos por lei:', '{{DOC_FGTS}}'),
    dcLinha('Regularidade perante a Justiça do Trabalho:', '{{DOC_CND_TRABALHISTA}}'),
    dcLinha('Declaração Conjunta assinada pela contratada, sob as penas da Lei, declarando que:<br>a) não se encontra impedida de contratar sob nenhuma das hipóteses previstas no Art. 14 da Lei Federal 14.133/2021;<br>b) cumpre as exigências de reserva de cargos para pessoa com deficiência e para reabilitado da Previdência Social, previstas em lei e em outras normas específicas;<br>c) cumpre com o disposto no inciso XXXIII do Artigo 7° da Constituição Federal;<br>d) tomou conhecimento de todas as informações e das condições locais para o cumprimento das obrigações contratadas.', '{{DOC_DU}}'),
    dcOpc('Balanço patrimonial, demonstração de resultado de exercício e demais demonstrações contábeis dos 2 (dois) últimos exercícios sociais, acompanhada de declaração, assinada por profissional habilitado da área contábil, que ateste o atendimento pela empresa dos índices econômicos exigidos pela regulamentação vigente.', 'DOC_BALANCO'),
    dcLinha('Certidão negativa de feitos sobre falência expedida pelo distribuidor da sede do licitante.', '{{DOC_FALENCIA}}'),
    dcLinha('Minuta de contrato:', '{{DOC_MINUTA}}'),
    `</tbody></table>`,
  ].join('\n'),
});

// ─── Análise Técnica de Preços (mapa de preços) ──
// Linhas com class="infra-opcional" somem quando todos os campos delas estão vazios
// (NF 2 e 3, tabela de cachê de credenciamento).
const E10 = 'Texto_Corpo_10_Alinhado_Esquerda'; // justificado em célula estreita espaça demais as palavras
const AT_CEL = 'border-color:#000000;min-width:2em;overflow-wrap:break-word;padding:0.2em';
const atLinha = (cels, opcional) => `<tr${opcional ? ' class="infra-opcional"' : ''}>` +
  cels.map(([w, x]) => `<td style="${AT_CEL};width:${w}px">${p(E10, x)}</td>`).join('') + '</tr>';
const AT_W = [134, 198, 199, 113, 151, 230];
const atCols = (...xs) => xs.map((x, i) => [AT_W[i], x]);
const atNF = n => atLinha(atCols(`{{BAL${n}_NF|opc}}`, `{{BAL${n}_EMPRESA|opc}}`, `{{BAL${n}_DESCRICAO|opc}}`, `{{BAL${n}_DATA|opc}}`, `{{BAL${n}_VALOR|opc}}`, `{{BAL${n}_DOC|opc}}`), true);
MODELOS_PADRAO.push({
  id: 'analise-tecnica',
  nome: 'Análise Técnica de Preços',
  html: [
    p('Texto_Corpo_10_Centralizado', '<strong>MAPA DE ANÁLISE DE PREÇOS</strong>'),
    `<table class="table infra-editor__table infra-doc-tabela" style="border-collapse:collapse;border-color:#000000;border-spacing:0px;margin:11px auto;width:1025px"><tbody>`,
    atLinha(atCols(...['Nº e Ano da NF', 'Empresa', 'Descrição do Serviço', 'Período ou Data de Execução', 'Valor', 'Link SEI'].map(s => `<strong>${s}</strong>`))),
    atLinha(atCols('Comprovante balizador 1', 'GRID ORÇAMENTÁRIO SALIC', '{{GRID_ITEM}}', 'valor médio', '{{GRID_VALOR}}', '{{DOC_GRID}}')),
    atLinha(atCols('Anexo 1 - Tabelas Cachê', '&nbsp;', '{{CACHE_DESCRICAO|opc}}', 'valor fixo', '{{CACHE_VALOR|opc}}', '{{DOC_TABELA_CACHE|opc}}'), true),
    atNF(1), atNF(2), atNF(3),
    atLinha(atCols('<strong>Proposta</strong>', '{{EMPRESA_NOME}} / <strong>CNPJ {{CNPJ}}</strong>', '{{OBJETO_DETALHADO}}', '{{EVENTO_DATA}}', '<strong>{{VALOR}}</strong>', '{{DOC_PROPOSTA}}')),
    `<tr><td style="${AT_CEL};width:134px">${t10('Justificativa')}</td><td style="${AT_CEL};width:891px" colspan="5">${t10('{{JUSTIFICATIVA_PRECO}}')}</td></tr>`,
    `</tbody></table>`,
  ].join('\n'),
});

// ─── Despachos (v4.1.0) ──────────────────────────────────────
// Textos tirados de despachos reais. O destinatário de cada um é um campo (grupo "Destinatários dos
// despachos"): preencha uma vez com os setores do seu órgão e use "Trancar".
// grupo: 'despacho' = terceiro bloco da lista de modelos. Corpo em Texto_Corpo_11 com recuo, como no SEI.
const desp = (id, nome, destino, ...paragrafos) => ({ id, grupo: 'despacho', nome,
  html: [p(JR, `<strong>${destino}</strong>,`), ...paragrafos.map(x => p(JR, x)), p(JR, 'Atenciosamente,')].join('\n') });
// minuta da Portaria (vai dentro do despacho de pedido de Portaria): tabela de fiscais como no despacho real
const PT_CEL = 'border-color:#000000;min-width:2em;overflow-wrap:break-word;padding:0.2em';
const ptLinha = (cels, negrito) => '<tr>' + cels.map(x => `<td style="${PT_CEL}">${p('Texto_Corpo_10_Centralizado', negrito ? `<strong>${x}</strong>` : x)}</td>`).join('') + '</tr>';
const fiscais = f => [`Fiscal de ${f === 'CONTRATO' ? 'Contrato' : 'Serviço'}`, `{{FISCAL_${f}_NOME|mai}}`, `{{FISCAL_${f}_MATRICULA}}`, `{{FISCAL_${f}_CARGO}}`,
  `{{FISCAL_${f}_SUP_NOME|mai}}`, `{{FISCAL_${f}_SUP_MATRICULA}}`, `{{FISCAL_${f}_SUP_CARGO}}`];
MODELOS_PADRAO.push(
  desp('desp-homologacao', 'Homologação', '{{DEST_HOMOLOGACAO}}',
    'Segue para homologação Memorando - SEI {{DOC_MEMORANDO}}, Termo de Referência {{DOC_TR}}, Estudo Técnico Preliminar {{DOC_ETP}}, Análise Técnica de Preço ({{DOC_ANALISE_TECNICA}}), e assinatura do Documento de Formalização de Demanda (DFD) {{DOC_DFD}}, no bloco de assinatura {{NUM_BLOCO}}.'),
  desp('desp-dlc', 'Numeração da inexigibilidade', '{{DEST_NUMERACAO}}',
    'Para informar a numeração da inexigibilidade para fins de publicação do Extrato de Inexigibilidade no {{DIARIO_OFICIAL}}. Considerando que o evento está previsto para {{EVENTO_DATA}}, solicitamos urgência, se possível.'),
  desp('desp-secon', 'Assinatura da minuta', '{{DEST_CONTRATOS}}',
    'Informo que este processo atende aos requisitos exigidos. Solicitamos assinatura das partes na Minuta de Contrato ({{DOC_MINUTA}}).'),
  desp('desp-bloco-contrato', 'Bloco do contrato', '{{DEST_HOMOLOGACAO}}',
    'Disponibilizado o bloco para assinatura do Contrato nº {{NUM_CONTRATO|num}} ({{DOC_CONTRATO}}).'),
  { id: 'desp-portaria', grupo: 'despacho', nome: 'Portaria de fiscais',
    html: [
      p('Texto_Corpo_10_Justificado_Recuo_Primeira_Linha', '<strong>{{DEST_PORTARIA}}</strong>,'),
      p('Texto_Corpo_10_Justificado_Recuo_Primeira_Linha', 'Solicitamos publicação de Portaria de fiscal de contrato conforme minuta abaixo:'),
      p('Texto_Corpo_10_Justificado_Recuo_Primeira_Linha', '<strong>{{ASSINANTE_CARGO|mai}}</strong>, no uso de suas atribuições legais,'),
      p('Texto_Corpo_10_Justificado', '<strong>DESIGNA</strong>, nos termos do art. 117 da Lei Federal nº 14.133/2021, os servidores abaixo relacionados, para acompanhar e fiscalizar a execução e o adequado cumprimento das cláusulas estabelecidas no Contrato n° <strong>{{NUM_CONTRATO}}</strong>, celebrado entre {{ORGAO_NOME}} e a empresa {{EMPRESA_NOME}}, CNPJ {{CNPJ}}, com vigência a contar da data de assinatura da Ordem de Início a {{VIGENCIA_FIM}}, que tem por objeto {{OBJETO_DETALHADO|min|sempt}} (Processo {{PROCESSO}}).'),
      `<table class="table infra-editor__table infra-doc-tabela" style="border-collapse:collapse;border-color:#000000;border-spacing:0px;margin:0.9em auto;width:860px"><tbody>` +
        ptLinha(['Função', 'Titular', 'Matrícula', 'Cargo', 'Suplente', 'Matrícula', 'Cargo'], true) + ptLinha(fiscais('CONTRATO')) + ptLinha(fiscais('SERVICO')) + '</tbody></table>',
      p('Texto_Corpo_10_Justificado_Recuo_Primeira_Linha', 'Atenciosamente,'),
    ].join('\n') },
  desp('desp-empenho', 'Pedido de empenho', '{{DEST_EMPENHO}}',
    'Considerando o Contrato nº {{NUM_CONTRATO|num}} ({{DOC_CONTRATO}}) assinado por ambas as partes; considerando certidões, consultas e certificados dentro do período de validade; considerando a Portaria - SEI {{DOC_PORTARIA}}; e considerando o Pré-Empenho {{NUM_PRE_EMPENHO}} ({{DOC_PRE_EMPENHO}}), solicitamos através deste despacho o Empenho.'),
  desp('desp-ecc', 'Publicação do extrato', '{{DEST_PUBLICACAO}}',
    'Segue a publicação do Extrato de Inexigibilidade no {{DIARIO_OFICIAL}} ({{DOC_PUB_INEX}}), para demais trâmites.'),
);

// ─── Minutas de Termo Aditivo e de Apostilamento (v4.1.0) ───
// Estrutura de minutas reais: a que contrato se refere, as partes,
// a cláusula corrigida — redação atual — "Passa a ter a seguinte redação" — redação nova.
const termo = (id, nome, tipo) => ({ id, nome,
  html: [
    p('Texto_Corpo_10_Justificado_Recuo_Primeira_Linha', `${tipo} ao Contrato nº {{NUM_CONTRATO|num}} / {{NUM_CONTRATO|ano}}, {{TERMO_FINALIDADE|min|sempt}}.`),
    p('Texto_Corpo_10_Justificado', '<strong>Contratante:</strong>'),
    p('Texto_Corpo_10_Justificado', '<strong>{{ORGAO_NOME|mai}}</strong>, CNPJ n.º {{ORGAO_CNPJ}}, neste ato representado(a) por {{SECRETARIA_CARGO}}, <strong>{{SECRETARIA_NOME|mai}}</strong>, aqui denominado(a) simplesmente CONTRATANTE.'),
    p('Texto_Corpo_10_Justificado', '<strong>Contratado:</strong>'),
    p('Texto_Corpo_10_Justificado', 'A empresa <strong>{{EMPRESA_NOME}}, CNPJ {{CNPJ}}</strong>, nesse ato representada pelo(a) Sr.(a) <strong>{{REP_NOME|mai}}</strong>, CPF {{REP_CPF_MASCARADO}}; aqui denominada simplesmente CONTRATADA.'),
    p('Texto_Corpo_10_Justificado', '<strong>Objeto:</strong>'),
    p('Texto_Corpo_10_Justificado', '<strong>Correção da {{TERMO_CLAUSULA|sempt}}:</strong>'),
    p('Texto_Corpo_10_Justificado_Recuo_Primeira_Linha', '{{TERMO_REDACAO_ATUAL}}'),
    p('Texto_Corpo_10_Justificado', '<strong>Passa a ter a seguinte redação:</strong>'),
    p('Texto_Corpo_10_Justificado_Recuo_Primeira_Linha', '{{TERMO_REDACAO_NOVA}}'),
    p('Texto_Corpo_10_Justificado', '{{CIDADE}}, {{DATA_EXTRATO}}'),
  ].join('\n') });
MODELOS_PADRAO.push(termo('minuta-aditivo', 'Minuta de Termo Aditivo', 'Aditivo'), termo('minuta-apostilamento', 'Minuta de Termo de Apostilamento', 'Apostilamento'));

// Campos conhecidos: rótulo, grupo e se é texto longo. Campos novos que o
// usuário inventar num modelo ({{QUALQUER_COISA}}) aparecem sozinhos em "Outros".
const CAMPOS = [
  // Seu órgão: preencha uma vez e use "Trancar" na categoria
  ['ORGAO_NOME', 'Órgão contratante (ex.: "Município de Exemplo")', 'Seu órgão'],
  ['ORGAO_CNPJ', 'CNPJ do órgão', 'Seu órgão'],
  ['UNIDADE_NOME', 'Unidade demandante (ex.: "a Secretaria de Cultura")', 'Seu órgão'],
  ['UNIDADE_SIGLA', 'Sigla da unidade (ex.: "SEC")', 'Seu órgão'],
  ['CIDADE', 'Cidade (data dos extratos e minutas)', 'Seu órgão'],
  ['FORO', 'Comarca do foro do contrato', 'Seu órgão'],
  ['DIARIO_OFICIAL', 'Diário Oficial (ex.: "Diário Oficial do Município")', 'Seu órgão'],
  ['DEST_HOMOLOGACAO', 'Homologação e bloco do contrato (ex.: "Ao Gabinete do Secretário")', 'Destinatários dos despachos'],
  ['DEST_NUMERACAO', 'Numeração da inexigibilidade', 'Destinatários dos despachos'],
  ['DEST_CONTRATOS', 'Assinatura da minuta (setor de contratos)', 'Destinatários dos despachos'],
  ['DEST_PORTARIA', 'Portaria de fiscais', 'Destinatários dos despachos'],
  ['DEST_EMPENHO', 'Pedido de empenho (setor financeiro)', 'Destinatários dos despachos'],
  ['DEST_PUBLICACAO', 'Publicação do extrato', 'Destinatários dos despachos'],
  ['PROCESSO', 'Nº do processo SEI', 'Processo'],
  ['TRATAMENTO', 'Vocativo (ex.: "Senhor Secretário,")', 'Processo'],
  ['EMPRESA_NOME', 'Razão social', 'Contratado'],
  ['NOME_FANTASIA', 'Nome fantasia', 'Contratado'],
  ['CNPJ', 'CNPJ', 'Contratado'],
  ['ENDERECO', 'Endereço completo', 'Contratado'],
  ['SITUACAO_CADASTRAL', 'Situação cadastral', 'Contratado'],
  ['REP_NOME', 'Representante (sócio)', 'Representante'],
  ['REP_CPF', 'CPF completo', 'Representante'],
  ['REP_CPF_MASCARADO', 'CPF mascarado (LGPD)', 'Representante'],
  ['REP_RG', 'RG', 'Representante'],
  ['REP_NASCIMENTO', 'Data de nascimento', 'Representante'],
  ['ARTISTA', 'Artista / grupo', 'Objeto'],
  ['EVENTO', 'Evento', 'Objeto'],
  ['EVENTO_DATA', 'Data(s)', 'Objeto'],
  ['EVENTO_DATA_EXTENSO', 'Data(s) por extenso', 'Objeto'],
  ['EVENTO_HORARIO', 'Horário', 'Objeto'],
  ['EVENTO_LOCAL', 'Local', 'Objeto'],
  ['QUANTIDADE', 'Quantidade', 'Objeto'],
  ['OBJETO', 'Objeto (simples)', 'Objeto', true],
  ['OBJETO_DETALHADO', 'Objeto detalhado', 'Objeto', true],
  ['VALOR', 'Valor', 'Valor'],
  ['VALOR_EXTENSO', 'Valor por extenso', 'Valor'],
  ['BANCO', 'Banco', 'Valor'],
  ['AGENCIA', 'Agência', 'Valor'],
  ['CONTA', 'Conta', 'Valor'],
  ['PIX', 'PIX', 'Valor'],
  ['CONTEXTO_EVENTO', 'Explicação do evento (por que existe, de onde vem o recurso)', 'Textos', true],
  ['JUSTIFICATIVA', 'Justificativa da escolha do artista', 'Textos', true],
  ['CURRICULO_TRECHO', 'Resumo do Currículo Material de Consagração (sugestão, entra na justificativa)', 'Textos', true],
  ['RESULTADOS', 'Resultados pretendidos', 'Textos', true],
  ['CONTRATACOES_CORRELATAS', 'Contratações correlatas', 'Textos', true],
  ['SECRETARIA_CARGO', 'Quem assina pelo órgão (ex.: "o Secretário de Cultura")', 'Contrato'],
  ['SECRETARIA_NOME', 'Nome de quem assina pelo órgão', 'Contrato'],
  ['VIGENCIA_FIM', 'Vigência até (ex.: "31 de dezembro de 2026")', 'Contrato'],
  ['DOTACAO', 'Dotação orçamentária', 'Contrato', true],
  ['CREDENCIAMENTO', 'Edital de credenciamento (vazio se não for credenciamento)', 'Contrato'],
  ['NUM_INEX', 'Nº da inexigibilidade (ex.: 15/2026)', 'Contrato'],
  ['NUM_CONTRATO', 'Nº do contrato (ex.: 120/2026)', 'Contrato'],
  ['DATA_ASSINATURA', 'Data da assinatura do contrato', 'Contrato'],
  ['NUM_ADITIVO', 'Nº do aditivo', 'Termo aditivo / apostilamento'],
  ['DATA_ASSINATURA_ADITIVO', 'Data da assinatura do aditivo', 'Termo aditivo / apostilamento'],
  ['OBJETO_ADITIVO', 'Objeto do termo aditivo', 'Termo aditivo / apostilamento', true],
  ['NUM_APOSTILAMENTO', 'Nº do apostilamento', 'Termo aditivo / apostilamento'],
  ['DATA_ASSINATURA_APOSTILAMENTO', 'Data da assinatura do apostilamento', 'Termo aditivo / apostilamento'],
  ['OBJETO_APOSTILAMENTO', 'Objeto do termo de apostilamento', 'Termo aditivo / apostilamento', true],
  ['TERMO_FINALIDADE', 'Minuta: para que serve o termo (ex.: "para correção do prazo de vigência")', 'Termo aditivo / apostilamento'],
  ['TERMO_CLAUSULA', 'Minuta: cláusula corrigida (ex.: "CLÁUSULA SEGUNDA – DO PRAZO E DA VIGÊNCIA")', 'Termo aditivo / apostilamento'],
  ['TERMO_REDACAO_ATUAL', 'Minuta: redação atual (como está no contrato)', 'Termo aditivo / apostilamento', true],
  ['TERMO_REDACAO_NOVA', 'Minuta: nova redação', 'Termo aditivo / apostilamento', true],
  ['DATA_EXTRATO', 'Data do extrato (ex.: "09 de outubro de 2026")', 'Assinatura dos extratos'],
  ['ASSINANTE_NOME', 'Quem assina o extrato', 'Assinatura dos extratos'],
  ['ASSINANTE_CARGO', 'Cargo (ex.: "Secretário de Cultura")', 'Assinatura dos extratos'],
  ['ORDENADOR_NOME', 'Nome', 'Ordenador de despesa (DFD)'],
  ['ORDENADOR_MATRICULA', 'Matrícula', 'Ordenador de despesa (DFD)'],
  ['ORDENADOR_CARGO', 'Cargo', 'Ordenador de despesa (DFD)'],
  ['ORDENADOR_EMAIL', 'E-mail', 'Ordenador de despesa (DFD)'],
  ['ORDENADOR_TELEFONE', 'Telefone', 'Ordenador de despesa (DFD)'],
  ['ORDENADOR_PUBLICACAO', 'Nº SEI da publicação do ordenador', 'Ordenador de despesa (DFD)'],
  ['CONTATO_NOME', 'Servidor', 'Contato (DFD)'],
  ['CONTATO_MATRICULA', 'Matrícula', 'Contato (DFD)'],
  ['CONTATO_LOTACAO', 'Lotação', 'Contato (DFD)'],
  ['CONTATO_RAMAL', 'Ramal', 'Contato (DFD)'],
  ['CONTATO_EMAIL', 'E-mail (Observações)', 'Contato (DFD)'],
  ['DOC_PROPOSTA', 'Proposta / orçamento', 'Nº dos documentos no SEI'],
  ['DOC_CNPJ', 'Cartão CNPJ', 'Nº dos documentos no SEI'],
  ['DOC_CURRICULO', 'Currículo / material de consagração', 'Nº dos documentos no SEI'],
  ['DOC_PORTFOLIO', 'Portfólio', 'Nº dos documentos no SEI'],
  ['DOC_ANALISE_TECNICA', 'Análise técnica de preços', 'Nº dos documentos no SEI'],
  ['DOC_PCA', 'Relatório PCA', 'Nº dos documentos no SEI'],
  ['DOC_MEMORANDO', 'Memorando', 'Nº dos documentos no SEI'],
  ['DOC_TR', 'Termo de Referência', 'Nº dos documentos no SEI'],
  ['DOC_ETP', 'Estudo Técnico Preliminar', 'Nº dos documentos no SEI'],
  ['DOC_DFD', 'DFD', 'Nº dos documentos no SEI'],
  ['DOC_CURRICULOS', 'Todos os currículos (Declaração de Conformidade)', 'Nº dos documentos no SEI'],
  ['DOC_HOMOLOGACAO', 'Despacho da autoridade que homologa (autorização)', 'Nº dos documentos no SEI'],
  ['DOC_PRE_EMPENHO', 'Pré-empenho', 'Nº dos documentos no SEI'],
  ['DOC_MINUTA', 'Minuta de contrato', 'Nº dos documentos no SEI'],
  ['DOC_DU', 'Declaração Unificada', 'Nº dos documentos no SEI'],
  ['DOC_CONTRATO', 'Contrato assinado', 'Nº dos documentos no SEI'],
  ['DOC_PORTARIA', 'Portaria de fiscalização', 'Nº dos documentos no SEI'],
  ['DOC_PUB_INEX', 'Publicação do Extrato de Inexigibilidade', 'Nº dos documentos no SEI'],
  ['NUM_BLOCO', 'Nº do bloco de assinatura (despacho de homologação)', 'Nº dos documentos no SEI'],
  ['DOC_EXCLUSIVIDADE', 'Contrato de exclusividade (vazio = X)', 'Nº dos documentos no SEI'],
  ['DOC_BALANCO', 'Balanço patrimonial (vazio = X; MEI/PF não tem)', 'Nº dos documentos no SEI'],
  ['DOC_CND_FEDERAL', 'CND Federal da empresa (CNPJ) — vai na Confirmação de Despesa', 'Nº das certidões no SEI'],
  ['DOC_CND_FEDERAL_CPF', 'CND Federal do sócio majoritário (CPF)', 'Nº das certidões no SEI'],
  ['DOC_REGULARIDADE_FAZENDA', 'Fazenda municipal, estadual e federal (CNPJ e CPF) — Declaração de Conformidade', 'Nº das certidões no SEI'],
  ['DOC_CND_ESTADUAL', 'CND Estadual', 'Nº das certidões no SEI'],
  ['DOC_CND_MUNICIPAL', 'CND Municipal', 'Nº das certidões no SEI'],
  ['DOC_CND_TRABALHISTA', 'CND Trabalhista', 'Nº das certidões no SEI'],
  ['DOC_FGTS', 'Certificado FGTS', 'Nº das certidões no SEI'],
  ['DOC_CEIS', 'CEIS (CGU)', 'Nº das certidões no SEI'],
  ['DOC_CNJ', 'CNJ – Improbidade', 'Nº das certidões no SEI'],
  ['DOC_TCU_INIDONEOS', 'TCU – Licitantes Inidôneos', 'Nº das certidões no SEI'],
  ['DOC_TCU_CONSOLIDADA', 'TCU – Consulta Consolidada', 'Nº das certidões no SEI'],
  ['DOC_ISSQN', 'Comprovante ISSQN (inscrição municipal)', 'Nº das certidões no SEI'],
  ['DOC_FALENCIA', 'Certidão Cível / Falência', 'Nº das certidões no SEI'],
  ['NUM_EMPENHO', 'Nota de Empenho', 'Empenho'],
  ['NUM_PRE_EMPENHO', 'Nº do pré-empenho', 'Empenho'],
  // Fiscais: lidos da Portaria do processo, se houver. Sem padrão no programa (dados pessoais): preencha
  // uma vez e use "Trancar" — costumam ser os mesmos de um processo para o outro.
  ...[['CONTRATO', 'Fiscal de contrato'], ['SERVICO', 'Fiscal de serviço']].flatMap(([f, r]) => [
    [`FISCAL_${f}_NOME`, `${r}: titular`], [`FISCAL_${f}_MATRICULA`, `${r}: matrícula`], [`FISCAL_${f}_CARGO`, `${r}: cargo`],
    [`FISCAL_${f}_SUP_NOME`, `${r}: suplente`], [`FISCAL_${f}_SUP_MATRICULA`, `${r}: matrícula do suplente`], [`FISCAL_${f}_SUP_CARGO`, `${r}: cargo do suplente`],
  ].map(([k, rot]) => [k, rot, 'Fiscais do contrato (Portaria)'])),
  ['NF_NUMERO', 'Nº da nota fiscal', 'Nota fiscal da despesa (Confirmação)'],
  ['DOC_NF', 'Nº SEI da nota fiscal', 'Nota fiscal da despesa (Confirmação)'],
  ['NF_VALOR', 'Valor da nota fiscal', 'Nota fiscal da despesa (Confirmação)'],
  ['NF_RECEBIDA', 'Recebida no dia', 'Nota fiscal da despesa (Confirmação)'],
  ['GRID_ITEM', 'Grid SALIC: item orçamentário', 'Análise técnica (balizadores)'],
  ['GRID_VALOR', 'Grid SALIC: valor médio do cachê', 'Análise técnica (balizadores)'],
  ['DOC_GRID', 'Grid SALIC: nº SEI', 'Análise técnica (balizadores)'],
  ['CACHE_DESCRICAO', 'Tabela de cachê (Cred.): nível', 'Análise técnica (balizadores)'],
  ['CACHE_VALOR', 'Tabela de cachê (Cred.): valor', 'Análise técnica (balizadores)'],
  ['DOC_TABELA_CACHE', 'Tabela de cachê (Cred.): nº SEI', 'Análise técnica (balizadores)'],
  ...[1, 2, 3].flatMap(n => [
    [`BAL${n}_NF`, `NF balizadora ${n}: nº/ano`], [`BAL${n}_EMPRESA`, `NF balizadora ${n}: empresa / CNPJ`],
    [`BAL${n}_DESCRICAO`, `NF balizadora ${n}: descrição`], [`BAL${n}_DATA`, `NF balizadora ${n}: data`],
    [`BAL${n}_VALOR`, `NF balizadora ${n}: valor`], [`BAL${n}_DOC`, `NF balizadora ${n}: nº SEI`],
  ].map(([k, r]) => [k, r, 'Análise técnica (balizadores)'])),
  ['JUSTIFICATIVA_PRECO', 'Justificativa de preço', 'Análise técnica (balizadores)', true],
];

// Valores fixos que valem pra quase todo processo (o usuário muda nos campos).
const PADROES_FIXOS = {
  TRATAMENTO: 'Senhor Secretário,',
  CONTRATACOES_CORRELATAS: 'Não há.',
  VIGENCIA_FIM: `31 de dezembro de ${new Date().getFullYear()}`,
  DATA_EXTRATO: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
  // Órgão, setores e pessoas: SEM padrão. Cada órgão preenche uma vez e usa "Trancar".
};
