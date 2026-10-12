// Static site build. index.html is hand-edited and is the source of truth for
// the page shell: the <head> assets and the sidebar between its `shell:*`
// markers are copied into every post. The build then
//   - renders posts/src/*.md to posts/<slug>/index.html,
//   - writes the blog cards into index.html between its `build:*` markers,
//   - stamps ?v=<content hash> on local CSS/JS references (cache busting),
//   - writes sitemap.xml.
// All outputs are committed; GitHub Pages serves the repo as-is.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'posts', 'src');
const OUT = path.join(ROOT, 'posts');
const SITE_URL = 'https://' + fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf-8').trim();
const AUTHOR = 'Samuel Lederer';
const HLJS = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0';

// ---------- helpers ----------

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

// Replace the content between <!-- {name} --> and <!-- /{name} --> markers.
function between(html, name) {
  const m = html.match(new RegExp(`<!-- ${name} -->([\\s\\S]*?)<!-- /${name} -->`));
  if (!m) throw new Error(`index.html is missing the <!-- ${name} --> markers`);
  return m[1];
}

function replaceBetween(html, name, content) {
  between(html, name); // throws if the markers are missing
  return html.replace(
    new RegExp(`(<!-- ${name} -->)[\\s\\S]*?(<!-- /${name} -->)`),
    (_, open, close) => `${open}${content}${close}`,
  );
}

// ---------- cache busting ----------

const VERSIONED = ['style.css', 'print.css', ...fs.readdirSync(path.join(ROOT, 'js')).map(f => `js/${f}`)];
const versions = Object.fromEntries(VERSIONED.map(f => [
  f, crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8),
]));

