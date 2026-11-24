/* Treditor — tree model: bracket notation, grammar checking, chart parsing,
   tree-rewriting transformations, LaTeX export.  No DOM dependencies. */
'use strict';
const Tree = (() => {
  let idc = 0;
  const newId = () => 'n' + (++idc).toString(36);
  function bumpIds(doc) {
    walkDoc(doc, n => {
      const m = /^n([0-9a-z]+)$/.exec(n.id || '');
      if (m) idc = Math.max(idc, parseInt(m[1], 36));
    });
  }
  const mk = (label, ch = [], extra = {}) => ({ id: newId(), label, ch, ...extra });

  function walk(n, f, parent = null, depth = 0) { f(n, parent, depth); n.ch.forEach(c => walk(c, f, n, depth + 1)); }
  function walkDoc(doc, f) { doc.roots.forEach(r => walk(r, f)); }
  function find(doc, id) {
    let hit = null;
    walkDoc(doc, (n, p) => { if (n.id === id) hit = { node: n, parent: p }; });
    return hit;
  }
  function rootOf(doc, id) { return doc.roots.find(r => { let f = false; walk(r, n => { if (n.id === id) f = true; }); return f; }); }
  function contains(a, id) { let f = false; walk(a, n => { if (n.id === id) f = true; }); return f; }
  function clone(n, keepIds = true) {
    const c = { ...n, id: keepIds ? n.id : newId(), ch: n.ch.map(x => clone(x, keepIds)) };
    return c;
  }
  function cloneDoc(doc) { return JSON.parse(JSON.stringify(doc)); }
  function yieldOf(n) { if (!n.ch.length) return n.silent ? [] : [n.label]; return n.ch.flatMap(yieldOf); }
  function leaves(n) { if (!n.ch.length) return [n]; return n.ch.flatMap(leaves); }
  function detach(doc, id) {
    const h = find(doc, id); if (!h) return null;
    if (h.parent) h.parent.ch.splice(h.parent.ch.indexOf(h.node), 1);
    else doc.roots.splice(doc.roots.indexOf(h.node), 1);
    return h;
  }
  function replaceNode(doc, oldId, nn) {
    const h = find(doc, oldId); if (!h) return;
    const arr = h.parent ? h.parent.ch : doc.roots;
    arr[arr.indexOf(h.node)] = nn;
  }
  function maxIndex(doc) {
    let m = 0;
    walkDoc(doc, n => {
      const re = /_(\d+)|^(\d+)$/g; let x;
      while ((x = re.exec(n.label))) m = Math.max(m, +(x[1] || x[2]));
    });
    return m;
  }

  /* ───────────── Bracket notation ─────────────
     [S [NP John] [VP [V loves] [NP Mary]]]
     [.S …]          qtree-style dot is accepted
     [NP^ the dog]   ^ after the label = roof/triangle
     [NP{+wh} …]     braces glued to the label = features
     {the old man}   braces after a space = one multi-word leaf (also "quoted")
     <DP> or ⟨DP⟩    angle brackets = silent / unpronounced copy            */
  function tokenize(s) {
    const toks = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '[' || c === ']') { toks.push({ t: c, pos: i }); i++; continue; }
      if (c === '{' || c === '"') {
        const close = c === '{' ? '}' : '"';
        const j = s.indexOf(close, i + 1);
        if (j < 0) throw new Error(`Unclosed ${c} at ${i}`);
        toks.push({ t: 'w', v: s.slice(i + 1, j), quoted: true, pos: i, end: j + 1 }); i = j + 1; continue;
      }
      let j = i, depth = 0;
      while (j < s.length) {
        const ch = s[j];
        if (ch === '{' && j > i) { depth++; j++; continue; }
        if (ch === '}' && depth) { depth--; j++; continue; }
        if (depth) { j++; continue; }
        if (/\s/.test(ch) || ch === '[' || ch === ']') break;
        j++;
      }
      toks.push({ t: 'w', v: s.slice(i, j), pos: i, end: j }); i = j;
    }
    return toks;
  }
  function decodeLabel(raw, quoted) {
    const out = {};
    let l = raw;
    if (!quoted) {
      const fm = /^(.+?)\{(.*)\}(\^?)$/.exec(l);
      if (fm) { l = fm[1] + fm[3]; out.f = fm[2]; }
      if (l.length > 1 && l.endsWith('^')) { l = l.slice(0, -1); out.roof = true; }
      const sm = /^[<⟨](.+)[>⟩]$/.exec(l);
      if (sm) { l = sm[1]; out.silent = true; }
    }
    out.label = l;
    return out;
  }
  function parseBracket(src, ranges = null) {
    const toks = tokenize(String(src)); let p = 0;
    const leaf = w => { const d = decodeLabel(w.v, w.quoted); const n = mk(d.label, [], extraOf(d)); if (ranges) ranges.set(n, [w.pos, w.end]); return n; };
    function node() {
      const open = toks[p++]; // '['
      let lab = { label: '' };
      if (toks[p] && toks[p].t === 'w') {
        const w = toks[p++];
        lab = decodeLabel(w.v.startsWith('.') && w.v.length > 1 && !w.quoted ? w.v.slice(1) : w.v, w.quoted);
      }
      const n = mk(lab.label, [], extraOf(lab));
      while (p < toks.length && toks[p].t !== ']') {
        if (toks[p].t === '[') n.ch.push(node());
        else n.ch.push(leaf(toks[p++]));
      }
      if (p >= toks.length) throw new Error(`Missing ']' for '[' at ${open.pos}`);
      if (ranges) ranges.set(n, [open.pos, toks[p].pos + 1]);
      p++;
      return n;
    }
    const roots = [];
    while (p < toks.length) {
      if (toks[p].t === '[') roots.push(node());
      else if (toks[p].t === ']') throw new Error(`Unmatched ']' at ${toks[p].pos}`);
      else roots.push(leaf(toks[p++]));
    }
    return { roots };
  }
  function extraOf(d) { const e = {}; if (d.f) e.f = d.f; if (d.roof) e.roof = true; if (d.silent) e.silent = true; return e; }
  function encLabel(n, isLeaf) {
    let l = n.label;
    const needs = l === '' || /[\s[\]{}"]/.test(l);
    if (needs && !n.f) l = isLeaf ? `{${l}}` : `"${l}"`;
    if (n.silent) l = `<${l}>`;
    if (n.f) l += `{${n.f}}`;
    if (n.roof) l += '^';
    return l;
  }
  function toBracket(doc, pretty = false) {
    function go(n, ind) {
      if (!n.ch.length) return encLabel(n, true);
      const kids = n.ch.map(c => go(c, ind + '  '));
      const flat = `[${encLabel(n)} ${kids.join(' ')}]`;
      if (!pretty || flat.length < 60) return flat;
      return `[${encLabel(n)}\n${kids.map(k => ind + '  ' + k).join('\n')}\n${ind}]`;
    }
    return doc.roots.map(r => go(r, '')).join(pretty ? '\n' : '  ');
  }

  function toBracketMap(doc) {
    const spans = new Map(); let out = '';
    function go(n) {
      const start = out.length;
      if (!n.ch.length) out += encLabel(n, true);
      else { out += `[${encLabel(n)} `; n.ch.forEach((c, i) => { if (i) out += ' '; go(c); }); out += ']'; }
      spans.set(n.id, [start, out.length]);
    }
    doc.roots.forEach((r, i) => { if (i) out += '  '; go(r); });
    return { text: out, spans };
  }

  /* ───────────── LaTeX import: forest, qtree, tikz-qtree ───────────── */
  const TEX_SYM = { emptyset: '∅', varnothing: '∅', lambda: 'λ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', phi: 'φ', varphi: 'φ', theta: 'θ', pi: 'π', sigma: 'σ', tau: 'τ', mu: 'μ', nu: 'ν', rho: 'ρ', iota: 'ι', forall: '∀', exists: '∃', neg: '¬', wedge: '∧', vee: '∨', rightarrow: '→', to: '→', leftrightarrow: '↔', prime: "'", langle: '⟨', rangle: '⟩', ldots: '…', dots: '…', textlangle: '⟨', textrangle: '⟩', ast: '*' };
  function stripBraces(x) { x = x.trim(); while (x.startsWith('{') && x.endsWith('}') && balanced(x.slice(1, -1))) x = x.slice(1, -1).trim(); return x; }
  function balanced(x) { let d = 0; for (const c of x) { if (c === '{') d++; if (c === '}' && --d < 0) return false; } return d === 0; }
  // LaTeX label → Treditor label (+ flags)
  function texToLabel(raw) {
    let x = stripBraces(raw);
    const out = {};
    const lines = x.split(/\\\\(?:\[[^\]]*\])?/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) { x = lines[0]; out.note = lines.slice(1).map(l => texToLabel(l).label).join(' '); }
    if (/\\sout\{/.test(x)) { out.silent = true; x = x.replace(/\\sout\{((?:[^{}]|\{[^{}]*\})*)\}/g, '$1'); }
    for (let k = 0; k < 4; k++) x = x.replace(/\\(?:textit|emph|textsc|textbf|textrm|textup|text|mathrm|mathit|mathbf|mbox|textsf|it|textnormal)\{((?:[^{}]|\{[^{}]*\})*)\}/g, '$1');
    x = x.replace(/\\(?:overline|bar)\{([^{}]*)\}/g, "$1'").replace(/\\=\{?([A-Za-z])\}?/g, "$1'");
    x = x.replace(/\\(?:it|bf|sc|rm|em|small|footnotesize|scriptsize)\b\s*/g, '');
    x = x.replace(/\$([^$]*)\$/g, (m, inner) => inner);
    x = x.replace(/_\{([^{}]*)\}/g, '_$1').replace(/\^\{([^{}]*)\}/g, '^$1');
    x = x.replace(/\\([A-Za-z]+)\s*/g, (m, w) => (TEX_SYM[w] !== undefined ? TEX_SYM[w] : ''));
    x = x.replace(/\\[,;:! ]/g, ' ').replace(/~/g, ' ').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
    const ang = /^[<⟨](.+)[>⟩]$/.exec(x); if (ang) { x = ang[1]; out.silent = true; }
    out.label = x;
    return out;
  }
  function parseForest(src) {
    let body = src;
    const be = /\\begin\{forest\}([\s\S]*?)\\end\{forest\}/g; const bodies = []; let m;
    while ((m = be.exec(src))) bodies.push(m[1]);
    if (!bodies.length) bodies.push(body);
    const roots = []; const arrows = [];
    for (const b0 of bodies) {
      const b = b0.replace(/(^|[^\\])%.*$/gm, '$1');
      let i = 0; const names = new Map();
      const skipWs = () => { while (i < b.length && /\s/.test(b[i])) i++; };
      function readContent() { // up to the next top-level '[' or ']'
        let d = 0, math = false, out = '';
        while (i < b.length) {
          const c = b[i];
          if (c === '\\' && i + 1 < b.length) { out += c + b[i + 1]; i += 2; continue; }
          if (c === '$') math = !math;
          if (!math) { if (c === '{') d++; else if (c === '}') d--; else if ((c === '[' || c === ']') && d <= 0) break; }
          out += c; i++;
        }
        return out;
      }
      function splitOpts(c) { let d = 0, math = false; for (let k = 0; k < c.length; k++) { const ch = c[k]; if (ch === '\\') { k++; continue; } if (ch === '$') math = !math; if (math) continue; if (ch === '{') d++; else if (ch === '}') d--; else if (ch === ',' && d === 0) return [c.slice(0, k), c.slice(k + 1)]; } return [c, '']; }
      function node() {
        i++; // '['
        const [lab, opts] = splitOpts(readContent());
        const d = texToLabel(lab);
        const n = mk(d.label, [], {});
        if (d.silent) n.silent = true; if (d.note) n.note = d.note;
        if (/(^|,)\s*roof\b/.test(opts) || /triangle/.test(opts)) n.roof = true;
        const nm = /name\s*=\s*\{?([\w-]+)\}?/.exec(opts); if (nm) names.set(nm[1], n.id);
        if (/edge\s*=\s*\{?[^,}]*dashed/.test(opts)) n.dash = true;
        const el = /edge label\s*=\s*\{?node[^{]*\{([^}]*)\}/.exec(opts); if (el) n.elabel = texToLabel(el[1]).label;
        for (;;) {
          skipWs();
          if (i >= b.length) throw new Error('forest: missing ]');
          if (b[i] === ']') { i++; break; }
          if (b[i] === '[') { n.ch.push(node()); continue; }
          readContent(); // stray text between daughters
        }
        return n;
      }
      for (;;) {
        skipWs(); if (i >= b.length) break;
        if (b[i] === '[') { roots.push(node()); continue; }
        const rest = b.slice(i);
        const dm = /^\\draw\s*(\[[^\]]*\])?\s*\(([\w-]+)\)[\s\S]*?\(([\w-]+)\)\s*;/.exec(rest);
        if (dm) { const from = names.get(dm[2]), to = names.get(dm[3]); if (from && to) arrows.push({ id: newId(), from, to, label: '', side: /north/.test(dm[0]) ? 'above' : 'below', heads: /<->/.test(dm[1] || '') ? 'both' : /->/.test(dm[1] || '') ? 'end' : 'none', dash: /dash/.test(dm[1] || '') }); i += dm[0].length; continue; }
        const nl = b.indexOf('\n', i); i = nl < 0 ? b.length : nl + 1; // skip other commands (for tree=…, etc.)
      }
    }
    // forest leaves are written [word]; one-daughter roofs [NP, roof [the dog]] keep the words
    return { roots, arrows };
  }
  function parseQtree(src) {
    const roots = [];
    const re = /\\Tree\s*/g; let m;
    while ((m = re.exec(src))) {
      let i = m.index + m[0].length;
      const s2 = src;
      const skipWs = () => { while (i < s2.length && /\s/.test(s2[i])) i++; };
      function token() { // {…} | word
        skipWs();
        if (s2[i] === '{') { let d = 0, j = i; for (; j < s2.length; j++) { if (s2[j] === '{') d++; if (s2[j] === '}' && --d === 0) break; } const t = s2.slice(i, j + 1); i = j + 1; return t; }
        if (s2[i] === '$') { const j = s2.indexOf('$', i + 1); const t = s2.slice(i, j + 1); i = j + 1; while (i < s2.length && !/[\s\]]/.test(s2[i])) i++; return s2.slice(i - (i - (j + 1)) - (j + 1 - (j + 1)), i) ? t + '' : t; }
        let j = i; while (j < s2.length && !/[\s\[\]]/.test(s2[j])) { if (s2[j] === '{') { let d = 0; for (; j < s2.length; j++) { if (s2[j] === '{') d++; if (s2[j] === '}' && --d === 0) break; } } j++; }
        const t = s2.slice(i, j); i = j; return t;
      }
      function node() {
        i++; // '['
        skipWs();
        let lab = '';
        if (s2[i] === '.') { i++; lab = token(); }
        const n = mk(texToLabel(lab).label, []);
        let roofNext = false;
        for (;;) {
          skipWs();
          if (i >= s2.length) throw new Error('qtree: missing ]');
          if (s2[i] === ']') { i++; break; }
          if (s2[i] === '[') { n.ch.push(node()); continue; }
          const t = token();
          if (!t) { i++; continue; }
          const qr = /^\\qroof\{([\s\S]*)\}\.(.+)$/.exec(t);
          if (qr) { const r = mk(texToLabel(qr[2]).label, [mk(texToLabel(qr[1]).label)], { roof: true }); n.ch.push(r); continue; }
          if (/^\\edge/.test(t)) { const semi = s2.indexOf(';', i); if (/roof/.test(s2.slice(i, semi < 0 ? i : semi))) roofNext = true; i = semi < 0 ? s2.length : semi + 1; continue; }
          const d = texToLabel(t);
          if (roofNext) { n.roof = true; roofNext = false; }
          n.ch.push(mk(d.label, [], d.silent ? { silent: true } : {}));
        }
        return n;
      }
      skipWs();
      if (s2[i] === '[') roots.push(node());
      else { const t = token(); roots.push(mk(texToLabel(t).label)); }
    }
    return { roots, arrows: [] };
  }
  const looksLikeLatex = t => /\\begin\{forest\}|\\Tree\b|\\qroof|\\Tree\[/.test(t) || (/^\s*\[/.test(t) && /\[[^\[\]]*,\s*(roof|name\s*=|edge|for tree|s sep|l sep)/.test(t)) || /\$_\{|\\textit|\\emph|\\sout|\\overline/.test(t);
  function parseLatex(src) {
    const t = String(src || '');
    const doc = /\\Tree/.test(t) ? parseQtree(t) : parseForest(t);
    if (!doc.roots.length) throw new Error('No tree found in the LaTeX');
    return doc;
  }

  /* ───────────── Grammar (CFG with (X) X? X* X+ and a|b) ───────────── */
  function parseGrammar(src) {
    const rules = []; const errors = [];
    String(src || '').split('\n').forEach((raw, ln) => {
      const line = raw.replace(/(^|\s)(#|\/\/).*$/, '').trim();
      if (!line) return;
      const m = /^(\S+)\s*(->|→|::=)\s*(.*)$/.exec(line);
      if (!m) { errors.push({ line: ln + 1, msg: 'Expected  LHS -> RHS' }); return; }
      for (const alt of m[3].split('|')) {
        const toks = alt.trim().split(/\s+/).filter(Boolean).map(t => {
          let q = '';
          let mm = /^\((.+)\)$/.exec(t);
          if (mm) return { s: mm[1], q: '?' };
          mm = /^(.+?)([?*+])$/.exec(t);
          if (mm && mm[1]) return { s: mm[1], q: mm[2] };
          return { s: t, q };
        });
        rules.push({ lhs: m[1], rhs: toks, line: ln + 1 });
      }
    });
    return { rules, errors, start: rules[0] ? rules[0].lhs : null };
  }
  function matchSeq(pat, labels, wild) {
    function go(i, j) {
      if (i === pat.length) return j === labels.length;
      const { s, q } = pat[i];
      const ok = k => k < labels.length && (labels[k] === s || wild[k]);
      if (q === '') return ok(j) && go(i + 1, j + 1);
      if (q === '?') return (ok(j) && go(i + 1, j + 1)) || go(i + 1, j);
      let k = j;
      if (q === '+') { if (!ok(k)) return false; k++; }
      for (;;) { if (go(i + 1, k)) return true; if (!ok(k)) return false; k++; }
    }
    return go(0, 0);
  }

  // Lexicon parsing shared by grammar checker, parser, palette and semantics
  function parseLexicon(src) {
    const entries = []; const errors = [];
    String(src || '').split('\n').forEach((raw, ln) => {
      const line = raw.replace(/(^|\s)(\/\/).*$/, '').replace(/^\s*#.*$/, '').trim();
      if (!line) return;
      const parts = line.split(':');
      if (parts.length < 2) { errors.push({ line: ln + 1, msg: 'Expected  word : Category [: type [: term]]' }); return; }
      const words = parts[0].split(',').map(w => w.trim()).filter(Boolean);
      const cat = parts[1].trim();
      const type = (parts[2] || '').trim();
      const term = parts.slice(3).join(':').trim();
      for (const w of words) entries.push({ word: w, cat, type, term, line: ln + 1 });
    });
    return { entries, errors };
  }

  function checkGrammar(doc, gram, lex, opts) {
    const issues = new Map();
    if (!gram.rules.length) return issues;
    const strip = l => opts.strip(l);
    const byLhs = new Map();
    gram.rules.forEach(r => { if (!byLhs.has(r.lhs)) byLhs.set(r.lhs, []); byLhs.get(r.lhs).push(r); });
    const lexByWord = new Map();
    lex.entries.forEach(e => { const k = e.word.toLowerCase(); if (!lexByWord.has(k)) lexByWord.set(k, []); lexByWord.get(k).push(e); });
    const isWild = c => !!(c.ante || c.label === '' || opts.isTrace(c.label) || opts.isIndex(c.label));
    walkDoc(doc, n => {
      if (!n.ch.length) return;
      const lab = strip(n.label);
      // preterminal: single leaf child
      if (n.ch.length === 1 && !n.ch[0].ch.length && !isWild(n.ch[0])) {
        const w = n.ch[0].label;
        const es = lexByWord.get(w.toLowerCase());
        if (es && es.length) {
          if (!es.some(e => e.cat === lab) && !(byLhs.get(lab) || []).some(r => matchSeq(r.rhs, [strip(w)], [false])))
            issues.set(n.id, `Lexicon lists “${w}” as ${[...new Set(es.map(e => e.cat))].join('/')}, not ${lab}`);
          return;
        }
      }
      if (n.roof || n.label === '') return;
      const rs = byLhs.get(lab);
      if (!rs) return;
      const labels = n.ch.map(c => strip(c.label));
      const wild = n.ch.map(isWild);
      if (!rs.some(r => matchSeq(r.rhs, labels, wild)))
        issues.set(n.id, `No rule ${lab} → ${labels.join(' ')}`);
    });
    return issues;
  }

  /* ───────────── Chart parser (memoised top-down, all parses) ───────────── */
  function expandRhs(rhs) {
    let outs = [[]];
    for (const { s, q } of rhs) {
      const reps = q === '' ? [1] : q === '?' ? [0, 1] : q === '*' ? [0, 1, 2] : [1, 2, 3];
      const next = [];
      for (const o of outs) for (const r of reps) next.push([...o, ...Array(r).fill(s)]);
      outs = next;
    }
    return outs.filter(o => o.length);
  }
  function parseSentence(sentence, gram, lex, opts = {}) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    const N = words.length;
    if (!N) return [];
    const start = opts.start || gram.start;
    const prods = new Map();
    gram.rules.forEach(r => { if (!prods.has(r.lhs)) prods.set(r.lhs, []); expandRhs(r.rhs).forEach(x => prods.get(r.lhs).push(x)); });
    const lexCats = words.map(w => {
      const es = lex.entries.filter(e => e.word === w);
      const es2 = es.length ? es : lex.entries.filter(e => e.word.toLowerCase() === w.toLowerCase());
      return [...new Set(es2.map(e => e.cat))];
    });
    const unknown = words.filter((w, i) => !lexCats[i].length);
    if (unknown.length) throw new Error(`Not in lexicon: ${unknown.join(', ')}`);
    const CAP = opts.cap || 40;
    const memo = new Map(); const busy = new Set();
    function P(cat, i, j) {
      const key = cat + '|' + i + '|' + j;
      if (memo.has(key)) return memo.get(key);
      if (busy.has(key)) return [];
      busy.add(key);
      const out = [];
      if (j - i === 1 && lexCats[i].includes(cat)) out.push({ label: cat, ch: [{ label: words[i], ch: [] }] });
      for (const rhs of prods.get(cat) || []) {
        if (rhs.length > j - i) continue;
        for (const kids of seq(rhs, 0, i, j)) {
          out.push({ label: cat, ch: kids });
          if (out.length >= CAP) break;
        }
        if (out.length >= CAP) break;
      }
      busy.delete(key);
      memo.set(key, out);
      return out;
    }
    function seq(rhs, k, i, j) {
      if (k === rhs.length - 1) return P(rhs[k], i, j).map(t => [t]);
      const res = [];
      const rem = rhs.length - k - 1;
      for (let m = i + 1; m <= j - rem; m++) {
        const left = P(rhs[k], i, m);
        if (!left.length) continue;
        const right = seq(rhs, k + 1, m, j);
        for (const l of left) for (const r of right) { res.push([l, ...r]); if (res.length >= CAP) return res; }
      }
      return res;
    }
    const finalize = t => mk(t.label, t.ch.map(finalize));
    const starts = start ? [start] : [...prods.keys()];
    const trees = [];
    for (const s of starts) for (const t of P(s, 0, N)) trees.push(t);
    // dedupe structurally
    const seen = new Set(); const uniq = [];
    for (const t of trees) { const k = JSON.stringify(t); if (!seen.has(k)) { seen.add(k); uniq.push(finalize(t)); } }
    return uniq;
  }

  /* ───────────── Tree rewriting (transformations) ─────────────
     Name: LHS => RHS     with
       ?x    any subtree        ?x*  any sequence of sister subtrees
       $X    any label (children matched by sub-pattern)
       _     anything (not bound)      <?x>  silent copy of x in the RHS          */
  function parseRewrite(src) {
    const rules = []; const errors = [];
    String(src || '').split('\n').forEach((raw, ln) => {
      const line = raw.replace(/(^|\s)(\/\/).*$/, '').replace(/^\s*#.*$/, '').trim();
      if (!line) return;
      const m = /^(.*?):\s*(.+?)\s*(=>|⇒|-->)\s*(.+)$/.exec(line);
      if (!m) { errors.push({ line: ln + 1, msg: 'Expected  Name: [pattern] => [result]' }); return; }
      try {
        const lhs = parseBracket(m[2]).roots, rhs = parseBracket(m[4]).roots;
        if (lhs.length !== 1) throw new Error('LHS must be one tree');
        let name = m[1].trim(); const manual = /\{manual\}/.test(name); name = name.replace(/\{manual\}/, '').trim();
        rules.push({ name: name || `Rule ${rules.length + 1}`, manual, lhs: lhs[0], rhs, src: line, line: ln + 1 });
      } catch (e) { errors.push({ line: ln + 1, msg: e.message }); }
    });
    return { rules, errors };
  }
  const isSubVar = l => /^\?[\p{L}\p{N}_']+$/u.test(l);
  const isSeqVar = l => /^\?[\p{L}\p{N}_']+\*$/u.test(l);
  const isLabVar = l => /^\$[\p{L}\p{N}_']+$/u.test(l);
  function labelMatch(pl, nl, strip) { return pl === nl || (!/_/.test(pl) && pl === strip(nl)); }

  function* mNode(p, n, b, strip) {
    if (p.label === '_' && !p.ch.length) { yield b; return; }
    if (isSubVar(p.label) && !p.ch.length) {
      const prev = b.sub[p.label];
      if (prev) { if (sameTree(prev, n)) yield b; return; }
      yield { ...b, sub: { ...b.sub, [p.label]: n } }; return;
    }
    let b2 = b;
    if (isLabVar(p.label)) {
      const prev = b.lab[p.label];
      if (prev !== undefined && prev !== n.label) return;
      b2 = { ...b, lab: { ...b.lab, [p.label]: n.label } };
    } else if (!labelMatch(p.label, n.label, strip)) return;
    if (!!p.silent !== !!n.silent && p.silent) return;
    b2 = { ...b2, nodes: [...b2.nodes, [p, n]] };
    if (!p.ch.length && !isLabVar(p.label)) { if (!n.ch.length) yield b2; return; }
    yield* mSeq(p.ch, 0, n.ch, 0, b2, strip);
  }
  function* mSeq(ps, i, ns, j, b, strip) {
    if (i === ps.length) { if (j === ns.length) yield b; return; }
    const p = ps[i];
    if (isSeqVar(p.label)) {
      for (let k = j; k <= ns.length; k++) {
        yield* mSeq(ps, i + 1, ns, k, { ...b, seq: { ...b.seq, [p.label]: ns.slice(j, k) } }, strip);
      }
      return;
    }
    if (j >= ns.length) return;
    for (const b2 of mNode(p, ns[j], b, strip)) yield* mSeq(ps, i + 1, ns, j + 1, b2, strip);
  }
  function sameTree(a, b) {
    return a.label === b.label && a.ch.length === b.ch.length && a.ch.every((c, i) => sameTree(c, b.ch[i]));
  }
  function matchRule(rule, n, strip) {
    for (const b of mNode(rule.lhs, n, { sub: {}, seq: {}, lab: {}, nodes: [] }, strip)) return b;
    return null;
  }
  function buildRhs(rule, b) {
    const used = new Set();
    const pool = new Map(); // label -> [node ids] of matched literal nodes, for identity reuse (animation)
    for (const [p, n] of b.nodes) if (!isLabVar(p.label)) { if (!pool.has(n.label)) pool.set(n.label, []); pool.get(n.label).push(n); }
    for (const [p, n] of b.nodes) if (isLabVar(p.label)) { if (!pool.has(n.label)) pool.set(n.label, []); pool.get(n.label).push(n); }
    const useOnce = n => { if (used.has(n.id)) return clone(n, false); used.add(n.id); return n; };
    function build(p) {
      const sm = /^[<⟨](\?.+)[>⟩]$/.exec(p.label);
      if (p.silent && isSubVar(p.label) || sm) {
        const v = sm ? sm[1] : p.label;
        const bound = b.sub[v]; if (!bound) throw new Error(`${v} is not bound by the pattern`);
        const c = clone(bound, false); c.silent = true; return [c];
      }
      if (isSubVar(p.label) && !p.ch.length) {
        const bound = b.sub[p.label]; if (!bound) throw new Error(`${p.label} is not bound by the pattern`);
        return [useOnce(bound)];
      }
      if (isSeqVar(p.label)) {
        const bound = b.seq[p.label]; if (!bound) throw new Error(`${p.label} is not bound by the pattern`);
        return bound.map(useOnce);
      }
      let label = p.label;
      label = label.replace(/\$[\p{L}\p{N}_']+/gu, v => (b.lab[v] !== undefined ? b.lab[v] : v));
      const kids = p.ch.flatMap(build);
      const cands = (pool.get(label) || []).filter(n => !used.has(n.id));
      let id;
      if (cands.length) { id = cands[0].id; used.add(id); } else id = newId();
      const n = { id, label, ch: kids };
      if (p.f) n.f = p.f; if (p.roof) n.roof = true; if (p.silent) n.silent = true;
      const src = cands[0];
      if (src && src.f && !p.f) n.f = src.f;
      return [n];
    }
    return rule.rhs.flatMap(build);
  }
  function applyRuleAt(doc, rule, nodeId, strip) {
    const h = find(doc, nodeId); if (!h) return false;
    const b = matchRule(rule, h.node, strip); if (!b) return false;
    const out = buildRhs(rule, b);
    const arr = h.parent ? h.parent.ch : doc.roots;
    const i = arr.indexOf(h.node);
    arr.splice(i, 1, ...out);
    return out[0] ? out[0].id : true;
  }
  function findMatch(doc, rules, strip, onlyNode) {
    let hit = null;
    const visit = n => {
      if (hit) return;
      for (const r of rules) if (matchRule(r, n, strip)) { hit = { rule: r, id: n.id }; return; }
      n.ch.forEach(visit);
    };
    if (onlyNode) visit(onlyNode); else doc.roots.forEach(visit);
    return hit;
  }


  /* ───────────── Templates (theory-defined structures with slots) ─────────────
     Name: trigger => [structure]
       trigger: $XP / $X' (X = the head you typed), a literal label, or * (anything)
       $X = captured head, $0 = the label exactly as typed, _ = a slot to fill        */
  function parseTemplates(src) {
    const list = []; const errors = [];
    String(src || '').split('\n').forEach((raw, ln) => {
      const line = raw.replace(/\s\/\/.*$/, '').replace(/^\s*#.*$/, '').trim();
      if (!line) return;
      const m = /^(.*?):\s*(\S+)\s*=>\s*(.+)$/.exec(line);
      if (!m) { errors.push({ line: ln + 1, msg: 'Expected  Name: trigger => [structure]' }); return; }
      const [, name, trigger, body] = m;
      try {
        const test = parseBracket(body.replace(/\$X/g, 'X').replace(/\$0/g, 'X'));
        if (test.roots.length !== 1) throw new Error('A template must be a single tree');
        let re;
        if (trigger === '*') re = /^(.+)$/u;
        else {
          const parts = trigger.split('$X').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          re = new RegExp('^' + parts.join('(\\S+?)') + '(?:_\\S+)?$', 'u');
        }
        list.push({ name: name.trim(), trigger, body, re, line: ln + 1 });
      } catch (e) { errors.push({ line: ln + 1, msg: e.message }); }
    });
    return { list, errors };
  }
  function labelForTemplate(t, head) {
    if (t.trigger === '*') return '';
    return t.trigger.replace('$X', head || 'X');
  }
  function expandTemplate(t, label, head) {
    if (head === undefined) {
      const m = t.re.exec(label); if (!m) return null;
      head = t.trigger === '*' || !t.trigger.includes('$X') ? '' : (m[1] || '');
    }
    const src = t.body.replace(/\$X/g, head).replace(/\$0/g, label || '');
    const root = parseBracket(src).roots[0];
    if (label) root.label = label;
    const holes = [];
    walk(root, n => { if (n.label === '_' && !n.ch.length) { n.label = ''; holes.push(n.id); } });
    return { node: root, holes };
  }
  function templatePreview(t, label) {
    const e = expandTemplate(t, label || labelForTemplate(t, 'X'));
    if (!e) return '';
    const go = n => (n.ch.length ? `[${n.label || '·'}${n.roof ? '△' : ''} ${n.ch.map(go).join(' ')}]` : (n.label || '·'));
    return go(e.node);
  }

  /* ───────────── LaTeX export ───────────── */
  // X' / X'' / X′ / X̄ → \overline{X} (bars) or X$'$ (primes); keeps any _index / ^sup after the bar
  function texBar(l, bars) {
    if (!bars) return null;
    const m = /^(.*?[^'′̄\s])('{1,2}|′{1,2}|̄{1,2}|-bar)((?:[_^].*)?)$/u.exec(l);
    if (!m) return null;
    const lvl = m[2] === '-bar' ? 1 : [...m[2]].length;
    const tail = m[3] ? texLabel('X' + m[3]).slice(1) : '';
    const base = texLabel(m[1]);
    if (bars === 'prime') return base + '$' + "'".repeat(lvl) + '$' + tail;
    let o = `\\mbox{${base}}`; for (let i = 0; i < lvl; i++) o = `\\overline{${o}}`;
    return `$${o}$` + tail;
  }
  function texLabel(l) {
    let s = l.replace(/[&%#$]/g, c => '\\' + c).replace(/~/g, '\\textasciitilde{}');
    s = s.replace(/_\{?([^}\s]+)\}?$/, (m, x) => `$_{${x}}$`).replace(/\^\{?([^}\s]+)\}?$/, (m, x) => `$^{${x}}$`);
    s = s.replace(/'/g, "$'$").replace(/\$\$/g, '');
    const map = { 'λ': '$\\lambda$', '∀': '$\\forall$', '∃': '$\\exists$', '¬': '$\\neg$', '∧': '$\\wedge$', '∨': '$\\vee$', '→': '$\\rightarrow$', '↔': '$\\leftrightarrow$', 'ι': '$\\iota$', '∅': '$\\varnothing$', 'φ': '$\\phi$', 'θ': '$\\theta$' };
    s = s.replace(/[λ∀∃¬∧∨→↔ι∅φθ]/g, c => map[c]);
    return s;
  }
  const TEXCOL = { red: 'red', orange: 'orange', green: 'teal', blue: 'blue', purple: 'violet', gray: 'gray' };
  function toForest(doc, opts = {}) {
    const links = [...(doc.arrows || []).map(a => ({ ...a, user: true })), ...(opts.links || [])].filter(a => !a.hidden);
    const names = new Map(); let k = 0;
    const nameOf = id => { if (!names.has(id)) names.set(id, 'n' + (++k)); return names.get(id); };
    const lab0 = l => texBar(l, opts.bars) ?? texLabel(l);
    const botName = n => nameOf(n.roof ? n.id + '~' : n.id); // under a triangle: below its words, not inside it
    // geometry: depth and leaf span of every node (forest stacks levels evenly, so depth ~ height)
    const info = new Map();
    doc.roots.forEach(r => { let leaf = 0; (function g(n, d) {
      const i = { n, d, lo: leaf, hi: leaf };
      if (!n.ch.length || n.roof) leaf++; else { n.ch.forEach(c => g(c, d + 1)); i.hi = leaf - 1; }
      info.set(n.id, i);
    })(r, 0); });
    const deepest = n => { if (n.roof) return n; let best = n, bd = -Infinity; walk(n, m => { if (!info.has(m.id)) return; const v = lowOf(m); if (v > bd) { bd = v; best = m; } }); return best; };
    const G = opts.geom || null; // id -> {x, w, y, h} from the on-screen layout
    const spanOf = n => { const g = G && G(n.id); if (g) return [g.x - g.w / 2, g.x + g.w / 2]; const i = info.get(n.id); return [i.lo, i.hi]; };
    const midOf = n => { const g = G && G(n.id); if (g) return g.x; const i = info.get(n.id); return (i.lo + i.hi) / 2; };
    const lowOf = n => { const g = G && G(n.id); return g ? g.y + g.h : info.get(n.id).d; };
    const anchorOf = id => {
      const own = info.get(id).n; const h = opts.anchor && opts.anchor(id);
      const x = (h && info.get(h)) ? info.get(h).n : own;
      return { x, y: deepest(x) };
    };
    // one node per line, children indented under their mother (as you'd write it by hand)
    function go(n, ind = '  ') {
      let lab = lab0(n.label);
      if (n.silent) lab = `\\sout{${lab}}`;
      const ex = opts.extra && opts.extra(n);
      if (ex) lab = `{${lab}\\\\${ex}}`;
      else if (n.note) lab = `{${lab}\\\\{\\footnotesize\\itshape ${texLabel(n.note)}}}`;
      if (n.f) lab += ` {\\scriptsize [${texLabel(n.f)}]}`;
      const av = opts.avm && opts.avm(n);
      // label above its feature structure; the AVM's own lines are indented to sit under this node
      const avi = av ? av.replace(/\n/g, '\n' + ind + '  ') : '';
      if (av) lab = n.label ? `${lab}\\\\${avi}` : avi;
      const o = [];
      if (names.has(n.id)) o.push(`name=${names.get(n.id)}`);
      if (n.color && TEXCOL[n.color]) o.push(`text=${TEXCOL[n.color]}`);
      if (n.shape === 'box') o.push('draw');
      if (n.shape === 'circle') o.push('draw, circle');
      if (n.dash) o.push('edge=dashed');
      if (n.elabel) o.push(`edge label={node[midway, font=\\scriptsize, left]{${texLabel(n.elabel)}}}`);
      if ((ex || n.note) && !opts.extra) o.push('align=center');
      const os = o.length ? ', ' + o.join(', ') : '';
      if (n.roof) return `[${lab}${os} [${texLabel(yieldOf(n).join(' '))}, roof${names.has(n.id + '~') ? `, name=${names.get(n.id + '~')}` : ''}]]`;
      if (!n.ch.length) return `[${lab}${os}]`;
      const ci = ind + '  ';
      // a single word under its preterminal stays on the same line: [V [loves]]
      if (n.ch.length === 1 && !n.ch[0].ch.length && !av) return `[${lab}${os} ${go(n.ch[0], ci)}]`;
      return `[${lab}${os}\n${n.ch.map(c => ci + go(c, ci)).join('\n')}]`;
    }
    const hasAvm = !!opts.avm && doc.roots.some(r => { let y = false; walk(r, n => { if (opts.avm(n)) y = true; }); return y; });
    const opt = opts.extra || hasAvm ? '\n  for tree={align=center, base=top}' : '';
    return doc.roots.map(r => {
      const inRoot = id => contains(r, id);
      const mine = links.filter(a => a.from !== a.to && inRoot(a.from) && inRoot(a.to));
      const mid = midOf;
      // each arrow is a squared lane just under the lowest node it spans; overlapping lanes stack downwards
      const plans = mine.map(a => {
        const below = a.side !== 'above';
        const A = below ? anchorOf(a.from) : { x: info.get(a.from).n }, B = below ? anchorOf(a.to) : { x: info.get(a.to).n };
        return { a, below, A, B, lo: Math.min(mid(A.x), mid(B.x)), hi: Math.max(mid(A.x), mid(B.x)) };
      }).sort((p, q) => (p.hi - p.lo) - (q.hi - q.lo));
      const placed = [], coords = [], draws = []; let li = 0;
      for (const P of plans) {
        const { a, below, A, B } = P;
        const dashed = a.user ? !!a.dash : a.dash !== false;
        const style = [a.heads === 'both' ? 'latex-latex' : a.heads === 'none' ? '-' : '-latex', dashed ? 'dashed' : '', 'rounded corners=3pt', 'shorten <=1pt', 'shorten >=1pt'].filter(Boolean).join(', ');
        const lab = a.label ? ` node[midway, ${below ? 'below' : 'above'}, font=\\footnotesize] {${texLabel(a.label)}}` : '';
        if (!below) { draws.push(`  \\draw[${style}] (${nameOf(a.from)}.north) to[out=north, in=north, looseness=.6]${lab} (${nameOf(a.to)}.north);`); continue; }
        let ref = null, rd = -1;
        rd = -Infinity;
        info.forEach(i => { if (!inRoot(i.n.id)) return; const [a0, a1] = spanOf(i.n); const v = lowOf(i.n); if (a0 <= P.hi && a1 >= P.lo && v > rd) { rd = v; ref = i.n; } });
        [A.y, B.y].forEach(n => { const v = lowOf(n); if (v > rd) { rd = v; ref = n; } });
        let step = 0;
        for (const q of placed) {
          if (q.hi < P.lo || q.lo > P.hi || Math.abs(q.rd - rd) > 1e-6) continue;
          step = Math.max(step, q.step + 1);
        }
        placed.push({ lo: P.lo, hi: P.hi, rd, ref, step });
        const L = 'lane' + (++li);
        coords.push(`  \\coordinate (${L}) at ([yshift=-${8 + step * 7}pt]${botName(ref)}.south);`);
        const ax = nameOf(A.x.id), ay = botName(A.y), bx = nameOf(B.x.id), by = botName(B.y);
        draws.push(`  \\draw[${style}] (${ax} |- ${ay}.south) -- (${ax} |- ${L}) --${lab} (${bx} |- ${L}) -- (${bx} |- ${by}.south);`);
      }
      const body = go(r); // node names are assigned during routing, so the tree is written afterwards
      const tail = [...coords, ...draws];
      const o2 = tail.length ? (opt ? opt.replace('}', ', fit=band}') : '\n  for tree={fit=band}') : opt;
      const fr = `\\begin{forest}${o2}\n  ${body}\n${tail.join('\n')}${tail.length ? '\n' : ''}\\end{forest}`;
      // trees of AVMs are wide: build in a box, then scale it to the line (needs \newsavebox{\treebox})
      return hasAvm ? `\\begin{lrbox}{\\treebox}\n${fr}\n\\end{lrbox}\n\\begin{center}\n\\resizebox{\\linewidth}{!}{\\usebox{\\treebox}}\n\\end{center}` : fr;
    }).join('\n\n');
  }
  function toQtree(doc) {
    function go(n) {
      if (n.roof) return `\\qroof{${texLabel(yieldOf(n).join(' '))}}.${texLabel(n.label)}`;
      if (!n.ch.length) return texLabel(n.label) || '{}';
      return `[.{${texLabel(n.label)}} ${n.ch.map(go).join(' ')} ]`;
    }
    return doc.roots.map(r => `\\Tree ${go(r)}`).join('\n\n');
  }

  return {
    newId, bumpIds, mk, walk, walkDoc, find, rootOf, contains, clone, cloneDoc, yieldOf, leaves, detach, replaceNode, maxIndex,
    parseBracket, toBracket, toBracketMap, parseLatex, looksLikeLatex, texToLabel, parseGrammar, parseLexicon, checkGrammar, matchSeq, parseSentence,
    parseRewrite, parseTemplates, expandTemplate, labelForTemplate, templatePreview, matchRule, applyRuleAt, findMatch, toForest, toQtree, texLabel,
  };
})();
if (typeof module !== 'undefined') module.exports = Tree;
