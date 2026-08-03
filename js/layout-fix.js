/* ==========================================================================
   layout-fix.js — o cabeçalho fixo (.letterhead) empilha busca + tema +
   protocolo + usuário numa coluna, então a altura dele varia (é bem maior
   que os 96px fixos que o CSS assumia). Isso fazia o topo do conteúdo de
   VÁRIAS abas ficar escondido atrás do cabeçalho no desktop. Aqui a gente
   mede a altura real e mantém --letterhead-h sempre atualizada.
   ========================================================================== */
function ajustarAlturaLetterhead() {
  const lh = document.querySelector('.letterhead');
  if (!lh) return;
  if (window.innerWidth < 860) {
    // no mobile o letterhead não é fixo (fica no fluxo normal da página),
    // então não precisa reservar espaço nenhum.
    document.documentElement.style.setProperty('--letterhead-h', '0px');
    return;
  }
  document.documentElement.style.setProperty('--letterhead-h', lh.offsetHeight + 'px');
}

window.addEventListener('load', ajustarAlturaLetterhead);
window.addEventListener('resize', ajustarAlturaLetterhead);
if ('ResizeObserver' in window) {
  new ResizeObserver(ajustarAlturaLetterhead).observe(document.querySelector('.letterhead'));
} else {
  document.addEventListener('DOMContentLoaded', ajustarAlturaLetterhead);
}
