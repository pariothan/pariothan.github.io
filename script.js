// --- Page switching ---
// The four "pages" are sections of index.html; the nav buttons show one and hide the rest.
const VALID_VIEWS = new Set(['me', 'projects', 'cv', 'blog']);
const content = document.getElementById('content');

// --- Blog ---
// window.__blogPosts__ comes from posts/manifest.js, which build.js writes.
const blogPosts = window.__blogPosts__ || [];
let activeBlogTag = null;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBlogPosts() {
  const postsEl = document.getElementById('blog-posts');
  const filtersEl = document.getElementById('blog-tag-filters');
  if (!postsEl || !filtersEl) return;

  // Tag filter buttons (only worth showing when there's more than one tag)
  const allTags = [...new Set(blogPosts.flatMap(p => p.tags))].sort();
  filtersEl.innerHTML = '';
  if (allTags.length > 1) {
    const makeBtn = (label, tag) => {
      const btn = document.createElement('button');
      btn.className = 'blog-tag-btn' + (tag === activeBlogTag ? ' active' : '');
      btn.textContent = label;
      btn.setAttribute('aria-pressed', tag === activeBlogTag);
      btn.addEventListener('click', () => { activeBlogTag = tag; renderBlogPosts(); });
      return btn;
    };
    filtersEl.appendChild(makeBtn('ALL', null));
    allTags.forEach(tag => filtersEl.appendChild(makeBtn(tag, tag)));
  }

  const filtered = activeBlogTag ? blogPosts.filter(p => p.tags.includes(activeBlogTag)) : blogPosts;

  if (filtered.length === 0) {
    postsEl.innerHTML = `<p class="blog-status">${blogPosts.length === 0 ? 'No posts yet — check back soon.' : 'No posts with that tag.'}</p>`;
    return;
  }

  postsEl.innerHTML = filtered.map(post => {
    const date = new Date(post.date + 'T12:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const tagsHtml = post.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');

    return `
      <a class="entry post-link" href="./posts/${post.slug}/">
        <div class="post-card-meta">
          <time class="post-date" datetime="${post.date}">${date}</time>
          <span class="post-reading-time">${post.readingTime}&nbsp;min&nbsp;read</span>
        </div>
        <h3>${escapeHtml(post.title)}</h3>
        ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
        ${post.excerpt ? `<p class="post-excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
      </a>`;
  }).join('');
}

function render(view) {
  if (!VALID_VIEWS.has(view)) view = 'me';
  const target = document.getElementById(view);
  if (!target) return; // blog post pages have no views to switch
  document.querySelectorAll('.view').forEach(s => { s.hidden = true; });
  target.hidden = false;
  document.querySelectorAll('.navbtn').forEach(link => {
    if (link.getAttribute('href') === '#' + view) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  if (view === 'blog') renderBlogPosts();
}

document.querySelectorAll('.navbtn').forEach(link => {
  const href = link.getAttribute('href');
  if (!href || !href.startsWith('#')) return;
  link.addEventListener('click', e => {
    e.preventDefault();
    history.pushState(null, '', link.href);
    render(href.replace('#', ''));
    // Start the new page from the top, not wherever the last one was scrolled to
    window.scrollTo({ top: 0, behavior: 'instant' });
    content.focus({ preventScroll: true });
    if (window.rebuildTree) window.rebuildTree();
  });
});

window.addEventListener('popstate', () => {
  render(location.hash.replace('#', ''));
  if (window.rebuildTree) window.rebuildTree();
});

document.getElementById('personal-website-link')?.addEventListener('click', () => {
  alert("You're already there!");
});

render(location.hash.replace('#', ''));

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

// Private demo: the button first asks for a password, then hands it to the demo page (which is what checks it).
(function () {
  const form = document.getElementById('private-demo');
  if (!form) return;
  const key = document.getElementById('private-demo-key');
  form.addEventListener('submit', (e) => {
    if (key.hidden) { e.preventDefault(); key.hidden = false; key.focus(); return; }
    if (!key.value) { e.preventDefault(); key.focus(); return; }
    try { sessionStorage.setItem('private-demo-key', key.value); } catch {}
    key.value = '';
  });
})();
