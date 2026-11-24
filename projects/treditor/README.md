# Treditor — syntax & semantics workbench

A drag-and-drop editor for syntactic trees, typed λ-calculus semantics, transformations and derivations. Every part of a theory is plain, editable text, so it works for Heim & Kratzer semantics, X-bar theory, Minimalism, 1957-style transformational grammar, logic, arithmetic, or a theory you write yourself.

## Run / host

It's a static site with no build step and no dependencies.

```sh
python3 -m http.server 8000      # then open http://localhost:8000
```

To host it, upload the folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3). You can also open `index.html` directly from disk.

## What it does

Treditor's main job is to get a tree you already have in mind onto the screen faster than typing out the brackets. Everything else is optional.

- **Typing top-down:** type a label, press `Tab` to add a daughter, `Shift+Tab` to go back up and add a sister, and `Enter` to finish.
- **Templates:** after typing a label such as `VP`, press `↓` and pick a structure (an X-bar phrase, head + complement, coordination, a triangle…). The skeleton appears, and `Tab` jumps from one empty slot to the next. Skipped slots disappear, and a slot can be expanded with another template. Templates are part of the theory: one line each (`Name: $XP => [$XP _ [$X' [$X _] _]]`), so you can write your own for structures you draw often.
- **Direct editing:** clicking a node opens a toolbar (add a daughter, sister or mother, triangle, arrow, delete). Right-click (or long-press on touch) opens a menu with every action. Drag a node onto another node's middle to make it a daughter, onto a side to make it a sister, or onto the top edge to adjoin it.
- **Syntax notation:** subscripts and superscripts (`DP_i`, `X^max`), primes or bars (X′ / X̄), features, triangles, unpronounced or struck-out copies, dashed branches, colours, boxes and circles, notes or glosses under labels, coindexing, and labelled arrows. Traces such as `t_i` link to their antecedent automatically.
- **Drag to rearrange / Drag to transform:** rearranging just moves nodes. Transforming is syntactic movement, and leaves behind a trace, an unpronounced copy, nothing, or a custom placeholder. You can configure the trace and placeholder labels and the index style (1, 2, 3 by default / i, j, k / none). Chains are numbered in cyclic order: the movement that happens lowest in the tree, and so earliest in a bottom-up derivation, gets 1, whatever order you dragged in. A phrase that moves successive-cyclically keeps one index. You can turn this off in Options, or renumber on demand with `Ctrl+K` → “Renumber movement chains”. Hold Shift while dragging to use the other mode.
- **Arrows:** each arrow is routed in its own lane so nested movements don't overlap. You can reshape any arrow by dragging its handles (depth and both ends) or nudging it with the keyboard. Arrows can be squared or curved.
- **Bracket notation:** the bracket bar stays in sync with the tree in both directions and pairs brackets automatically.
- **Bottom-up:** type the words of a sentence, select some of them with a box and type a label to group them.
- **Output:** PNG, SVG, LaTeX (`forest` with arrows and styles, or `qtree`), bracket text, and share links.

- **Drop targets:** drop on a node's middle to make a daughter, on either side to make a sister, or on its top edge to adjoin. Dropping in the gap between two daughters inserts a daughter there, and dropping on a branch line creates an intervening node (for adjuncts) and opens its label for naming.
- **Manual positioning:** ⌘/Ctrl+drag or Ctrl+Alt+arrows nudges a node. It resists small movements, keeps its whole subtree clear of its sisters, and snaps back if its mother or sisters change.

### Editor conveniences

- **Status bar:** a clickable path from the root to the selected node, plus node and issue counts. Click the issue count to step through the problems.
- **Zoom:** the percentage is shown; click it to return to 100%.
- **Menus:** File (New, Open, Save, Share) and Display (arrows, alignment, spacing, branch and bar style, and semantic and AVM layers) keep the toolbars on one line.
- **Node toolbar:** drawn icons for daughter left/right, sister left/right, mother, rename, triangle, arrow, more and delete.
- **Template suggestions:** shown as mini trees, both in the suggestion popup and in the theory editor.

### Restructuring & import

- **Ctrl+↓** inserts a layer below a node; the new node takes all its daughters.
- **Ctrl+Shift+↑** inserts a projection above a node, with a head: type `VP`, Tab (V is pre-filled), Tab, then the word. For example, *have*'s VP goes in as one command.
- **Find & replace (Ctrl+F)** works over labels and/or words, with case, whole-label and regex options (`$1` in the replacement). Matches are highlighted; you can step through them, select them all, replace one, or replace all.
- **Relabel many:** right-click → "Select all with this label", then **F2** relabels every selected node at once.
- **The bracket bar follows the selection:** the selected node's brackets are highlighted, and clicking inside the brackets selects that node.
- **LaTeX import:** paste `forest`, `qtree` or `tikz-qtree` code onto the canvas or into the bracket bar, or use File → Import LaTeX…. It brings over subscripts, bars, triangles, `\sout`, edge labels and `name=` + `\draw` arrows.

