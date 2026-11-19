// Gera app/lib/ocr-embutido.js: worker + núcleo (wasm) do Tesseract e o idioma português dentro de um
// .js comum. Assim o OCR funciona aberto direto do arquivo (file://), onde o navegador não deixa
// carregar worker/wasm/idioma por caminho. Rodar de novo só se trocar a versão do tesseract.js:
//   node ferramentas/embutir-ocr.js
const fs = require('fs'), path = require('path');
const lib = path.join(__dirname, '..', 'app', 'lib');
const ler = f => fs.readFileSync(path.join(lib, f));
// Erro do tesseract.js 5.1.1: com idioma passado como {code, data}, o "initialize" junta t.data (os bytes)
// em vez de t.code ("por") e o Tesseract não acha o idioma. Corrige no texto do worker embutido.
const ERRO = 'return"string"==typeof t?t:t.data}', CERTO = 'return"string"==typeof t?t:t.code}';
const worker = ler('worker.min.js').toString('utf8');
if (!worker.includes(ERRO)) throw new Error('trecho do worker mudou: rever a correção (versão nova do tesseract.js?)');
const conteudo = '// GERADO por ferramentas/embutir-ocr.js — não editar à mão.\n' +
  'window.OCR_EMBUTIDO = {\n' +
  '  worker: ' + JSON.stringify(worker.replace(ERRO, CERTO)) + ',\n' +
  '  core: ' + JSON.stringify(ler('tesseract-core/tesseract-core-simd-lstm.wasm.js').toString('utf8')) + ',\n' +
  '  por: ' + JSON.stringify(ler('lang/por.traineddata.gz').toString('base64')) + ',\n};\n';
fs.writeFileSync(path.join(lib, 'ocr-embutido.js'), conteudo);
console.log('ocr-embutido.js:', (conteudo.length / 1e6).toFixed(1), 'MB');
