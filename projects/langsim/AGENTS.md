# Repository Guidelines

## Project Structure & Module Organization
- `js/` contains ES6 modules that drive the simulator; keep rendering logic in `visualization.js` and core evolution mechanics in `simulation.js`.
- `app.js` coordinates UI state, while assets live under `attached_assets/`; update `styles.css` alongside any new UI components.
- `index.html` hosts the full application, and `test.html` stays minimal for regression probes—extend it for new diagnostics.

## Build, Test, and Development Commands
- `python3 -m http.server 8000` from the repo root serves the site locally; open `http://localhost:8000/index.html` for the main experience.
- `open test.html` (macOS) or `xdg-open test.html` (Linux) runs the smoke-test harness; verify it still passes after visual or simulation changes.
- `npx prettier --check js/*.js` confirms formatting before review; use `--write` to auto-fix.

## Coding Style & Naming Conventions
- Use 2 spaces for HTML/CSS and 4 spaces for JavaScript to match existing files. Keep classes `PascalCase`, helper functions `camelCase`, and exported constants `UPPER_SNAKE_CASE`.
- Favor small, pure functions for simulation rules and document non-obvious parameters with short comments. Avoid DOM access inside core model modules to keep them reusable.

## Testing Guidelines
- Add focused fixtures in `attached_assets/` and extend `test.html` with toggleable scenarios when introducing new map modes or stats overlays.
- Use browser devtools for console assertions; capture GIFs of new behaviors and stash them in PR descriptions rather than the repo.

## Commit & Pull Request Guidelines
- Follow the repo’s history of concise, imperative commit subjects (e.g., “Refine prestige decay logic”). Add a short body when behavior changes need context.
- Pull requests should flag affected map modes, list config defaults touched, and attach before/after visuals or metrics so reviewers can compare outcomes.

## Configuration Tips
- Centralize new knobs in `js/config.js` and surface them in the settings modal. Document defaults in `README.md` whenever you add or rename parameters.
- Keep large experimental data out of git; store temporary exports under `attached_assets/` and clean them up before merging.
