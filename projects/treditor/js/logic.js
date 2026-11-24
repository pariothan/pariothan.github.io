/* Treditor — logic core: semantic types, lambda terms, type inference,
   beta-reduction, and evaluation in a model.  No DOM dependencies. */
'use strict';
const Logic = (() => {

  /* ───────────────────────── Types ───────────────────────── */
  let tvCounter = 0;
  const TV = () => ({ v: ++tvCounter });
  const B = n => ({ b: n });
  const F = (a, r) => ({ f: [a, r] });

  class ParseError extends Error {}

  // parseType("<e,<e,t>>")  or  "e -> e -> t".  In pattern mode, identifiers that are
  // not base types become type variables (shared through opts.varMap).
  function parseType(src, opts = {}) {
    const s = String(src).trim(); let i = 0;
    const varMap = opts.varMap || new Map();
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    const err = m => new ParseError(`Type "${s}": ${m} at ${i}`);
    function prim() {
      ws();
      const c = s[i];
      if (c === '<' || c === '⟨') {
        i++; const a = arrow(); ws();
        if (s[i] !== ',') throw err("expected ','"); i++;
        const r = arrow(); ws();
        if (s[i] !== '>' && s[i] !== '⟩') throw err("expected '>'"); i++;
        return F(a, r);
      }
      if (c === '(') { i++; const a = arrow(); ws(); if (s[i] !== ')') throw err("expected ')'"); i++; return a; }
      const m = /^[\p{L}_'][\p{L}\p{N}_']*/u.exec(s.slice(i));
      if (!m) throw err('expected a type');
      i += m[0].length;
      const n = m[0];
      if (opts.pattern && !(opts.base && opts.base.has(n))) {
        if (!varMap.has(n)) varMap.set(n, TV());
        return varMap.get(n);
      }
      return B(n);
    }
    function arrow() {
      const a = prim(); ws();
      if (s.startsWith('->', i)) { i += 2; return F(a, arrow()); }
      if (s[i] === '→') { i += 1; return F(a, arrow()); }
      return a;
    }
    if (!s) throw err('empty type');
    const t = arrow(); ws();
    if (i < s.length) throw err(`unexpected '${s[i]}'`);
    return t;
  }

  function prune(t, S) { while (t && t.v !== undefined && S.has(t.v)) t = S.get(t.v); return t; }
  function resolve(t, S) {
    t = prune(t, S);
    if (t.f) return F(resolve(t.f[0], S), resolve(t.f[1], S));
    return t;
  }
  function occurs(v, t, S) {
    t = prune(t, S);
    if (t.v !== undefined) return t.v === v;
    if (t.f) return occurs(v, t.f[0], S) || occurs(v, t.f[1], S);
    return false;
  }
  function unify(a, b, S) {
    a = prune(a, S); b = prune(b, S);
    if (a.v !== undefined) {
      if (b.v === a.v) return true;
      if (occurs(a.v, b, S)) return false;
      S.set(a.v, b); return true;
    }
    if (b.v !== undefined) return unify(b, a, S);
    if (a.b !== undefined && b.b !== undefined) return a.b === b.b;
    if (a.f && b.f) return unify(a.f[0], b.f[0], S) && unify(a.f[1], b.f[1], S);
    return false;
  }
  function freshen(t, map = new Map()) {
    if (t.v !== undefined) { if (!map.has(t.v)) map.set(t.v, TV()); return map.get(t.v); }
    if (t.f) return F(freshen(t.f[0], map), freshen(t.f[1], map));
    return t;
  }
  function hasVars(t) { return t.v !== undefined || (t.f && (hasVars(t.f[0]) || hasVars(t.f[1]))); }
  const GREEK = 'αβγδεζηθκμνξπρστφχψω';
  function typeStr(t, style = 'angle', names = new Map()) {
    if (!t) return '?';
    if (t.v !== undefined) {
      if (!names.has(t.v)) { const k = names.size; names.set(t.v, GREEK[k % GREEK.length] + (k >= GREEK.length ? Math.floor(k / GREEK.length) : '')); }
      return names.get(t.v);
    }
    if (t.b !== undefined) return t.b;
    const [a, r] = t.f;
    if (style === 'arrow') {
      const as = typeStr(a, style, names);
      return (a.f ? `(${as})` : as) + '→' + typeStr(r, style, names);
    }
    return `⟨${typeStr(a, style, names)},${typeStr(r, style, names)}⟩`;
  }
  function typeEq(a, b) { return typeStr(a) === typeStr(b); }

  /* ───────────────────────── Terms ───────────────────────── */
  // AST: {k:'id',n} {k:'lam',v,ty,b} {k:'app',f,a} {k:'q',q,v,ty,b}
  //      {k:'op',o,a:[...]} {k:'num',n} {k:'bool',n} {k:'meta',n}
  const BINOPS = ['↔', '→', '∨', '∧', '=', '≠', '<', '>', '≤', '≥', '+', '-', '*', '/'];
  const PREC = { '↔': 1, '→': 2, '∨': 3, '∧': 4, '¬': 5, '=': 6, '≠': 6, '<': 6, '>': 6, '≤': 6, '≥': 6, '⊑': 6, '+': 7, '-': 7, '⊕': 7, '*': 8, '/': 8 };
  const MULTI = [['<->', '↔'], ['<=>', '↔'], ['->', '→'], ['=>', '→'], ['/\\', '∧'], ['\\/', '∨'], ['!=', '≠'], ['<=', '≤'], ['>=', '≥'], ['&&', '∧'], ['||', '∨']];
  const SINGLE = { '&': '∧', '|': '∨', '~': '¬', '!': '¬', '¬': '¬', '∧': '∧', '∨': '∨', '→': '→', '↔': '↔', '=': '=', '≠': '≠', '<': '<', '>': '>', '≤': '≤', '≥': '≥', '+': '+', '-': '-', '*': '*', '/': '/', '⊃': '→', '≡': '↔', '⊕': '⊕', '⊑': '⊑', '≼': '⊑' };
  const KEYWORDS = { lambda: ['lam'], forall: ['q', '∀'], exists: ['q', '∃'], iota: ['q', 'ι'], sigma: ['q', 'σ'], the: null, true: ['bool', true], false: ['bool', false], and: ['op', '∧'], or: ['op', '∨'], not: ['op', '¬'] };

  function lex(src) {
    const s = String(src); const toks = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      const pos = i;
      if (c === 'λ' || (c === '\\' && s[i + 1] !== '/')) { toks.push({ t: 'lam', pos }); i++; continue; }
      if (c === '∀' || c === '∃' || c === 'ι' || c === 'σ') { toks.push({ t: 'q', v: c, pos }); i++; continue; }
      if (c === '⊤' || c === '⊥') { toks.push({ t: 'bool', v: c === '⊤', pos }); i++; continue; }
      if (c === '(' || c === '[') { toks.push({ t: '(', pos }); i++; continue; }
      if (c === ')' || c === ']') { toks.push({ t: ')', pos }); i++; continue; }
      if (c === ',') { toks.push({ t: ',', pos }); i++; continue; }
      if (c === '.') { toks.push({ t: '.', pos }); i++; continue; }
      if (c === ':') {
        // raw type annotation up to '.' at depth 0
        i++; let d = 0; const st = i;
        while (i < s.length) {
          const ch = s[i];
          if (ch === '<' || ch === '⟨' || ch === '(') d++;
          else if (ch === '>' && s[i - 1] !== '-') d--;
          else if (ch === '⟩' || ch === ')') d--;
          else if (ch === '.' && d <= 0) break;
          i++;
        }
        toks.push({ t: 'type', v: s.slice(st, i).trim(), pos });
        continue;
      }
      if (c === '#' && /\d/.test(s[i + 1] || '')) {
        let j = i + 1; while (j < s.length && /\d/.test(s[j])) j++;
        toks.push({ t: 'meta', v: s.slice(i + 1, j), pos }); i = j; continue;
      }
      let m = /^\d+(\.\d+)?/.exec(s.slice(i));
      if (m) { toks.push({ t: 'num', v: parseFloat(m[0]), pos }); i += m[0].length; continue; }
      m = /^[\p{L}_][\p{L}\p{N}_']*/u.exec(s.slice(i));
      if (m) {
        const w = m[0]; i += w.length;
        const kw = Object.prototype.hasOwnProperty.call(KEYWORDS, w) ? KEYWORDS[w] : null;
        if (kw) toks.push({ t: kw[0], v: kw[1], pos });
        else toks.push({ t: 'id', v: w, pos });
        continue;
      }
      const multi = MULTI.find(([k]) => s.startsWith(k, i));
      if (multi) { toks.push({ t: 'op', v: multi[1], pos }); i += multi[0].length; continue; }
      if (SINGLE[c]) { toks.push({ t: 'op', v: SINGLE[c], pos }); i++; continue; }
      throw new ParseError(`Unexpected character '${c}' at ${i}`);
    }
    return toks;
  }

  function parseTerm(src) {
    const toks = lex(src); let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const isOp = (...o) => peek() && peek().t === 'op' && o.includes(peek().v);
    const err = m => new ParseError(`${m}${peek() ? ` at ${peek().pos}` : ' at end'} in "${src}"`);
    const expect = t => { if (!peek() || peek().t !== t) throw err(`Expected '${t}'`); return next(); };
    const op = (o, a) => ({ k: 'op', o, a });
    function term() { return iff(); }
    function iff() { let a = imp(); while (isOp('↔')) { next(); a = op('↔', [a, imp()]); } return a; }
    function imp() { const a = or(); if (isOp('→')) { next(); return op('→', [a, imp()]); } return a; }
    function or() { let a = and(); while (isOp('∨')) { next(); a = op('∨', [a, and()]); } return a; }
    function and() { let a = not(); while (isOp('∧')) { next(); a = op('∧', [a, not()]); } return a; }
    function not() { if (isOp('¬')) { next(); return op('¬', [not()]); } return cmp(); }
    function cmp() { const a = add(); if (isOp('=', '≠', '<', '>', '≤', '≥', '⊑')) { const o = next().v; return op(o, [a, add()]); } return a; }
    function add() { let a = mul(); while (isOp('+', '-', '⊕')) { const o = next().v; a = op(o, [a, mul()]); } return a; }
    function mul() { let a = post(); while (isOp('*', '/')) { const o = next().v; a = op(o, [a, post()]); } return a; }
    function post() {
      let a = atom();
      while (peek() && peek().t === '(') {
        next();
        const args = [term()];
        while (peek() && peek().t === ',') { next(); args.push(term()); }
        expect(')');
        for (const x of args) a = { k: 'app', f: a, a: x };
      }
      return a;
    }
    function binder() {
      const tk = next();
      if (tk.t === 'lam') {
        const vars = [];
        do {
          const id = next();
          if (!id || id.t !== 'id') throw err('Expected a variable after λ');
          let ty = null;
          if (peek() && peek().t === 'type') ty = parseType(next().v);
          vars.push({ v: id.v, ty });
          if (peek() && peek().t === 'lam') next(); // allow λxλy.
        } while (peek() && peek().t === 'id');
        expect('.');
        let body = term();
        for (let k = vars.length - 1; k >= 0; k--) body = { k: 'lam', v: vars[k].v, ty: vars[k].ty, b: body };
        return body;
      }
      const id = next();
      if (!id || id.t !== 'id') throw err(`Expected a variable after ${tk.v}`);
      let ty = null;
      if (peek() && peek().t === 'type') ty = parseType(next().v);
      let body;
      if (peek() && peek().t === '.') { next(); body = term(); } else body = not();
      return { k: 'q', q: tk.v, v: id.v, ty, b: body };
    }
    function atom() {
      const tk = peek();
      if (!tk) throw err('Unexpected end of term');
      if (tk.t === 'lam' || tk.t === 'q') return binder();
      if (isOp('¬')) return not();
      next();
      switch (tk.t) {
        case 'id': return { k: 'id', n: tk.v };
        case 'num': return { k: 'num', n: tk.v };
        case 'bool': return { k: 'bool', n: tk.v };
        case 'meta': return { k: 'meta', n: +tk.v };
        case '(': { const t = term(); expect(')'); return t; }
      }
      p--; throw err(`Unexpected '${tk.v ?? tk.t}'`);
    }
    if (!toks.length) throw new ParseError('Empty term');
    const t = term();
    if (p < toks.length) throw err('Unexpected extra input');
    return t;
  }

  /* ───────────────────────── Printing ───────────────────────── */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function fmtId(n, html) {
    if (!html) return n;
    const m = /^(.*?[^\d_])_?(\d+)('*)$/u.exec(n);
    if (m) return `${esc(m[1])}<sub>${m[2]}</sub>${m[3]}`;
    const m2 = /^(.+?)_(.+)$/.exec(n);
    if (m2) return `${esc(m2[1])}<sub>${esc(m2[2])}</sub>`;
    return esc(n);
  }
  function show(t, o = {}) {
    const html = !!o.html, lam = o.lambda || 'λ', uncurry = o.uncurry !== false;
    const tyStyle = o.typeStyle || 'angle';
    const wrap = (s, node) => (html && o.hl === node ? `<span class="redex">${s}</span>` : s);
    const tyAnn = ty => (ty && o.showAnn !== false ? (html ? `<sub class="ann">${esc(typeStr(ty, tyStyle))}</sub>` : ':' + typeStr(ty, tyStyle)) : '');
    const sym = s => (html ? esc(s) : s);
    function go(t, ctx) {
      let s, pr;
      switch (t.k) {
        case 'id': s = fmtId(t.n, html); pr = 10; break;
        case 'num': s = String(t.n); pr = 10; break;
        case 'bool': s = t.n ? '⊤' : '⊥'; pr = 10; break;
        case 'meta': s = '#' + t.n; pr = 10; break;
        case 'lam': s = `${lam}${fmtId(t.v, html)}${tyAnn(t.ty)}.${go(t.b, 0)}`; pr = 0; break;
        case 'q': s = `${t.q}${fmtId(t.v, html)}${tyAnn(t.ty)}.${go(t.b, 0)}`; pr = 0; break;
        case 'app': {
          const args = []; let h = t;
          while (h.k === 'app') { args.unshift(h.a); h = h.f; }
          if (uncurry && h.k === 'id') s = go(h, 10) + '(' + args.map(a => go(a, 0)).join(', ') + ')';
          else {
            // print curried, but keep the full spine for highlight positions
            const spine = []; let x = t; while (x.k === 'app') { spine.unshift(x); x = x.f; }
            s = go(x, 10);
            for (const ap of spine) { s = s + '(' + go(ap.a, 0) + ')'; if (html && o.hl === ap && ap !== t) s = `<span class="redex">${s}</span>`; }
          }
          pr = 9; break;
        }
        case 'op': {
          const p = PREC[t.o];
          if (t.a.length === 1) { s = sym(t.o) + go(t.a[0], p); pr = p; break; }
          const [l, r] = t.a;
          let lc = p, rc = p + 1;
          if (t.o === '→') { lc = p + 1; rc = p; }
          if (p === 6) { lc = p + 1; rc = p + 1; }
          s = `${go(l, lc)} ${sym(t.o)} ${go(r, rc)}`; pr = p; break;
        }
        default: s = '?'; pr = 10;
      }
      if (pr < ctx) s = '(' + s + ')';
      return wrap(s, t);
    }
    return go(t, 0);
  }

  /* ───────────────────────── Variables & substitution ───────────────────────── */
  function freeVars(t, out = new Set(), bound = new Set()) {
    switch (t.k) {
      case 'id': if (!bound.has(t.n)) out.add(t.n); break;
      case 'lam': case 'q': { const b2 = new Set(bound); b2.add(t.v); freeVars(t.b, out, b2); break; }
      case 'app': freeVars(t.f, out, bound); freeVars(t.a, out, bound); break;
      case 'op': t.a.forEach(x => freeVars(x, out, bound)); break;
    }
    return out;
  }
  function allNames(t, out = new Set()) {
    switch (t.k) {
      case 'id': out.add(t.n); break;
      case 'lam': case 'q': out.add(t.v); allNames(t.b, out); break;
      case 'app': allNames(t.f, out); allNames(t.a, out); break;
      case 'op': t.a.forEach(x => allNames(x, out)); break;
    }
    return out;
  }
  function freshName(v, avoid) {
    let n = v + "'";
    while (avoid.has(n)) n += "'";
    return n;
  }
  // capture-avoiding substitution [s/x]t
  function subst(t, x, s, fvS = freeVars(s)) {
    switch (t.k) {
      case 'id': return t.n === x ? s : t;
      case 'lam': case 'q': {
        if (t.v === x) return t;
        if (!freeVars(t.b).has(x)) return t;
        if (fvS.has(t.v)) {
          const avoid = new Set([...fvS, ...allNames(t.b), x]);
          const nv = freshName(t.v, avoid);
          const b2 = subst(t.b, t.v, { k: 'id', n: nv });
          return { ...t, v: nv, b: subst(b2, x, s, fvS) };
        }
        return { ...t, b: subst(t.b, x, s, fvS) };
      }
      case 'app': return { k: 'app', f: subst(t.f, x, s, fvS), a: subst(t.a, x, s, fvS) };
      case 'op': return { k: 'op', o: t.o, a: t.a.map(y => subst(y, x, s, fvS)) };
      default: return t;
    }
  }
  // Fill template metavariables #0, #1… with terms, renaming template binders that would capture.
  function instantiate(tpl, metas, binding = new Set()) {
    const fvAll = new Set(); metas.forEach(m => m && freeVars(m, fvAll));
    function go(t, ren) {
      switch (t.k) {
        case 'meta': {
          const m = metas[t.n];
          if (!m) throw new Error(`Template refers to #${t.n}, which is not available`);
          return m;
        }
        case 'id': return ren.has(t.n) ? { k: 'id', n: ren.get(t.n) } : t;
        case 'lam': case 'q': {
          let v = t.v;
          const r2 = new Map(ren);
          if (fvAll.has(v) && !binding.has(v)) { v = freshName(v, new Set([...fvAll, ...allNames(t.b)])); r2.set(t.v, v); }
          else r2.delete(t.v);
          return { ...t, v, b: go(t.b, r2) };
        }
        case 'app': return { k: 'app', f: go(t.f, ren), a: go(t.a, ren) };
        case 'op': return { k: 'op', o: t.o, a: t.a.map(y => go(y, ren)) };
        default: return t;
      }
    }
    return go(tpl, new Map());
  }

  /* ───────────────────────── Reduction ───────────────────────── */
  function findRedex(t) {
    switch (t.k) {
      case 'app': if (t.f.k === 'lam') return t; return findRedex(t.f) || findRedex(t.a);
      case 'lam': case 'q': return findRedex(t.b);
      case 'op': for (const x of t.a) { const r = findRedex(x); if (r) return r; } return null;
      default: return null;
    }
  }
  function contract(t, r) {
    if (t === r) return subst(r.f.b, r.f.v, r.a);
    switch (t.k) {
      case 'app': return { k: 'app', f: contract(t.f, r), a: contract(t.a, r) };
      case 'lam': case 'q': return { ...t, b: contract(t.b, r) };
      case 'op': return { k: 'op', o: t.o, a: t.a.map(x => contract(x, r)) };
      default: return t;
    }
  }
  // Returns list of {term, redex} where redex is the redex in `term` contracted to get the next one.
  function reductionSteps(t, limit = 200) {
    const steps = [];
    let cur = t;
    for (let i = 0; i < limit; i++) {
      const r = findRedex(cur);
      steps.push({ term: cur, redex: r });
      if (!r) return steps;
      cur = contract(cur, r);
    }
    steps.push({ term: cur, redex: null, truncated: true });
    return steps;
  }
  function normalize(t, limit = 500) {
    let cur = t;
    for (let i = 0; i < limit; i++) { const r = findRedex(cur); if (!r) return cur; cur = contract(cur, r); }
    return cur;
  }

  /* ───────────────────────── Mereology (plurals & mass) ─────────────────────────
     Individuals are strings; a sum is its atoms sorted and joined with ⊕ ("ann⊕bo").  */
  const partsOf = x => String(x).split('⊕').filter(Boolean);
  const sumOf = (...xs) => [...new Set(xs.flatMap(partsOf))].sort().join('⊕');
  const partOf = (x, y) => { const py = new Set(partsOf(y)); return partsOf(x).every(p => py.has(p)); };
  function allSums(atoms, cap = 10) {
    const a = atoms.slice(0, cap), out = [];
    for (let m = 1; m < (1 << a.length); m++) out.push(sumOf(...a.filter((_, i) => m & (1 << i))));
    return out.sort((p, q) => partsOf(p).length - partsOf(q).length || (p < q ? -1 : 1));
  }
  function closeUnderSum(xs) {
    const set = new Set(xs.map(x => sumOf(x)));
    let grew = true;
    while (grew && set.size < 2048) { grew = false; const arr = [...set]; for (const a of arr) for (const b of arr) { const s = sumOf(a, b); if (!set.has(s)) { set.add(s); grew = true; } } }
    return [...set];
  }
  const BUILTIN_TYPES = {
    atom: () => F(B('e'), B('t')),
    star: () => F(F(B('e'), B('t')), F(B('e'), B('t'))),
  };

  /* ───────────────────────── Type inference ───────────────────────── */
  // ctx: { conv(name)->type|null, consts: Map(name->type) }
  function infer(t, ctx = {}) {
    const S = new Map(); const free = new Map();
    const conv = ctx.conv || (() => null);
    const consts = ctx.consts || new Map();
    const T = B('t'), N = B('n');
    const mismatch = (what, a, b) => {
      const names = new Map();
      return new TypeError(`${what}: ${typeStr(resolve(a, S), ctx.style, names)} vs ${typeStr(resolve(b, S), ctx.style, names)}`);
    };
    const need = (x, ty, what) => { if (!unify(x, ty, S)) throw mismatch(what, x, ty); };
    function go(t, env) {
      switch (t.k) {
        case 'id': {
          if (env.has(t.n)) return env.get(t.n);
          const c = conv(t.n); if (c) return freshen(c);
          if (consts.has(t.n)) return freshen(consts.get(t.n));
          if (BUILTIN_TYPES[t.n]) return BUILTIN_TYPES[t.n]();
          if (!free.has(t.n)) free.set(t.n, TV());
          return free.get(t.n);
        }
        case 'num': return N;
        case 'bool': return T;
        case 'meta': throw new TypeError('Uninstantiated metavariable #' + t.n);
        case 'lam': {
          const tv = t.ty || conv(t.v) || TV();
          const e2 = new Map(env); e2.set(t.v, tv);
          return F(tv, go(t.b, e2));
        }
        case 'q': {
          const tv = t.ty || conv(t.v) || (t.q === 'ι' || t.q === 'σ' ? TV() : B('e'));
          const e2 = new Map(env); e2.set(t.v, tv);
          const bt = go(t.b, e2);
          need(bt, T, `Body of ${t.q}${t.v} must be type t`);
          return t.q === 'ι' || t.q === 'σ' ? tv : T;
        }
        case 'app': {
          const tf = go(t.f, env), ta = go(t.a, env);
          const r = TV();
          const ftp = prune(tf, S);
          if (!unify(tf, F(ta, r), S)) {
            const names = new Map();
            const fs = typeStr(resolve(tf, S), ctx.style, names), as = typeStr(resolve(ta, S), ctx.style, names);
            if (ftp.b !== undefined) throw new TypeError(`Cannot apply ${show(t.f)} of type ${fs} — it is not a function`);
            throw new TypeError(`Type mismatch: ${show(t.f)} : ${fs} cannot apply to ${show(t.a)} : ${as}`);
          }
          return r;
        }
        case 'op': {
          const o = t.o;
          if (o === '¬') { need(go(t.a[0], env), T, '¬ needs type t'); return T; }
          if (['∧', '∨', '→', '↔'].includes(o)) { t.a.forEach(x => need(go(x, env), T, `${o} needs type t`)); return T; }
          if (o === '=' || o === '≠') { const a = go(t.a[0], env), b = go(t.a[1], env); need(a, b, `Both sides of ${o} must have the same type`); return T; }
          if (o === '⊕') { t.a.forEach(x => need(go(x, env), B('e'), '⊕ joins individuals (type e)')); return B('e'); }
          if (o === '⊑') { t.a.forEach(x => need(go(x, env), B('e'), '⊑ relates individuals (type e)')); return T; }
          if (['<', '>', '≤', '≥'].includes(o)) { t.a.forEach(x => need(go(x, env), N, `${o} compares numbers (type n)`)); return T; }
          t.a.forEach(x => need(go(x, env), N, `${o} needs numbers (type n)`)); return N;
        }
      }
      throw new TypeError('Unknown term');
    }
    const ty = go(t, new Map());
    const freeTypes = new Map();
    for (const [k, v] of free) freeTypes.set(k, resolve(v, S));
    return { type: resolve(ty, S), free: freeTypes };
  }

  /* ───────────────────────── Models & evaluation ───────────────────────── */
  class EvalError extends Error {}
  const isFn = v => v && typeof v === 'object' && typeof v.fn === 'function';
  function valEq(a, b, model) {
    if (isFn(a) || isFn(b)) {
      if (!isFn(a) || !isFn(b)) return false;
      return model.domain.every(d => { try { return valEq(a.fn(d), b.fn(d), model); } catch { return false; } });
    }
    return a === b;
  }
  function setFn(tuples, arity) {
    const keys = new Set(tuples.map(t => t.join('\u0001')));
    const build = prefix => ({ fn: x => (prefix.length + 1 === arity ? keys.has([...prefix, x].join('\u0001')) : build([...prefix, x])) });
    return arity <= 0 ? false : build([]);
  }
  function arityOf(ty) { let n = 0; while (ty && ty.f) { n++; ty = ty.f[1]; } return n; }

  function splitTop(s, sep = ',') {
    const out = []; let d = 0, cur = '';
    for (const ch of s) {
      if ('([{<⟨'.includes(ch)) d++;
      if (')]}>⟩'.includes(ch)) d--;
      if (ch === sep && d === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim() || out.length) out.push(cur);
    return out.map(x => x.trim()).filter(x => x !== '');
  }

  function parseModel(src, consts = new Map()) {
    const model = { domain: [], vals: new Map(), errors: [] };
    const lines = String(src || '').split('\n');
    const pending = []; const cumulative = new Set();
    lines.forEach((raw, ln) => {
      const line = raw.replace(/(^|\s)(#|\/\/).*$/, '').trim();
      if (!line) return;
      if (line.startsWith('@')) {
        const dm = /^@(\w+)\s*(.*)$/.exec(line);
        if (dm && dm[1] === 'sums') model.sums = true;
        else if (dm && dm[1] === 'cumulative') dm[2].split(/[\s,]+/).filter(Boolean).forEach(n => cumulative.add(n));
        else model.errors.push({ line: ln + 1, msg: `Unknown directive ${line}` });
        return;
      }
      const m = /^([^=]+?)\s*=\s*(.+)$/.exec(line) || /^(D|domain)\s*:\s*(.+)$/i.exec(line);
      if (!m) { model.errors.push({ line: ln + 1, msg: 'Expected  name = value' }); return; }
      const name = m[1].trim(), rhs = m[2].trim();
      if (/^(D|domain|D_e|De)$/i.test(name)) {
        const inner = rhs.replace(/^[{[]|[}\]]$/g, '');
        model.domain = splitTop(inner).map(x => x.trim());
        return;
      }
      pending.push({ name, rhs, ln });
    });
    model.atoms = model.domain.slice();
    if (model.sums) {
      if (model.atoms.length > 10) model.errors.push({ line: 0, msg: 'Sums: only the first 10 individuals are combined' });
      model.domain = allSums(model.atoms);
    }
    model.cumulative = cumulative;
    for (const { name, rhs, ln } of pending) {
      try { model.vals.set(name, parseValue(rhs, name)); }
      catch (e) { model.errors.push({ line: ln + 1, msg: e.message }); }
    }
    function parseValue(rhs, name) {
      if (/^(true|T|⊤)$/.test(rhs)) return true;
      if (/^(false|F|⊥)$/.test(rhs)) return false;
      if (/^-?\d+(\.\d+)?$/.test(rhs)) return parseFloat(rhs);
      if (/^\{.*\}$/.test(rhs)) {
        const items = splitTop(rhs.slice(1, -1));
        const tuples = items.map(it => {
          const t = /^[(<⟨](.*)[)>⟩]$/.exec(it);
          return t ? splitTop(t[1]) : [it];
        });
        let arity = tuples.length ? tuples[0].length : Math.max(1, arityOf(consts.get(name)));
        if (tuples.some(t => t.length !== arity)) throw new Error(`Tuples in ${name} have different lengths`);
        for (const t of tuples) for (let i = 0; i < t.length; i++) if (t[i].includes('⊕')) t[i] = sumOf(t[i]);
        if (arity === 1 && cumulative.has(name)) { const c = closeUnderSum(tuples.map(t => t[0])); tuples.length = 0; c.forEach(x => tuples.push([x])); }
        const v = setFn(tuples, arity);
        v.tuples = tuples; v.arity = arity;
        return v;
      }
      if (/^[\p{L}_][\p{L}\p{N}_']*$/u.test(rhs) && (model.domain.includes(rhs))) return rhs;
      if (model.vals.has(rhs)) return model.vals.get(rhs);
      const term = parseTerm(rhs);
      return evaluate(term, model);
    }
    return model;
  }

  function evaluate(t, model, env = new Map()) {
    const ev = (x, e = env) => evaluate(x, model, e);
    const bool = (v, what) => { if (typeof v !== 'boolean') throw new EvalError(`${what} expected a truth value, got ${showVal(v, model)}`); return v; };
    switch (t.k) {
      case 'id': {
        if (env.has(t.n)) return env.get(t.n);
        if (model.vals.has(t.n)) return model.vals.get(t.n);
        if (model.domain.includes(t.n)) return t.n;
        if (t.n === 'atom') return { fn: x => partsOf(x).length === 1 };
        if (t.n === 'star') return { fn: P => ({ fn: x => { const ps = model.domain.filter(y => partOf(y, x) && P.fn(y) === true); return ps.length > 0 && sumOf(...ps) === sumOf(x); } }) };
        throw new EvalError(`'${t.n}' has no value in the model (and is not a free variable with an assignment)`);
      }
      case 'num': case 'bool': return t.n;
      case 'lam': return { fn: x => ev(t.b, new Map(env).set(t.v, x)), lam: t };
      case 'app': {
        const f = ev(t.f);
        if (!isFn(f)) throw new EvalError(`${show(t.f)} denotes ${showVal(f, model)}, which is not a function`);
        return f.fn(ev(t.a));
      }
      case 'q': {
        if (!model.domain.length) throw new EvalError('The model has an empty domain (add  D = {a, b, …})');
        const sat = d => bool(ev(t.b, new Map(env).set(t.v, d)), `${t.q}${t.v}`);
        if (t.q === '∀') return model.domain.every(sat);
        if (t.q === '∃') return model.domain.some(sat);
        if (t.q === 'σ') {
          const xs = model.domain.filter(sat);
          if (!xs.length) throw new EvalError(`Presupposition failure: σ${t.v} — nothing satisfies the description`);
          return sumOf(...xs);
        }
        const xs = model.domain.filter(sat);
        if (xs.length !== 1) throw new EvalError(`Presupposition failure: ι${t.v} needs exactly one satisfier, found ${xs.length}${xs.length ? ' (' + xs.join(', ') + ')' : ''}`);
        return xs[0];
      }
      case 'op': {
        const o = t.o;
        if (o === '¬') return !bool(ev(t.a[0]), '¬');
        if (o === '∧') return bool(ev(t.a[0]), '∧') && bool(ev(t.a[1]), '∧');
        if (o === '∨') return bool(ev(t.a[0]), '∨') || bool(ev(t.a[1]), '∨');
        if (o === '→') return !bool(ev(t.a[0]), '→') || bool(ev(t.a[1]), '→');
        if (o === '↔') return bool(ev(t.a[0]), '↔') === bool(ev(t.a[1]), '↔');
        const a = ev(t.a[0]), b = ev(t.a[1]);
        if (o === '⊕') return sumOf(a, b);
        if (o === '⊑') return partOf(a, b);
        if (o === '=') return valEq(a, b, model);
        if (o === '≠') return !valEq(a, b, model);
        const num = v => { if (typeof v !== 'number') throw new EvalError(`${o} expected a number, got ${showVal(v, model)}`); return v; };
        switch (o) {
          case '<': return num(a) < num(b); case '>': return num(a) > num(b);
          case '≤': return num(a) <= num(b); case '≥': return num(a) >= num(b);
          case '+': return num(a) + num(b); case '-': return num(a) - num(b);
          case '*': return num(a) * num(b); case '/': return num(a) / num(b);
        }
      }
    }
    throw new EvalError('Cannot evaluate ' + t.k);
  }

  // Render a value: functions over entities shown as sets / relations when possible.
  function showVal(v, model, depth = 0) {
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
    if (typeof v === 'string') return v;
    if (!isFn(v)) return String(v);
    if (depth > 3 || !model || !model.domain.length) return '[function]';
    const tuples = charTuples(v, model, 4);
    if (tuples) return '{' + tuples.map(t => (t.length === 1 ? t[0] : '⟨' + t.join(',') + '⟩')).join(', ') + '}';
    try {
      const pairs = model.domain.map(d => `${d}→${showVal(v.fn(d), model, depth + 1)}`);
      return '[' + pairs.join(', ') + ']';
    } catch { return '[function]'; }
  }
  function charTuples(v, model, maxDepth) {
    const out = [];
    function rec(f, prefix) {
      if (prefix.length > maxDepth) throw 0;
      for (const d of model.domain) {
        const r = f.fn(d);
        if (typeof r === 'boolean') { if (r) out.push([...prefix, d]); }
        else if (isFn(r)) rec(r, [...prefix, d]);
        else throw 0;
      }
    }
    try { rec(v, []); return out; } catch { return null; }
  }

  return {
    ParseError, EvalError, TV, B, F, parseType, unify, resolve, freshen, hasVars, typeStr, typeEq, prune,
    parseTerm, show, esc, fmtId, freeVars, subst, instantiate, findRedex, contract, reductionSteps, normalize,
    infer, parseModel, evaluate, showVal, splitTop, isFn, sumOf, partOf, partsOf, allSums,
  };
})();
if (typeof module !== 'undefined') module.exports = Logic;
