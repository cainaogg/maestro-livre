# Maestro Livre

Programa para quem monta processos de **contratação por inexigibilidade** (Lei 14.133/2021, art. 74, II: profissional do setor artístico) no **SEI**.

Você abre o processo exportado do SEI (o `.zip`) e o Maestro Livre:

- lê os documentos (PDF, imagem, Word, HTML), inclusive os escaneados;
- acha os dados: contratado, CNPJ, representante, valor, evento, números SEI dos documentos, certidões e validades, notas fiscais balizadoras;
- preenche os documentos prontos para colar no editor do SEI: memorando, termo de referência, estudo técnico preliminar, DFD, minuta de contrato, análise técnica de preços, declarações, despachos e extratos;
- confere o processo: o que falta, certidões vencidas ou que vencem antes do evento, valores diferentes entre documentos, prazo do PNCP;
- traz um checklist das etapas, com a explicação de cada item.

**Nada sai do seu computador.** O programa não usa internet nem inteligência artificial. Os documentos têm dados pessoais (RG, CPF, conta bancária) e ficam só no navegador de quem usa.

## Como usar

1. Baixe o zip da última versão (em *Releases*, à direita nesta página) e descompacte.
2. Dê dois cliques em **Abrir Maestro Livre.html**. Funciona no Chrome, Edge ou Firefox, no Windows, Linux ou Mac. Não precisa instalar nada.
3. Na tela inicial, solte o `.zip` do processo exportado do SEI (no SEI, a opção de gerar o arquivo ZIP do processo).
4. Confira os dados na tela **Dados** e copie os documentos na tela **Documentos**.

## Primeiro passo: o seu órgão

O programa vem sem nome de órgão, setor ou pessoa. Antes do primeiro processo:

1. Na tela **Dados**, preencha a categoria **Seu órgão**: nome do órgão, CNPJ, unidade, sigla, cidade, comarca do foro e nome do Diário Oficial.
2. Preencha **Destinatários dos despachos**: para quem vai cada despacho (ex.: "Ao Gabinete do Secretário", "Ao Setor Financeiro").
3. Faça o mesmo com quem assina os extratos e com o ordenador de despesa.
4. Clique em **Trancar** em cada uma dessas categorias. Os valores ficam fixos e valem para todos os processos.

O CNPJ do órgão também ajuda o programa a separar a nota fiscal do serviço (emitida para o órgão) das notas balizadoras (emitidas para outros contratantes).

## Como adaptar à realidade do seu órgão

Quase tudo se muda pela própria tela, sem programar.

| O que mudar | Onde |
|---|---|
| Texto dos documentos, despachos e extratos | **Documentos** → botão de editar (lápis) no documento aberto. Dá para criar modelos novos, duplicar e reordenar a lista. |
| Campos (dados que o programa procura e usa nos modelos) | **Configurações** → **Campos**: renomear, mudar de categoria, esconder ou criar campos novos. |
| Leis, decretos, sistemas e links | Tela **Consulta**: incluir, mudar e excluir. Inclua aqui os decretos e instruções normativas do seu órgão. |
| Etapas e itens do checklist | Tela **Checklist** → *Editar estrutura*; a explicação de cada item também é editável. |
| Valores fixos (órgão, setores, quem assina) | Tela **Dados** → **Trancar** na categoria. |

Para levar tudo para outro computador ou para um colega do mesmo órgão: gaveta **Processos salvos** → **Exportar tudo (.json)**, e lá, **Importar tudo**. Vão juntos os processos, o checklist, os modelos editados, os campos e os valores trancados.

### Campos novos

Em **Configurações** → **Campos** → **Novo campo**, escolha como o programa acha o valor:

- **Preencher à mão**;
- **Nº SEI do documento cujo nome tem uma palavra** (ex.: "Parecer" → número SEI do arquivo `…_Parecer_Juridico.pdf`);
- **Texto que vem depois de um rótulo** (ex.: o que vem depois de "Matrícula:" no documento com "Parecer" no nome);
- **Primeiro CPF, CNPJ, data, valor ou e-mail** encontrado num documento.

O campo ganha um código, como `{{MATRICULA_DO_PARECERISTA}}`. Escreva esse código no modelo para ele entrar no documento.

### Para quem programa

O programa é HTML e JavaScript puro, sem compilação. Abre direto do arquivo (`file://`).

- `app/extrator.js`: regras de leitura (roda no navegador e no Node). Regras novas ganham um caso em `testes/teste-extrator.js`. Rode `node testes/teste-extrator.js`.
- `app/modelos-padrao.js`: modelos de fábrica (com as classes de parágrafo do editor do SEI) e a lista de campos.
- `app/checklist.html`: checklist e explicações de cada item.
- `app/consulta.js`: lista de leis e links da tela Consulta.
- `app/servidor.ps1`: servidor local só para desenvolver.
- `ferramentas/gerar-zip.ps1`: gera o zip da versão em `releases/`.

## Limites conhecidos

- Pensado para a contratação de **artistas** (art. 74, II). Outras hipóteses funcionam com modelos editados, mas as conferências automáticas (notas balizadoras, Grid de cachês) são do setor artístico.
- A leitura de notas fiscais conhece a NFS-e nacional e um modelo antigo de NFS-e municipal. Outros modelos podem precisar de regra nova.
- Prazos em dias úteis contam só sábados e domingos: confira os feriados.
- Credenciamento (art. 79): o programa sabe que não há número de inexigibilidade nem Extrato de Inexigibilidade e que o cachê é o da tabela do edital. Adapte a minuta e o extrato de contrato ao seu edital.

## Licença

MIT (veja `LICENSE`). Bibliotecas incluídas, cada uma com a sua licença: [pdf.js](https://github.com/mozilla/pdf.js) (Apache 2.0), [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache 2.0), [Mammoth](https://github.com/mwilliamson/mammoth.js) (BSD 2) e fontes sob a SIL Open Font License (`app/lib/fontes/LICENCA-OFL.txt`).
