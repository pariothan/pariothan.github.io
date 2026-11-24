# prosodic.net

Plain HTML, CSS and JavaScript, served by GitHub Pages straight from this repo.

- `index.html` is the whole main site. ME / PROJECTS / CV / BLOG are four sections of that one file, and `script.js` shows one at a time.
- `style.css` is the look of everything. `print.css` makes printing the page give you just the CV.
- `tree.js` is the prosodic tree that grows in the sidebar.
- `projects/` holds the projects, each one its own separate little site.
- `posts/src/` holds blog posts as markdown.

## Writing a blog post

1. Add `posts/src/my-post.md`, copying the block at the top of an existing post (title, date, tags, excerpt, terms).
2. Wrapping a word in `{{double braces}}` gives it a hover definition, taken from `terms` at the top of the file.
3. Run `npm install` (first time only) and then `npm run build`. That writes `posts/my-post/index.html` and updates the list on the BLOG page.
4. Add the new post to `sitemap.xml`.

`npm start` serves the site at http://localhost:8080 for a look before pushing.

## Things that are easy to forget

- The blog post pages get their sidebar from the template inside `build.js`, not from `index.html`. Change one, change the other, then rebuild.
- After changing `style.css`, `print.css`, `script.js` or `tree.js`, bump the `?v=` numbers in `index.html` and `ASSET_VERSION` in `build.js` (and rebuild), or returning visitors keep the old cached files.
- `.nojekyll` has to stay, otherwise GitHub Pages turns the markdown files into extra broken copies of the posts.
