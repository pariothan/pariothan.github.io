// --- Glossary term tooltips ---
// One shared popover appended to <body>, positioned in JS and clamped to
// the viewport so it can't be clipped by the layout's overflow:hidden
// panels or hidden behind other cards' stacking contexts.
(function () {
  const popover = document.createElement('div');
  popover.className = 'term-popover';
  popover.setAttribute('role', 'tooltip');
  document.body.appendChild(popover);

  let activeTerm = null;

  function positionPopover(term) {
    const margin = 8;
    const termRect = term.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();

    let left = termRect.left + termRect.width / 2 - popRect.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - popRect.width - margin));

    let top = termRect.top - popRect.height - margin;
    if (top < margin) top = termRect.bottom + margin;

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function showPopover(term) {
    const def = term.getAttribute('data-def');
    if (!def) return;
    if (activeTerm && activeTerm !== term) activeTerm.classList.remove('is-active');
    popover.textContent = def;
    activeTerm = term;
    term.classList.add('is-active');
    popover.classList.add('is-visible');
    positionPopover(term);
  }

  function hidePopover() {
    if (activeTerm) activeTerm.classList.remove('is-active');
    activeTerm = null;
    popover.classList.remove('is-visible');
  }

  document.addEventListener('mouseover', (e) => {
    const term = e.target.closest('.term');
    if (term) showPopover(term);
  });

  document.addEventListener('mouseout', (e) => {
    const term = e.target.closest('.term');
    if (term && !term.contains(e.relatedTarget)) hidePopover();
  });

  document.addEventListener('focusin', (e) => {
    const term = e.target.closest('.term');
    if (term) showPopover(term);
  });

  document.addEventListener('focusout', (e) => {
    if (e.target.closest('.term')) hidePopover();
  });

  document.addEventListener('click', (e) => {
    const term = e.target.closest('.term');
    if (!term) { hidePopover(); return; }
    e.stopPropagation();
    if (activeTerm === term) hidePopover();
    else showPopover(term);
  });

  window.addEventListener('scroll', () => {
    if (activeTerm) positionPopover(activeTerm);
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (activeTerm) positionPopover(activeTerm);
  });
})();
