# Maestro Livre — guia para agentes

Fork público e genérico do Maestro (pasta `../9. Auto Preencher Inexigibilidade`, versão 5.2.2), para publicar no
GitHub com licença MIT. Inexigibilidade do setor artístico (Lei 14.133/2021, art. 74, II) no SEI, para qualquer órgão.
Documentação para quem usa: `README.md` (vai no zip e é a página do repositório).

- **Nada de PMPA nem de nenhum órgão específico** (pedido do usuário, 19/11/2026): sem nomes de unidades/setores
  (CM-SMC, EAF, SECON, DLC, PGM…), sem decretos/INs/leis municipais, sem sistemas locais (LicitaCon, SisConP, DOPA, SIGEF).
  O órgão entra por campos (`ORGAO_*`, `UNIDADE_*`, `CIDADE`, `FORO`, `DIARIO_OFICIAL`, `DEST_*`), sem valor padrão.
  Antes de publicar, varrer: `grep -rniE "porto alegre|pmpa|smc|secon|dlc|pgm|dopa|licitacon|procempa" app testes`.
- **Sem IA e sem rede.** Nunca dados reais (nomes, CPFs, contas) em testes, docs ou capturas.
- Ids internos herdados (`desp-dlc`, `desp-secon`, item `dopa`, classe `f-dopa`, `--dopa`) ficaram: não aparecem na tela.
- Armazenamento separado do Maestro original: prefixo `mlivre_` (localStorage), IndexedDB `mlivre`, `mlivre-config`,
  `mlivre-consulta`, `mlivre-checklist-v1`. Importa exportações do Maestro original (`maestro-processos`).
- CNPJ do órgão: `Extrator.definirOrgao(ORGAO_CNPJ)` antes de ler; vazio = NF da despesa reconhecida só por data/valor.
- Contrato: `ehContrato()`/`RE_CONTRATO` em extrator.js (`…_Contrato.html`, `…_Contrato_Assinado`, `…_Contrato_Registrado…`).
- **Campos editáveis** (Configurações → Campos): `camposUsuario` em app.js (LS `campos` = `{mud, novos}`); `CAMPOS` é refeito
  por `aplicarCampos()` como `[código, nome, categoria, longo, escondido, criado]`. Regras dos campos novos:
  `Extrator.aplicarRegras(campos, docs)` (tipos `sei`, `rotulo`, `formato`), com teste em `testes/teste-extrator.js`.
- Credenciamento: sem modelos de edital específico; o conhecimento ficou (sem nº de inexigibilidade, sem Extrato de
  Inexigibilidade, sem Análise Técnica: `NAO_SE_APLICA_CRED` em app.js e regra em `conferirProcesso`).
- Versão em `app/versao.js` (`VERSAO_MAESTRO`, começa em 1.0.0); toda mudança entregue sobe a versão e entra no `CHANGELOG.md`.
- Zip: `ferramentas/gerar-zip.ps1` → `releases/Maestro-Livre-v<versão>.zip` (fora do git; anexar em Releases).
- Testes: `node testes/teste-extrator.js`. Desenvolvimento: `.claude/launch.json` do projeto original tem `maestro-livre`.
- Regras herdadas do original continuam: sem emoji na interface, `confirmar()`/`perguntar()`/`dialogo()` no lugar de
  `confirm()`/`prompt()`, abre de `file://` (nada de fetch de arquivo), modelos com as classes de parágrafo do SEI.
