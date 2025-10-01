# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a personal portfolio website hosted on GitHub Pages at prosodic.net. It's a single-page application with a custom LCARS-inspired aesthetic, featuring multiple projects including interactive physics simulations and linguistic puzzles.

## Development Commands

### Local Development
```bash
node server.js
```
Starts a local development server on port 5000. The custom server (server.js) handles:
- Static file serving with proper MIME types
- CORS headers for development
- Directory index.html resolution
- Cache-control headers for hot reloading

Access at: http://localhost:5000/

### Dependencies
```bash
npm install
```
Installs two dependencies:
- `http-server` (not actively used - custom server.js is preferred)
- `words` (used by letter-tree-puzzles)

## Architecture

### Main Site Structure

The site is a **single-page application** with client-side routing:

- **index.html**: Contains all HTML, CSS (inline `<style>` tag), and JavaScript (inline `<script>` tag) for the main site
- **Layout**: CSS Grid-based LCARS-inspired design with three columns:
  1. Main content area (`.content-frame`)
  2. Sidebar navigation (`.button-frame`)
  3. Vertical name display (`.name-column`)
- **Content Switching**: JavaScript-based view rendering system in index.html:271-436
  - Content templates stored in `VIEWS` object
  - Navigation via `data-view` attributes on `.navbtn` buttons
  - Supports deep-linking via URL hash (#me, #resume, #projects)
- **Design System**: LCARS-inspired color palette with clipped corners using CSS `clip-path`
  - Custom fonts: Quantico (body), JetBrains Mono/Fira Code (monospace UI elements)
  - Accent colors: green (#7cb342), blue (#4285f4), purple (#9c27b0), yellow (#ff9800), red (#f44336)

### Projects

Each project is a self-contained subdirectory in `/projects/`:

#### 1. gravity-sim (Current Version)
Built with a modern JavaScript framework (appears to be Vite/React based on build output). Features:
- Real-time n-body Newtonian physics simulation
- Interactive 3D canvas controls
- Custom wheel event handling to prevent page scroll during zoom
- Pre-built assets in `/assets/` directory

#### 2. letter-tree-puzzles
Interactive binary tree word puzzle inspired by linguistic syntax trees. Architecture:
- **index.html**: Main structure
- **script.js**: Core game logic including:
  - Dictionary loading from `words_dictionary.json` (loaded into window.dictionary)
  - Binary tree node management with dynamic child creation
  - Word validation against dictionary
  - Visual feedback system (node growth/shrinking, collision detection)
  - SVG line rendering for tree connections
- **style.css**: Node styling, animations, and tree layout
- **Key mechanics**: Players build words by creating binary tree structures where each node contains a letter

#### 3. gravity-sim-legacy
Earlier version of gravity simulation, kept for historical reference. Marked as deprecated in the UI.

### File Organization

```
/
├── index.html          # Main SPA (all-in-one: HTML/CSS/JS)
├── script.js           # Legacy navigation (not used by current index.html)
├── style.css           # Legacy styles (not used by current index.html)
├── server.js           # Custom development server
├── package.json        # Dependencies
├── CNAME               # GitHub Pages custom domain (prosodic.net)
├── /assets/images/     # Site images (headshot, screenshots)
├── /projects/
│   ├── /gravity-sim/           # Modern Vite-built physics sim
│   ├── /gravity-sim-legacy/    # Original version
│   └── /letter-tree-puzzles/   # Linguistic word puzzle game
└── /node_modules/
```

## Key Technical Details

### Content Management
All main site content is **hardcoded in index.html** within the `VIEWS` object (line 288). To update:
1. Locate the relevant view key (`me`, `projects`, `resume`)
2. Edit the template literal string
3. Changes take effect immediately on page reload

### Styling Conventions
- LCARS aesthetic: Use `clip-path` for chamfered corners
- Color variables defined in `:root` (lines 18-30 of index.html)
- Responsive breakpoint: 880px (switches to stacked layout)

### Project Integration
Projects are referenced in the `projects` view via relative links:
- `./projects/gravity-sim` → Modern physics sim
- `./projects/letter-tree-puzzles` → Word puzzle game
- `./projects/gravity-sim-legacy` → Deprecated sim (wrapped in `.deprecated` styling)

### GitHub Pages Deployment
- Custom domain configured via CNAME file
- No build step required for main site (all inline)
- gravity-sim project contains pre-built assets
- Standard `git push` to main branch deploys automatically

## Development Workflow

1. Make changes to index.html or project files
2. Test locally: `node server.js`
3. Commit and push to main branch for deployment
4. Changes appear at prosodic.net after GitHub Pages rebuild