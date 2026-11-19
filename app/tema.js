// Tema e aparência (v5.0.0). Carregado no <head> do index.html e do checklist.html, antes do CSS,
// para a tela já nascer no tema certo (sem piscar). Grava em localStorage "mlivre-config":
// { tema: 'classico'|'caderno'|'partitura'|'didatico' (padrão: didatico), modo: 'claro'|'escuro'|'auto' }.
// No <html>: data-tema, data-modo (já resolvido: claro|escuro) e data-theme (o nome que o Checklist usa).
// O Checklist dentro do Maestro acompanha a troca pelo evento "storage" (mesma origem, mesmo armazenamento).
(function () {
  const CHAVE = 'mlivre-config', raiz = document.documentElement, so = matchMedia('(prefers-color-scheme: dark)');
  const ler = () => { let c = {}; try { c = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { /* sem armazenamento: padrão */ }
    // tema padrão: Didático (pedido do usuário, 15/11/2026); quem já escolheu fica com o seu
    return { tema: c.tema || 'didatico', modo: ['claro', 'escuro'].includes(c.modo) ? c.modo : 'auto' }; };
  function aplicar() {
    const c = ler(), modo = c.modo === 'auto' ? (so.matches ? 'escuro' : 'claro') : c.modo;
    raiz.dataset.tema = c.tema; raiz.dataset.modo = modo; raiz.dataset.theme = modo === 'escuro' ? 'dark' : 'light';
  }
  function gravar(mud) { try { localStorage.setItem(CHAVE, JSON.stringify({ ...ler(), ...mud })); } catch (e) { /* idem */ } aplicar(); }
  aplicar();
  so.addEventListener('change', aplicar);
  addEventListener('storage', e => { if (e.key === CHAVE) aplicar(); });
  window.MaestroTema = { ler, gravar };
})();
