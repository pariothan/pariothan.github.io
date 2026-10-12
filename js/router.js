// Home page sections (#me, #projects, #cv, #blog) and the blog tag filter.
// The visible section is html[data-view]; an inline script in <head> sets it
// before first paint and CSS shows the matching .view.
(function () {
  const root = document.documentElement;
  const content = document.getElementById('content');
  const views = new Set([...document.querySelectorAll('.view')].map(s => s.id));
  const navLinks = document.querySelectorAll('.navbtn[href^="#"]');

  function setView(view) {
    if (!views.has(view)) view = 'me';
    root.dataset.view = view;
    navLinks.forEach(link => {
      if (link.getAttribute('href') === '#' + view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      history.pushState(null, '', link.href);
      setView(link.getAttribute('href').slice(1));
      content.focus();
      window.rebuildTree?.();
    });
  });

  window.addEventListener('popstate', () => setView(location.hash.slice(1)));

  setView(location.hash.slice(1));

  // --- Blog tag filter (cards and buttons are rendered by build.js) ---
  const filters = document.getElementById('blog-tag-filters');
  const cards = [...document.querySelectorAll('.blog-post-card')];
  const postsEl = document.getElementById('blog-posts');
  if (!filters || !filters.querySelector('.blog-tag-btn')) return;

  filters.hidden = false;
  const empty = document.createElement('p');
  empty.className = 'blog-status';
  empty.textContent = 'No posts with that tag.';

  filters.addEventListener('click', e => {
    const btn = e.target.closest('.blog-tag-btn');
    if (!btn) return;
    const tag = btn.dataset.tag;
    filters.querySelectorAll('.blog-tag-btn').forEach(b => b.classList.toggle('active', b === btn));
    let shown = 0;
    cards.forEach(card => {
      const match = !tag || JSON.parse(card.dataset.tags).includes(tag);
      card.hidden = !match;
      if (match) shown++;
    });
    if (shown) empty.remove();
    else postsEl.appendChild(empty);
  });
})();