### Theory & model editors

The header switch **Tree | Theory | Model** (Ctrl+1/2/3) turns the centre pane into a direct-manipulation editor for the theory itself:

- **Rows editors** with live checks:
  - Enter adds a row, ↑↓ moves between rows, Alt+↑↓ reorders, ⌘D duplicates, Backspace on an empty row deletes it, and rows can be dragged.
  - `Ctrl+K` lists everything you can do in the current section or model; problems in the theory are links that jump to the faulty row.
- **Type hierarchy:**
  - drag a type onto another to re-parent it (Shift adds an extra supertype);
  - renaming a type updates every reference;
  - constraints are edited as AVMs, next to the fully inherited result.
- **HPSG lexicon:** a searchable table with inline AVM editing.
- **Lexical rules:** INPUT ⇒ OUTPUT cards.
- **Models:**
  - several models side by side;
  - grid cells you can move through with the arrow keys and toggle with Enter;
  - paste facts as `pred: a, b` / `rel(a, b)` / a 0-1 table;
  - a table comparing each sentence and formula across models.

Theory changes have their own undo: Ctrl+Z in the Theory or Model view, or the header undo button. The plain-text forms on the Theory tab stay in sync.

### Opt-in features (Features menu)

- **Semantics:** typed λ-terms, composition rules, β-reduction step by step, evaluation in a model. Models are built in a visual editor with domain chips, predicate grids and relation matrices, and it can add anything the lexicon uses that the model is missing. Mereology for plurals and mass terms: sums `a⊕b`, part-of `⊑`, `σ`, `atom`, `star`, and cumulative predicates.
- **Default AVMs for labels (HPSG):** a Label → feature-structure table, with textbook defaults for S, VP, NP and so on. A label's default is applied only when you ask: from the node, the right-click menu, `Ctrl+K`, or "Defaults → empty nodes". `NP_i` also gets `SEM|INDEX i`.
- **HPSG toolkit** (shown only when the theory is an HPSG theory; AVMs alone don't turn it on):
  - A typed feature structure engine: type hierarchy with multiple inheritance, inherited constraints, unification, structure sharing across the whole tree, lists with `⊕`, defaults `/`, optional `( )` list members, and `list(type)`.
  - A TDL-like grammar format (`type := super & [ … ].`), with aliases and abbreviations.
  - A lexicon, and lexical rules: inflectional (lexeme → word), derivational and post-inflectional, with English morphology and irregular forms.
  - Grammar rules written as `rule` types with `ARGS`, plus optional built-in schemata. The principles (Head Feature, Valence, Semantic Inheritance and Compositionality, GAP, PHON) can be switched on or off.
  - Optional principles from Sag, Wasow & Bender ch. 9: the Case Constraint, the Binding Theory (Principles A and B), the Anaphoric Agreement Principle, coordination that shares only FORM and VAL, no Head-Only rule (a lone head is a Head-Complement phrase that takes all its complements), and total well-typedness (every structure must resolve to a leaf type).
  - An initial symbol: `@root [ … ]` states what the root of a complete tree must satisfy.
  - Type warnings: undeclared types, features used where they don't belong (with the path they probably meant), and features added at the wrong level.
- **Preset: HPSG — Sag, Wasow & Bender ch. 9 grammar.** The grammar summarized in §9.2 of *Syntactic Theory* (2nd ed.): the type hierarchy and constraints, abbreviations, grammar rules (with the Imperative Rule), the ten lexical rules and the basic lexicon. Its examples include the ungrammatical ones each principle rules out.
  - **Build tree** lexicalizes the words, trying their ambiguous analyses, then builds every phrase and reports the node and feature path where it fails.
  - AVMs can be viewed **as written**, **textbook** (expanded, then trimmed to the informative parts) or **fully specified**. Click a feature to fold it, or set features to always fold or hide.
  - A type-hierarchy browser shows each type's own and inherited constraints.
- **Feature structures (AVMs):** typed AVMs on nodes, with structure-sharing tags (each in its own colour), lists, sets and paths, plus branch labels (H, C, S…). Edit them visually or in a compact text syntax. A type signature suggests each type's features. There is an HPSG preset, and LaTeX export uses `langsci-avm`.
- **Grammar & lexicon:** check trees against phrase-structure rules and parse sentences.
- **Transformations:** tree-rewriting rules, applied one at a time or until no rule matches.
- **Derivation timeline:** record the steps of a derivation and play them back as an animation.

## Files

- `js/logic.js`: types, λ-terms, inference, reduction, models
- `js/tree.js`: bracket notation, grammar, parser, rewriting, LaTeX
- `js/semantics.js`: theory compiler and composition engine
- `js/theories.js`: built-in theories and lessons
- `js/app.js`: UI
