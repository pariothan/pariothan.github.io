const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const SRC = path.join(__dirname, 'posts', 'src');
const OUT = path.join(__dirname, 'posts');

function readingTime(text) {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));
}

function toISODate(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function formatDate(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Replaces explicit {{term}} / {{display|term}} markup with hoverable glossary spans,
// looking definitions up in the post's frontmatter `terms` map.
function applyTerms(content, terms, slug) {
  if (!terms) return content;
  const defs = {};
  for (const [key, def] of Object.entries(terms)) {
    defs[key.trim().toLowerCase()] = def;
  }
  return content.replace(/\{\{([^{}|]+?)(?:\|([^{}]+?))?\}\}/g, (match, display, key) => {
    const lookupKey = (key || display).trim().toLowerCase();
    const def = defs[lookupKey];
    if (!def) {
      console.warn(`  [warn] ${slug}: no glossary entry for term "${lookupKey}" (from "${match}")`);
      return display.trim();
    }
    const label = escapeHtml(`${display.trim()} — ${def}`);
    return `<span class="term" tabindex="0" data-def="${escapeHtml(def)}" aria-label="${label}">${display.trim()}</span>`;
  });
}

function buildPostHtml({ title, date, tags, readingTime, content, prev, next }) {
  const tagsHtml = tags.map(t => `<span class="tech-badge">${escapeHtml(t)}</span>`).join('');

  const prevHtml = prev
    ? `<a class="navbtn post-nav-btn" href="../${prev.slug}/">&#8592; ${escapeHtml(prev.title)}</a>`
    : `<span class="navbtn post-nav-btn post-nav-btn--empty"></span>`;
  const nextHtml = next
    ? `<a class="navbtn post-nav-btn" href="../${next.slug}/">${escapeHtml(next.title)} &#8594;</a>`
    : `<span class="navbtn post-nav-btn post-nav-btn--empty"></span>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — Samuel Lederer</title>
    <link rel="icon" href="../../favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Quantico:ital,wght@0,400;0,700;1,400;1,700&family=Roboto:ital,wght@0,100..900;1,100..900&family=Fira+Code&family=JetBrains+Mono&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../style.css" />
    <link rel="stylesheet" href="../../print.css" media="print" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" />
  </head>
  <body>
    <div class="wrap">
      <div class="left-column" aria-hidden="true"></div>
      <main id="content" class="content-frame" tabindex="-1">
        <article class="story-grid auto-fit">
          <header class="title-card post-header">
            <div class="post-header-meta">
              <time class="post-date" datetime="${date}">${formatDate(date)}</time>
              <span class="post-reading-time">${readingTime} min read</span>
            </div>
            <h1>${escapeHtml(title)}</h1>
            ${tags.length ? `<div class="tech-stack">${tagsHtml}</div>` : ''}
          </header>
          <section class="story-card post-body">
            ${content}
          </section>
          <nav class="story-card post-nav" aria-label="Post navigation">
            ${prevHtml}
            <a class="navbtn" href="../../#blog">ALL POSTS</a>
            ${nextHtml}
          </nav>
        </article>
      </main>
      <aside class="sidebar" aria-label="Sidebar">
        <div class="nav-section">
          <div class="nav-separator">NAVIGATION</div>
          <nav class="button-frame" aria-label="Section navigation">
            <a class="navbtn" href="../../">ME</a>
            <a class="navbtn" href="../../#projects">PROJECTS</a>
            <a class="navbtn" href="../../#cv">CV</a>
            <a class="navbtn" href="../../#blog">BLOG</a>
          </nav>
        </div>
        <div class="tree-section">
          <canvas id="tree-canvas"></canvas>
        </div>
        <div class="links-section">
          <div class="links-separator">LINKS</div>
          <nav class="links-frame" aria-label="External links">
            <a href="https://github.com/pariothan" target="_blank" rel="noopener noreferrer" class="linkbtn">GITHUB</a>
            <a href="https://www.linkedin.com/in/lederersamuel/" target="_blank" rel="noopener noreferrer" class="linkbtn">LINKEDIN</a>
            <a href="mailto:slederer@pm.me" class="linkbtn">EMAIL</a>
          </nav>
        </div>
      </aside>
      <div class="name-column"><span class="spaceafter">颯</span><span>SAMUEL LEDERER</span></div>
    </div>
    <script src="../../script.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>document.addEventListener('DOMContentLoaded', () => hljs.highlightAll());</script>
  </body>
</html>`;
}

if (!fs.existsSync(SRC)) fs.mkdirSync(SRC, { recursive: true });

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.md'));

const posts = files.map(file => {
  const raw = fs.readFileSync(path.join(SRC, file), 'utf-8');
  const { data, content } = matter(raw);
  const slug = data.slug || path.basename(file, '.md');
  const rawTags = data.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags
    : rawTags ? String(rawTags).split(',').map(t => t.trim()) : [];
  return {
    slug,
    title: data.title || slug,
    date: data.date ? toISODate(data.date) : new Date().toISOString().slice(0, 10),
    tags,
    excerpt: data.excerpt || '',
    readingTime: readingTime(content),
    terms: data.terms || null,
    _content: content,
  };
}).sort((a, b) => b.date.localeCompare(a.date));

posts.forEach((post, i) => {
  const dir = path.join(OUT, post.slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const prev = posts[i + 1] || null;
  const next = posts[i - 1] || null;

  const html = buildPostHtml({
    ...post,
    content: marked(applyTerms(post._content, post.terms, post.slug)),
    prev,
    next,
  });

  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
  console.log(`  built posts/${post.slug}/index.html`);
});

const manifest = posts.map(({ _content, terms, ...p }) => p);
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
fs.writeFileSync(path.join(OUT, 'manifest.js'), `window.__blogPosts__ = ${JSON.stringify(manifest)};`, 'utf-8');
console.log(`  wrote posts/manifest.json + manifest.js (${manifest.length} post${manifest.length !== 1 ? 's' : ''})`);
