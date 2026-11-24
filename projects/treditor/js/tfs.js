/* Treditor — typed feature structures for HPSG.
   Unification over a type hierarchy (multiple inheritance, greatest lower bounds), inherited type
   constraints with full expansion (well-typedness), lists with ⊕ (solved in either direction),
   defaults (persistent until a word is finished), optional list members, path aliases, category
   abbreviations, lexicon, lexical rules (inflectional / derivational / post-inflectional with
   default identity), schemata and the standard principles.

   Grammar text (TDL-like; ';' or '#' comments; statements end with '.'):
     verb := agr-pos & [AUX bool / -].            type, supertypes, constraint (AVM syntax)
     gerund := noun & verb.                        multiple inheritance
     @alias HEAD SYN|HEAD                          feature shorthand (resolved where not appropriate)
     @abbr NP [HEAD noun, VAL [SPR < >, COMPS < >]] category abbreviation (NP_i adds INDEX #i)
     @abbrindex SEM|INDEX                          path that NP_i's subscript binds
     @irreg see past saw                           irregular morphology
   Lexicon:   kim := pn-lxm & [PHON <"Kim">, SEM|RESTR <[RELN name, NAME Kim, NAMED #i]>].
   Rules:     3sg-verb (i, 3sg): [verb-lxm] => [word HEAD [FORM fin, AGR 3sing]]
              kinds: i = inflectional (lexeme→word, monotonic), d = derivational, p = post-inflectional
              (d/p: output keeps everything from the input it doesn't override — default identity)  */
