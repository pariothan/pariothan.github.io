/* Treditor — theory compiler and compositional semantics engine. */
'use strict';
const Sem = (() => {
  const { parseType, parseTerm, infer, normalize, instantiate, unify, resolve, freshen, typeStr, B } = Logic;

  function splitTopCommas(s) { return Logic.splitTop(s, ','); }
  function regexOrNull(src, flags = 'u') { if (!src) return null; try { return new RegExp(src, flags); } catch { return null; } }

  // Variable naming conventions:  "x, y, z : e"   or   "/^w\d*$/ : s"
  function parseConventions(src) {
    const out = []; const errors = [];
    String(src || '').split('\n').forEach((raw, ln) => {
      const line = raw.replace(/^\s*#.*$/, '').trim();
      if (!line) return;
      const i = line.lastIndexOf(':');
      if (i < 0) { errors.push({ line: ln + 1, msg: 'Expected  names : type' }); return; }
      const lhs = line.slice(0, i).trim(), rhs = line.slice(i + 1).trim();
      try {
        const type = parseType(rhs);
        let re;
        const rm = /^\/(.+)\/$/.exec(lhs);
        if (rm) re = new RegExp(rm[1], 'u');
        else {
          const names = lhs.split(/[\s,]+/).filter(Boolean).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          re = new RegExp(`^(${names.join('|')})(_?\\d+)?'*$`, 'u');
        }
        out.push({ re, type });
      } catch (e) { errors.push({ line: ln + 1, msg: e.message }); }
    });
    return { list: out, errors };
  }

  // Composition rules:   Name {label=REGEX; fixed}: pat, pat => template
  function parseComposition(src, base) {
    const rules = []; const errors = [];
    String(src || '').split('\n').forEach((raw, ln) => {
      const line = raw.replace(/^\s*(#|\/\/).*$/, '').trim();
      if (!line) return;
      const m = /^([^:{]+?)\s*(?:\{([^}]*)\})?\s*:\s*(.*?)\s*(=>|⇒)\s*(.+)$/u.exec(line);
      if (!m) { errors.push({ line: ln + 1, msg: 'Expected  Name: type, type => template' }); return; }
      const opts = {};
      (m[2] || '').split(';').map(s => s.trim()).filter(Boolean).forEach(o => {
        const kv = /^(\w+)\s*=\s*(.*)$/.exec(o);
        if (kv) opts[kv[1]] = kv[2]; else opts[o] = true;
      });
      const pats = splitTopCommas(m[3]);
      try {
        pats.forEach(p => { if (p !== 'idx' && p !== '*') parseType(p, { pattern: true, base }); });
        const tplSrc = m[5].trim();
        parseTerm(tplSrc.replace(/\$i/g, '1'));
        rules.push({
          name: m[1].trim(), pats, tpl: tplSrc, label: regexOrNull(opts.label), fixed: !!opts.fixed,
          desc: opts.desc || '', line: ln + 1,
        });
      } catch (e) { errors.push({ line: ln + 1, msg: e.message }); }
    });
    return { rules, errors };
  }

  function parseCategories(src) {
    const cats = [];
    String(src || '').split('\n').forEach(raw => {
      const line = raw.trim(); if (!line || line.startsWith('#') && !/^#[0-9a-f]{3,8}$/i.test(line)) return;
      const m = /^(.+?)(?:\s+(#[0-9a-fA-F]{3,8}|[a-z]+\(.*\)))?\s*$/.exec(line);
      if (m) cats.push({ label: m[1], color: m[2] || null });
    });
    return cats;
  }

  /* Compile a theory (plain JSON) into everything the editor needs */
  function compile(th) {
    const errors = [];
    const push = (section, list) => list.forEach(e => errors.push({ section, ...e }));
    const base = new Set(String(th.baseTypes || 'e t').split(/[\s,]+/).filter(Boolean));
    const conv = parseConventions(th.varTypes); push('Variable types', conv.errors);
    const convFn = name => { for (const c of conv.list) if (c.re.test(name)) return c.type; return null; };
    const gram = Tree.parseGrammar(th.grammar); push('Grammar', gram.errors);
    const lex = Tree.parseLexicon(th.lexicon); push('Lexicon', lex.errors);
    const comp = parseComposition(th.composition, base); push('Composition', comp.errors);
    const rew = Tree.parseRewrite(th.rewrite); push('Transformations', rew.errors);
    const cats = parseCategories(th.categories);
    const stripRe = regexOrNull(th.labelStrip || '');
    const traceRe = regexOrNull(th.traceRegex || '');
    const indexRe = regexOrNull(th.indexRegex || '');
    const strip = l => (stripRe ? l.replace(stripRe, '') : l);
    const isTrace = l => !!(traceRe && traceRe.test(l));
    const isIndex = l => !!(indexRe && indexRe.test(l));

    // lexical semantics; collect constant types
    const consts = new Map();
    const tctx = { conv: convFn, consts, style: th.display && th.display.typeStyle };
    const lexSem = [];
    for (let pass = 0; pass < 2; pass++) {
      lexSem.length = 0;
      for (const e of lex.entries) {
        const out = { ...e, vacuous: false, term: null, typeObj: null, err: null };
        lexSem.push(out);
        if (/^(vacuous|_|∅)$/i.test(e.type) || e.term === '_') { out.vacuous = true; continue; }
        if (!e.type && !e.term) continue;
        try {
          const declared = e.type ? parseType(e.type) : null;
          const termSrc = e.term || sanitizeConst(e.word);
          const term = parseTerm(termSrc);
          const r = infer(term, tctx);
          let ty = r.type;
          if (declared) {
            const S = new Map();
            if (!unify(r.type, declared, S)) throw new TypeError(`term has type ${typeStr(r.type)}, but entry declares ${typeStr(declared)}`);
            ty = resolve(declared, S);
            for (const [k, v] of r.free) { const rv = resolve(v, S); if (!Logic.hasVars(rv) && !consts.has(k)) consts.set(k, rv); }
          } else {
            for (const [k, v] of r.free) if (!Logic.hasVars(v) && !consts.has(k)) consts.set(k, v);
          }
          out.term = term; out.typeObj = ty;
        } catch (err) {
          out.err = err.message;
          if (pass === 1) errors.push({ section: 'Lexicon', line: e.line, msg: `${e.word}: ${err.message}` });
        }
      }
    }
    const model = Logic.parseModel(th.model, consts); push('Model', model.errors);

    return {
      th, base, conv: convFn, gram, lex, lexSem, comp, rew, cats, strip, isTrace, isIndex,
      traceRe, indexRe, consts, tctx, model, errors,
    };
  }
  function sanitizeConst(w) {
    const s = w.toLowerCase().replace(/[^\p{L}\p{N}_']+/gu, '_').replace(/^_+|_+$/g, '');
    return /^[\p{L}_]/u.test(s) ? s : 'c_' + s;
  }

  /* Compute denotations bottom-up for the whole forest.
     Returns Map(id -> info) and a post-order list for animation. */
  function compute(doc, C) {
    const out = new Map(); const order = [];
    const th = C.th;
    const tyStyle = (th.display && th.display.typeStyle) || 'angle';
    const tStr = t => typeStr(t, tyStyle);
    function lexLookup(word, parentLabel) {
      let es = C.lexSem.filter(e => e.word === word);
      if (!es.length) es = C.lexSem.filter(e => e.word.toLowerCase() === word.toLowerCase());
      if (!es.length) return null;
      const pl = parentLabel != null ? C.strip(parentLabel) : null;
      return es.find(e => e.cat === pl && (e.term || e.vacuous)) || es.find(e => e.term || e.vacuous) || es[0];
    }
    function finish(n, info) { out.set(n.id, info); order.push(n.id); return info; }
    function mkInfo(term, rule, why) {
      const r = infer(term, C.tctx);
      const red = normalize(term);
      return { term, red, type: r.type, tyStr: tStr(r.type), rule, why };
    }
    function rec(n, parent) {
      const kids = n.ch.map(c => rec(c, n));
      // index nodes (binders for predicate abstraction)
      if (C.isIndex(n.label) && !n.ch.length) {
        const m = C.indexRe.exec(n.label);
        return finish(n, { idx: m[1] !== undefined ? m[1] : n.label, rule: 'Index', why: 'Index node: binds a variable in its sister (Predicate Abstraction)' });
      }
      // traces & pronouns
      const traceLab = n.silent && !C.isTrace(n.label) ? null : n.label;
      if (traceLab != null && C.isTrace(traceLab) && (!n.ch.length || n.ch.every(c => !c.ch.length))) {
        const m = C.traceRe.exec(traceLab);
        const idx = m[1] !== undefined ? m[1] : '';
        try {
          const term = parseTerm(String(th.traceTerm || 'x$1').replace(/\$1/g, idx));
          return finish(n, mkInfo(term, 'Traces & Pronouns', `⟦${n.label}⟧ᵍ = g(${idx}) — interpreted as the variable ${Logic.show(term)}`));
        } catch (e) { return finish(n, { err: e.message }); }
      }
      if (n.silent && n.ch.length) {
        const m = /_(\d+)/.exec(n.label);
        if (m && th.traceTerm) {
          try { return finish(n, mkInfo(parseTerm(String(th.traceTerm).replace(/\$1/g, m[1])), 'Traces & Pronouns', `Unpronounced copy interpreted as a bound variable (trace conversion)`)); } catch { /* ignore */ }
        }
        return finish(n, { vac: true, rule: 'Silent', why: 'Unpronounced copy: ignored by interpretation' });
      }
      if (!n.ch.length) {
        if (n.silent) return finish(n, { vac: true, rule: 'Silent', why: 'Unpronounced copy: ignored by interpretation' });
        const e = lexLookup(n.label, parent && parent.label);
        if (e) {
          if (e.vacuous) return finish(n, { vac: true, rule: 'Vacuous', why: `“${n.label}” is semantically vacuous` });
          if (e.err) return finish(n, { err: `Lexicon: ${e.err}` });
          if (e.term) return finish(n, { term: e.term, red: normalize(e.term), type: e.typeObj, tyStr: tStr(e.typeObj), rule: 'Terminal Node', why: `Lexicon: ⟦${n.label}⟧ = ${Logic.show(e.term, { lambda: th.display && th.display.lambda })}` });
        }
        const fb = th.leafFallback || 'none';
        if (fb !== 'none') {
          try {
            const term = fb === 'term' ? parseTerm(n.label) : { k: 'id', n: sanitizeConst(n.label) };
            return finish(n, mkInfo(term, 'Terminal Node', 'Leaf interpreted directly as a term'));
          } catch { /* fall through */ }
        }
        if (e) return finish(n, { none: true, why: `“${n.label}” has no semantic entry` });
        return finish(n, { none: true, why: `“${n.label}” is not in the lexicon` });
      }
      // roofed phrase with a lexical entry for the whole yield
      if (n.roof) {
        const y = Tree.yieldOf(n).join(' ');
        const e = lexLookup(y, n.label);
        if (e && e.term) return finish(n, { term: e.term, red: normalize(e.term), type: e.typeObj, tyStr: tStr(e.typeObj), rule: 'Terminal Node', why: `Lexicon: ⟦${y}⟧` });
      }
      const bad = kids.find(k => k.err || k.none);
      if (bad) return finish(n, { err: bad.err ? 'A daughter has a type or lexicon error' : 'A daughter has no denotation', blocked: true });
      const live = kids.filter(k => !k.vac);
      if (!live.length) return finish(n, { vac: true, rule: 'Vacuous', why: 'All daughters are vacuous' });
      const tried = [];
      for (const rule of C.comp.rules) {
        if (rule.pats.length !== live.length) continue;
        if (rule.label && !rule.label.test(n.label)) continue;
        const perms = rule.fixed || live.length > 4 ? [live] : permutations(live);
        for (const perm of perms) {
          const S = new Map(); const varMap = new Map();
          let ok = true; let idx = null;
          for (let i = 0; i < perm.length && ok; i++) {
            const p = rule.pats[i], k = perm[i];
            if (p === 'idx') { if (k.idx == null) ok = false; else idx = k.idx; continue; }
            if (k.idx != null || !k.term) { ok = false; continue; }
            if (p === '*') continue;
            const pt = parseType(p, { pattern: true, base: C.base, varMap });
            if (!unify(pt, freshen(k.type), S)) ok = false;
          }
          if (!ok) continue;
          try {
            const tplSrc = rule.tpl.replace(/\$i/g, idx != null ? idx : '');
            const tpl = parseTerm(tplSrc);
            const metas = perm.map(k => k.red || null);
            // binders built from $i (e.g. λx$i) are meant to capture: Predicate Abstraction
            const binding = new Set();
            const bre = /([\p{L}_][\p{L}\p{N}_']*)?\$i([\p{L}\p{N}_']*)/gu; let bm;
            while ((bm = bre.exec(rule.tpl))) binding.add((bm[1] || '').replace(/^[λι∀∃]+/u, '') + (idx != null ? idx : '') + (bm[2] || ''));
            const term = instantiate(tpl, metas, binding);
            const info = mkInfo(term, rule.name, rule.desc || describe(rule, perm, n));
            info.inputs = perm.map(k => k);
            return finish(n, info);
          } catch (e) { tried.push(`${rule.name}: ${e.message}`); }
        }
      }
      const types = live.map(k => (k.idx != null ? 'index ' + k.idx : k.tyStr)).join(' + ');
      return finish(n, { err: `No composition rule applies to ${types}${tried.length ? ' (' + tried.join('; ') + ')' : ''}`, typeClash: true });
    }
    doc.roots.forEach(r => rec(r, null));
    return { info: out, order };
  }
  function describe(rule, perm) {
    const nm = rule.name;
    if (/^FA|Function Application/i.test(nm)) return 'Function Application: the function daughter applies to its sister';
    if (/^PM|Predicate Modification/i.test(nm)) return 'Predicate Modification: two ⟨e,t⟩ predicates are intersected';
    if (/^PA|Predicate Abstraction|Lambda Abstraction/i.test(nm)) return 'Predicate Abstraction: the index binds the trace variable in its sister';
    if (/^NN|Non-?branching/i.test(nm)) return 'Non-branching Node: inherits the denotation of its only daughter';
    return `${nm}: ${rule.pats.join(' + ')} ⇒ ${rule.tpl}`;
  }
  function permutations(a) {
    if (a.length <= 1) return [a];
    const out = [];
    a.forEach((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).forEach(p => out.push([x, ...p])));
    return out;
  }

  return { compile, compute, parseConventions, parseComposition, parseCategories, sanitizeConst };
})();
if (typeof module !== 'undefined') module.exports = Sem;