function stampVersions(html) {
  return html.replace(
    /((?:href|src)="(?:\.\/|(?:\.\.\/)+)?)(style\.css|print\.css|js\/[\w-]+\.js)(?:\?v=\w+)?"/g,
    (_, prefix, file) => `${prefix}${file}${versions[file] ? `?v=${versions[file]}` : ''}"`,
  );
}

// ---------- shared shell ----------

// Rewrite the home page's relative URLs so the fragment works from `prefix`
// (e.g. "../../" for posts/<slug>/).
function rebase(html, prefix) {
  return html
    .replace(/ aria-current="page"/g, '')
    .replace(/href="#me"/g, `href="${prefix}"`)
    .replace(/(href|src)="#/g, `$1="${prefix}#`)
    .replace(/(href|src)="(?!https?:|mailto:|data:|\/|#|\.\.\/)(?:\.\/)?/g, `$1="${prefix}`);
}

// ---------- glossary terms ----------

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

// ---------- posts ----------

// First image in the rendered post, as an absolute URL (for social cards).
function firstImageUrl(html, pageUrl) {
  const m = html.match(/<img[^>]+src="([^"]+)"/);
  return m ? new URL(m[1], pageUrl).href : `${SITE_URL}/assets/images/headshot.png`;
}

function postMeta({ slug, title, date, excerpt, content }) {
  const url = `${SITE_URL}/posts/${slug}/`;
  const image = firstImageUrl(content, url);
  const desc = escapeHtml(excerpt);
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: excerpt,
    datePublished: date,
    image,
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Person', name: AUTHOR, url: SITE_URL + '/' },
  }).replace(/</g, '\\u003c');
  return `<meta name="description" content="${desc}" />
    <meta name="author" content="${AUTHOR}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${image}" />
    <meta property="article:published_time" content="${date}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${image}" />
    <script type="application/ld+json">${jsonLd}</script>`;
}

function buildPostHtml(post, shell) {
  const { title, date, tags, readingTime, content, prev, next } = post;
  const tagsHtml = tags.map(t => `<span class="tech-badge">${escapeHtml(t)}</span>`).join('');
  const hasCode = content.includes('<pre><code');
  const hasTerms = content.includes('class="term"');

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
    <title>${escapeHtml(title)} — ${AUTHOR}</title>
    ${postMeta(post)}
    ${shell.head.trim()}${hasCode ? `
    <link rel="stylesheet" href="${HLJS}/styles/atom-one-dark.min.css" />` : ''}
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
      ${shell.sidebar.trim()}
    </div>
    <script src="../../js/site.js"></script>
    <script src="../../js/tree.js"></script>${hasTerms ? `
    <script src="../../js/glossary.js"></script>` : ''}${hasCode ? `
    <script src="${HLJS}/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>` : ''}
  </body>
</html>
`;
}

function loadPosts() {
  if (!fs.existsSync(SRC)) return [];
  return fs.readdirSync(SRC).filter(f => f.endsWith('.md')).map(file => {
    const { data, content } = matter(fs.readFileSync(path.join(SRC, file), 'utf-8'));
    const slug = data.slug || path.basename(file, '.md');
    const tags = Array.isArray(data.tags)
      ? data.tags
      : data.tags ? String(data.tags).split(',').map(t => t.trim()) : [];
    return {
      slug,
      title: data.title || slug,
      date: data.date ? toISODate(data.date) : new Date().toISOString().slice(0, 10),
      tags,
      excerpt: data.excerpt || '',
      readingTime: readingTime(content),
      content: marked(applyTerms(content, data.terms, slug)),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- blog index (inside index.html) ----------

function blogCardHtml(post) {
  const tagsHtml = post.tags.map(t => `<span class="tech-badge">${escapeHtml(t)}</span>`).join('');
  return `
            <a class="story-card blog-post-card" href="./posts/${post.slug}/" data-tags="${escapeHtml(JSON.stringify(post.tags))}">
              <div class="post-card-meta">
                <time class="post-date" datetime="${post.date}">${formatDate(post.date)}</time>
                <span class="post-reading-time">${post.readingTime}&nbsp;min&nbsp;read</span>
              </div>
              <h3>${escapeHtml(post.title)}</h3>
              ${tagsHtml ? `<div class="tech-stack">${tagsHtml}</div>` : ''}
              ${post.excerpt ? `<p class="post-excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
            </a>`;
}

function blogFiltersHtml(posts) {
  const allTags = [...new Set(posts.flatMap(p => p.tags))].sort();
  if (allTags.length <= 1) return '';
  const btn = (label, tag, active) =>
    `<button type="button" class="blog-tag-btn${active ? ' active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(label)}</button>`;
  return [btn('ALL', '', true), ...allTags.map(t => btn(t, t, false))].join('');
}

// ---------- run ----------

const posts = loadPosts();

let indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
indexHtml = replaceBetween(indexHtml, 'build:blog-filters', blogFiltersHtml(posts));
indexHtml = replaceBetween(indexHtml, 'build:blog-posts', posts.length
  ? posts.map(blogCardHtml).join('') + '\n            '
  : '<p class="blog-status">No posts yet — check back soon.</p>');
indexHtml = stampVersions(indexHtml);
fs.writeFileSync(path.join(ROOT, 'index.html'), indexHtml, 'utf-8');
console.log(`  updated index.html (${posts.length} blog card${posts.length !== 1 ? 's' : ''})`);

const shell = {
  head: between(indexHtml, 'shell:head'),
  sidebar: between(indexHtml, 'shell:sidebar'),
};

posts.forEach((post, i) => {
  const dir = path.join(OUT, post.slug);
  fs.mkdirSync(dir, { recursive: true });
  const postShell = { head: rebase(shell.head, '../../'), sidebar: rebase(shell.sidebar, '../../') };
  const html = buildPostHtml({ ...post, prev: posts[i + 1] || null, next: posts[i - 1] || null }, postShell);
  fs.writeFileSync(path.join(dir, 'index.html'), stampVersions(html), 'utf-8');
  console.log(`  built posts/${post.slug}/index.html`);
});

// Sitemap: the home page, every project linked from it, and every post.
// Fragment URLs (#cv etc.) are omitted; search engines ignore them.
const projectPaths = [...indexHtml.matchAll(/href="\.\/(projects\/[^"#?]+?)\/?"/g)].map(m => m[1] + '/');
const EXTRA_PATHS = ['projects/letter-tree-puzzles/']; // live but not linked from the home page
const sitemapEntries = [
  { loc: `${SITE_URL}/` },
  ...[...new Set([...projectPaths, ...EXTRA_PATHS])].sort().map(p => ({ loc: `${SITE_URL}/${p}` })),
  ...posts.map(p => ({ loc: `${SITE_URL}/posts/${p.slug}/`, lastmod: p.date })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(e => `  <url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf-8');
console.log(`  wrote sitemap.xml (${sitemapEntries.length} URLs)`);