'use strict';
const TFS = (() => {
  const TOP = '*top*';
  class TfsError extends Error {}

  /* ───────── nodes ───────── */
  let uid = 0;
  const mk = (t = TOP) => ({ id: ++uid, t, f: null, fwd: null });
  const D = n => { while (n && n.fwd) n = n.fwd; return n; };
  const get = (n, f) => { n = D(n); return n && n.f ? n.f.get(f) : undefined; };
  function put(n, f, v) { n = D(n); if (!n.f) n.f = new Map(); n.f.set(f, v); }
  function copy(n, memo = new Map()) {
    n = D(n);
    if (memo.has(n)) return memo.get(n);
    const c = { id: ++uid, t: n.t, f: null, fwd: null };
    for (const k of ['el', 'exp', 'lit', 'str', 'set', 'vname']) if (n[k] !== undefined) c[k] = n[k];
    memo.set(n, c);
    if (n.f) { c.f = new Map(); for (const [k, v] of n.f) c.f.set(k, copy(v, memo)); }
    if (n.def) c.def = copy(n.def, memo);
    if (n.apps) c.apps = n.apps.map(([a, b]) => [copy(a, memo), copy(b, memo)]);
    return c;
  }
  function nodesOf(root, out = new Set()) {
    const stack = [root];
    while (stack.length) {
      const n = D(stack.pop()); if (!n || out.has(n)) continue; out.add(n);
      if (n.f) for (const v of n.f.values()) stack.push(v);
      if (n.apps) for (const [a, b] of n.apps) stack.push(a, b);
    }
    return out;
  }

  /* ───────── grammar ───────── */
  function splitStatements(src) {
    const out = []; let cur = '', depth = 0, q = false, line = 1, startLine = 1;
    const text = String(src || '').split('\n').map(l => (/^\s*[;#]/.test(l) ? '' : l.replace(/\s;.*$/, ''))).join('\n');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '\n') { line++; if (!cur.trim()) startLine = line; }
      if (c === '"') q = !q;
      if (!q) {
        if ('[<{('.includes(c) || c === '⟨') depth++;
        if (']>})'.includes(c) || c === '⟩') depth = Math.max(0, depth - 1);
        if (c === '>' && text[i - 1] === '=') depth++; // '=>' in rules is not a closer
      }
      if (c === '@' && !q && depth === 0 && !cur.trim()) { const j = text.indexOf('\n', i); const l = text.slice(i, j < 0 ? text.length : j); out.push({ s: l.trim(), line }); i = (j < 0 ? text.length : j) - 1; continue; }
      if (c === '.' && !q && depth === 0 && (i + 1 >= text.length || /\s/.test(text[i + 1]))) { if (cur.trim()) out.push({ s: cur.trim(), line: startLine }); cur = ''; startLine = line; continue; }
      cur += c;
    }
    if (cur.trim()) out.push({ s: cur.trim(), line: startLine });
    return out;
  }
  // "a & b & [..]" → { sups: [a, b], avm: AVM value | null }
  function splitConj(rhs) {
    const parts = []; let d = 0, cur = '', q = false;
    for (const c of rhs) {
      if (c === '"') q = !q;
      if (!q && ('[<{('.includes(c))) d++;
      if (!q && (']>})'.includes(c))) d--;
      if (c === '&' && d === 0 && !q) { parts.push(cur.trim()); cur = ''; } else cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());
    const sups = [], avms = [];
    for (const p of parts) { if (/^[^\s[<{"]+$/.test(p)) sups.push(p); else avms.push(p); }
    let avm = null;
    if (avms.length) avm = AVM.parse(avms.length === 1 ? avms[0] : avms.join(' & '));
    return { sups, avm };
  }

  function compile(typesSrc, lexSrc, rulesSrc, opts = {}) {
    const G = {
      types: new Map(), aliases: new Map(), abbr: new Map(), irreg: new Map(), errors: [],
      abbrIndex: ['SEM', 'INDEX'], lexicon: [], rules: [], principles: { ...DEFAULT_PRINCIPLES, ...(opts.principles || {}) },
    };
    const err = (section, line, msg) => G.errors.push({ section, line, msg });
    const declare = (name, sups, avm, line) => {
      if (name === TOP) return;
      const t = G.types.get(name);
      if (t) { t.sups.push(...sups.filter(s => !t.sups.includes(s))); if (avm) t.avm = t.avm ? { k: 'conj', parts: [t.avm, avm] } : avm; }
      else G.types.set(name, { name, sups: sups.length ? sups : [TOP], avm, line });
    };
    // built-in list types
    declare('list', [TOP], null, 0); declare('elist', ['list'], null, 0);
    declare('nelist', ['list'], AVM.parse('[FIRST *top*, REST list]'), 0);
    declare('set', [TOP], null, 0);
    declare('rule', [TOP], AVM.parse('[ARGS list]'), 0);
    for (const st of splitStatements(typesSrc)) {
      try {
        if (st.s.startsWith('@')) { directive(G, st.s); continue; }
        let m = /^([^\s:=]+)\s*:=\s*([\s\S]+)$/.exec(st.s);
        if (m) { const { sups, avm } = splitConj(m[2]); declare(m[1], sups, avm, st.line); continue; }
        // compact form:  type < sup1 & sup2: FEAT:type, FEAT:type
        m = /^([^\s:<]+)\s*(?:<\s*([^:]+?))?\s*(?::\s*([\s\S]*))?$/.exec(st.s.replace(/\n/g, ' '));
        if (m) {
          const sups = m[2] ? m[2].split(/[&,\s]+/).filter(Boolean) : [];
          const rows = (m[3] || '').split(/[\s,]+/).filter(Boolean).map(x => { const [f, t] = x.split(':'); return `${f} ${t || TOP}`; });
          declare(m[1], sups, rows.length ? AVM.parse(`[${rows.join(', ')}]`) : null, st.line);
          continue;
        }
        err('Types', st.line, `Cannot read: ${st.s.slice(0, 60)}`);
      } catch (e) { err('Types', st.line, e.message); }
    }
    // every supertype mentioned must exist
    for (const t of [...G.types.values()]) for (const s of t.sups) if (s !== TOP && !G.types.has(s)) declare(s, [TOP], null, t.line);
    // ancestors (with cycle check), subtypes
    G.anc = new Map(); G.subs = new Map();
    const ancOf = (t, seen = new Set()) => {
      if (G.anc.has(t)) return G.anc.get(t);
      if (seen.has(t)) { err('Types', 0, `Cycle in the type hierarchy at ${t}`); return new Set([t, TOP]); }
      seen.add(t);
      const set = new Set([t, TOP]);
      const T = G.types.get(t);
      if (T) for (const s of T.sups) for (const a of ancOf(s, seen)) set.add(a);
      G.anc.set(t, set); return set;
    };
    for (const t of G.types.keys()) { ancOf(t); for (const s of G.types.get(t).sups) { if (!G.subs.has(s)) G.subs.set(s, []); G.subs.get(s).push(t); } }
    G.glbCache = new Map(); G.expCache = new Map(); G.expBusy = new Set();
    Object.assign(G, grammarMethods);
    G.paths = {
      HEAD: G.pathOf('HEAD', ['SYN', 'HEAD']), SPR: G.pathOf('SPR', ['SYN', 'VAL', 'SPR']), COMPS: G.pathOf('COMPS', ['SYN', 'VAL', 'COMPS']),
      MOD: G.pathOf('MOD', ['SYN', 'VAL', 'MOD']), GAP: G.pathOf('GAP', ['SYN', 'GAP']), RESTR: G.pathOf('RESTR', ['SEM', 'RESTR']),
      INDEX: G.pathOf('INDEX', ['SEM', 'INDEX']), MODE: G.pathOf('MODE', ['SEM', 'MODE']), PHON: G.pathOf('PHON', ['PHON']), ARGST: G.pathOf('ARG-ST', ['ARG-ST']),
      CASE: G.pathOf('CASE', ['SYN', 'HEAD', 'CASE']), AGR: G.pathOf('AGR', ['SYN', 'HEAD', 'AGR']), FORM: G.pathOf('FORM', ['SYN', 'HEAD', 'FORM']),
    };
    // expand every type now so constraint errors surface
    for (const t of G.types.keys()) { try { G.expC(t); } catch (e) { err('Types', G.types.get(t).line, `${t}: ${e.message}`); } }
    lintTypes(G, err);
    compileLexicon(G, lexSrc, err);
    compileRules(G, rulesSrc, err);
    return G;
  }
  function directive(G, line) {
    const m = /^@(\w+)\s+(.*)$/.exec(line.trim()); if (!m) throw new TfsError(`Bad directive ${line}`);
    const [, d, rest] = m;
    if (d === 'alias') { const [name, path] = rest.trim().split(/\s+/); G.aliases.set(name, path.split(/[|.]/)); }
    else if (d === 'abbr') { const mm = /^(\S+)\s+([\s\S]+)$/.exec(rest.trim()); G.abbr.set(mm[1], AVM.parse(mm[2])); }
    else if (d === 'abbrindex') G.abbrIndex = rest.trim().split(/[|.]/);
    else if (d === 'irreg') { const [stem, cls, form] = rest.trim().split(/\s+/); G.irreg.set(`${stem}|${cls}`, form); }
    else if (d === 'root') G.root = AVM.parse(rest.trim()); // initial symbol: what the root of a whole tree must satisfy
    else throw new TfsError(`Unknown directive @${d}`);
  }

  const grammarMethods = {
    isType(t) { return t === TOP || this.types.has(t); },
    ancestors(t) { if (this.anc.has(t)) return this.anc.get(t); const s = new Set([t, TOP]); if (/^".*"$/.test(t) && this.types.has('string')) s.add('string'); return s; },
    sub(a, b) { return a === b || b === TOP || this.ancestors(a).has(b); }, // a ⊑ b (a at least as specific)
    glb(a, b) {
      if (a === b) return a; if (a === TOP) return b; if (b === TOP) return a;
      const key = a < b ? a + '\u0001' + b : b + '\u0001' + a;
      if (this.glbCache.has(key)) return this.glbCache.get(key);
      let r = null;
      if (this.sub(a, b)) r = a; else if (this.sub(b, a)) r = b;
      else {
        const common = [...this.types.keys()].filter(t => this.sub(t, a) && this.sub(t, b));
        const best = common.filter(c => !common.some(d => d !== c && this.sub(c, d)));
        r = best.length ? best[0] : null;
      }
      this.glbCache.set(key, r); return r;
    },
    pathOf(name, dflt) { return this.aliases.get(name) || dflt; },
    // fully expanded constraint of a type (all inherited constraints + well-typed feature values)
    expC(t) {
      if (this.expCache.has(t)) return this.expCache.get(t);
      if (this.expBusy.has(t) || !this.types.has(t)) return null;
      this.expBusy.add(t);
      try {
        const T = this.types.get(t);
        let n = T.avm ? toTFS(T.avm, this, { tags: new Map() }, t) : mk(t);
        n = D(n); const nt = this.glb(n.t, t); if (nt === null) throw new TfsError(`constraint of ${t} has incompatible type ${n.t}`); n.t = nt;
        for (const s of T.sups) {
          if (s === TOP) continue;
          const sc = this.expC(s);
          if (sc && !unify(n, copy(sc), this)) throw new TfsError(`conflicts with supertype ${s} (${this.fail || ''})`);
        }
        D(n).exp = t;
        if (!expand(n, this)) throw new TfsError(this.fail || 'not well-typed');
        const res = D(n);
        this.expCache.set(t, res);
        return res;
      } finally { this.expBusy.delete(t); }
    },
    appropriate(t, f) {
      if (t === TOP) return false;
      if (this.expBusy.has(t)) { const T = this.types.get(t); return !!T && T.sups.some(s => this.appropriate(s, f)); } // type being defined: inherited features only
      const c = this.expC(t); return !!(c && c.f && c.f.has(f));
    },
    declaredType(t, f) { const c = this.expC(t); const v = c && get(c, f); return v ? D(v) : null; },
  };

  /* ───────── unification ───────── */
  function unify(a, b, G) {
    a = D(a); b = D(b); if (a === b) return true;
    const t = G.glb(a.t, b.t);
    if (t === null) { G.fail = `${a.t} and ${b.t} do not unify`; return false; }
    const bothExp = a.exp === t && b.exp === t;
    b.fwd = a; a.t = t;
    a.exp = bothExp ? t : (a.exp === t ? t : (b.exp === t ? t : null));
    if (a.exp !== t) a.exp = null;
    if (b.el && !a.el) a.el = b.el;
    if (b.lit) a.lit = true;
    if (b.str) a.str = true;
    if (b.def && !a.def) a.def = b.def;
    if (b.vname && !a.vname) a.vname = b.vname;
    if (b.apps) a.apps = (a.apps || []).concat(b.apps);
    if (b.f) for (const [k, bv] of b.f) {
      const av = a.f && a.f.get(k);
      if (av) { if (!unify(av, bv, G)) { G.fail = `${k}: ${G.fail}`; return false; } }
      else put(a, k, bv);
    }
    return true;
  }
  // apply type constraints to every node until nothing changes; solve ⊕ along the way
  function expand(root, G) {
    for (let round = 0; round < 60; round++) {
      let changed = false;
      const nodes = nodesOf(root);
      if (nodes.size > 40000) throw new TfsError('structure too large (runaway constraints?)');
      for (const n0 of nodes) {
        const n = D(n0);
        if (n.exp === n.t || !G.types.has(n.t)) { if (!G.types.has(n.t)) n.exp = n.t; continue; }
        const c = G.expC(n.t);
        const t0 = n.t;
        if (c) { if (!unify(n, copy(c), G)) return false; changed = true; }
        const m = D(n); if (m.t === t0) m.exp = t0; else changed = true;
      }
      const r = solveApps(root, G);
      if (r === false) return false;
      if (r) changed = true;
      if (!changed) return true;
    }
    G.fail = 'constraints did not settle'; return false;
  }

  /* ───────── lists & ⊕ ───────── */
  function listOf(items, tail) {
    let cur = tail || mk('elist');
    for (let i = items.length - 1; i >= 0; i--) { const c = mk('nelist'); put(c, 'FIRST', items[i]); put(c, 'REST', cur); cur = c; }
    return cur;
  }
  function listArr(n, G) {
    const items = []; let cur = D(n);
    for (let g = 0; g < 500; g++) {
      if (G.sub(cur.t, 'elist')) return { items, closed: true, tail: cur };
      const f = get(cur, 'FIRST');
      if (G.sub(cur.t, 'nelist') && f) { items.push(f); cur = D(get(cur, 'REST') || mk('list')); continue; }
      return { items, closed: false, tail: cur };
    }
    return { items, closed: false, tail: cur };
  }
  // returns false on failure, true if something was solved, null if nothing to do
  function solveApps(root, G) {
    let solved = null;
    for (const n0 of nodesOf(root)) {
      const r = D(n0); if (!r.apps || !r.apps.length) continue;
      const keep = []; const todo = r.apps; r.apps = null;
      for (const [a, b] of todo) {
        const la = listArr(a, G), lb = listArr(b, G), lr = listArr(r, G);
        if (la.closed) { if (!unify(r, listOf(la.items, b), G)) return false; solved = true; }
        else if (lr.closed && lb.closed) {
          const k = lr.items.length - lb.items.length;
          if (k < 0) { G.fail = 'list too short for ⊕'; return false; }
          if (!unify(a, listOf(lr.items.slice(0, k)), G) || !unify(b, listOf(lr.items.slice(k)), G)) return false; solved = true;
        } else if (lr.closed && !lr.items.length) { if (!unify(a, mk('elist'), G) || !unify(b, mk('elist'), G)) return false; solved = true; // A ⊕ B = ⟨ ⟩: both empty
        } else if (lr.closed && la.items.length > lr.items.length) { G.fail = 'list too short for ⊕'; return false; }
        else keep.push([a, b]);
      }
      const rr = D(r); const all = (rr.apps || []).concat(keep); rr.apps = all.length ? all : null;
    }
    return solved;
  }

  /* ───────── lint: things that compile but are almost certainly not what was meant ───────── */
  function lintTypes(G, err) {
    const declared = t => t === TOP || G.types.has(t);
    // where does a feature live?  a short path from `from` to a type that has it
    const pathTo = (from, f) => {
      const q = [[from, []]]; const seen = new Set([from]);
      while (q.length) {
        const [t, p] = q.shift(); if (p.length > 3) continue;
        let c = null; try { c = G.expC(t); } catch { c = null; }
        if (!c || !c.f) continue;
        if (c.f.has(f) && p.length) return [...p, f];
        for (const [k, v] of c.f) { const nt = D(v).t; if (nt && nt !== TOP && !seen.has(nt) && G.types.has(nt)) { seen.add(nt); q.push([nt, [...p, k]]); } }
      }
      return null;
    };
    const owners = f => [...G.types.values()].filter(T => T.avm && T.avm.k === 'avm' && T.avm.feats.some(r => r.f.split(/[|.]/)[0] === f)).map(T => T.name);
    const checkAtom = (w, where, line) => {
      for (const part of String(w).split(/[()]/).filter(Boolean)) {
        if (!/^[a-z][a-z0-9-]*$/.test(part) || declared(part) || G.abbr.has(part)) continue;
        err('Types', line, `${where}: “${part}” is not a declared type — add  ${part}.  (or ${part} := supertype.)`);
      }
    };
    for (const T of G.types.values()) {
      if (!T.avm || !T.line) continue;
      const walk = (v, ctx, path, root) => {
        if (!v) return;
        if (v.def) walk(v.def, ctx, path, false);
        if (v.k === 'atom') { if (!v.q) checkAtom(v.v, `${T.name} ${path.join('|') || ''}`.trim(), T.line); if (v.avm) walk({ ...v.avm, type: null }, v.v, path, false); return; }
        if (v.k === 'list' || v.k === 'set') { v.items.forEach(x => walk(x, null, path, false)); return; }
        if (v.k === 'app') { v.args.forEach(x => walk(x, null, path, false)); return; }
        if (v.k === 'conj') { v.parts.forEach(x => walk(x, ctx, path, root)); return; }
        if (v.k !== 'avm') return;
        if (v.type) { checkAtom(v.type, `${T.name} ${path.join('|')}`.trim(), T.line); if (declared(v.type)) ctx = v.type; }
        const here = root ? T.name : ctx;
        for (const r of v.feats) {
          const steps = r.f.split(/[|.]/); const f = steps[0];
          if (G.aliases.has(f) && steps.length === 1) { walk(r.v, null, [...path, f], false); continue; }
          let ok = true;
          if (here && here !== TOP) {
            const inherited = root ? T.sups.some(sp => sp !== TOP && G.appropriate(sp, f)) : G.appropriate(here, f);
            if (root && !inherited) {
              // introduced on this type: fine, unless it obviously belongs somewhere else
              const p = pathTo(T.name, f);
              if (p) { err('Types', T.line, `${T.name}: ${f} at the top level adds a new feature to ${T.name}; ${T.name} already has ${f} at ${p.join('|')} — did you mean that?`); ok = false; }
            } else if (!root && !inherited) {
              const p = pathTo(here, f);
              err('Types', T.line, `${T.name}: ${[...path, f].join('|')} — ${f} is not a feature of ${here}${p ? `; it lives at ${[...path, ...p].join('|')}` : owners(f).length ? ` (it belongs to ${owners(f)[0]})` : ''}`);
              ok = false;
            }
          }
          let nctx = null;
          if (ok && here && here !== TOP && steps.length === 1) { try { const dt = G.declaredType(here, f); nctx = dt && dt.t !== TOP ? dt.t : null; } catch { nctx = null; } }
          walk(r.v, nctx, [...path, ...steps], false);
        }
      };
      try { walk(T.avm, T.name, [], true); } catch { /* lint must never break compiling */ }
    }
  }

  /* ───────── AVM ⇄ TFS ───────── */
  function resolveFeat(f, n, ctxType, G, parentFeat = null) {
    if (/[|.]/.test(f)) return f.split(/[|.]/);
    const t = n.t !== TOP ? n.t : ctxType || TOP;
    if (G.appropriate(t, f)) return [f];
    const al = G.aliases.get(f);
    if (!al) return [f];
    // inside the value of a feature on the alias's own path (e.g. HEAD inside SYN [...]): continue from there
    if (parentFeat) { const k = al.lastIndexOf(parentFeat); if (k >= 0 && k < al.length - 1) return al.slice(k + 1); }
    if (t === TOP) return al;
    // start the alias at the first step this type actually has; if it has none, the feature is introduced here
    for (let k = 0; k < al.length; k++) if (G.appropriate(t, al[k])) return al.slice(k);
    return [f];
  }
  function atomNode(w, G, ctx, ctxType) {
    const sm = /^(.+?)_\{?([^}]+)\}?$/.exec(w);
    const base = sm ? sm[1] : w;
    if (G.abbr.has(base) && !G.types.has(base)) {
      const n = toTFS(G.abbr.get(base), G, { tags: new Map() }, ctxType);
      if (sm) {
        if (!ctx.tags.has(sm[2])) ctx.tags.set(sm[2], mk(G.types.has('index') ? 'index' : TOP));
        const at = putPath(n, G.abbrIndex, G);
        if (!unify(at, ctx.tags.get(sm[2]), G)) throw new TfsError(`${w}: ${G.fail}`);
      }
      return n;
    }
    if (ctxType && G.types.has('index') && G.types.has(ctxType) && G.sub(ctxType, 'index') && !G.types.has(w)) {
      const key = 'ix\u0001' + w;
      if (!ctx.tags.has(key)) { const ix = mk(ctxType); ix.vname = w; ctx.tags.set(key, ix); }
      return ctx.tags.get(key);
    }
    const pm = /^([^\s(]+)\(([^)]+)\)$/.exec(w);
    if (pm) { const n = mk(pm[1]); n.el = pm[2]; return n; }
    const n = mk(w);
    return n;
  }
  function putPath(n, path, G) {
    let cur = D(n);
    for (const f of path) {
      let nx = get(cur, f);
      if (!nx) { const dt = G.declaredType(cur.t, f); nx = mk(dt ? dt.t : TOP); if (dt && dt.el) nx.el = dt.el; put(cur, f, nx); }
      cur = D(nx);
    }
    return cur;
  }
  function toTFS(v, G, ctx = { tags: new Map() }, ctxType = null) {
    if (!v) return mk();
    let n;
    switch (v.k) {
      case 'none': n = mk(ctxType && ctxType !== TOP && G.types.has(ctxType) ? ctxType : TOP); break;
      case 'atom': {
        n = v.q ? Object.assign(mk(`"${v.v}"`), { str: true }) : atomNode(v.v, G, ctx, ctxType);
        if (v.avm) { const extra = toTFS({ ...v.avm, type: null }, G, ctx, D(n).t); if (!unify(n, extra, G)) throw new TfsError(`${v.v}[…]: ${G.fail}`); }
        break;
      }
      case 'avm': {
        const abBase = v.type && !G.types.has(v.type) ? v.type.replace(/_\{?[^}]+\}?$/, '') : null;
        if (abBase && G.abbr.has(abBase)) n = atomNode(v.type, G, ctx, ctxType);
        else { n = mk(v.type || TOP); if (v.type && !G.isType(v.type)) n.t = v.type; }
        for (const r of v.feats) {
          const path = resolveFeat(r.f, D(n), ctxType, G, ctx.pf || null);
          const parent = putPath(n, path.slice(0, -1), G);
          const last = path[path.length - 1];
          const dt = parent.t !== TOP || ctxType ? G.declaredType(parent.t !== TOP ? parent.t : ctxType, last) : null;
          const savedPf = ctx.pf; ctx.pf = last;
          let val; try { val = toTFS(r.v, G, ctx, dt ? dt.t : null); } finally { ctx.pf = savedPf; }
          if (dt && dt.el && !D(val).el) D(val).el = dt.el;
          const ex = get(parent, last);
          if (ex) { if (!unify(ex, val, G)) throw new TfsError(`${r.f}: ${G.fail}`); } else put(parent, last, val);
        }
        break;
      }
      case 'list': case 'set': {
        const elT = ctxType && G.types.has(ctxType) ? null : null;
        const items = v.items.map(x => toTFS(x, G, ctx, elT));
        n = listOf(items, v.open ? mk('list') : mk('elist'));
        if (v.k === 'set') D(n).set = true;
        nodesOf(n).forEach(x => { if (x.t === 'nelist' || x.t === 'elist') x.lit = true; });
        break;
      }
      case 'app': n = mk('list'); n.apps = [[toTFS(v.args[0], G, ctx, 'list'), toTFS(v.args[1], G, ctx, 'list')]]; break;
      case 'conj': { n = toTFS(v.parts[0], G, ctx, ctxType); for (const p of v.parts.slice(1)) { const nt = D(n).t; if (!unify(n, toTFS(p, G, ctx, nt !== TOP && G.types.has(nt) ? nt : ctxType), G)) throw new TfsError(G.fail); } break; }
      default: n = mk();
    }
    if (v.def) D(n).def = toTFS(v.def, G, ctx, ctxType);
    if (v.tag) {
      if (ctx.tags.has(v.tag)) { const ex = ctx.tags.get(v.tag); if (!unify(ex, n, G)) throw new TfsError(`#${v.tag}: ${G.fail}`); return ex; }
      ctx.tags.set(v.tag, n);
    }
    return n;
  }
  // list-element type hints (list(synsem)) are applied lazily to items when converting lists
  function typedItems(n, G) { const d = D(n); if (!d.el) return; for (const it of listArr(d, G).items) { const x = D(it); if (x.t === TOP && G.types.has(d.el)) x.t = d.el; x.exp = null; } }

  // TFS → AVM values for several roots at once, with tree-global tags and index letters
  function toAVM(roots, G, o = {}) {
    const refs = new Map();
    const count = (n, seen) => {
      n = D(n); refs.set(n, (refs.get(n) || 0) + 1);
      // a list reached again (e.g. ARG-ST's tail is the COMPS list): its items are reached again too, so they get tags
      if (seen.has(n)) { if (n.t !== TOP && G.sub(n.t, 'list')) for (const it of listArr(n, G).items) { const d = D(it); refs.set(d, (refs.get(d) || 0) + 1); } return; }
      seen.add(n);
      if (n.f) for (const v of n.f.values()) count(v, seen);
      if (n.def) count(n.def, seen);
      if (n.apps) for (const [a, b] of n.apps) { count(a, seen); count(b, seen); }
    };
    const seen = new Set(); roots.forEach(r => r && count(r, seen));
    const tagOf = new Map(); let nextTag = 1;
    const idxName = new Map(); const idxUsed = { ref: 0, sit: 0, other: 0 };
    const REF = 'ijklmnopqruvwxyz';
    const isIndex = t => G.types.has('index') && G.sub(t, 'index');
    const indexName = n => {
      if (idxName.has(n)) return idxName.get(n);
      let name;
      const taken = new Set(idxName.values());
      if (n.vname && !taken.has(n.vname)) { idxName.set(n, n.vname); return n.vname; }
      if (G.types.has('sit-index') && G.sub(n.t, 'sit-index')) name = `s_${++idxUsed.sit}`;
      else name = REF[idxUsed.ref++ % REF.length] + (idxUsed.ref > REF.length ? Math.ceil(idxUsed.ref / REF.length) : '');
      idxName.set(n, name); return name;
    };
    const written = new Set();
    const isElist = n => G.sub(n.t, 'elist');
    const uninformative = (n, declared, depth = 0) => {
      n = D(n);
      if ((refs.get(n) || 0) > 1 || n.def || n.apps || n.vname || depth > 6) return false;
      if (declared && n.t !== declared.t) return false;
      if (!declared && n.t !== TOP) return false;
      if (n.f) for (const [k, v] of n.f) if (!uninformative(v, G.declaredType(n.t, k), depth + 1)) return false;
      return true;
    };
    const rootSet = new Set(roots.filter(Boolean).map(D));
    function conv(n0, declared, top = false) {
      const n = D(n0);
      const shared = (refs.get(n) || 0) > 1;
      // a structure that is itself a tree node is spelled out at that node; elsewhere only its tag appears
      if (!top && rootSet.has(n) && shared) { if (!tagOf.has(n)) tagOf.set(n, String(nextTag++)); return { k: 'none', tag: tagOf.get(n) }; }
      if (isIndex(n.t)) {
        if (!G.sub(n.t, 'index') || n.t === 'index' || n.t === 'ref-index' || n.t === 'sit-index') return { k: 'atom', v: indexName(n) };
        return { k: 'atom', v: n.t };
      }
      let tag = null;
      if (shared) { if (!tagOf.has(n)) tagOf.set(n, String(nextTag++)); tag = tagOf.get(n); if (written.has(n)) return { k: 'none', tag }; written.add(n); }
      let v;
      if (G.sub(n.t, 'list') || n.t === 'list') {
        const la = listArr(n, G);
        if (la.items.length || isElist(la.tail) || G.sub(n.t, 'nelist')) {
          v = { k: n.set ? 'set' : 'list', items: la.items.map(it => conv(it, null)) };
          if (!la.closed) v.open = true;
        } else if (n.apps && n.apps.length) v = { k: 'app', args: [conv(n.apps[0][0]), conv(n.apps[0][1])] };
        else v = { k: 'atom', v: n.el ? `${n.t}(${n.el})` : n.t };
      } else if (n.f && n.f.size) {
        const feats = [];
        for (const [k, val] of n.f) {
          if (o.hide && o.hide.has(k)) continue;
          if (o.compact && uninformative(val, G.declaredType(n.t, k))) continue;
          feats.push({ f: k, v: conv(val, G.declaredType(n.t, k)) });
        }
        const showType = n.t !== TOP && !(o.compact && declared && declared.t === n.t && feats.length);
        v = { k: 'avm', type: showType ? n.t : null, feats };
        if (!feats.length && n.t !== TOP) v = { k: 'atom', v: n.t };
      } else if (n.str) v = { k: 'atom', v: n.t.replace(/^"|"$/g, ''), q: /\s/.test(n.t) };
      else if (n.t === TOP) v = tag ? { k: 'none' } : { k: 'avm', type: null, feats: [] };
      else v = { k: 'atom', v: n.t };
      if (n.def && (n.t === TOP || (declared && n.t === declared.t) || (G.sub(n.t, 'list') && !G.sub(n.t, 'elist') && !G.sub(n.t, 'nelist')))) v.def = conv(n.def);
      if (tag) v.tag = tag;
      return v;
    }
    return roots.map(r => (r ? conv(r, null, true) : null));
  }

  /* ───────── defaults ───────── */
  function ownNodes(root) {
    const out = new Set(); const stack = [root];
    while (stack.length) { const n = D(stack.pop()); if (!n || out.has(n)) continue; out.add(n); if (n.f) for (const [k, v] of n.f) if (k !== 'FIRST') stack.push(v); }
    return out;
  }
  function fillDefaults(root, G) {
    const report = { applied: 0, overridden: [] };
    for (let guard = 0; guard < 200; guard++) {
      const n = [...ownNodes(root)].map(D).find(x => x.def);
      if (!n) break;
      const def = n.def; n.def = null;
      const memo = new Map(); const trialRoot = copy(root, memo); void trialRoot;
      const trialN = memo.get(n) || copy(n);
      const saved = G.fail;
      if (unify(trialN, copy(def), G)) { unify(n, def, G); report.applied++; }
      else report.overridden.push(G.fail);
      G.fail = saved;
    }
    return report;
  }

  /* ───────── lexicon & lexical rules ───────── */
  function variants(v) {
    // expand optional list members: <A, (B)> → <A, B> and <A>
    if (!v || typeof v !== 'object') return [v];
    if (v.k === 'list' || v.k === 'set') {
      let outs = [[]];
      for (const it of v.items) {
        const sub = variants({ ...it, opt: false });
        const next = [];
        for (const o of outs) { for (const s of sub) next.push([...o, s]); if (it.opt) next.push(o); }
        outs = next;
      }
      return outs.map(items => ({ ...v, items }));
    }
    if (v.k === 'avm') {
      let outs = [[]];
      for (const r of v.feats) { const sub = variants(r.v); const next = []; for (const o of outs) for (const s of sub) next.push([...o, { f: r.f, v: s }]); outs = next; }
      return outs.map(feats => ({ ...v, feats }));
    }
    if (v.k === 'app' || v.k === 'conj') {
      const key = v.k === 'app' ? 'args' : 'parts';
      let outs = [[]];
      for (const p of v[key]) { const sub = variants(p); const next = []; for (const o of outs) for (const s of sub) next.push([...o, s]); outs = next; }
      return outs.map(arr => ({ ...v, [key]: arr }));
    }
    return [v];
  }
  function compileLexicon(G, src, err) {
    for (const st of splitStatements(src)) {
      try {
        if (st.s.startsWith('@')) { directive(G, st.s); continue; }
        const m = /^([^\s:=]+)\s*:=\s*([\s\S]+)$/.exec(st.s);
        if (!m) { err('Lexicon', st.line, `Expected  name := type & [ … ].`); continue; }
        const { sups, avm } = splitConj(m[2]);
        const whole = { k: 'avm', type: sups[0] || null, feats: avm ? (avm.k === 'avm' ? avm.feats : []) : [] };
        if (avm && avm.k === 'avm' && avm.type) whole.type = whole.type || avm.type;
        const vs = variants(whole);
        vs.forEach((vv, i) => {
          try {
            let n = toTFS(vv, G, { tags: new Map() });
            for (const s of sups.slice(1)) if (!unify(n, mk(s), G)) throw new TfsError(G.fail);
            if (!expand(n, G)) throw new TfsError(G.fail);
            G.lexicon.push({ name: m[1], variant: vs.length > 1 ? i + 1 : 0, tfs: D(n), line: st.line, stem: stemOf(n, G) || m[1] });
          } catch (e) { err('Lexicon', st.line, `${m[1]}${vs.length > 1 ? ' #' + (i + 1) : ''}: ${e.message}`); }
        });
      } catch (e) { err('Lexicon', st.line, e.message); }
    }
  }
  function stemOf(n, G) {
    const ph = get(D(n), G.paths.PHON[0]); if (!ph) return null;
    const la = listArr(ph, G); const f = la.items[0] && D(la.items[0]);
    return f && f.str ? f.t.replace(/^"|"$/g, '') : null;
  }
  function compileRules(G, src, err) {
    String(src || '').split('\n').forEach((raw, ln) => {
      const line = raw.replace(/^\s*[;#].*$/, '').trim(); if (!line) return;
      const m = /^(.+?)\s*\(\s*([idp])\w*\s*(?:,\s*([^)]*?))?\s*\)\s*:\s*(.+?)\s*(?:=>|⇒)\s*(.+)$/.exec(line);
      if (!m) { err('Lexical rules', ln + 1, 'Expected  Name (i|d|p, morph): [input] => [output]'); return; }
      try {
        const [, name, kind, morph, inp, out] = m;
        const whole = AVM.parse(`[INPUT ${inp}, OUTPUT ${out}]`);
        const vs = variants(whole);
        G.rules.push({ name: name.trim(), kind, morph: (morph || '=').trim(), variants: vs, src: line, line: ln + 1 });
      } catch (e) { err('Lexical rules', ln + 1, e.message); }
    });
  }
  // English-ish morphology with irregular overrides
  function morph(stem, cls, G) {
    if (!cls || cls === '=' || cls === 'base') return stem;
    const irr = G.irreg.get(`${stem}|${cls}`); if (irr) return irr;
    const suf = { '3sg': 's', pl: 's', past: 'ed', psp: 'ed', prp: 'ing', er: 'er' }[cls];
    if (cls.startsWith('+')) return addSuffix(stem, cls.slice(1));
    if (cls.endsWith('+')) return cls.slice(0, -1) + stem;
    return suf ? addSuffix(stem, suf) : stem;
  }
  function addSuffix(stem, suf) {
    const V = /[aeiou]/;
    if (suf === 's') { if (/(s|x|z|ch|sh)$/.test(stem)) return stem + 'es'; if (/[^aeiou]y$/.test(stem)) return stem.slice(0, -1) + 'ies'; return stem + 's'; }
    if (suf === 'ed' || suf === 'er') {
      if (stem.endsWith('e')) return stem + suf.slice(1);
      if (/[^aeiou]y$/.test(stem)) return stem.slice(0, -1) + 'i' + suf;
      if (/^[^aeiou]*[aeiou][bdgklmnprt]$/.test(stem)) return stem + stem.slice(-1) + suf;
      return stem + suf;
    }
    if (suf === 'ing') {
      if (/ie$/.test(stem)) return stem.slice(0, -2) + 'ying';
      if (/[^e]e$/.test(stem) && stem.length > 2) return stem.slice(0, -1) + 'ing';
      if (/^[^aeiou]*[aeiou][bdgklmnprt]$/.test(stem)) return stem + stem.slice(-1) + 'ing';
      return stem + 'ing';
    }
    void V; return stem + suf;
  }
  function setForm(n, form, G) {
    const p = G.paths.PHON;
    const parent = putPath(n, p.slice(0, -1), G);
    const ph = get(parent, p[p.length - 1]);
    const rest = ph ? listArr(ph, G).items.slice(1) : [];
    put(parent, p[p.length - 1], listOf([Object.assign(mk(`"${form}"`), { str: true }), ...rest]));
  }
  // default identity: copy what the output does not determine (not into explicit lists, not into input-shared nodes)
  function inherit(out, inp, G, inputNodes, seen = new Set()) {
    out = D(out); inp = D(inp);
    if (out === inp || seen.has(out) || inputNodes.has(out)) return;
    seen.add(out);
    if (out.def) return; // the output's own default wins over default identity
    const t = G.glb(out.t, inp.t); if (t !== null) out.t = t;
    if (out.lit || out.apps) return;
    if (inp.f) for (const [k, iv] of inp.f) {
      if (!G.appropriate(out.t, k) && out.t !== TOP) continue;
      const ov = get(out, k);
      if (!ov) put(out, k, iv); else inherit(ov, iv, G, inputNodes, seen);
    }
  }
  function applyRule(rule, lexTfs, G) {
    let lastErr = null;
    for (const vv of rule.variants) {
      try {
        const rt = toTFS(vv, G, { tags: new Map() });
        const inp = get(rt, 'INPUT'), out = get(rt, 'OUTPUT');
        if (!unify(inp, copy(lexTfs), G)) { lastErr = `input doesn't match: ${G.fail}`; continue; }
        let res;
        if (rule.kind === 'i') {
          const x = mk(TOP); x.f = new Map(D(inp).f || []);
          if (!unify(out, x, G)) { lastErr = G.fail; continue; }
          res = D(out);
        } else {
          if (!expand(out, G)) { lastErr = G.fail; continue; }
          const inputNodes = nodesOf(inp);
          // nodes shared between input and output by tags are identities already
          inherit(out, inp, G, new Set([...inputNodes].filter(n => nodesOf(out).has(n) && n !== D(out))));
          res = D(out);
        }
        const stem = stemOf(inp, G);
        if (stem) setForm(res, morph(stem, rule.morph, G), G);
        if (!expand(res, G)) { lastErr = G.fail; continue; }
        // detach from the rule's INPUT so the result stands alone
        return { tfs: copy(res) };
      } catch (e) { lastErr = e.message; }
    }
    return { err: lastErr || 'rule does not apply' };
  }
  // every word the lexicon + rules produce
  function generateWords(G, limit = 600) {
    const words = [];
    const isWord = n => G.types.has('word') && G.sub(D(n).t, 'word');
    const isLex = n => !isWord(n);
    const finish = (tfs, chain, entry) => {
      const n = copy(tfs);
      if (!expand(n, G)) return;
      fillDefaults(n, G);
      if (!expand(n, G)) return;
      if (G.principles.caseC && isWord(n) && caseConstraint(n, G).length) return;
      if (G.principles.leafTypes && unresolvable(n, G)) return;
      const form = stemOf(n, G) || entry.name;
      words.push({ form, tfs: D(n), chain, entry: entry.name, variant: entry.variant });
    };
    for (const e of G.lexicon) {
      if (words.length >= limit) break;
      let lexemes = [{ tfs: e.tfs, chain: [] }];
      if (isWord(e.tfs)) { finish(e.tfs, [], e); continue; }
      // derivational closure (depth 2)
      let frontier = lexemes;
      for (let depth = 0; depth < 2; depth++) {
        const next = [];
        for (const lx of frontier.slice(0, 20)) for (const r of G.rules.filter(r => r.kind === 'd')) {
          if (lx.chain.includes(r.name)) continue;
          const a = applyRule(r, lx.tfs, G); if (a.tfs && isLex(a.tfs)) next.push({ tfs: a.tfs, chain: [...lx.chain, r.name] });
        }
        lexemes = lexemes.concat(next); frontier = next;
        if (!next.length) break;
      }
      for (const lx of lexemes) for (const r of G.rules.filter(r => r.kind === 'i')) {
        const a = applyRule(r, lx.tfs, G);
        if (!a.tfs) continue;
        const chain = [...lx.chain, r.name];
        finish(a.tfs, chain, e);
        for (const pr of G.rules.filter(r2 => r2.kind === 'p')) { const b = applyRule(pr, a.tfs, G); if (b.tfs) finish(b.tfs, [...chain, pr.name], e); }
      }
    }
    return words;
  }

  /* ───────── schemata & principles ───────── */
  const DEFAULT_PRINCIPLES = { builtin: true, hfp: true, valence: true, sip: true, scp: true, gap: true, phon: true, caseC: false, binding: false, aap: false, coordForm: false, headOnly: true, leafTypes: false };
  const SCHEMATA = [
    { id: 'hd-comp', name: 'Head-Complement', type: 'hd-comp-ph' },
    { id: 'hd-spr', name: 'Head-Specifier', type: 'hd-spr-ph' },
    { id: 'hd-mod', name: 'Head-Modifier', type: 'hd-mod-ph' },
    { id: 'hd-fill', name: 'Head-Filler', type: 'hd-fill-ph' },
    { id: 'coord', name: 'Coordination', type: 'coord-ph' },
    { id: 'hd-only', name: 'Head-Only', type: 'hd-only-ph' },
  ];
  // mother = combine(daughters) in one graph; returns {mother} or {err}
  function combine(dtrs, headIdx, schemaId, G) {
    const P = G.paths, pr = G.principles;
    const at = (n, p) => putPath(n, p, G);
    const fail = m => ({ err: m });
    const H = dtrs[headIdx], NH = dtrs.filter((_, i) => i !== headIdx);
    const sch = SCHEMATA.find(s => s.id === schemaId);
    const M = mk(G.types.has(sch.type) ? sch.type : G.types.has('phrase') ? 'phrase' : TOP);
    const u = (a, b, what) => { if (!unify(a, b, G)) throw new TfsError(`${what}: ${G.fail}`); };
    try {
      if (!expand(M, G)) return fail(G.fail);
      const vset = new Set();
      if (schemaId === 'hd-comp') {
        if (G.types.has('word') && !G.sub(D(H).t, 'word')) return fail('the head of a Head-Complement phrase must be a word');
        const lc = listArr(at(H, P.COMPS), G);
        if (lc.items.length < NH.length) return fail(`the head wants ${lc.items.length} complement(s), found ${NH.length}`);
        if (pr.headOnly === false && lc.closed && lc.items.length !== NH.length) return fail(`the head wants ${lc.items.length} complement(s), found ${NH.length} (a Head-Complement phrase takes all of them)`);
        if (dtrs.indexOf(H) !== 0) return fail('complements follow the head');
        if (pr.headOnly === false && NH.length === 0 && !lc.closed) return fail('the head\'s COMPS is not known to be empty');
        NH.forEach((d, i) => u(lc.items[i], d, `complement ${i + 1}`));
        u(at(M, P.COMPS), listOf([], lc.items.length > NH.length ? listOf(lc.items.slice(NH.length), lc.tail) : lc.tail), 'COMPS'); vset.add('COMPS');
      } else if (schemaId === 'hd-spr') {
        if (NH.length !== 1 || headIdx !== 1) return fail('Head-Specifier: one specifier, then the head');
        const ls = listArr(at(H, P.SPR), G);
        if (!ls.items.length) return fail('the head takes no specifier');
        const lc = listArr(at(H, P.COMPS), G); if (lc.items.length) return fail('the head still wants complements');
        u(ls.items[0], NH[0], 'specifier'); u(at(M, P.SPR), mk('elist'), 'SPR'); vset.add('SPR');
      } else if (schemaId === 'hd-mod') {
        if (NH.length !== 1) return fail('Head-Modifier: one modifier');
        const lm = listArr(at(NH[0], P.MOD), G);
        if (!lm.items.length) return fail('the non-head is not a modifier (empty MOD)');
        u(lm.items[0], H, 'MOD');
      } else if (schemaId === 'hd-fill') {
        if (NH.length !== 1 || headIdx !== 1) return fail('Head-Filler: filler, then the head');
        const lg = listArr(at(H, P.GAP), G); if (!lg.items.length) return fail('the head has an empty GAP');
        u(lg.items[0], NH[0], 'filler'); u(at(M, P.GAP), listOf(lg.items.slice(1), lg.tail), 'GAP'); vset.add('GAP');
      } else if (schemaId === 'coord') {
        const isConj = d => G.types.has('conj') && G.sub(D(at(d, P.HEAD)).t, 'conj');
        const conjs = dtrs.filter(d => !isConj(d)), cw = dtrs.find(isConj);
        if (conjs.length < 2 || !cw) return fail('Coordination needs two conjuncts and a conjunction');
        for (const c of conjs) u(at(M, P.SPR.slice(0, -1)), at(c, P.SPR.slice(0, -1)), 'VAL');
        if (pr.coordForm) {
          for (const c of conjs) u(at(M, P.FORM), at(c, P.FORM), 'Coordination (FORM)');
          const t0 = D(at(conjs[0], P.HEAD)).t; if (conjs.every(c => D(at(c, P.HEAD)).t === t0)) u(at(M, P.HEAD), mk(t0), 'Coordination (part of speech)');
          u(at(M, P.INDEX), at(cw, P.INDEX), 'Coordination (INDEX)');
          const rs = listArr(at(cw, P.RESTR), G);
          if (rs.items.length) u(at(rs.items[0], ['ARGS']), listOf(conjs.map(c => at(c, P.INDEX)), mk('elist')), 'Coordination (ARGS)');
        } else u(at(M, P.HEAD), at(conjs[0], P.HEAD), 'HEAD');
        vset.add('SPR'); vset.add('COMPS');
      } else if (schemaId === 'hd-only') {
        if (dtrs.length !== 1) return fail('Head-Only: exactly one daughter');
      }
      if (schemaId !== 'coord') {
        if (pr.hfp) u(at(M, P.HEAD), at(H, P.HEAD), 'Head Feature Principle');
        if (pr.valence) { if (!vset.has('SPR')) u(at(M, P.SPR), at(H, P.SPR), 'Valence Principle (SPR)'); if (!vset.has('COMPS')) u(at(M, P.COMPS), at(H, P.COMPS), 'Valence Principle (COMPS)'); if (schemaId !== 'hd-mod') u(at(M, P.MOD), at(H, P.MOD), 'Valence Principle (MOD)'); }
        if (pr.sip) { u(at(M, P.MODE), at(H, P.MODE), 'Semantic Inheritance (MODE)'); u(at(M, P.INDEX), at(H, P.INDEX), 'Semantic Inheritance (INDEX)'); }
      }
      const appendAll = (path, nodes) => nodes.reduceRight((acc, d) => { const r = mk('list'); r.apps = [[at(d, path), acc]]; return r; }, mk('elist'));
      if (pr.scp) u(at(M, P.RESTR), appendAll(P.RESTR, dtrs), 'Semantic Compositionality');
      if (pr.phon) u(at(M, P.PHON), appendAll(P.PHON, dtrs), 'PHON');
      if (pr.gap && !vset.has('GAP') && G.appropriate(D(M).t, P.GAP[0])) u(at(M, P.GAP), appendAll(P.GAP, dtrs), 'GAP Principle');
      if (!expand(M, G)) return fail(G.fail);
      fillDefaults(M, G);
      if (pr.leafTypes) { const bad = unresolvable(M, G); if (bad) return fail(`no leaf type: ${bad}`); }
      return { mother: D(M), schema: sch };
    } catch (e) { return fail(e.message); }
  }
  // try schemata (and head positions) until one works; branch label 'H' fixes the head
  function autoCombine(dtrs, G, headHint = null) {
    const tries = [];
    const heads = headHint != null ? [headHint] : dtrs.map((_, i) => i);
    for (const s of SCHEMATA) for (const h of heads) {
      if (s.id === 'hd-only' && dtrs.length !== 1) continue;
      if (s.id !== 'hd-only' && dtrs.length === 1) continue;
      const memo = new Map();
      const cp = dtrs.map(d => copy(d, memo));
      const r = combine(cp, h, s.id, G);
      if (r.mother) return { ...r, head: h, dtrs: cp, memo };
      tries.push(`${s.name} (head ${h + 1}): ${r.err}`);
    }
    return { err: tries.length ? tries.join('\n') : 'no schema applies' };
  }

  /* ───────── total well-typedness: every node can be resolved to a leaf type (SWB (32b)) ───────── */
  function leavesOf(t, G) {
    if (!G.leafCache) G.leafCache = new Map();
    if (G.leafCache.has(t)) return G.leafCache.get(t);
    const out = []; const stack = [t]; const seen = new Set();
    while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); const subs = (G.subs.get(x) || []).filter(y => !(G.types.has('rule') && G.sub(y, 'rule'))); if (!subs.length) { if (x !== t) out.push(x); } else stack.push(...subs); }
    G.leafCache.set(t, out); return out;
  }
  function unresolvable(root, G) {
    for (const n0 of nodesOf(root)) {
      const n = D(n0);
      if (!n.f || !n.f.size || n.t === TOP || n.lit || G.sub(n.t, 'list') || G.sub(n.t, 'rule')) continue;
      const leaves = leavesOf(n.t, G); if (!leaves.length) continue;
      const ok = leaves.some(L => { const c = copy(n); const saved = G.fail; const r = unify(c, mk(L), G) && expand(c, G); G.fail = saved; return r; });
      if (!ok) return `${n.t} [${[...n.f.keys()].join(', ')}] fits none of its subtypes (${leaves.join(', ')})`;
    }
    return null;
  }

  /* ───────── principles stated over ARG-ST and coindexation (SWB ch. 9) ───────── */
  const valAt = (n, p) => { let c = D(n); for (const f of p) { c = c && get(c, f); c = c && D(c); if (!c) return null; } return c; };
  const isNounish = (n, G) => { const h = valAt(n, G.paths.HEAD); return !!(h && G.types.has('noun') && G.sub(h.t, 'noun')); };
  // Case Constraint: an outranked NP (any ARG-ST member after the first) is [CASE acc]
  function caseConstraint(w, G) {
    const out = []; const as = valAt(w, G.paths.ARGST); if (!as || !G.types.has('acc')) return out;
    listArr(as, G).items.forEach((it, k) => {
      if (k === 0 || !isNounish(it, G)) return;
      if (!unify(putPath(it, G.paths.CASE, G), mk('acc'), G)) out.push(`Case Constraint: argument ${k + 1} is outranked, so it must be [CASE acc] — ${G.fail}`);
    });
    return out;
  }
  // after a whole tree is built: Case Constraint, Binding Theory (A, B) and Anaphoric Agreement
  function checkRoot(rootTfs, G) {
    if (!G.root || !rootTfs) return null;
    try { const want = toTFS(G.root, G, { tags: new Map() }); if (!unify(rootTfs, want, G) || !expand(rootTfs, G)) return `Initial symbol (@root): the root must be ${AVM.str(G.root)} — ${G.fail}`; }
    catch (e) { return `Initial symbol (@root): ${e.message}`; }
    return null;
  }
  function checkTree(roots, G) {
    const pr = G.principles, out = [];
    if (!pr.caseC && !pr.binding && !pr.aap) return out;
    const isWordN = n => G.types.has('word') && G.sub(D(n).t, 'word');
    for (const [id, r] of roots) {
      if (!isWordN(r)) continue;
      if (pr.caseC) caseConstraint(r, G).forEach(m => out.push({ id, msg: m }));
      if (pr.binding) {
        const as = valAt(r, G.paths.ARGST); if (!as) continue;
        const items = listArr(as, G).items;
        items.forEach((it, k) => {
          const mode = valAt(it, G.paths.MODE), idx = valAt(it, G.paths.INDEX); if (!mode || !idx) return;
          const outranked = items.slice(0, k).some(e => valAt(e, G.paths.INDEX) === idx);
          if (mode.t === 'ana' && !outranked) out.push({ id, msg: `Binding Theory, Principle A: argument ${k + 1} is [MODE ana] but no coindexed argument outranks it` });
          if (mode.t === 'ref' && outranked) out.push({ id, msg: `Binding Theory, Principle B: argument ${k + 1} is [MODE ref] but a coindexed argument outranks it` });
        });
      }
    }
    if (pr.aap) {
      // coindexed NPs agree: identify the AGR of every noun-headed sign that shares an INDEX
      const seen = new Set(), groups = new Map();
      const visit = (n, owner) => {
        n = D(n); if (!n || seen.has(n)) return; seen.add(n);
        if (isNounish(n, G)) { const ix = valAt(n, G.paths.INDEX); if (ix) { if (!groups.has(ix)) groups.set(ix, []); groups.get(ix).push({ n, owner }); } }
        if (n.f) for (const v of n.f.values()) visit(v, owner);
      };
      for (const [id, r] of roots) visit(r, id);
      for (const list of groups.values()) {
        for (let k = 1; k < list.length; k++) {
          const a = putPath(list[0].n, G.paths.AGR, G), b = putPath(list[k].n, G.paths.AGR, G);
          if (!unify(a, b, G)) { out.push({ id: list[k].owner, msg: `Anaphoric Agreement Principle: coindexed NPs must agree — ${G.fail}` }); break; }
        }
      }
    }
    return out;
  }

  /* ───────── tree-level: global tags, build a mother, write back ───────── */
  // nodes: [{id, avm (AVM value)}] → Map id → root (tags shared across the whole tree)
  function readTree(nodes, G, given = null) {
    const ctx = { tags: new Map() }; const roots = new Map(); const errors = new Map();
    for (const nd of nodes) {
      if (given && given.has(nd.id)) { roots.set(nd.id, copy(given.get(nd.id))); continue; }
      if (!nd.avm) continue;
      try { const r = toTFS(nd.avm, G, ctx); roots.set(nd.id, r); }
      catch (e) { errors.set(nd.id, e.message); }
    }
    for (const [id, r] of roots) { try { if (!expand(r, G)) { errors.set(id, G.fail); roots.delete(id); } } catch (e) { errors.set(id, e.message); roots.delete(id); } }
    for (const [id, r] of roots) roots.set(id, D(r));
    return { roots, errors };
  }
  // build the mother `mid` from daughters `cids` (in order); every root is copied together so sharing stays intact
  function userRules(G) { return [...G.types.keys()].filter(t => t !== 'rule' && G.sub(t, 'rule') && !(G.subs.get(t) || []).length); }
  function buildAt(roots, mid, cids, G, headHint = null) {
    const tries = [];
    // 1. grammar rules written as types: rule & [ARGS <d1, d2, …>] — the rule itself is the mother
    for (const t of userRules(G)) {
      const memo = new Map(); const cp = new Map();
      for (const [id, r] of roots) cp.set(id, copy(r, memo));
      const dtrs = cids.map(id => cp.get(id));
      if (dtrs.some(d => !d)) return { err: 'every daughter needs a feature structure first' };
      const rt = copy(G.expC(t));
      const la = listArr(get(rt, 'ARGS') || mk('list'), G);
      if (la.closed && la.items.length !== dtrs.length) { tries.push(`${t}: takes ${la.items.length} daughter(s)`); continue; }
      let ok = true;
      for (let i = 0; i < dtrs.length && ok; i++) { const slot = la.items[i]; if (!slot || !unify(slot, dtrs[i], G)) { tries.push(`${t}: daughter ${i + 1} — ${G.fail || 'no slot'}`); ok = false; } }
      if (!ok) continue;
      if (!expand(rt, G)) { tries.push(`${t}: ${G.fail}`); continue; }
      fillDefaults(rt, G);
      if (G.principles.leafTypes) { const bad = unresolvable(rt, G); if (bad) { tries.push(`${t}: no leaf type: ${bad}`); continue; } }
      const own = cp.get(mid);
      if (own && (!unify(rt, own, G) || !expand(rt, G))) { tries.push(`${t}: clashes with this node's own description — ${G.fail}`); continue; }
      const m = D(rt); if (m.f) m.f.delete('ARGS');
      cp.set(mid, m); for (const [id, x] of cp) cp.set(id, D(x));
      return { roots: cp, schema: { id: t, name: t }, head: null };
    }
    if (G.principles.builtin === false) return { err: tries.join('\n') || 'no grammar rule (subtype of rule) applies' };
    const heads = headHint != null ? [headHint] : cids.map((_, i) => i);
    for (const s of SCHEMATA) for (const h of heads) {
      if (G.principles.headOnly === false) { if (s.id === 'hd-only') continue; if (cids.length === 1 && s.id !== 'hd-comp') continue; }
      else if ((s.id === 'hd-only') !== (cids.length === 1)) continue;
      const memo = new Map(); const cp = new Map();
      for (const [id, r] of roots) cp.set(id, copy(r, memo));
      const dtrs = cids.map(id => cp.get(id));
      if (dtrs.some(d => !d)) return { err: 'every daughter needs a feature structure first' };
      const r = combine(dtrs, h, s.id, G);
      if (!r.mother) { tries.push(`${s.name}${heads.length > 1 ? ` (head = daughter ${h + 1})` : ''}: ${r.err}`); continue; }
      const own = cp.get(mid);
      if (own && !unify(r.mother, own, G)) { tries.push(`${s.name}: clashes with this node's own description — ${G.fail}`); continue; }
      if (own && !expand(r.mother, G)) { tries.push(`${s.name}: ${G.fail}`); continue; }
      cp.set(mid, D(r.mother));
      for (const [id, x] of cp) cp.set(id, D(x));
      return { roots: cp, schema: s, head: h };
    }
    return { err: tries.join('\n') || 'no schema applies' };
  }
  function writeTree(roots, order, G, o = {}) {
    const ids = order.filter(id => roots.has(id));
    const vals = toAVM(ids.map(id => roots.get(id)), G, o);
    const out = new Map(); ids.forEach((id, i) => out.set(id, vals[i]));
    return out;
  }

  /* ───────── abbreviation labels ───────── */
  function subsumes(g, s, G, seen = new Set()) {
    g = D(g); s = D(s);
    if (seen.has(g)) return true; seen.add(g);
    if (!G.sub(s.t, g.t)) return false;
    if (g.f) for (const [k, gv] of g.f) { const sv = get(s, k); if (!sv) return false; if (!subsumes(gv, sv, G, seen)) return false; }
    return true;
  }
  function labelFits(name, n, G) {
    labelFor(mk(TOP), G);
    const base = String(name || '').replace(/_\{?[^}]+\}?$/, '');
    const a = (G.abbrTfs || []).find(x => x[0] === base);
    return !!(a && subsumes(a[1], n, G));
  }
  function labelFor(n, G) {
    if (!G.abbrTfs) { G.abbrTfs = []; for (const [name, avm] of G.abbr) { try { G.abbrTfs.push([name, toTFS(avm, G, { tags: new Map() })]); } catch { /* skip */ } } }
    for (const [name, a] of G.abbrTfs) if (subsumes(a, n, G)) return name;
    return null;
  }

  return {
    TOP, TfsError, compile, toTFS, toAVM, unify, expand, copy, fillDefaults, generateWords, applyRule, combine, autoCombine,
    labelFor, labelFits, checkRoot, listArr, D, get, SCHEMATA, readTree, buildAt, writeTree, checkTree, caseConstraint, stemOf, splitStatements, splitConj, DEFAULT_PRINCIPLES, mk, nodesOf, solveApps, typedItems,
  };
})();
if (typeof module !== 'undefined') module.exports = TFS;
