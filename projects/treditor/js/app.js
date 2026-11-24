/* Treditor — application: rendering, interaction, derivations, panels. */
'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = Logic.esc;
  const deep = o => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode etc. */ } },
  };
  const T = Tree;
  const COLORS = ['red', 'orange', 'green', 'blue', 'purple', 'gray'];

  /* ═════════════ State ═════════════ */
  const S = {
    doc: { roots: [], arrows: [] }, theory: null, presetId: 'syn', C: null,
    sem: null, vals: new Map(), issues: new Map(), layout: null,
    sel: [], selArrow: null, undo: [], redo: [], clip: null, clipText: '',
    deriv: { steps: [], cur: -1, rec: false }, playing: false,
    view: { x: 40, y: 40, k: 1 }, reveal: null, pulse: null,
    parse: { results: [], i: 0 },
    features: { sem: false, gram: false, tx: false, deriv: false, avm: false },
    pick: null, spaceDown: false,
  };
  const disp = () => S.theory.display;
  const speed = () => parseFloat($('#tlSpeed').value) || 1;
  const arrowsOf = doc => (doc.arrows || (doc.arrows = []));

  /* ═════════════ Hints (off by default; ? or the help screen turns them on) ═════════════ */
  const hintsOn = () => document.body.classList.contains('show-hints');
  function setHints(on) { document.body.classList.toggle('show-hints', on); store.set('arbor.hints', on ? '1' : ''); const cb = $('#hintsToggle'); if (cb) cb.checked = on; renderInspector(); }
  if (store.get('arbor.hints') === '1') document.body.classList.add('show-hints');

  /* ═════════════ Features ═════════════ */
  function loadFeatures() { try { Object.assign(S.features, JSON.parse(store.get('arbor.features') || '{}')); } catch { /* ignore */ } }
  function applyFeatures() {
    const f = S.features, b = document.body.classList;
    b.toggle('f-avm', !!f.avm); b.toggle('f-hpsg', isHpsg()); b.toggle('f-sem', !!f.sem); b.toggle('f-gram', !!f.gram); b.toggle('f-tx', !!f.tx); b.toggle('f-deriv', !!f.deriv);
    b.toggle('f-adv', !!(f.sem || f.gram || f.tx || f.avm));
    $$('[data-feature]').forEach(el => { el.checked = !!f[el.dataset.feature]; });
    const cur = $('.tabs button.on');
    if (cur && getComputedStyle(cur).display === 'none') switchTab('build');
    store.set('arbor.features', JSON.stringify(f));
  }
  // the HPSG tools appear only when working in an HPSG theory (AVMs alone are theory-neutral)
  function isHpsg() { return !!S.features.avm && !!S.theory && !!(S.theory.hpsg || /^hpsg/.test(S.presetId || '')); }
  function setFeatures(obj) {
    let changed = false;
    for (const [k, v] of Object.entries(obj || {})) if (!!S.features[k] !== !!v) { S.features[k] = !!v; changed = true; }
    if (changed) { applyFeatures(); fillPalette(); }
    return changed;
  }
  $$('[data-feature]').forEach(el => el.addEventListener('change', () => {
    S.features[el.dataset.feature] = el.checked; applyFeatures(); fillPalette(); render();
    if (el.checked && el.dataset.feature === 'sem' && !(S.C && S.C.comp.rules.length)) toast('This theory has no composition rules. Pick “Heim & Kratzer” under Theory for a ready-made semantics.', 5000);
    if (el.checked && el.dataset.feature === 'gram' && !(S.C && S.C.gram.rules.length)) toast('This theory has no grammar yet — write rules on the Theory tab, or pick a preset under Theory.', 5000);
  }));

  /* ═════════════ Theory ═════════════ */
  function myTheories() { try { return JSON.parse(store.get('arbor.theories') || '[]'); } catch { return []; } }
  function fillTheorySelect() {
    const sel = $('#theorySel');
    const mine = myTheories();
    sel.innerHTML = `<optgroup label="Built-in">${Theories.presets.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>` +
      (mine.length ? `<optgroup label="My theories">${mine.map((t, i) => `<option value="my:${i}">${esc(t.name)}</option>`).join('')}</optgroup>` : '') +
      (S.presetId === 'custom' ? `<option value="custom">${esc(S.theory.name)} (loaded)</option>` : '');
    sel.value = S.presetId;
    $('#theoryDesc').textContent = S.theory.description || '';
    const ms = $('#modeSel'); ms.innerHTML = sel.innerHTML; ms.value = S.presetId;
    if (S.presetId === 'custom' || !ms.value) { const o = ms.querySelector('option[value="custom"]') || ms.appendChild(document.createElement('option')); o.value = 'custom'; o.textContent = S.theory.name || 'Custom'; ms.value = 'custom'; }
    if (typeof sizeModeSel === 'function') requestAnimationFrame(sizeModeSel);
  }
  function normalizeTheory(th) {
    const base = deep(Theories.byId('blank'));
    const t = { ...base, ...th };
    t.display = { bars: 'bar', labelColors: true, italicWords: true, showAvm: true, tabSide: 'right', arrowStyle: 'square', ...base.display, ...(th.display || {}) };
    if (!Array.isArray(t.examples)) t.examples = [];
    if (t.indexVersion !== 2) { if (!th.moveIndex || th.moveIndex === 'none') t.moveIndex = 'number'; t.cyclicIndex = true; t.indexVersion = 2; }
    if (!t.moveIndex) t.moveIndex = 'number';
    if (t.cyclicIndex === undefined) t.cyclicIndex = true;
    if (t.leaveLabel === undefined) t.leaveLabel = '∅';
    return t;
  }
  function setTheory(th, presetId, { loadExample: loadEx = true } = {}) {
    S.theory = normalizeTheory(deep(th));
    S.presetId = presetId;
    stopPlay(); S.deriv = { steps: [], cur: -1, rec: false };
    $('#lessonCard').hidden = true;
    setFeatures(th.features);
    recompile();
    fillTheorySelect();
    fillTheoryForm();
    if (loadEx && S.theory.examples.length) loadExample(S.theory.examples[0]);
    else render({ fit: true });
  }
  function recompile() {
    S.C = Sem.compile(S.theory);
    S.tpl = T.parseTemplates(S.theory.templates);
    S.C.errors.push(...S.tpl.errors.map(e => ({ section: 'Templates', ...e })));
    const G = isHpsg() ? hpGrammar() : null; if (G) S.C.errors.push(...G.errors);
    document.body.classList.toggle('f-hpsg', isHpsg());
    { const cur = document.querySelector('.tabs button.on'); if (cur && getComputedStyle(cur).display === 'none') switchTab('build'); }
    const errs = S.C.errors.filter(e => (S.features.sem || !['Composition', 'Variable types', 'Model'].includes(e.section)) && (S.features.tx || e.section !== 'Transformations'));
    $('#thErrors').innerHTML = errs.length
      ? `<div class="errbox">${errs.slice(0, 12).map(e => `<div><b>${esc(e.section)}</b>${e.line ? ` line ${e.line}` : ''}: ${esc(e.msg)}</div>`).join('')}${errs.length > 12 ? `<div>…and ${errs.length - 12} more</div>` : ''}</div>`
      : '';
    fillPalette(); fillExamples(); fillDatalist();
    if (modelEd) modelEd.refresh();
    if (Array.isArray(S.theory.models) && S.theory.models[S.theory.activeModel || 0]) S.theory.models[S.theory.activeModel || 0].text = S.theory.model || '';
    if (typeof WS !== 'undefined' && WS && S.centerView === 'theory') WS.refresh();
    if (typeof MW !== 'undefined' && MW && S.centerView === 'model') MW.refresh();
  }
  let modelEd = null;
  function mountModelEditor() {
    modelEd = ModelEditor.mount($('#modelEd'), {
      getText: () => S.theory.model || '',
      setText: t => { S.theory.model = t; const ta = $('[data-th=model]'); if (ta) ta.value = t; onTheoryEdit(); },
      consts: () => (S.C ? S.C.consts : new Map()),
      typeStr: t => Logic.typeStr(t, disp().typeStyle),
    });
  }
  function fillTheoryForm() {
    const th = S.theory;
    $('#th-name').value = th.name || '';
    $('#th-desc').textContent = th.description || '';
    $$('[data-th]').forEach(el => {
      const k = el.dataset.th;
      if (el.type === 'checkbox') el.checked = !!th[k]; else el.value = th[k] ?? '';
    });
    syncDisplayControls();
  }
  function syncDisplayControls() {
    const d = disp();
    $$('[data-disp]').forEach(el => {
      const k = el.dataset.disp;
      if (el.tagName === 'BUTTON') el.classList.toggle('on', !!d[k]);
      else if (el.type === 'checkbox') el.checked = !!d[k];
      else el.value = d[k] ?? '';
    });
    $$('[data-dmode]').forEach(b => b.classList.toggle('on', dragKind() === b.dataset.dmode));
    if (typeof syncAvmView === 'function') syncAvmView();
    $('#leaveWrap').hidden = dragKind() !== 'transform';
    $('#leaveSel').value = leaveKind();
    $$('[data-th="dragMode"],[data-th="leave"]').forEach(el => { el.value = el.dataset.th === 'dragMode' ? dragKind() : leaveKind(); });
  }
  const onTheoryEdit = debounce(() => { recompile(); render(); refreshRules(); autosave(); }, 350);

  /* ═════════════ Text measurement & labels ═════════════ */
  const mctx = document.createElement('canvas').getContext('2d');
  const SERIF = getComputedStyle(document.documentElement).getPropertyValue('--serif') || 'serif';
  const mcache = new Map();
  function tw(text, size, italic = false) {
    const key = size + (italic ? 'i' : '') + '|' + text;
    let w = mcache.get(key);
    if (w === undefined) { mctx.font = `${italic ? 'italic ' : ''}${size}px ${SERIF}`; w = mctx.measureText(text).width; if (mcache.size > 5000) mcache.clear(); mcache.set(key, w); }
    return w;
  }
  function richLabel(l) {
    const m = /^(.+?)(?:_\{?([^}^]*)\}?)?(?:\^\{?([^}]*)\}?)?$/u.exec(l);
    let r = (!m || l.length < 2) ? { base: l, sub: '', sup: '' } : { base: m[1], sub: m[2] || '', sup: m[3] || '' };
    const bars = S.theory ? disp().bars : 'bar';
    r.bar = 0;
    r.base = r.base.replace(/^(.*?)('{1,2}|′{1,2})$/u, (all, a, p) => {
      if (!a) return all;
      if (bars === 'bar') { r.bar = p.length; return a; }
      return a + (p.length === 1 ? '′' : '″');
    });
    return r;
  }
  const SUBS = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
  const prettyPlain = s => s.replace(/([\p{L}'])_?(\d+)(?!\.\d)/gu, (m, a, d) => a + d.replace(/\d/g, c => SUBS[c]));
  const showOpts = () => ({ lambda: disp().lambda || 'λ', uncurry: disp().uncurry !== false, typeStyle: disp().typeStyle });
  const showTerm = t => prettyPlain(Logic.show(t, showOpts()));
  const showHtml = (t, hl) => Logic.show(t, { ...showOpts(), html: true, hl });
  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const catSet = () => new Set((S.C ? S.C.cats : []).map(c => c.label));
  // Colour by head: a projection shares its head's colour (Voice, Voice′, VoiceP), and each new head type
  // you introduce gets its own hue, as far from the hues already in use as possible (kept with the document).
  const HEAD_HUES = { C: 0, T: 210, I: 210, Infl: 210, V: 130, v: 95, N: 30, n: 50, D: 275, P: 180, A: 320, Adj: 320, Adv: 340, Deg: 300, Q: 15, S: 240 };
  function headOfLabel(label) {
    let l = String(label).replace(/\[.*\]$/, '').replace(/\^.*$/, '').replace(/_\{?[^}_\s]*\}?$/, '').trim();
    l = l.replace(/(?:['′’]+|-?bar|̄|max|min)$/i, '');
    if (l.length > 1 && /P$/.test(l)) l = l.slice(0, -1);
    return /^\p{L}+$/u.test(l) ? l : null;
  }
  function headHue(head) {
    if (head in HEAD_HUES) return HEAD_HUES[head];
    const map = S.doc.headHues || (S.doc.headHues = { ...(S.headHues || {}) }); S.headHues = map;
    if (map[head] != null) return map[head];
    const used = Object.values(map);
    T.walkDoc(S.doc, n => { const h = headOfLabel(n.label); if (h && h in HEAD_HUES) used.push(HEAD_HUES[h]); });
    const dist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
    let best = 0, bestD = -1;
    for (let h = 0; h < 360; h += 5) { const d = used.length ? Math.min(...used.map(u => dist(u, h))) : 360; if (d > bestD) { bestD = d; best = h; } }
    return (map[head] = best);
  }
  function catColor(label) {
    if (!S.theory || disp().labelColors === false) return null;
    const lab = S.C ? S.C.strip(label) : label;
    const c = S.C && S.C.cats.find(x => x.label === lab);
    if (c && c.color) return c.color;
    const head = headOfLabel(label);
    if (head) return `hsl(${headHue(head)} 55% var(--catL))`;
    if (!c) return null;
    let h = 0; for (const ch of lab) h = (h * 31 + ch.codePointAt(0)) % 360;
    return `hsl(${h} 55% var(--catL))`;
  }
  const idxOf = label => { const m = /_\{?([^}_^\s]+)\}?$/.exec(label); return m ? m[1] : null; };
  const isTraceLabel = l => /^(t|trace|e)_\{?[^}_\s]+\}?$/.test(l);

  /* ═════════════ Feature structures ═════════════ */
  const avmCache = new Map();
  function avmOf(text) {
    if (!text) return null;
    if (!avmCache.has(text)) { let v = null, err = null; try { v = AVM.parse(text); } catch (e) { err = e.message; } if (avmCache.size > 500) avmCache.clear(); avmCache.set(text, { v, err }); }
    return avmCache.get(text);
  }
  const showAvms = () => S.features.avm && disp().showAvm !== false;
  let sigCache = { src: null, sig: AVM.parseSignature('') };
  function signature() {
    const G = typeof hpGrammar === 'function' ? hpGrammar() : null;
    if (G) {
      const featDefs = t => { try { const c = G.expC(t); return c && c.f ? [...c.f].map(([f, v]) => { const d = TFS.D(v); return { f, t: d.t === TFS.TOP ? null : d.t }; }) : []; } catch { return []; } };
      return { types: G.types, typeNames: [...G.types.keys()], featDefs, featsOf: t => featDefs(t).map(d => d.f) };
    }
    const src = S.theory.signature || ''; if (sigCache.src !== src) sigCache = { src, sig: AVM.parseSignature(src) }; return sigCache.sig;
  }
  const atw = (t, sz, it, b) => tw(t, sz, it) * (b ? 1.08 : 1);

  /* ═════════════ Semantics & values ═════════════ */
  function hasSem() { return S.features.sem && S.C && S.C.comp.rules.length > 0; }
  function computeSem() {
    S.sem = null; S.vals = new Map();
    if (!hasSem()) return;
    try { S.sem = Sem.compute(S.doc, S.C); } catch (e) { console.error(e); return; }
    const M = S.C.model;
    const firstOrder = t => !!t && (t.b !== undefined || (!!t.f && t.f[0].b === 'e' && firstOrder(t.f[1])));
    for (const [id, inf] of S.sem.info) {
      if (!inf.red) continue;
      if (!firstOrder(inf.type)) { S.vals.set(id, { hi: true }); continue; }
      try { S.vals.set(id, { v: Logic.evaluate(inf.red, M), ok: true }); }
      catch (e) {
        if (/Presupposition/.test(e.message)) S.vals.set(id, { err: e.message, presup: true });
        else S.vals.set(id, { err: e.message });
      }
    }
  }
  const infoOf = id => (S.sem ? S.sem.info.get(id) : null);
  function valText(id) {
    const v = S.vals.get(id); if (!v) return null;
    if (v.presup) return { text: '# undefined', cls: 'err' };
    if (!v.ok) return null;
    if (typeof v.v === 'boolean') return { text: v.v ? '= 1 (true)' : '= 0 (false)', cls: v.v ? 'true' : 'false' };
    return { text: '= ' + truncate(Logic.showVal(v.v, S.C.model), 40), cls: 'ent' };
  }

  /* ═════════════ Layout ═════════════ */
  function movementLinks(doc) {
    // explicit (from dragging) + automatic: a trace t_i / silent X_i points at the highest non-trace node with index i
    const out = []; const byIdx = new Map();
    T.walkDoc(doc, (n, p, d) => {
      const i = idxOf(n.label); if (!i || isTraceLabel(n.label) || n.silent) return;
      const prev = byIdx.get(i); if (!prev || d < prev.d) byIdx.set(i, { n, d });
    });
    T.walkDoc(doc, n => {
      const props = { ...(n.arrow || {}), id: 'mv:' + n.id, mv: true };
      if (props.hidden) return;
      if (n.ante) { if (T.find(doc, n.ante)) out.push({ ...props, from: n.id, to: n.ante }); return; }
      if (isTraceLabel(n.label) || n.silent) { const i = idxOf(n.label); const a = i && byIdx.get(i); if (a && a.n.id !== n.id) out.push({ ...props, from: n.id, to: a.n.id, auto: true }); }
    });
    return out;
  }
  function layout(doc) {
    const d = disp();
    const HG = d.compact ? 14 : 26, VG = d.compact ? 22 : 38, PAD = 6;
    const recs = new Map(); const edges = []; const arrows = [];
    const hide = id => S.reveal && !S.reveal.has(id);
    const cats = catSet();
    function mkRec(n, depth, parent, isLeaf) {
      const lines = [];
      const rl = richLabel(n.label);
      const isWord = isLeaf && !cats.has(n.label) && !(parent === null && isLeaf && false);
      const ital = isWord && d.italicWords !== false;
      const av = showAvms() && n.avm ? (HP.disp.get(n.id) || avmOf(n.avm)) : null;
      const lw = n.label === '' ? (av ? 0 : 10) : tw(rl.base, 17, ital) + (rl.sub ? tw(rl.sub, 11.5) + 1 : 0) + (rl.sup ? tw(rl.sup, 11.5) + 1 : 0);
      if (!(av && n.label === '')) lines.push({ k: 'lbl', ...rl, w: lw + (n.shape ? 10 : 0), lw, h: n.shape === 'circle' ? 25 : 21, ital, word: isWord });
      if (av && av.v) { const m = AVM.measure(av.v, atw, foldOpts(n)); lines.push({ k: 'avm', v: av.v, m, w: m.w, h: m.h + 6 }); }
      else if (av && av.err) lines.push({ k: 'ty', err: true, text: /^Not well/.test(av.err) ? 'not well-formed' : 'AVM syntax error', full: av.err, w: tw('AVM syntax error', 12.5), h: 16 });
      if (n.f) lines.push({ k: 'feat', text: `[${n.f}]`, w: tw(`[${n.f}]`, 12, true), h: 15 });
      if (n.note) lines.push({ k: 'note', text: n.note, w: tw(n.note, 12.5, true), h: 16 });
      const inf = infoOf(n.id);
      const redundantLeaf = isLeaf && parent && parent.ch.length === 1;
      if (inf && !hide(n.id) && !redundantLeaf) {
        if (inf.red) {
          if (d.showTypes) lines.push({ k: 'ty', text: inf.tyStr, w: tw(inf.tyStr, 12.5), h: 16 });
          if (d.showDen) { const full = showTerm(inf.red); const t = truncate(full, 46); lines.push({ k: 'den', text: t, full, w: tw(t, 12.5), h: 16 }); }
          const vt = d.showVals && valText(n.id);
          if (vt) lines.push({ k: 'val', ...vt, w: tw(vt.text, 11) + 12, h: 18 });
        } else if (inf.typeClash && (d.showTypes || d.showDen)) {
          lines.push({ k: 'ty', err: true, text: 'type mismatch', full: inf.err, w: tw('type mismatch', 12.5), h: 16 });
        } else if (inf.err && !inf.blocked && (d.showTypes || d.showDen)) {
          lines.push({ k: 'ty', err: true, text: 'error', full: inf.err, w: tw('error', 12.5), h: 16 });
        }
      }
      const w = Math.max(...lines.map(l => l.w)) + PAD * 2;
      const h = lines.reduce((a, l) => a + l.h, 0) + 4;
      const r = { id: n.id, node: n, depth, parentId: parent ? parent.id : null, lines, w, h, leaf: isLeaf, x: 0, y: 0 };
      recs.set(n.id, r);
      return r;
    }
    function build(n, depth, parent) {
      const isLeaf = !n.ch.length;
      const rec = mkRec(n, depth, parent, isLeaf);
      const lt = { rec, kids: [], node: n, parent };
      if (n.roof && n.ch.length) {
        const text = T.yieldOf(n).join(' ');
        const ital = d.italicWords !== false;
        const rr = { id: n.id + '~roof', node: null, roofText: text, depth: depth + 1, parentId: n.id, lines: [{ k: 'lbl', base: text, sub: '', sup: '', w: tw(text, 17, ital), lw: tw(text, 17, ital), h: 21, ital, word: true }], w: tw(text, 17, ital) + PAD * 2, h: 25, leaf: true, x: 0, y: 0, pseudo: true };
        recs.set(rr.id, rr);
        lt.kids.push({ rec: rr, kids: [] });
        edges.push({ p: n.id, c: rr.id, roof: true });
      } else {
        for (const c of n.ch) { lt.kids.push(build(c, depth + 1, n)); edges.push({ p: n.id, c: c.id, dash: !!c.dash }); }
      }
      return lt;
    }
    const lts = doc.roots.map(r => build(r, 0, null));
    movementLinks(doc).forEach(a => { if (recs.has(a.from) && recs.has(a.to)) arrows.push(a); });
    const uarrows = arrowsOf(doc).filter(a => recs.has(a.from) && recs.has(a.to));
    let maxDepth = 0; recs.forEach(r => { maxDepth = Math.max(maxDepth, r.depth); });
    if (d.alignLeaves) recs.forEach(r => { if (r.leaf) r.depth = maxDepth; });
    const levelH = []; recs.forEach(r => { levelH[r.depth] = Math.max(levelH[r.depth] || 0, r.h); });
    const levelY = []; let acc = 0;
    for (let i = 0; i <= maxDepth; i++) { levelY[i] = acc; acc += (levelH[i] || 0) + VG; }
    recs.forEach(r => { r.y = levelY[r.depth]; });
    function measure(lt) {
      lt.kids.forEach(measure);
      const cw = lt.kids.reduce((a, k) => a + k.sw, 0) + HG * Math.max(0, lt.kids.length - 1);
      lt.cw = cw; lt.sw = Math.max(lt.rec.w, cw);
    }
    function place(lt, left) {
      if (!lt.kids.length) { lt.rec.x = left + lt.sw / 2; return; }
      let x = left + (lt.sw - lt.cw) / 2;
      for (const k of lt.kids) { place(k, x); x += k.sw + HG; }
      const f = lt.kids[0].rec, l = lt.kids[lt.kids.length - 1].rec;
      lt.rec.x = (f.x + l.x) / 2;
    }
    let left = 0;
    const allLeaves = lts.every(lt => !lt.kids.length);
    for (const lt of lts) { measure(lt); place(lt, left); left += lt.sw + (allLeaves ? 22 : 70); }
    // manual nudges: shift the whole subtree, but never into a sister's space; bounded vertically
    const shift = (lt, dx, dy) => { lt.rec.x += dx; lt.rec.y += dy; lt.kids.forEach(k => shift(k, dx, dy)); };
    const extent = lt => { let a = lt.rec.x - lt.rec.w / 2, b = lt.rec.x + lt.rec.w / 2; lt.kids.forEach(k => { const e = extent(k); a = Math.min(a, e[0]); b = Math.max(b, e[1]); }); return [a, b]; };
    const applyPos = (lt, sibs, i) => {
      const n = lt.node;
      const ov = n && (S.posDrag && S.posDrag.id === n.id ? S.posDrag : n.pos && n.pos.sig === posSig(n, lt.parent) ? n.pos : null);
      if (ov && (ov.dx || ov.dy)) {
        const dy = clamp(ov.dy || 0, -(VG - 12), VG * 3);
        const [a, b] = extent(lt);
        const lo = i > 0 ? extent(sibs[i - 1])[1] + HG * 0.5 : -Infinity;
        const hi = i < sibs.length - 1 ? extent(sibs[i + 1])[0] - HG * 0.5 : Infinity;
        const dx = clamp(ov.dx || 0, Math.min(0, lo - a), Math.max(0, hi - b));
        shift(lt, dx, dy); lt.rec.manual = true;
      }
      lt.kids.forEach((k, j) => applyPos(k, lt.kids, j));
    };
    lts.forEach((lt, i) => applyPos(lt, lts, i));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    recs.forEach(r => { x0 = Math.min(x0, r.x - r.w / 2); x1 = Math.max(x1, r.x + r.w / 2); y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y + r.h); });
    const Lo = { recs, edges, arrows, uarrows, bbox: recs.size ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 0, y1: 0 } };
    if (recs.size) routeArrows(Lo, [...(d.arrows ? arrows : []), ...uarrows]).forEach(g => { Lo.bbox.y1 = Math.max(Lo.bbox.y1, g.maxY + 20); Lo.bbox.y0 = Math.min(Lo.bbox.y0, g.minY - 20); });
    return Lo;
  }

  // a manual position stays valid only while the node keeps its mother, sisters and number of daughters
  const posSig = (n, parent) => `${parent ? parent.id : '#'}|${parent ? parent.ch.map(c => c.id).join(',') : ''}|${n.ch.length}`;
  function dropStalePositions() { T.walkDoc(S.doc, (n, p) => { if (n.pos && n.pos.sig !== posSig(n, p)) delete n.pos; }); }
  function setPos(id, dx, dy, desc = 'Reposition node') {
    commit(desc, () => { const h = T.find(S.doc, id); if (!h) return false; if (!dx && !dy) { if (!h.node.pos) return false; delete h.node.pos; } else h.node.pos = { dx: Math.round(dx), dy: Math.round(dy), sig: posSig(h.node, h.parent) }; }, { animate: false });
  }

  /* ═════════════ Drawing ═════════════ */
  function edgePath(p, c, style) {
    const x1 = p.x, y1 = p.y + p.h - 2, x2 = c.x, y2 = c.y + 2;
    if (style === 'elbow') { const my = (y1 + y2) / 2; return `M${x1} ${y1}V${my}H${x2}V${y2}`; }
    if (style === 'curve') { const my = (y1 + y2) / 2; return `M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}`; }
    return `M${x1} ${y1}L${x2} ${y2}`;
  }
  function nodeSvg(r, op) {
    const n = r.node;
    const cls = ['node'];
    if (!r.pseudo) {
      if (S.sel.length === 1 && S.sel[0] === r.id) cls.push('sel');
      else if (S.sel.includes(r.id)) cls.push('multi');
      if (S.issues.has(r.id) || (infoOf(r.id) && infoOf(r.id).typeClash)) cls.push('bad');
      if (S.pulse === r.id) cls.push('pulse');
      if (n.color && COLORS.includes(n.color)) cls.push('c-' + n.color);
      if (S.snip && S.snip.holes.includes(r.id) && n.label === '') cls.push('slot');
      if (S.pick && S.pick.cursor === r.id) cls.push('pickcur');
      if (S.findIds && S.findIds.has(r.id)) cls.push('found');
    }
    let y = 2; let body = '';
    const titleParts = [];
    for (const l of r.lines) {
      const cy = y + l.h - 5;
      if (l.k === 'lbl') {
        if (n && n.label === '') body += `<circle class="dot" cx="${r.w / 2}" cy="${y + l.h / 2 + 1}" r="2.6"/>`;
        else {
          const lcls = ['lbl']; if (l.word) lcls.push('leaf'); if (!l.ital) lcls.push('roman'); if (n && n.silent) lcls.push('silent');
          const col = n && !l.word && !n.color ? catColor(n.label) : null;
          const ty = n && n.shape === 'circle' ? cy - 2 : cy;
          if (l.bar) { const bw = tw(l.base, 17, l.ital), x0 = r.w / 2 - l.lw / 2; for (let b = 0; b < l.bar; b++) body += `<line class="xbar" x1="${x0 + 1}" x2="${x0 + bw - 1}" y1="${ty - 14 - b * 3}" y2="${ty - 14 - b * 3}"/>`; }
          body += `<text class="${lcls.join(' ')}" x="${r.w / 2}" y="${ty}" text-anchor="middle"${col ? ` style="fill:${col}"` : ''}>${esc(l.base)}${l.sub ? `<tspan class="sub" dy="4">${esc(l.sub)}</tspan>` : ''}${l.sup ? `<tspan class="sub" dy="${l.sub ? -11 : -7}">${esc(l.sup)}</tspan>` : ''}</text>`;
          if (n && n.silent) body += `<line class="strike" x1="${(r.w - l.lw) / 2}" x2="${(r.w + l.lw) / 2}" y1="${ty - 5}" y2="${ty - 5}"/>`;
          if (n && n.shape === 'box') body += `<rect class="shape" x="${(r.w - l.lw) / 2 - 5}" y="${y - 1}" width="${l.lw + 10}" height="${l.h + 1}" rx="3"/>`;
          if (n && n.shape === 'circle') body += `<ellipse class="shape" cx="${r.w / 2}" cy="${y + l.h / 2}" rx="${l.lw / 2 + 8}" ry="${l.h / 2 + 1}"/>`;
        }
      } else if (l.k === 'avm') body += `<g transform="translate(${((r.w - l.w) / 2).toFixed(1)},${y + 3})">${AVM.draw(l.v, l.m, 0, 0)}</g>`;
      else if (l.k === 'feat') body += `<text class="feat" x="${r.w / 2}" y="${cy}" text-anchor="middle">${esc(l.text)}</text>`;
      else if (l.k === 'note') body += `<text class="note" x="${r.w / 2}" y="${cy}" text-anchor="middle">${esc(l.text)}</text>`;
      else if (l.k === 'ty') { body += `<text class="ty${l.err ? ' err' : ''}" x="${r.w / 2}" y="${cy}" text-anchor="middle">${esc(l.text)}</text>`; if (l.full) titleParts.push(l.full); }
      else if (l.k === 'den') { body += `<text class="den" x="${r.w / 2}" y="${cy}" text-anchor="middle">${esc(l.text)}</text>`; titleParts.push(l.full); }
      else if (l.k === 'val') body += `<text class="val ${l.cls}" x="${r.w / 2}" y="${cy}" text-anchor="middle">${esc(l.text)}</text>`;
      y += l.h;
    }
    if (S.issues.has(r.id)) titleParts.push('⚠ ' + S.issues.get(r.id));
    const title = titleParts.length ? `<title>${esc(titleParts.join('\n'))}</title>` : '';
    return `<g class="${cls.join(' ')}" data-id="${r.pseudo ? r.parentId : r.id}" transform="translate(${(r.x - r.w / 2).toFixed(1)},${r.y.toFixed(1)})"${op < 1 ? ` opacity="${op.toFixed(3)}"` : ''}>${title}<rect class="hit" x="0" y="0" width="${r.w.toFixed(1)}" height="${r.h}" rx="3"/>${body}</g>`;
  }
  /* Arrow routing.  Automatic shapes ("lane" = squared, "curve") drop from the source, run along their own
     lane just below what lies between the ends, and rise into the target; lanes are assigned shortest-first
     so nested movements stack without overlapping.  Every arrow can be overridden by hand:
       shape  lane | curve | straight | free (cubic Bézier with explicit end angles)
       at1/at2  where it attaches: auto | bottom | top | left | right | center
       dx1,dy1 / dx2,dy2  endpoint nudges · dy  lane depth · a1/a2 angles (deg, 0 = right, 90 = down) · l1/l2 strengths */
  const ARROW_KEYS = ['shape', 'at1', 'at2', 'dx1', 'dy1', 'dx2', 'dy2', 'dy', 'a1', 'a2', 'l1', 'l2', 'w'];
  function anchorPt(r, kind, subBottom, up, isEnd) {
    const gap = isEnd ? 5 : 3;
    switch (kind) {
      case 'top': return { x: r.x, y: r.y - gap, ang: -90 };
      case 'bottom': return { x: r.x, y: r.y + r.h + gap, ang: 90 };
      case 'left': return { x: r.x - r.w / 2 - gap, y: r.y + r.h / 2, ang: 180 };
      case 'right': return { x: r.x + r.w / 2 + gap, y: r.y + r.h / 2, ang: 0 };
      case 'center': return { x: r.x, y: r.y + r.h / 2, ang: 90 };
      default: return up ? { x: r.x, y: r.y - gap, ang: -90 } : { x: r.x, y: subBottom + gap, ang: 90 };
    }
  }
  const rad = d => (d * Math.PI) / 180;
  const normDeg = d => ((Math.round(d) % 360) + 360) % 360;
  function routeArrows(L, list) {
    const live = r => r && (r.op === undefined || r.op > 0.3);
    const bottom = new Map();
    L.recs.forEach(r => {
      if (!live(r)) return;
      const b = r.y + r.h; let id = r.id;
      while (id) { if ((bottom.get(id) ?? -Infinity) < b) bottom.set(id, b); const rr = L.recs.get(id); id = rr ? rr.parentId : null; }
    });
    const items = list.map(a => {
      const A = S.arrowDrag && S.arrowDrag.id === a.id ? { ...a, ...S.arrowDrag } : a;
      return { a, A, f: L.recs.get(a.from), t: L.recs.get(a.to) };
    }).filter(o => o.f && o.t && o.f !== o.t);
    // spread automatic endpoints that share a node (ordered by where the other end is, so lines don't cross)
    const ends = new Map();
    items.forEach(o => {
      const up = o.A.side === 'above';
      [['f', o.a.from, o.t.x, o.A.at1], ['t', o.a.to, o.f.x, o.A.at2]].forEach(([k, id, other, at]) => {
        if (at && at !== 'auto') return;
        const key = id + (up ? '^' : 'v'); if (!ends.has(key)) ends.set(key, []); ends.get(key).push({ o, k, other });
      });
    });
    ends.forEach(arr => { arr.sort((p, q) => p.other - q.other); arr.forEach((e, i) => { e.o['d' + e.k] = (i - (arr.length - 1) / 2) * 9; }); });
    items.forEach(o => { o.span = Math.abs(o.f.x - o.t.x); });
    items.sort((p, q) => p.span - q.span);
    const placed = { below: [], above: [] };
    const globalShape = (disp().arrowStyle || 'square') === 'curve' ? 'curve' : 'lane';
    const out = [];
    for (const o of items) {
      const A = o.A;
      const up = A.side === 'above', dir = up ? -1 : 1;
      const end = (r, at, id) => {
        if (up || (at && at !== 'auto') || disp().arrowToHead === false) return [r, bottom.get(id) ?? r.y + r.h];
        const h = headRec(L, id) || r; return [h, bottom.get(h.id) ?? h.y + h.h];
      };
      const [r1, b1] = end(o.f, A.at1, o.a.from), [r2, b2] = end(o.t, A.at2, o.a.to);
      const p1 = anchorPt(r1, A.at1, b1, up, false);
      const p2 = anchorPt(r2, A.at2, b2, up, true);
      const x1 = p1.x + (o.df || 0) + (A.dx1 || 0), y1 = p1.y + (A.dy1 || 0);
      const x2 = p2.x + (o.dt || 0) + (A.dx2 || 0), y2 = p2.y + (A.dy2 || 0);
      let shape = A.shape || globalShape;
      const horiz = k => k === 'left' || k === 'right';
      if ((shape === 'lane' || shape === 'curve') && (horiz(A.at1) || horiz(A.at2) || A.at1 === 'center' || A.at2 === 'center')) shape = 'free';
      const base = { a: o.a, x1, y1, x2, y2, dir, shape };
      if (shape === 'straight') {
        out.push({ ...base, d: `M${x1} ${y1}L${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2, minY: Math.min(y1, y2), maxY: Math.max(y1, y2) });
        continue;
      }
      if (shape === 'free') {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const ang1 = A.a1 ?? p1.ang, ang2 = A.a2 ?? p2.ang;
        const L1 = A.l1 ?? Math.max(30, dist * 0.45), L2 = A.l2 ?? Math.max(30, dist * 0.45);
        const c1x = x1 + L1 * Math.cos(rad(ang1)), c1y = y1 + L1 * Math.sin(rad(ang1));
        const c2x = x2 + L2 * Math.cos(rad(ang2)), c2y = y2 + L2 * Math.sin(rad(ang2));
        out.push({ ...base, d: `M${x1} ${y1}C${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`, mx: (x1 + 3 * c1x + 3 * c2x + x2) / 8, my: (y1 + 3 * c1y + 3 * c2y + y2) / 8,
          c1: [c1x, c1y], c2: [c2x, c2y], ang1: normDeg(ang1), ang2: normDeg(ang2), L1: Math.round(L1), L2: Math.round(L2),
          minY: Math.min(y1, y2, c1y, c2y), maxY: Math.max(y1, y2, c1y, c2y) });
        continue;
      }
      const xa = Math.min(x1, x2) - 6, xb = Math.max(x1, x2) + 6;
      let lane = up ? Math.min(y1, y2) - 16 : Math.max(y1, y2) + 16;
      for (let guard = 0; guard < 60; guard++) {
        let moved = false;
        L.recs.forEach(r => {
          if (!live(r) || r.x + r.w / 2 < xa || r.x - r.w / 2 > xb) return;
          if (r.y - 4 < lane && r.y + r.h + 4 > lane) { lane = up ? r.y - 10 : r.y + r.h + 10; moved = true; }
        });
        for (const q of placed[up ? 'above' : 'below']) {
          if (q.xb > xa && q.xa < xb && Math.abs(q.lane - lane) < 9) { lane = q.lane + 10 * dir; moved = true; }
        }
        if (!moved) break;
      }
      placed[up ? 'above' : 'below'].push({ xa, xb, lane });
      lane += A.dy || 0;
      out.push({ ...base, ...arrowPath(x1, y1, x2, y2, lane, dir, shape), lane, ang1: up ? 270 : 90, ang2: up ? 270 : 90, minY: Math.min(y1, y2, lane), maxY: Math.max(y1, y2, lane) });
    }
    return out;
  }
  const ANCHOR_OPTS = '<option value="auto">automatic</option><option value="bottom">node bottom</option><option value="top">node top</option><option value="left">node left</option><option value="right">node right</option><option value="center">node centre</option>';
  const arrowDashed = a => (a.mv ? a.dash !== false : !!a.dash);
  function arrowPath(x1, y1, x2, y2, lane, dir, shape) {
    const mx = (x1 + x2) / 2;
    if (shape === 'curve') {
      const c = (8 * lane - y1 - y2) / 6;
      return { d: `M${x1} ${y1}C${x1} ${c} ${x2} ${c} ${x2} ${y2}`, mx, my: lane };
    }
    const s = Math.sign(x2 - x1) || 1;
    const r = Math.max(0, Math.min(10, Math.abs(x2 - x1) / 2, Math.abs(lane - y1) - 1, Math.abs(lane - y2) - 1));
    if (Math.abs(x2 - x1) < 1) return { d: `M${x1} ${y1}V${lane}M${x2} ${lane}V${y2}`, mx, my: lane };
    return { d: `M${x1} ${y1}V${lane - dir * r}Q${x1} ${lane} ${x1 + s * r} ${lane}H${x2 - s * r}Q${x2} ${lane} ${x2} ${lane - dir * r}V${y2}`, mx, my: lane };
  }
  function draw(L) {
    const d = disp();
    const op = r => (r.op === undefined ? 1 : r.op);
    let eh = '';
    for (const e of L.edges) {
      const p = L.recs.get(e.p), c = L.recs.get(e.c);
      if (!p || !c) continue;
      const o = Math.min(op(p), op(c)) * (e.op === undefined ? 1 : e.op);
      if (o <= 0.01) continue;
      const oa = o < 1 ? ` opacity="${o.toFixed(3)}"` : '';
      if (e.roof) eh += `<path class="roof" d="M${p.x} ${p.y + p.h - 2}L${c.x - c.w / 2 + 4} ${c.y + 2}H${c.x + c.w / 2 - 4}Z"${oa}/>`;
      else {
        eh += `<path class="edge${e.dash ? ' dash' : ''}" d="${edgePath(p, c, d.edge)}"${oa}/>`;
        if (c.node && c.node.elabel) { const mx = (p.x + c.x) / 2, my = (p.y + p.h + c.y) / 2, left = c.x < p.x; eh += `<text class="elabel" x="${mx + (left ? -6 : 6)}" y="${my + 4}" text-anchor="${left ? 'end' : 'start'}"${oa}>${esc(c.node.elabel)}</text>`; }
      }
    }
    let ah = '', hh = '';
    const routes = routeArrows(L, [...(d.arrows ? L.arrows.map(a => ({ ...a, mv: true })) : []), ...(L.uarrows || [])]);
    S.routes = new Map(routes.map(g => [g.a.id, g]));
    for (const g of routes) {
      const a = g.a;
      const f = L.recs.get(a.from), t = L.recs.get(a.to);
      const o = Math.min(op(f), op(t)); if (o <= 0.01) continue;
      const heads = a.heads || 'end';
      const mid = a.mv ? 'arrowHead' : 'arrowHead2';
      const mk = `${heads !== 'none' ? ` marker-end="url(#${mid})"` : ''}${heads === 'both' ? ` marker-start="url(#${mid})"` : ''}`;
      const dashed = arrowDashed(a);
      const isSel = S.selArrow === a.id;
      const cls = `${a.mv ? 'mvarrow' : 'uarrow'}${dashed ? ' dash' : ' solid'}${isSel ? ' sel' : ''}${a.w ? ' w-' + a.w : ''}`;
      let handles = '';
      if (isSel && o >= 1) {
        const hc = (k, x, y, extra, tip) => `<circle class="ahandle ${extra}" data-handle="${k}" cx="${x}" cy="${y}" r="${extra === 'ctl' ? 5 : 6}"><title>${tip} · double-click to reset</title></circle>`;
        if (g.c1) handles += `<line class="aguide" x1="${g.x1}" y1="${g.y1}" x2="${g.c1[0]}" y2="${g.c1[1]}"/><line class="aguide" x1="${g.x2}" y1="${g.y2}" x2="${g.c2[0]}" y2="${g.c2[1]}"/>` +
          hc('c1', g.c1[0], g.c1[1], 'ctl', 'Drag to set the angle and strength at which the arrow leaves (Shift snaps to 15°)') + hc('c2', g.c2[0], g.c2[1], 'ctl', 'Drag to set the angle and strength at which the arrow arrives (Shift snaps to 15°)');
        else if (g.lane !== undefined) handles += hc('mid', g.mx, g.lane, '', 'Drag up/down to change how deep it runs');
        handles += hc('p1', g.x1, g.y1, 'end', 'Drag to move the start') + hc('p2', g.x2, g.y2, 'end', 'Drag to move the tip');
        if (!g.c1) handles += hc('bend1', g.x1 + (g.x2 > g.x1 ? 22 : -22), g.y1 + g.dir * 22, 'ctl ghost', 'Drag to bend freely (switches to a free curve with angle control)');
      }
      ah += `<g data-arrow="${a.id}"${o < 1 ? ` opacity="${o.toFixed(3)}"` : ''}><path class="uarrow-hit" d="${g.d}"/><path class="${cls}" d="${g.d}"${mk}/>${a.label ? `<text class="alabel${a.mv ? ' mv' : ''}" x="${g.mx}" y="${g.my + (a.side === 'above' ? -6 : 16)}" text-anchor="middle">${esc(a.label)}</text>` : ''}</g>`;
      if (handles) hh += `<g data-arrow="${a.id}">${handles}</g>`;
    }
    let nh = '';
    L.recs.forEach(r => { const o = op(r); if (o > 0.01) nh += nodeSvg(r, o); });
    $('#gEdges').innerHTML = eh; $('#gArrows').innerHTML = ah; $('#gNodes').innerHTML = nh; $('#gHandles').innerHTML = hh;
    applyView();
  }
  function headNodeId(id) {
    const h = T.find(S.doc, id); if (!h) return null;
    let n = h.node; const cat = headOfLabel(n.label); if (!cat) return null;
    const bare = l => String(l).replace(/\[.*\]$/, '').replace(/\^.*$/, '').replace(/_\{?[^}_\s]*\}?$/, '').trim();
    for (let guard = 0; guard < 40 && n.ch.length; guard++) {
      const same = n.ch.filter(c => c.ch.length && headOfLabel(c.label) === cat);
      if (!same.length) break;
      n = same.find(c => bare(c.label) === cat) || same[0];
    }
    return n.id === id ? null : n.id;
  }
  // The head of a phrase: follow daughters of the same category (VoiceP → Voice′ → Voice), preferring the X⁰
  function headRec(L, id) {
    const h = T.find(S.doc, id); if (!h) return null;
    let n = h.node; const cat = headOfLabel(n.label); if (!cat) return null;
    for (let guard = 0; guard < 40 && n.ch.length; guard++) {
      const same = n.ch.filter(c => c.ch.length && headOfLabel(c.label) === cat && L.recs.has(c.id));
      if (!same.length) break;
      const bare = l => String(l).replace(/\[.*\]$/, '').replace(/\^.*$/, '').replace(/_\{?[^}_\s]*\}?$/, '').trim();
      n = same.find(c => bare(c.label) === cat) || same[0];
    }
    return n.id === id ? null : L.recs.get(n.id);
  }
  function subtreeBottom(L, id) {
    let b = -Infinity;
    L.recs.forEach(r => { if (r.id === id || isDesc(L, r, id)) b = Math.max(b, r.y + r.h); });
    return b;
  }
  function isDesc(L, r, anc) { let p = r.parentId; while (p) { if (p === anc) return true; const pr = L.recs.get(p); p = pr ? pr.parentId : null; } return false; }

  /* ═════════════ Animation ═════════════ */
  let animRaf = null;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function mix(A, B, t) {
    const recs = new Map();
    B.recs.forEach((b, id) => {
      const a = A.recs.get(id);
      if (a) {
        const moved = a.parentId !== b.parentId;
        const lift = moved ? -Math.sin(Math.PI * t) * 46 : 0;
        recs.set(id, { ...(t < 0.5 ? a : b), x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + lift, w: a.w + (b.w - a.w) * t, op: 1 });
      } else recs.set(id, { ...b, op: t });
    });
    A.recs.forEach((a, id) => { if (!B.recs.has(id)) recs.set(id, { ...a, op: 1 - t }); });
    const key = e => e.p + '>' + e.c;
    const bk = new Set(B.edges.map(key)), ak = new Set(A.edges.map(key));
    const edges = [...B.edges.map(e => (ak.has(key(e)) ? e : { ...e, op: t })), ...A.edges.filter(e => !bk.has(key(e))).map(e => ({ ...e, op: 1 - t }))];
    return { recs, edges, arrows: t < 0.5 ? A.arrows : B.arrows, uarrows: t < 0.5 ? A.uarrows : B.uarrows, bbox: B.bbox };
  }
  function animate(A, B, dur, done) {
    cancelAnimationFrame(animRaf);
    if (!A || !A.recs.size || matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(B); done && done(); return; }
    const t0 = performance.now();
    S.animating = true; hideNodebar();
    const frame = now => {
      const t = clamp((now - t0) / dur, 0, 1);
      draw(mix(A, B, ease(t)));
      if (t < 1) animRaf = requestAnimationFrame(frame); else { S.animating = false; draw(B); placeNodebar(); done && done(); }
    };
    animRaf = requestAnimationFrame(frame);
  }

  /* ═════════════ Render ═════════════ */
  function render(o = {}) {
    dropStalePositions();
    computeSem();
    S.issues = S.features.gram && disp().checkGrammar && S.C ? T.checkGrammar(S.doc, S.C.gram, S.C.lex, S.C) : new Map();
    try { computeAvmDisplay(); } catch (e) { console.error(e); }
    for (const [id, m] of HP.issues) if (T.find(S.doc, id)) S.issues.set(id, m);
    for (const [id, d] of HP.disp) if (d.err) S.issues.set(id, d.err);
    S.sel = S.sel.filter(id => T.find(S.doc, id));
    if (S.selArrow && !getArrow(S.selArrow)) S.selArrow = null;
    const prev = S.layout;
    const L = layout(S.doc);
    S.layout = L;
    $('#emptyHint').hidden = S.doc.roots.length > 0;
    if (o.fit) fit(L, false);
    if (o.animate && prev) animate(prev, L, o.dur || 600 / speed(), o.done);
    else { cancelAnimationFrame(animRaf); S.animating = false; draw(L); o.done && o.done(); }
    if (!o.keepText) syncBracket();
    renderInspector(); renderTimeline(); refreshRules(); renderNodebar(); renderStatus(); updateBracketHL();
    $('#btnUndo').disabled = !S.undo.length; $('#btnRedo').disabled = !S.redo.length;
    autosave();
  }
  function redraw() { if (S.layout) draw(S.layout); renderInspector(); refreshRules(); renderNodebar(); renderStatus(); if (typeof updateBracketHL === 'function') updateBracketHL(); }

  /* ═════════════ Viewport ═════════════ */
  const wrap = $('#canvasWrap'), svg = $('#svg');
  function applyView() { $('#vp').setAttribute('transform', `translate(${S.view.x},${S.view.y}) scale(${S.view.k})`); positionEditor(); placeNodebar(); const z = $('#zPct'); if (z) z.textContent = Math.round(S.view.k * 100) + '%'; }
  function renderStatus() {
    const pathEl = $('#sbPath'), info = $('#sbInfo'); if (!pathEl) return;
    const id = primary();
    if (S.selArrow) pathEl.innerHTML = '<span class="sb-k">arrow</span>';
    else if (id) {
      const chain = []; let h = T.find(S.doc, id);
      while (h) { chain.unshift(h.node); h = h.parent ? T.find(S.doc, h.parent.id) : null; }
      pathEl.innerHTML = chain.map(n => `<button class="sb-crumb${n.id === id ? ' cur' : ''}" data-crumb="${n.id}">${esc(n.label || '·')}</button>`).join('<span class="sb-sep">›</span>') + (S.sel.length > 1 ? `<span class="sb-k">+${S.sel.length - 1} more</span>` : '');
    } else pathEl.innerHTML = '<span class="sb-k">nothing selected</span>';
    let count = 0; T.walkDoc(S.doc, () => count++);
    const issues = S.issues ? S.issues.size : 0;
    info.innerHTML = `${S.doc.roots.length > 1 ? `${S.doc.roots.length} trees · ` : ''}${count} node${count === 1 ? '' : 's'}${issues ? ` · <button class="sb-issue" data-issue="1">${issues} issue${issues > 1 ? 's' : ''}</button>` : ''} · drag ${dragKind() === 'rearrange' ? 'rearranges' : 'transforms'}`;
  }
  $('#statusbar').addEventListener('click', e => {
    const c = e.target.closest('[data-crumb]'); if (c) { select(c.dataset.crumb); return; }
    if (e.target.closest('[data-issue]')) { const ids = [...S.issues.keys()].filter(i => T.find(S.doc, i)); if (ids.length) { const k = ids.indexOf(primary()); select(ids[(k + 1) % ids.length]); toast(S.issues.get(primary()).split('\n')[0], 4000); } }
  });
  $('#zPct').onclick = () => zoomAt(1 / S.view.k, wrap.clientWidth / 2, wrap.clientHeight / 2);
  function fit(L = S.layout, redrawNow = true) {
    if (!L || !L.recs.size) { S.view = { x: 40, y: 40, k: 1 }; applyView(); return; }
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const bw = L.bbox.x1 - L.bbox.x0, bh = L.bbox.y1 - L.bbox.y0;
    const k = clamp(Math.min((W - 60) / Math.max(bw, 1), (H - 90) / Math.max(bh, 1)), 0.2, 1.5);
    S.view = { k, x: (W - bw * k) / 2 - L.bbox.x0 * k, y: Math.max(30, (H - bh * k) / 2) - L.bbox.y0 * k };
    if (redrawNow) applyView();
  }
  function zoomAt(f, sx, sy) {
    const k2 = clamp(S.view.k * f, 0.15, 4);
    const r = k2 / S.view.k;
    S.view.x = sx - (sx - S.view.x) * r; S.view.y = sy - (sy - S.view.y) * r; S.view.k = k2;
    applyView();
  }
  function toWorld(e) {
    const b = wrap.getBoundingClientRect();
    return { x: (e.clientX - b.left - S.view.x) / S.view.k, y: (e.clientY - b.top - S.view.y) / S.view.k, sx: e.clientX - b.left, sy: e.clientY - b.top };
  }
  function toScreen(x, y) { return { x: S.view.x + x * S.view.k, y: S.view.y + y * S.view.k }; }
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const b = wrap.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - b.left, e.clientY - b.top);
    else { S.view.x -= e.deltaX; S.view.y -= e.deltaY; applyView(); }
  }, { passive: false });
  $('#zIn').onclick = () => zoomAt(1.2, wrap.clientWidth / 2, wrap.clientHeight / 2);
  $('#zOut').onclick = () => zoomAt(1 / 1.2, wrap.clientWidth / 2, wrap.clientHeight / 2);
  $('#zFit').onclick = () => fit();
  new ResizeObserver(debounce(() => { if (S.layout) applyView(); }, 100)).observe(wrap);

  /* ═════════════ Commit / undo ═════════════ */
  function snapshot() { return JSON.stringify(S.doc); }
  function commit(desc, mutate, o = {}) {
    const before = snapshot();
    const r = mutate();
    if (r === false) return false;
    S.undo.push(before); if (S.undo.length > 300) S.undo.shift();
    S.redo = [];
    if (S.features.deriv && (S.deriv.rec || o.record)) addStep(desc, before);
    if (o.select) { S.sel = [].concat(o.select); S.selArrow = null; }
    cleanLinks();
    render({ animate: o.animate !== false, fit: o.fit });
    return r;
  }
  function cleanLinks() {
    const ids = new Set(); T.walkDoc(S.doc, n => ids.add(n.id));
    T.walkDoc(S.doc, n => { if (n.ante && !ids.has(n.ante)) delete n.ante; });
    S.doc.arrows = arrowsOf(S.doc).filter(a => ids.has(a.from) && ids.has(a.to));
  }
  function undo() { if (!S.undo.length) return; finishEdit(false); S.redo.push(snapshot()); S.doc = JSON.parse(S.undo.pop()); render({ animate: true }); }
  function redo() { if (!S.redo.length) return; S.undo.push(snapshot()); S.doc = JSON.parse(S.redo.pop()); render({ animate: true }); }

  /* ═════════════ Derivation timeline ═════════════ */
  function addStep(desc, beforeJson) {
    const D = S.deriv;
    if (D.cur >= 0 && D.cur < D.steps.length - 1) D.steps.length = D.cur + 1;
    if (!D.steps.length) D.steps.push({ doc: JSON.parse(beforeJson), desc: 'Start' });
    D.steps.push({ doc: deep(S.doc), desc });
    D.cur = D.steps.length - 1;
  }
  function renderTimeline() {
    const D = S.deriv;
    $('#tlRec').classList.toggle('on', D.rec);
    $('#tlPlay').textContent = S.playing ? '❚❚ Pause' : '▶ Play';
    const box = $('#tlSteps');
    if (!D.steps.length) { box.innerHTML = `<span class="tl-empty">No derivation yet — press ● Rec and edit, apply a transformation, or move something.</span>`; return; }
    box.innerHTML = D.steps.map((s, i) => `<div class="step${i === D.cur ? ' cur' : ''}" data-i="${i}" title="${esc(s.desc)} (double-click to rename)"><i>${i}</i><span>${esc(s.desc)}</span><button class="del" data-del="${i}" title="Remove step">×</button></div>`).join('');
    const cur = box.querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function goToStep(i, o = {}) {
    const D = S.deriv; if (i < 0 || i >= D.steps.length) return;
    if (!o.noUndo) { S.undo.push(snapshot()); S.redo = []; }
    S.doc = deep(D.steps[i].doc); D.cur = i;
    T.bumpIds(S.doc);
    showCaption(`<span class="rule">Step ${i}</span>${esc(D.steps[i].desc)}`, o.captionMs || 1600);
    render({ animate: true, dur: o.dur, done: o.done });
  }
  let playTimer = null;
  function play() {
    const D = S.deriv;
    if (S.playing) { stopPlay(); return; }
    if (D.steps.length < 2) { toast('Record at least two steps first (● Rec).'); return; }
    S.playing = true;
    S.undo.push(snapshot()); S.redo = [];
    let i = D.cur >= D.steps.length - 1 || D.cur < 0 ? 0 : D.cur;
    const stepDur = () => 900 / speed();
    const go = () => {
      if (!S.playing) return;
      goToStep(i, { noUndo: true, dur: stepDur(), captionMs: stepDur() + 500, done: () => {
        if (!S.playing) return;
        if (i >= D.steps.length - 1) { stopPlay(); return; }
        i++; playTimer = setTimeout(go, 500 / speed());
      } });
    };
    renderTimeline(); go();
  }
  function stopPlay() { S.playing = false; clearTimeout(playTimer); renderTimeline(); }
  $('#tlRec').onclick = () => { S.deriv.rec = !S.deriv.rec; renderTimeline(); toast(S.deriv.rec ? 'Recording: every edit becomes a derivation step.' : 'Recording off.'); };
  $('#tlSnap').onclick = () => {
    const D = S.deriv;
    if (D.cur >= 0 && D.cur < D.steps.length - 1) D.steps.length = D.cur + 1;
    D.steps.push({ doc: deep(S.doc), desc: D.steps.length ? 'Snapshot' : 'Start' }); D.cur = D.steps.length - 1; renderTimeline(); autosave();
  };
  $('#tlPrev').onclick = () => goToStep(S.deriv.cur - 1);
  $('#tlNext').onclick = () => goToStep(S.deriv.cur + 1);
  $('#tlPlay').onclick = play;
  $('#tlClear').onclick = () => { if (S.deriv.steps.length && !confirm('Clear the derivation timeline?')) return; S.deriv.steps = []; S.deriv.cur = -1; renderTimeline(); autosave(); };
  $('#tlSteps').addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) { const i = +del.dataset.del; S.deriv.steps.splice(i, 1); if (S.deriv.cur >= S.deriv.steps.length) S.deriv.cur = S.deriv.steps.length - 1; renderTimeline(); return; }
    const st = e.target.closest('.step'); if (st) { stopPlay(); goToStep(+st.dataset.i); }
  });
  $('#tlSteps').addEventListener('dblclick', e => {
    const st = e.target.closest('.step'); if (!st || e.target.closest('[data-del]')) return;
    const s = S.deriv.steps[+st.dataset.i]; const name = prompt('Describe this step:', s.desc);
    if (name != null) { s.desc = name; renderTimeline(); autosave(); }
  });

  /* ═════════════ Caption & toast ═════════════ */
  let capTimer, toastTimer;
  function showCaption(html, ms = 1800) {
    const c = $('#caption'); c.innerHTML = html; c.hidden = false;
    clearTimeout(capTimer); if (ms) capTimer = setTimeout(() => { c.hidden = true; }, ms);
  }
  function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms); }

  /* ═════════════ Tree operations ═════════════ */
  const primary = () => S.sel[S.sel.length - 1] || null;
  function select(ids) { S.sel = [].concat(ids).filter(Boolean); S.selArrow = null; redraw(); ensureVisible(primary()); }
  function ensureVisible(id) {
    const r = id && S.layout && S.layout.recs.get(id); if (!r) return;
    const a = toScreen(r.x - r.w / 2, r.y), b = toScreen(r.x + r.w / 2, r.y + r.h);
    const W = wrap.clientWidth, H = wrap.clientHeight, m = 50;
    let dx = 0, dy = 0;
    if (a.x < m) dx = m - a.x; else if (b.x > W - m) dx = W - m - b.x;
    if (a.y < m) dy = m - a.y; else if (b.y > H - m) dy = H - m - b.y;
    if (dx || dy) { S.view.x += dx; S.view.y += dy; applyView(); }
  }
  // which side Tab adds a daughter on (Build → Options)
  const tabAt = () => (disp().tabSide === 'left' ? 0 : undefined);
  const arrOf = h => (h.parent ? h.parent.ch : S.doc.roots);
  function addChild(id, label = '', at) {
    let nid;
    commit('Add node', () => {
      const h = T.find(S.doc, id); if (!h) return false;
      const n = T.mk(label); nid = n.id;
      if (at === undefined) h.node.ch.push(n); else h.node.ch.splice(at, 0, n);
    }, { animate: false });
    return nid;
  }
  function addSister(id, label = '', before = false) {
    let nid;
    commit('Add node', () => {
      const h = T.find(S.doc, id); if (!h) return false;
      const arr = arrOf(h);
      const n = T.mk(label); nid = n.id;
      arr.splice(arr.indexOf(h.node) + (before ? 0 : 1), 0, n);
    }, { animate: false });
    return nid;
  }
  function addRoot(label = '') { let nid; commit('Add tree', () => { const n = T.mk(label); nid = n.id; S.doc.roots.push(n); }, { animate: false }); return nid; }
  // a new node between this node and all of its daughters
  function insertLayerBelow(id) {
    let nid;
    commit('Insert layer', () => { const h = T.find(S.doc, id); if (!h) return false; const L = T.mk('', h.node.ch); h.node.ch = [L]; nid = L.id; });
    if (nid) startEdit(nid, { isNew: true, initial: '', keepEmpty: true });
  }
  // wrap the node in a new projection with a head: [XP [X word] node] — type XP, Tab (X is filled in), Tab, the word
  function insertProjection(id, headRight = false) {
    let P, H, W;
    commit('Insert projection', () => {
      const h = T.find(S.doc, id); if (!h) return false;
      W = T.mk(''); H = T.mk('', [W]); P = T.mk('', headRight ? [h.node, H] : [H, h.node]);
      const arr = arrOf(h); arr[arr.indexOf(h.node)] = P;
    });
    if (!P) return;
    S.snip = { holes: [P.id, H.id, W.id], i: 0, derive: new Map([[H.id, P.id]]) };
    goHole();
  }
  const headOf = l => { const m = /^(.+?)P(_.*)?$/.exec(l) || /^(.+?)(?:'+|′+|-bar)$/.exec(l); return m ? m[1] : l; };
  function relabelMany(ids) {
    if (!ids.length) return;
    const labels = [...new Set(ids.map(id => (T.find(S.doc, id) || { node: { label: '' } }).node.label))];
    askText(`Relabel ${ids.length} node${ids.length > 1 ? 's' : ''} to…`, labels.length === 1 ? labels[0] : '').then(v => {
      if (v == null) return;
      commit(`Relabel ${ids.length} → ${v.trim()}`, () => { ids.forEach(id => { const h = T.find(S.doc, id); if (h) h.node.label = v.trim(); }); }, { animate: false });
    });
  }
  function selectSameLabel(id) {
    const h = T.find(S.doc, id); if (!h) return;
    const ids = []; T.walkDoc(S.doc, n => { if (n.label === h.node.label && !!n.ch.length === !!h.node.ch.length) ids.push(n.id); });
    S.sel = [id, ...ids.filter(x => x !== id)]; S.selArrow = null; redraw();
    toast(`${ids.length} node(s) labelled “${h.node.label || '·'}” — F2 relabels them all`, 2400);
  }
  function wrapNode(id, label = '') {
    let nid;
    commit('Add mother', () => {
      const h = T.find(S.doc, id); if (!h) return false;
      const p = T.mk(label, [h.node]); nid = p.id;
      const arr = arrOf(h); arr[arr.indexOf(h.node)] = p;
    });
    return nid;
  }
  // Group sisters (or separate trees) under a new mother
  function groupNodes(ids, label = '') {
    const hs = ids.map(id => T.find(S.doc, id)).filter(Boolean);
    const top = hs.filter(h => !hs.some(o => o !== h && T.contains(o.node, h.node.id)));
    if (!top.length) return null;
    if (top.length === 1) return wrapNode(top[0].node.id, label);
    const key = h => (h.parent ? h.parent.id : '#root');
    if (new Set(top.map(key)).size !== 1) { toast('To group nodes they must be sisters (same mother) — or separate words/trees.', 3500); return null; }
    let gid;
    commit(`Group${label ? ' as ' + label : ''}`, () => {
      const first = T.find(S.doc, top[0].node.id);
      const arr = arrOf(first);
      const members = top.map(h => h.node.id).map(id => arr.find(n => n.id === id)).filter(Boolean).sort((a, b) => arr.indexOf(a) - arr.indexOf(b));
      const at = arr.indexOf(members[0]);
      const g = T.mk(label, members); gid = g.id;
      for (const m of members) arr.splice(arr.indexOf(m), 1);
      arr.splice(at, 0, g);
    });
    return gid;
  }
  function deleteNodes(ids, splice = false) {
    if (!ids.length) return;
    let next = null;
    commit(splice ? 'Remove node' : 'Delete', () => {
      for (const id of ids) {
        const h = T.find(S.doc, id); if (!h) continue;
        const arr = arrOf(h); const i = arr.indexOf(h.node);
        if (splice) arr.splice(i, 1, ...h.node.ch); else arr.splice(i, 1);
        next = h.parent ? h.parent.id : (arr[i] || arr[i - 1] || {}).id || null;
      }
    });
    S.sel = next && T.find(S.doc, next) ? [next] : []; redraw();
  }
  function setProp(ids, prop, value, desc) {
    if (!ids.length) return;
    commit(desc || 'Style', () => {
      ids.forEach(id => { const h = T.find(S.doc, id); if (!h) return; if (value === undefined || value === false || value === '') delete h.node[prop]; else h.node[prop] = value; });
    }, { animate: prop === 'roof' });
  }
  function toggleProp(ids, prop, desc) {
    const h = T.find(S.doc, ids[0]); if (!h) return;
    setProp(ids, prop, !h.node[prop], desc);
  }
  function reorder(id, dir) {
    commit('Reorder', () => {
      const h = T.find(S.doc, id); if (!h) return false;
      const arr = arrOf(h); const i = arr.indexOf(h.node), j = i + dir;
      if (j < 0 || j >= arr.length) return false;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    });
  }
  // Renumber movement chains in the order a bottom-up (cyclic) derivation performs them:
  // the chain whose first landing site is deepest moves first and gets 1 (or i), and so on.
  function cyclicRenumber(doc, { force = false } = {}) {
    const style = S.theory.moveIndex || 'number';
    if (!force && (style === 'none' || S.theory.cyclicIndex === false)) return false;
    const binders = S.theory.qrBinder && S.features.sem;
    const pos = new Map(); let order = 0;
    const groups = new Map(); const binderLeaves = [];
    const antes = new Set(); T.walkDoc(doc, n => { if (n.ante) antes.add(n.ante); });
    T.walkDoc(doc, (n, parent, depth) => {
      pos.set(n.id, { depth, order: order++ });
      if (binders && !n.ch.length && /^\d+$/.test(n.label) && parent && parent.ch.length === 2) { binderLeaves.push(n); return; }
      const i = idxOf(n.label); if (!i) return;
      if (!groups.has(i)) groups.set(i, []);
      groups.get(i).push(n);
    });
    const chains = [];
    groups.forEach((ns, i) => {
      if (ns.length < 2) return;
      const isChain = ns.some(n => isTraceLabel(n.label) || n.silent || n.ante) || ns.some(n => antes.has(n.id));
      if (!isChain) return;
      const ps = ns.map(n => pos.get(n.id)).sort((a, b) => b.depth - a.depth || a.order - b.order);
      const launch = ps[0], land = ps[1];
      chains.push({ i, key: [-land.depth, -launch.depth, land.order] });
    });
    if (!chains.length) return false;
    chains.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);
    // indices not in chains (binding, agreement…) are kept and skipped over
    const chainIdx = new Set(chains.map(c => c.i));
    const taken = new Set([...groups.keys()].filter(i => !chainIdx.has(i)));
    const letters = style === 'letter';
    const seq = letters ? 'ijklmnopqrsuvwxyz'.split('') : Array.from({ length: 999 }, (_, k) => String(k + 1));
    const map = new Map(); let k = 0;
    chains.forEach(c => { while (taken.has(seq[k])) k++; map.set(c.i, seq[k++] || c.i); });
    if ([...map].every(([a, b]) => a === b)) return false;
    T.walkDoc(doc, n => {
      if (binderLeaves.includes(n)) { if (map.has(n.label)) n.label = map.get(n.label); return; }
      const i = idxOf(n.label); if (!i || !map.has(i)) return;
      n.label = n.label.replace(/_(\{?)([^}_^\s]+)(\}?)$/, (m, a, _b, c) => `_${a}${map.get(i)}${c}`);
    });
    return true;
  }
  function renumberChains() {
    commit('Renumber chains', () => (cyclicRenumber(S.doc, { force: true }) ? undefined : false), { animate: false });
  }
  function nextIndex(label) {
    const have = idxOf(label); if (have) return have;
    const style = S.theory.moveIndex || 'number';
    if (style === 'none') return null;
    if (style === 'letter') {
      const used = new Set(); T.walkDoc(S.doc, n => { const i = idxOf(n.label); if (i) used.add(i); });
      return 'ijklmnopqrsuvwxyz'.split('').find(c => !used.has(c)) || String(T.maxIndex(S.doc) + 1);
    }
    return String(T.maxIndex(S.doc) + 1);
  }
  // Drag to rearrange vs. drag to transform (and what a transformation leaves behind)
  const dragKind = () => S.theory.dragMode || (S.theory.movement && S.theory.movement !== 'none' ? 'transform' : 'rearrange');
  const leaveKind = () => S.theory.leave || (S.theory.movement === 'copy' ? 'copy' : 'trace');
  const transformMode = () => (dragKind() === 'transform' ? leaveKind() : 'none');
  function strip(l) { return S.C ? S.C.strip(l) : l; }
  function coindex(ids) {
    if (ids.length < 2) { toast('Select two or more nodes to coindex.'); return; }
    const used = new Set(); T.walkDoc(S.doc, n => { const i = idxOf(n.label); if (i) used.add(i); });
    const existing = ids.map(id => idxOf(T.find(S.doc, id).node.label)).find(Boolean);
    const letter = existing || 'ijklmnopqrs'.split('').find(c => !used.has(c)) || String(T.maxIndex(S.doc) + 1);
    commit(`Coindex _${letter}`, () => {
      ids.forEach(id => { const n = T.find(S.doc, id).node; n.label = n.label.replace(/_\{?[^}_^\s]+\}?$/, '') + '_' + letter; });
    }, { animate: false });
  }
  function addArrow(from, to) {
    if (from === to) return;
    const a = { id: T.newId(), from, to, label: '', side: 'below', heads: 'end', dash: false };
    commit('Draw arrow', () => { arrowsOf(S.doc).push(a); }, { animate: false });
    S.sel = []; S.selArrow = a.id; redraw();
  }
  // Arrows: user-drawn ones live in doc.arrows; movement arrows (trace → antecedent) keep their settings on the trace node
  function getArrow(id) {
    if (!id) return null;
    if (id.startsWith('mv:')) { const l = movementLinks(S.doc).find(x => x.id === id); return l || null; }
    const a = arrowsOf(S.doc).find(x => x.id === id); return a ? { ...a, mv: false } : null;
  }
  const allArrowIds = () => [...movementLinks(S.doc).map(l => l.id), ...arrowsOf(S.doc).map(a => a.id)];
  function updateArrow(id, patch, desc = 'Edit arrow') {
    commit(desc, () => {
      if (id.startsWith('mv:')) { const h = T.find(S.doc, id.slice(3)); if (!h) return false; h.node.arrow = { ...(h.node.arrow || {}), ...patch }; return; }
      const a = arrowsOf(S.doc).find(x => x.id === id); if (!a) return false; Object.assign(a, patch);
    }, { animate: false });
  }
  function deleteArrow(id) {
    if (id.startsWith('mv:')) { updateArrow(id, { hidden: true }, 'Hide arrow'); toast('Movement arrow hidden — Ctrl+K “Show hidden arrows” brings it back.'); }
    else commit('Delete arrow', () => { S.doc.arrows = arrowsOf(S.doc).filter(a => a.id !== id); }, { animate: false });
    S.selArrow = null; redraw();
  }
  function showHiddenArrows() { commit('Show hidden arrows', () => { let any = false; T.walkDoc(S.doc, n => { if (n.arrow && n.arrow.hidden) { delete n.arrow.hidden; any = true; } }); return any ? undefined : false; }, { animate: false }); }
  function nudgeArrow(patch) {
    const a = getArrow(S.selArrow); if (!a) return;
    const p = {}; for (const k in patch) p[k] = (a[k] || 0) + patch[k];
    updateArrow(a.id, p, 'Adjust arrow path');
  }
  function mergeLabelFor(a, b) {
    const ml = S.theory.mergeLabel || 'first';
    if (ml === 'first') return strip(a.label);
    if (ml === 'second') return strip(b.label);
    if (ml === 'blank') return '';
    return ml;
  }
  // Move (or copy) node to a drop target {id, zone}.  zone: child | before | after | above | root
  function dragMode(e) {
    const m = transformMode();
    if (e && e.shiftKey) return m === 'none' ? leaveKind() : 'none';
    return m;
  }
  function moveNode(srcId, tgt, o = {}) {
    const src = T.find(S.doc, srcId); if (!src) return;
    if (tgt.id && (tgt.id === srcId || T.contains(src.node, tgt.id))) { toast("Can't move a node into itself."); return; }
    const mode = o.mode || 'none';
    const leaveTrace = !o.copy && !!src.parent && mode !== 'none' && tgt.zone !== 'root';
    let newMother = null;
    commit(o.copy ? 'Copy' : leaveTrace ? 'Move' : 'Rearrange', () => {
      const r = (() => {
      const s = T.find(S.doc, srcId);
      const mover = o.copy ? T.clone(s.node, false) : s.node;
      let idx = null;
      if (leaveTrace) {
        idx = nextIndex(mover.label);
        if (idx && !idxOf(mover.label)) mover.label += '_' + idx;
        const withIdx = l => (idx ? `${l}_${idx}` : l);
        let trace = null;
        if (mode === 'copy') { trace = T.clone(mover, false); trace.silent = true; }
        else if (mode === 'trace') trace = T.mk(withIdx(S.theory.traceLabel || 't'));
        else if (mode === 'custom') trace = T.mk(withIdx(S.theory.leaveLabel || '∅'));
        if (trace) { trace.ante = mover.id; s.parent.ch[s.parent.ch.indexOf(s.node)] = trace; }
        else T.detach(S.doc, srcId);
      } else if (!o.copy) T.detach(S.doc, srcId);
      if (tgt.zone === 'root') { S.doc.roots.push(mover); return; }
      const t = T.find(S.doc, tgt.id); if (!t) return false;
      const arr = arrOf(t);
      if (tgt.zone === 'child') t.node.ch.push(mover);
      else if (tgt.zone === 'before' || tgt.zone === 'between') arr.splice(arr.indexOf(t.node), 0, mover);
      else if (tgt.zone === 'after') arr.splice(arr.indexOf(t.node) + 1, 0, mover);
      else if (tgt.zone === 'above' || tgt.zone === 'branch') {
        const lab = S.theory.mergeLabel === 'blank' ? '' : strip(t.node.label);
        const P = T.mk(lab);
        const moverLeft = tgt.side ? tgt.side === 'left' : leaveTrace || !S.layout || ((S.layout.recs.get(srcId) || {}).x || 0) <= ((S.layout.recs.get(tgt.id) || {}).x || 0);
        let sister = t.node;
        if (leaveTrace && mode !== 'nothing' && S.theory.qrBinder && S.features.sem && idx) sister = T.mk('', [T.mk(String(idx)), t.node]);
        P.ch = moverLeft ? [mover, sister] : [sister, mover];
        arr[arr.indexOf(t.node)] = P; newMother = P.id;
      }
      })();
      if (r !== false && leaveTrace) cyclicRenumber(S.doc);
      return r;
    }, { select: srcId });
    if (newMother) nameNewMother(newMother);
  }
  // a freshly created intervening/adjunction node: open its label for naming, default kept on Enter
  function nameNewMother(id) { if (T.find(S.doc, id)) startEdit(id, { keepEmpty: true }); }
  function insertNew(node, tgt) {
    let newMother = null;
    commit('Insert ' + (node.label || 'node'), () => {
      if (tgt.zone === 'root') { S.doc.roots.push(node); return; }
      const t = T.find(S.doc, tgt.id); if (!t) return false;
      const arr = arrOf(t);
      if (tgt.zone === 'child') t.node.ch.push(node);
      else if (tgt.zone === 'replace') arr[arr.indexOf(t.node)] = node;
      else if (tgt.zone === 'before' || tgt.zone === 'between') arr.splice(arr.indexOf(t.node), 0, node);
      else if (tgt.zone === 'after') arr.splice(arr.indexOf(t.node) + 1, 0, node);
      else if (tgt.zone === 'above' || tgt.zone === 'branch') { const lab = S.theory.mergeLabel === 'blank' ? '' : strip(t.node.label); const P = T.mk(lab, tgt.side === 'right' ? [t.node, node] : [node, t.node]); arr[arr.indexOf(t.node)] = P; newMother = P.id; }
    }, { select: node.id });
    if (newMother && !S.pendingHoles) nameNewMother(newMother);
  }
  function merge() {
    if (S.sel.length !== 2) { toast('Select two nodes to Merge: click one, Shift-click the other.'); return; }
    const [aId, bId] = S.sel;
    const ra = T.rootOf(S.doc, aId), rb = T.rootOf(S.doc, bId);
    const aRoot = ra && ra.id === aId, bRoot = rb && rb.id === bId;
    if (aRoot && bRoot && ra !== rb) {
      commit('Merge', () => {
        const a = T.find(S.doc, aId).node, b = T.find(S.doc, bId).node;
        const P = T.mk(mergeLabelFor(a, b), [a, b]);
        const i = Math.min(S.doc.roots.indexOf(a), S.doc.roots.indexOf(b));
        S.doc.roots = S.doc.roots.filter(r => r !== a && r !== b);
        S.doc.roots.splice(i, 0, P);
        S.sel = [P.id];
      });
      return;
    }
    if ((aRoot && ra === rb) || (bRoot && ra === rb)) {
      const rootId = aRoot ? aId : bId, inner = aRoot ? bId : aId;
      moveNode(inner, { id: rootId, zone: 'above' }, { mode: dragKind() === 'transform' ? leaveKind() : 'copy' });
      return;
    }
    toast('Merge needs two separate trees, or a tree and something inside it (Internal Merge).');
  }
  function addWords(text) {
    text = (text || '').trim(); if (!text) return;
    if (/^\s*\[/.test(text)) { try { const nd = T.parseBracket(text); commit('Paste', () => { S.doc.roots.push(...nd.roots); }, { fit: true }); } catch (e) { toast(e.message); } return; }
    const words = text.split(/\s+/);
    commit('Add words', () => { words.forEach(w => S.doc.roots.push(T.mk(w))); }, { animate: false, fit: true });
    S.sel = []; redraw();
  }
  // Label chip semantics: multi-selection → group; word → give it a mother; empty node → label it; else add a daughter.
  function applyLabel(label) {
    const ids = S.sel.slice();
    if (ids.length > 1) { const g = groupNodes(ids, label); if (g) select(g); return; }
    const id = ids[0];
    if (!id) { insertNew(T.mk(label), { zone: 'root' }); return; }
    const h = T.find(S.doc, id);
    const isWord = !h.node.ch.length && h.node.label !== '' && !catSet().has(h.node.label);
    if (h.node.label === '') { commit(`Label ${label}`, () => { T.find(S.doc, id).node.label = label; }, { animate: false }); return; }
    if (isWord) { const g = wrapNode(id, label); if (g) select(g); return; }
    insertNew(T.mk(label), { id, zone: 'child' });
  }

  /* ═════════════ Inline editing ═════════════ */
  const ed = $('#inlineEdit');
  let editing = null; // {id, isNew, keepEmpty}
  function positionEditor() {
    if (!editing || !S.layout) return;
    const r = S.layout.recs.get(editing.id); if (!r) return;
    const k = S.view.k;
    const w = Math.max(100, r.w * k + 40);
    ed.style.width = w + 'px';
    ed.style.left = (S.view.x + r.x * k - w / 2) + 'px';
    ed.style.top = (S.view.y + r.y * k - 3) + 'px';
    if (!sg.hidden) { sg.style.left = ed.style.left; sg.style.top = (parseFloat(ed.style.top) + ed.offsetHeight + 4) + 'px'; }
  }
  function startEdit(id, o = {}) {
    const h = T.find(S.doc, id); if (!h) return;
    finishEdit(true);
    S.sel = [id]; S.selArrow = null; redraw();
    editing = { id, isNew: !!o.isNew, keepEmpty: !!o.keepEmpty, hole: !!o.hole };
    ed.hidden = false; hideNodebar();
    ed.value = o.initial !== undefined ? o.initial : h.node.label;
    positionEditor();
    ed.focus();
    if (o.initial === undefined) ed.select(); else ed.setSelectionRange(ed.value.length, ed.value.length);
    if (o.hole && hintsOn()) showCaption('<span class="rule">Template</span>Fill this slot · <kbd>Tab</kbd> next · <kbd>⇧Tab</kbd> previous · <kbd>Enter</kbd> done', 0);
    updateSuggest();
  }
  function finishEdit(save = true) {
    if (!editing) return null;
    const e = editing; editing = null;
    ed.hidden = true;
    const h = T.find(S.doc, e.id);
    if (!h) return null;
    const val = ed.value.trim();
    const dropNew = () => {
      S.doc = JSON.parse(S.undo.pop());
      if (S.deriv.rec && S.deriv.steps.length) { S.deriv.steps.pop(); if (S.deriv.steps.length === 1) S.deriv.steps.pop(); S.deriv.cur = S.deriv.steps.length - 1; }
      S.sel = h.parent ? [h.parent.id] : []; render({ animate: false });
    };
    if (!save) { if (e.isNew && !h.node.label && !e.keepEmpty) dropNew(); else renderNodebar(); wrap.focus(); return null; }
    if (e.isNew) {
      if (!val && !e.keepEmpty) { dropNew(); return null; }
      h.node.label = val;
      if (S.deriv.rec && S.deriv.steps.length) { S.deriv.steps[S.deriv.steps.length - 1].doc = deep(S.doc); S.deriv.steps[S.deriv.steps.length - 1].desc = `Add ${val}`; }
      render({ animate: false });
    } else if (val !== h.node.label) {
      commit(`Relabel ${h.node.label || '∅'} → ${val}`, () => { T.find(S.doc, e.id).node.label = val; }, { animate: false });
    } else renderNodebar();
    return e.id;
  }
  /* ── template suggestions under the label box ── */
  const sg = $('#suggest');
  let sug = { items: [], hi: -1 };
  function updateSuggest() {
    if (!editing) { hideSuggest(); return; }
    const h = T.find(S.doc, editing.id);
    const v = ed.value.trim();
    if (!h || h.node.ch.length || !v || !S.tpl) { hideSuggest(); return; }
    const items = S.tpl.list.filter(t => t.re.test(v)).slice(0, 8);
    sug = { items, hi: -1 };
    if (!items.length) { hideSuggest(); return; }
    paintSuggest();
  }
  function paintSuggest() {
    const v = ed.value.trim();
    sg.innerHTML = `<div class="sg-head xhint">↓↑ choose · Enter insert · Enter alone = just the label</div>` + sug.items.map((t, i) => `<div class="sg${i === sug.hi ? ' hi' : ''}" data-i="${i}"><b>${esc(t.name)}</b>${templateMini(t, v)}</div>`).join('');
    sg.hidden = false;
    const hiEl = sg.querySelector('.sg.hi'); if (hiEl) hiEl.scrollIntoView({ block: 'nearest' });
    sg.style.left = ed.style.left; sg.style.top = (parseFloat(ed.style.top) + ed.offsetHeight + 4) + 'px';
  }
  function hideSuggest() { sg.hidden = true; sug = { items: [], hi: -1 }; }
  sg.addEventListener('pointerdown', e => { e.preventDefault(); const it = e.target.closest('.sg'); if (it) applyTemplate(sug.items[+it.dataset.i]); });
  ed.addEventListener('input', updateSuggest);

  /* ── snippets: Tab walks through the empty slots of an inserted template ── */
  function startSnippet(holes) {
    holes = (holes || []).filter(id => T.find(S.doc, id));
    if (!holes.length) { S.snip = null; return; }
    S.snip = { holes, i: 0 };
    goHole();
  }
  function goHole() {
    const sn = S.snip; if (!sn) return;
    while (sn.i < sn.holes.length && !T.find(S.doc, sn.holes[sn.i])) sn.i++;
    if (sn.i >= sn.holes.length) { endSnippet(); return; }
    const hid = sn.holes[sn.i];
    if (sn.derive && sn.derive.has(hid)) { const p = T.find(S.doc, sn.derive.get(hid)), hh = T.find(S.doc, hid); if (p && hh && !hh.node.label && p.node.label) hh.node.label = headOf(p.node.label); }
    startEdit(hid, { isNew: true, keepEmpty: true, hole: true });
  }
  function commitHole() {
    if (!editing) return;
    const e = editing; editing = null; ed.hidden = true; hideSuggest();
    const h = T.find(S.doc, e.id); if (!h) return;
    const v = ed.value.trim();
    if (v) h.node.label = v;
    else if (!h.node.ch.length && h.node.label === '') { arrOf(h).splice(arrOf(h).indexOf(h.node), 1); }
  }
  function endSnippet(cancelCurrent) {
    $('#caption').hidden = true;
    if (editing && editing.hole) { if (cancelCurrent) ed.value = ''; commitHole(); }
    const sn = S.snip; S.snip = null;
    if (sn) sn.holes.forEach(id => { const h = T.find(S.doc, id); if (h && h.node.label === '' && !h.node.ch.length) arrOf(h).splice(arrOf(h).indexOf(h.node), 1); });
    render({ animate: false }); wrap.focus();
  }
  function applyTemplate(t) {
    if (!editing || !t) return;
    const e = editing; const label = ed.value.trim();
    const exp = T.expandTemplate(t, label); if (!exp) return;
    editing = null; ed.hidden = true; hideSuggest();
    exp.node.id = e.id;
    const apply = () => { const h = T.find(S.doc, e.id); const arr = arrOf(h); arr[arr.indexOf(h.node)] = exp.node; };
    if (e.isNew) { apply(); render({ animate: false }); }
    else commit(`Insert ${t.name}`, apply, { animate: false });
    if (S.snip && e.hole) { S.snip.holes.splice(S.snip.i, 1, ...exp.holes); goHole(); }
    else startSnippet(exp.holes);
  }
  ed.addEventListener('keydown', e => {
    e.stopPropagation();
    // suggestion popup navigation
    if (!sg.hidden && sug.items.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sug.hi = (sug.hi + 1) % sug.items.length; paintSuggest(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); sug.hi = sug.hi <= 0 ? sug.items.length - 1 : sug.hi - 1; paintSuggest(); return; }
      if ((e.key === 'Enter' || e.key === 'Tab') && sug.hi >= 0 && !e.shiftKey) { e.preventDefault(); applyTemplate(sug.items[sug.hi]); return; }
      if (e.key === 'Escape' && sug.hi >= 0) { e.preventDefault(); sug.hi = -1; paintSuggest(); return; }
    }
    // inside a template: Tab / Shift+Tab move between slots
    if (editing && editing.hole && S.snip) {
      if (e.key === 'Tab') {
        e.preventDefault(); commitHole();
        if (e.shiftKey) { S.snip.i = Math.max(0, S.snip.i - 1); while (S.snip.i > 0 && !T.find(S.doc, S.snip.holes[S.snip.i])) S.snip.i--; }
        else S.snip.i++;
        render({ animate: false }); goHole(); return;
      }
      if (e.key === 'Enter') { e.preventDefault(); endSnippet(); return; }
      if (e.key === 'Escape') { e.preventDefault(); endSnippet(true); return; }
    }
    hideSuggest();
    if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); wrap.focus(); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishEdit(true); wrap.focus(); return; }
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); const id = finishEdit(true); if (id) newAndEdit(() => addSister(id)); return; }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const id = finishEdit(true); if (id) newAndEdit(() => addChild(id, '', tabAt())); return; }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault(); const id = finishEdit(true); if (!id) return;
      const h = T.find(S.doc, id);
      if (h && h.parent) newAndEdit(() => addSister(h.parent.id)); else if (h) newAndEdit(() => addSister(id));
    }
  });
  ed.addEventListener('blur', () => { setTimeout(() => { if (document.activeElement === ed) return; if (editing) { if (editing.hole) endSnippet(); else finishEdit(true); } hideSuggest(); }, 0); });
  function newAndEdit(make) { const id = make(); if (id) startEdit(id, { isNew: true, initial: '' }); }
  function groupAndEdit(initial = '') { const g = groupNodes(S.sel.slice(), ''); if (g) startEdit(g, { initial, keepEmpty: true }); }

  /* ═════════════ Pointer: select, lasso, pan, drag, pick, menus ═════════════ */
  let ptr = null, drag = null, lastClick = { key: null, t: 0 }, longPress = null;
  svg.addEventListener('contextmenu', e => e.preventDefault());
  svg.addEventListener('mouseover', e => { const t = e.target.closest('.avm-tag'); if (!t) return; svg.querySelectorAll(`.avm-tag[data-tag="${CSS.escape(t.dataset.tag)}"]`).forEach(x => x.classList.add('hot')); });
  svg.addEventListener('mouseout', e => { const t = e.target.closest('.avm-tag'); if (!t) return; svg.querySelectorAll('.avm-tag.hot').forEach(x => x.classList.remove('hot')); });
  svg.addEventListener('pointerdown', e => {
    closeMenu();
    if (e.button === 2) return;
    if (editing) finishEdit(true);
    const g = e.target.closest('.node');
    const ar = e.target.closest('[data-arrow]');
    const hd = e.target.closest('[data-handle]');
    if (hd && ar) {
      const a = getArrow(ar.dataset.arrow);
      svg.setPointerCapture(e.pointerId);
      const geo = S.routes && S.routes.get(a.id);
      const base = {}; ARROW_KEYS.forEach(k => { base[k] = a[k]; });
      ptr = { mode: 'ahandle', id: a.id, which: hd.dataset.handle, w0: toWorld(e), base, geo, x: e.clientX, y: e.clientY };
      return;
    }
    const panMode = e.button === 1 || S.spaceDown || (e.pointerType === 'touch' && !g);
    svg.setPointerCapture(e.pointerId);
    wrap.focus({ preventScroll: true });
    if (panMode) { ptr = { mode: 'pan', x: e.clientX, y: e.clientY, vx: S.view.x, vy: S.view.y, moved: false }; return; }
    if (ar && !S.pick) { S.selArrow = ar.dataset.arrow; S.sel = []; redraw(); ptr = null; return; }
    if (g) {
      if (S.pick) { finishPick(g.dataset.id); ptr = null; return; }
      const fp = e.target.closest('[data-fpath]');
      ptr = { mode: 'press', id: g.dataset.id, x: e.clientX, y: e.clientY, shift: e.shiftKey || e.metaKey || e.ctrlKey, mod: e.ctrlKey || e.metaKey, fpath: fp ? fp.dataset.fpath : null };
      if (e.pointerType === 'touch') longPress = setTimeout(() => { const id = ptr && ptr.id; ptr = null; if (id) { if (!S.sel.includes(id)) select(id); openMenu(e.clientX, e.clientY, 'node'); } }, 550);
    } else {
      if (S.pick) { cancelPick(); return; }
      ptr = { mode: 'lasso', x: e.clientX, y: e.clientY, w0: toWorld(e), shift: e.shiftKey || e.metaKey || e.ctrlKey };
    }
  });
  svg.addEventListener('pointermove', e => {
    if (drag) { updateDrag(e); return; }
    if (!ptr) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y, dist = Math.hypot(dx, dy);
    if (ptr.mode === 'press' && dist > 5 && ptr.mod) {
      const n = T.find(S.doc, ptr.id);
      if (n) { ptr.mode = 'pos'; ptr.base = n.node.pos && n.node.pos.sig === posSig(n.node, n.parent) ? { ...n.node.pos } : { dx: 0, dy: 0 }; S.sel = [ptr.id]; hideNodebar(); }
    }
    if (ptr.mode === 'pos') {
      const DEAD = 10, k = S.view.k;
      const fr = d => (Math.abs(d) < DEAD ? 0 : d - Math.sign(d) * DEAD);
      const ddx = fr(dx / k), ddy = fr(dy / k);
      S.posDrag = { id: ptr.id, dx: Math.round((ptr.base.dx + ddx) / 2) * 2, dy: Math.round((ptr.base.dy + ddy) / 2) * 2 };
      ptr.moved = true; S.layout = layout(S.doc); draw(S.layout); return;
    }
    if (ptr.mode === 'press' && dist > 5) {
      clearTimeout(longPress);
      const n = T.find(S.doc, ptr.id);
      if (n) { if (!S.sel.includes(ptr.id)) { S.sel = [ptr.id]; redraw(); } startDrag({ kind: 'node', id: ptr.id }, n.node.label || '∅', e); }
      ptr = null; return;
    }
    if (ptr.mode === 'ahandle') {
      const w = toWorld(e); const ddx = w.x - ptr.w0.x, ddy = w.y - ptr.w0.y;
      if (dist > 2) ptr.moved = true;
      const v = { ...ptr.base }, b = ptr.base, g = ptr.geo;
      const which = ptr.which === 'bend1' ? 'c1' : ptr.which;
      if (which === 'mid') v.dy = Math.round((b.dy || 0) + ddy);
      else if (which === 'p1') { v.dx1 = Math.round((b.dx1 || 0) + ddx); v.dy1 = Math.round((b.dy1 || 0) + ddy); }
      else if (which === 'p2') { v.dx2 = Math.round((b.dx2 || 0) + ddx); v.dy2 = Math.round((b.dy2 || 0) + ddy); }
      else if ((which === 'c1' || which === 'c2') && g) {
        const n = which === 'c1' ? 1 : 2;
        const ox = n === 1 ? g.x1 : g.x2, oy = n === 1 ? g.y1 : g.y2;
        let ang = Math.atan2(w.y - oy, w.x - ox) * 180 / Math.PI;
        if (e.shiftKey) ang = Math.round(ang / 15) * 15;
        v.shape = 'free';
        if (g.shape !== 'free') { v.a1 = b.a1 ?? g.ang1; v.a2 = b.a2 ?? g.ang2; }
        v['a' + n] = normDeg(ang); v['l' + n] = Math.max(8, Math.round(Math.hypot(w.x - ox, w.y - oy)));
      }
      S.arrowDrag = { id: ptr.id, ...v }; draw(S.layout); return;
    }
    if (ptr.mode === 'pan') {
      if (dist > 3) ptr.moved = true;
      svg.classList.add('panning'); S.view.x = ptr.vx + dx; S.view.y = ptr.vy + dy; applyView(); return;
    }
    if (ptr.mode === 'lasso' && (ptr.active || dist > 4)) {
      ptr.active = true;
      const w = toWorld(e), a = ptr.w0;
      const x = Math.min(a.x, w.x), y = Math.min(a.y, w.y), W = Math.abs(a.x - w.x), H = Math.abs(a.y - w.y);
      ptr.rect = { x, y, W, H };
      $('#gDrop').innerHTML = `<rect class="lasso" x="${x}" y="${y}" width="${W}" height="${H}" rx="3"/>`;
    }
  });
  svg.addEventListener('pointerup', e => {
    clearTimeout(longPress);
    svg.classList.remove('panning');
    if (drag) { endDrag(e); return; }
    if (!ptr) return;
    const p = ptr; ptr = null;
    if (p.mode === 'pos') { S.posDragAt = performance.now(); const v = S.posDrag; S.posDrag = null; if (v) setPos(p.id, v.dx, v.dy); else render({ animate: false }); return; }
    if (p.mode === 'ahandle') {
      const now0 = performance.now(); const key0 = 'h:' + p.id + p.which;
      const dbl0 = lastClick.key === key0 && now0 - lastClick.t < 380;
      lastClick = { key: dbl0 ? null : key0, t: now0 };
      const v = S.arrowDrag; S.arrowDrag = null;
      const RESET = { mid: { dy: 0 }, p1: { dx1: 0, dy1: 0 }, p2: { dx2: 0, dy2: 0 }, c1: { a1: undefined, l1: undefined }, c2: { a2: undefined, l2: undefined }, bend1: {} };
      if (dbl0) { updateArrow(p.id, RESET[p.which] || {}, 'Reset arrow path'); return; }
      if (p.moved && v) { const patch = {}; ARROW_KEYS.forEach(k => { if (v[k] !== p.base[k]) patch[k] = v[k]; }); updateArrow(p.id, patch, 'Adjust arrow path'); } else draw(S.layout);
      return;
    }
    if (p.mode === 'pan') { if (!p.moved && e.pointerType === 'touch') bgClick(e, p); return; }
    if (p.mode === 'lasso' && p.active) {
      $('#gDrop').innerHTML = '';
      const r = p.rect; const hits = [];
      S.layout.recs.forEach(rc => { if (rc.pseudo) return; const x0 = rc.x - rc.w / 2; if (x0 < r.x + r.W && x0 + rc.w > r.x && rc.y < r.y + r.H && rc.y + rc.h > r.y) hits.push(rc); });
      // prefer the highest nodes: drop nodes whose ancestor is also hit
      const ids = new Set(hits.map(h => h.id));
      const tops = hits.filter(h => { let q = h.parentId; while (q) { if (ids.has(q)) return false; q = (S.layout.recs.get(q) || {}).parentId; } return true; }).sort((a, b) => a.x - b.x).map(h => h.id);
      S.sel = p.shift ? [...new Set([...S.sel, ...tops])] : tops; S.selArrow = null;
      redraw();
      return;
    }
    const now = performance.now();
    const key = p.mode === 'press' ? p.id : '#bg';
    const dbl = lastClick.key === key && now - lastClick.t < 380;
    lastClick = { key: dbl ? null : key, t: now };
    if (p.mode === 'press') {
      if (p.fpath && !p.shift) { lastClick = { key: null, t: 0 }; S.sel = [p.id]; toggleFold(p.id, p.fpath); return; }
      if (dbl && !p.shift) { startEdit(p.id); return; }
      if (p.shift) S.sel = S.sel.includes(p.id) ? S.sel.filter(x => x !== p.id) : [...S.sel, p.id];
      else S.sel = [p.id];
      S.selArrow = null; redraw();
    } else bgClick(e, p, dbl);
  });
  function bgClick(e, p, dbl) {
    if (!S.doc.roots.length || dbl) newAndEdit(() => addRoot());
    else if (S.sel.length || S.selArrow) { S.sel = []; S.selArrow = null; redraw(); }
  }
  svg.addEventListener('pointercancel', () => { ptr = null; clearTimeout(longPress); $('#gDrop').innerHTML = ''; if (drag) cancelDrag(); });
  wrap.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (ptr && ptr.mode === 'pos' || performance.now() - (S.posDragAt || 0) < 400) return;
    if (editing) finishEdit(true);
    const g = e.target.closest('.node'), ar = e.target.closest('[data-arrow]');
    if (ar) { S.selArrow = ar.dataset.arrow; S.sel = []; redraw(); openMenu(e.clientX, e.clientY, 'arrow'); return; }
    if (g) { if (!S.sel.includes(g.dataset.id)) { S.sel = [g.dataset.id]; S.selArrow = null; redraw(); } openMenu(e.clientX, e.clientY, S.sel.length > 1 ? 'multi' : 'node'); return; }
    if (e.target.closest('#nodebar, .start-card, #lessonCard')) return;
    S.menuWorld = toWorld(e);
    openMenu(e.clientX, e.clientY, 'canvas');
  });

  // pick mode: choose a target node by clicking, or with the arrow keys + Enter
  const PICK_TEXT = {
    arrow: 'Point the arrow at…', coindex: 'Coindex with…', 'move-child': 'Move it — as a daughter of…',
    'move-before': 'Move it — as left sister of…', 'move-adjr': 'Move it — adjoined to the right of…', 'move-after': 'Move it — as right sister of…', 'move-above': 'Move it — adjoined above…',
  };
  function startPick(kind, from) {
    S.pick = { kind, from, cursor: from };
    wrap.classList.add('picking'); hideNodebar();
    const b = $('#pickBanner'); b.hidden = false;
    b.innerHTML = `${esc(PICK_TEXT[kind] || 'Choose a node')} &nbsp;<b>click</b> or <kbd>←↑↓→</kbd> + <kbd>Enter</kbd> · <kbd>Esc</kbd> cancels`;
    redraw(); wrap.focus({ preventScroll: true });
  }
  function cancelPick() { S.pick = null; wrap.classList.remove('picking'); $('#pickBanner').hidden = true; redraw(); }
  function finishPick(id) {
    const p = S.pick; cancelPick();
    if (!p || !id) return;
    if (p.kind === 'arrow') addArrow(p.from, id);
    else if (p.kind === 'coindex') { S.sel = [p.from, id]; coindex(S.sel); }
    else if (p.kind.startsWith('move-')) {
      if (id === p.from) { toast('Pick a different node.'); return; }
      const zone = p.kind === 'move-adjr' ? 'branch' : p.kind.slice(5);
      moveNode(p.from, { id, zone, side: p.kind === 'move-adjr' ? 'right' : p.kind === 'move-above' ? 'left' : undefined }, { mode: transformMode() });
    }
  }

  const LEAVE_TEXT = { trace: 'leaves a trace', copy: 'leaves an unpronounced copy', nothing: 'leaves nothing behind', custom: 'leaves a placeholder' };
  const ZONE_TEXT = { between: 'insert as a daughter here', branch: 'adjoin on this branch (new intervening node)', child: 'make it a daughter', before: 'insert as left sister', after: 'insert as right sister', above: 'adjoin above / Merge', root: 'make it a separate tree' };
  function startDrag(src, label, e) {
    drag = { src, label, tgt: null };
    $('#ghost').hidden = false; hideNodebar();
    updateDrag(e);
  }
  function hitTest(w) {
    if (!S.layout) return null;
    let best = null;
    S.layout.recs.forEach(r => {
      if (r.pseudo) return;
      const x0 = r.x - r.w / 2 - 3, y0 = r.y - 12;
      if (w.x >= x0 && w.x <= x0 + r.w + 6 && w.y >= y0 && w.y <= y0 + r.h + 16) {
        if (!best || r.w * r.h < best.w * best.h) best = r;
      }
    });
    if (!best) return gapOrBranch(w);
    const rx = (w.x - (best.x - best.w / 2)) / best.w, ry = (w.y - best.y) / best.h;
    let zone = 'child';
    if (ry < 0.22) zone = 'above';
    else if (rx < 0.22) zone = 'before';
    else if (rx > 0.78) zone = 'after';
    return { id: best.id, zone, r: best };
  }
  // Between two sisters → new daughter in the middle; on a branch line → intervening (adjunction) node
  function gapOrBranch(w) {
    const L = S.layout; let hit = null;
    T.walkDoc(S.doc, n => {
      if (hit || n.ch.length < 2 || n.roof) return;
      for (let i = 0; i + 1 < n.ch.length; i++) {
        const a = L.recs.get(n.ch[i].id), b = L.recs.get(n.ch[i + 1].id); if (!a || !b) continue;
        const gx0 = a.x + a.w / 2, gx1 = b.x - b.w / 2, top = Math.min(a.y, b.y) - 14, bot = Math.max(a.y + a.h, b.y + b.h) + 6;
        if (w.x > gx0 - 2 && w.x < gx1 + 2 && w.y > top && w.y < bot) { hit = { id: n.ch[i + 1].id, zone: 'between', gx: (Math.max(gx0, a.x) + Math.min(gx1, b.x)) / 2, gy0: top + 6, gy1: bot }; return; }
      }
    });
    if (hit) return hit;
    let best = null, bd = 8;
    for (const e of L.edges) {
      if (e.roof) continue;
      const p = L.recs.get(e.p), c = L.recs.get(e.c); if (!p || !c || c.pseudo) continue;
      const x1 = p.x, y1 = p.y + p.h, x2 = c.x, y2 = c.y;
      const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1;
      const t = clamp(((w.x - x1) * dx + (w.y - y1) * dy) / len2, 0.08, 0.92);
      const px = x1 + t * dx, py = y1 + t * dy, dd = Math.hypot(w.x - px, w.y - py);
      if (dd < bd) { bd = dd; const side = (w.x - px) * dy - (w.y - py) * dx > 0 ? 'left' : 'right'; best = { id: e.c, zone: 'branch', side, seg: [x1, y1, x2, y2] }; }
    }
    return best;
  }
  function updateDrag(e) {
    const gh = $('#ghost');
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const inCanvas = el && wrap.contains(el) && !el.closest('#nodebar');
    let tgt = null;
    if (inCanvas) {
      tgt = hitTest(toWorld(e)) || { zone: 'root' };
      if (drag.src.kind === 'node' && tgt.id) {
        const sn = T.find(S.doc, drag.src.id);
        if (sn && (tgt.id === drag.src.id || T.contains(sn.node, tgt.id))) tgt = null;
      }
      if (drag.src.kind === 'node' && tgt && tgt.zone === 'root') { const h = T.find(S.doc, drag.src.id); if (h && !h.parent) tgt = null; }
    }
    drag.tgt = tgt;
    let extra = '';
    if (drag.src.kind === 'node' && tgt) {
      if (e.altKey) extra = ' · copy';
      else if (tgt.zone !== 'root' && T.find(S.doc, drag.src.id)?.parent) {
        const m = dragMode(e);
        extra = m === 'none' ? ' · hold Shift to transform' : ` · ${LEAVE_TEXT[m]} · Shift: just rearrange`;
      }
    }
    gh.innerHTML = `${esc(drag.label)}<small>${tgt ? ZONE_TEXT[tgt.zone] + extra : 'drop on the canvas'}</small>`;
    gh.style.left = (e.clientX + 14) + 'px'; gh.style.top = (e.clientY + 10) + 'px';
    drawDrop(tgt);
  }
  function drawDrop(t) {
    const g = $('#gDrop');
    if (t && t.zone === 'between') { g.innerHTML = `<line class="drop-line" x1="${t.gx}" x2="${t.gx}" y1="${t.gy0}" y2="${t.gy1}"/>`; return; }
    if (t && t.zone === 'branch') { const [a, b, c, d] = t.seg; g.innerHTML = `<line class="drop-line" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/><circle class="drop-dot" cx="${(a + c) / 2}" cy="${(b + d) / 2}" r="5"/>`; return; }
    if (!t || !t.r) { g.innerHTML = ''; return; }
    const r = t.r, x0 = r.x - r.w / 2, y0 = r.y;
    let h = `<rect class="drop-box" x="${x0 - 4}" y="${y0 - 4}" width="${r.w + 8}" height="${r.h + 8}"/>`;
    if (t.zone === 'before') h += `<line class="drop-line" x1="${x0 - 9}" x2="${x0 - 9}" y1="${y0 - 4}" y2="${y0 + r.h + 4}"/>`;
    if (t.zone === 'after') h += `<line class="drop-line" x1="${x0 + r.w + 9}" x2="${x0 + r.w + 9}" y1="${y0 - 4}" y2="${y0 + r.h + 4}"/>`;
    if (t.zone === 'above') h += `<line class="drop-line" x1="${x0 - 6}" x2="${x0 + r.w + 6}" y1="${y0 - 10}" y2="${y0 - 10}"/>`;
    if (t.zone === 'child') h += `<line class="drop-line" x1="${r.x}" x2="${r.x}" y1="${y0 + r.h + 6}" y2="${y0 + r.h + 22}"/>`;
    g.innerHTML = h;
  }
  function endDrag(e) {
    const d = drag; cancelDrag();
    if (!d.tgt) { renderNodebar(); return; }
    if (d.src.kind === 'node') moveNode(d.src.id, d.tgt, { copy: e.altKey, mode: dragMode(e) });
    else { S.pendingHoles = null; const node = d.src.make(); const holes = S.pendingHoles; insertNew(node, d.tgt); if (holes) startSnippet(holes); }
  }
  function cancelDrag() { drag = null; $('#ghost').hidden = true; $('#gDrop').innerHTML = ''; }

  function chipPointer(el, make, label, onClick) {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY; let started = false;
      const mv = ev => {
        if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) { started = true; startDrag({ kind: 'new', make }, label, ev); }
        if (started) updateDrag(ev);
      };
      const up = ev => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
        if (started) { if (drag) endDrag(ev); return; }
        onClick();
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
  }

  /* ═════════════ Node toolbar ═════════════ */
  const bar = $('#nodebar');
  function hideNodebar() { bar.hidden = true; }

  // small drawn icons for the node toolbar (existing node = ink, new node = accent)
  const ICON = (() => {
    const svg = b => `<svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
    const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="2.1" fill="currentColor" stroke="none"/>`;
    const nu = (x, y) => `<circle class="nb-new" cx="${x}" cy="${y}" r="2.6"/><path class="nb-new" d="M${x - 1.4} ${y}h2.8M${x} ${y - 1.4}v2.8" stroke-width="1"/>`;
    return {
      childL: svg(`${dot(11, 4)}<path d="M11 6 5.5 12.5"/>${nu(4.5, 14)}`),
      childR: svg(`${dot(7, 4)}<path d="M7 6l5.5 6.5"/>${nu(13.5, 14)}`),
      sisL: svg(`<path d="M9 3 4.5 12M9 3l4.5 9" opacity=".45"/>${nu(4.5, 14)}${dot(13.5, 14)}`),
      sisR: svg(`<path d="M9 3 4.5 12M9 3l4.5 9" opacity=".45"/>${dot(4.5, 14)}${nu(13.5, 14)}`),
      mother: svg(`${nu(9, 4)}<path d="M9 7v5"/>${dot(9, 14)}`),
      rename: svg('<path d="M3 15l1-4 8-8 3 3-8 8z"/><path d="M10.5 4.5l3 3"/>'),
      roof: svg('<path d="M9 3 3 14h12z"/>'),
      arrow: svg('<path d="M4 6v4a4 4 0 0 0 4 4h6"/><path d="M11 11l3 3-3 3" transform="translate(0 -3)"/>'),
      more: svg(`${dot(4, 9)}${dot(9, 9)}${dot(14, 9)}`),
      del: svg('<path d="M4.5 4.5l9 9M13.5 4.5l-9 9"/>'),
      group: svg(`${nu(9, 4)}<path d="M9 6.5 4.5 12.5M9 6.5l4.5 6"/>${dot(4.5, 14)}${dot(13.5, 14)}`),
      merge: svg(`${nu(9, 4)}<path d="M9 6.5 4.5 12.5M9 6.5l4.5 6"/>${dot(4.5, 14)}${dot(13.5, 14)}`),
      coindex: svg('<text x="3" y="12" font-size="11" font-family="serif" fill="currentColor" stroke="none">x</text><text x="10" y="15" font-size="8" font-style="italic" font-family="serif" fill="currentColor" stroke="none">i</text>'),
    };
  })();
  function renderNodebar() {
    if (!S.sel.length || editing || drag || S.pick || S.playing) { hideNodebar(); return; }
    const one = S.sel.length === 1;
    const n = one && T.find(S.doc, S.sel[0]);
    if (one && !n) { hideNodebar(); return; }
    let h;
    if (one) {
      const nd = n.node;
      const tl = disp().tabSide === 'left';
      h = `<button data-b="childL" title="Daughter on the left${tl ? ' (Tab)' : ''}">${ICON.childL}</button><button data-b="childR" title="Daughter on the right${tl ? '' : ' (Tab)'}">${ICON.childR}</button><button data-b="sisL" title="Sister on the left">${ICON.sisL}</button><button data-b="sisR" title="Sister on the right (Shift+Tab)">${ICON.sisR}</button><button data-b="mother" title="Mother above (Ctrl+↑)">${ICON.mother}</button><span class="sep"></span>` +
        `<button data-b="rename" title="Rename (Enter, or just start typing)">${ICON.rename}</button>` +
        (nd.ch.length ? `<button data-b="roof" class="${nd.roof ? 'on' : ''}" title="Triangle over the words">${ICON.roof}</button>` : '') +
        `<button data-b="arrow" title="Arrow from this node — then pick the target">${ICON.arrow}</button>` +
        `<button data-b="more" title="More: colour, notes, features, copy… (right-click)">${ICON.more}</button><span class="sep"></span><button data-b="del" title="Delete this node, keep what's under it (Del) — Shift: delete everything below too (⇧Del)">${ICON.del}</button>`;
    } else {
      h = `<button data-b="group" class="primary wide" title="Group under a new node — or just type its label">${ICON.group}<span>Group</span></button>` +
        (S.sel.length === 2 ? `<button data-b="merge" class="wide" title="Merge (Ctrl+M): first selected projects">${ICON.merge}<span>Merge</span></button><button data-b="arrow2" title="Arrow from the first to the second selected">${ICON.arrow}</button>` : '') +
        `<button data-b="coindex" title="Give them the same index (i, j, k…)">${ICON.coindex}</button><button data-b="more" title="More">${ICON.more}</button><span class="sep"></span><button data-b="del" title="Delete the selected nodes, keep what's under them (Del) — Shift: with everything below (⇧Del)">${ICON.del}</button>`;
    }
    bar.innerHTML = h; bar.hidden = false;
    placeNodebar();
  }
  function placeNodebar() {
    if (bar.hidden || !S.layout || S.animating) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const id of S.sel) { const r = S.layout.recs.get(id); if (!r) continue; x0 = Math.min(x0, r.x - r.w / 2); x1 = Math.max(x1, r.x + r.w / 2); y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y + r.h); }
    if (x0 === Infinity) { bar.hidden = true; return; }
    const a = toScreen(x0, y0), b = toScreen(x1, y1);
    const bw = bar.offsetWidth, bh = bar.offsetHeight, W = wrap.clientWidth, H = wrap.clientHeight;
    let left = clamp((a.x + b.x) / 2 - bw / 2, 6, W - bw - 6), top = b.y + 8;
    if (top + bh > H - 6) top = a.y - bh - 8;
    bar.style.left = left + 'px'; bar.style.top = clamp(top, 6, H - bh - 6) + 'px';
  }
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-b]'); if (!b) return;
    const id = primary(); const act = b.dataset.b;
    switch (act) {
      case 'childL': newAndEdit(() => addChild(id, '', 0)); break;
      case 'childR': newAndEdit(() => addChild(id)); break;
      case 'sisL': newAndEdit(() => addSister(id, '', true)); break;
      case 'sisR': newAndEdit(() => addSister(id)); break;
      case 'mother': { const g = wrapNode(id); if (g) startEdit(g, { isNew: true, initial: '', keepEmpty: true }); break; }
      case 'rename': startEdit(id); break;
      case 'roof': toggleProp(S.sel, 'roof', 'Triangle'); break;
      case 'arrow': startPick('arrow', id); break;
      case 'arrow2': addArrow(S.sel[0], S.sel[1]); break;
      case 'group': groupAndEdit(''); break;
      case 'merge': merge(); break;
      case 'coindex': coindex(S.sel.slice()); break;
      case 'del': deleteNodes(S.sel.slice(), !e.shiftKey); break;
      case 'more': { const r = b.getBoundingClientRect(); openMenu(r.left, r.bottom + 4, S.sel.length > 1 ? 'multi' : 'node'); break; }
    }
  });

  /* ═════════════ Context menu ═════════════ */
  const menu = $('#ctxmenu');
  function closeMenu() { menu.hidden = true; }
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); }, true);
  function openMenu(x, y, kind) {
    const it = (cmd, label, key = '', on = false) => `<button data-cmd="${cmd}">${on ? '✓ ' : ''}${label}${key ? `<kbd>${key}</kbd>` : ''}</button>`;
    const sep = '<div class="sep"></div>';
    const n = S.sel.length === 1 && T.find(S.doc, S.sel[0]);
    const swatches = cur => `<div class="swatches">Colour <button data-cmd="color:" class="sw-none" title="none"></button>${COLORS.map(c => `<button data-cmd="color:${c}" title="${c}" style="background:var(--c-${c})"></button>`).join('')}</div>` +
      `<div class="swatches">Shape <button class="shape-b" data-cmd="shape:">none</button><button class="shape-b" data-cmd="shape:box">▭ box</button><button class="shape-b" data-cmd="shape:circle">◯ circle</button></div>`;
    let h = '';
    if (kind === 'node' && n) {
      const nd = n.node;
      const tl = disp().tabSide === 'left';
      h = it('rename', 'Rename', 'Enter') + it('childL', 'Add daughter on the left', tl ? 'Tab' : '') + it('childR', 'Add daughter on the right', tl ? '' : 'Tab') + it('sisL', 'Add sister on the left') + it('sisR', 'Add sister on the right', '⇧Tab') + it('mother', 'Add mother', 'Ctrl+↑') + it('layerBelow', 'Insert layer below (takes the daughters)', 'Ctrl+↓') + it('projection', 'Insert projection above, with head', 'Ctrl+⇧↑') + it('sameLabel', 'Select all with this label') + sep +
        (nd.ch.length ? it('roof', 'Triangle over words', '', nd.roof) : '') + it('silent', 'Unpronounced (struck out)', '', nd.silent) + (n.parent ? it('dash', 'Dashed branch to mother', '', nd.dash) : '') + swatches() +
        it('note', 'Note / gloss under label…') + it('feat', 'Features…') + (nd && n.parent ? it('elabel', 'Branch label…') : '') + (S.features.avm ? it('avm', 'Feature structure (AVM)…') + (nd.avm ? it('avmFill', 'Fully specify from signature') : '') : '') + (defaultAvmFor(nd.label) ? it('avmDefault', `${nd.avm ? 'Reset to' : 'Use'} default feature structure for ${nd.label}`) : '') + sep +
        it('arrow', 'Draw arrow from here…') + it('coindexWith', 'Coindex with…') + sep +
        it('moveChild', 'Move to… as daughter') + it('moveBefore', 'Move to… as left sister') + it('moveAfter', 'Move to… as right sister') + it('moveAbove', 'Move to… adjoined on the left') + it('moveAdjR', 'Move to… adjoined on the right') + sep +
        it('cut', 'Cut', 'Ctrl+X') + it('copy', 'Copy', 'Ctrl+C') + (S.clip ? it('paste', 'Paste as daughter', 'Ctrl+V') : '') + it('dup', 'Duplicate', 'Ctrl+D') +
        it('left', 'Move left', 'Alt+←') + it('right', 'Move right', 'Alt+→') + (nd.pos ? it('resetPos', 'Reset manual position') : '') + sep +
        (nd.ch.length ? it('splice', 'Delete only this node', 'Del') + it('del', 'Delete with everything below', '⇧Del') : it('del', 'Delete', 'Del'));
    } else if (kind === 'multi') {
      h = it('relabelMany', 'Relabel all…', 'F2') + it('group', 'Group under a new node', 'type a label') + (S.sel.length === 2 ? it('merge', 'Merge (first projects)', 'Ctrl+M') + it('arrow2', 'Arrow from first to second') : '') + it('coindex', 'Coindex') + sep +
        it('roof', 'Triangle') + it('silent', 'Unpronounced') + swatches() + sep + it('splice', 'Delete all (keep what’s under them)', 'Del') + it('del', 'Delete all with everything below', '⇧Del');
    } else if (kind === 'arrow') {
      const a = getArrow(S.selArrow); if (!a) return;
      h = it('alabel', 'Label…', 'Enter') + it('aside', a.side === 'above' ? 'Route below the tree' : 'Route above the tree') + it('adash', 'Dashed', '', arrowDashed(a)) +
        it('aheads', a.heads === 'both' ? 'No arrowheads' : a.heads === 'none' ? 'Single arrowhead' : 'Arrowheads at both ends') + (a.mv ? '' : it('arev', 'Reverse direction')) +
        it('ashape:free', 'Free curve (set angles)') + it('ashape:straight', 'Straight line') + it('ashape:lane', 'Squared lane') + it('ashape:curve', 'Curve') +
        it('areset', 'Reset path (undo manual dragging)') + sep + it('adel', a.mv ? 'Hide this arrow' : 'Delete arrow', 'Del');
    } else {
      h = it('newtree', 'New tree here') + it('words', 'Add words from a sentence…') + (S.clip ? it('pasteRoot', 'Paste', 'Ctrl+V') : '') + sep + it('selall', 'Select all', 'Ctrl+A') + it('fit', 'Fit to screen', 'F') + sep + it('clear', 'Clear canvas');
    }
    menu.innerHTML = h; menu.hidden = false;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = clamp(x, 4, innerWidth - mw - 4) + 'px';
    menu.style.top = clamp(y, 4, innerHeight - mh - 4) + 'px';
  }
  function openMenuForSelection() {
    const b = wrap.getBoundingClientRect();
    let kind = 'canvas', x = b.left + wrap.clientWidth / 2, y = b.top + 60;
    if (S.selArrow) kind = 'arrow';
    else if (S.sel.length) {
      kind = S.sel.length > 1 ? 'multi' : 'node';
      const r = S.layout && S.layout.recs.get(primary());
      if (r) { const p = toScreen(r.x, r.y + r.h); x = b.left + p.x; y = b.top + p.y + 6; }
    }
    openMenu(x, y, kind);
    const first = menu.querySelector('button'); if (first) first.focus();
  }
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-cmd]'); if (!b) return;
    closeMenu(); runCmd(b.dataset.cmd);
  });
  function focusInspector(sel) { const el = $(sel); if (el && el.offsetParent) { el.focus(); el.select && el.select(); return true; } return false; }
  function runCmd(cmd) {
    const id = primary(); const ids = S.sel.slice();
    const [c, arg] = cmd.split(':');
    const a = getArrow(S.selArrow);
    switch (c) {
      case 'rename': startEdit(id); break;
      case 'child': newAndEdit(() => addChild(id, '', tabAt())); break;
      case 'childL': newAndEdit(() => addChild(id, '', 0)); break;
      case 'childR': newAndEdit(() => addChild(id)); break;
      case 'sisL': newAndEdit(() => addSister(id, '', true)); break;
      case 'sisR': newAndEdit(() => addSister(id)); break;
      case 'mother': { const g = wrapNode(id); if (g) startEdit(g, { isNew: true, initial: '', keepEmpty: true }); break; }
      case 'layerBelow': insertLayerBelow(id); break;
      case 'projection': insertProjection(id); break;
      case 'projectionR': insertProjection(id, true); break;
      case 'sameLabel': selectSameLabel(id); break;
      case 'relabelMany': relabelMany(ids); break;
      case 'find': openFind(); break;
      case 'importTex': openImportTex(); break;
      case 'roof': toggleProp(ids, 'roof', 'Triangle'); break;
      case 'silent': toggleProp(ids, 'silent', 'Unpronounced'); break;
      case 'dash': toggleProp(ids, 'dash', 'Dashed branch'); break;
      case 'color': setProp(ids, 'color', arg || undefined, 'Colour'); break;
      case 'shape': setProp(ids, 'shape', arg || undefined, 'Shape'); break;
      case 'note': askText('Note / gloss shown under the label', T.find(S.doc, id).node.note || '').then(v => { if (v != null) setProp([id], 'note', v.trim(), 'Note'); }); break;
      case 'elabel': askText('Branch label (e.g. H, C, S, A)', T.find(S.doc, id).node.elabel || '').then(v => { if (v != null) setProp([id], 'elabel', v.trim(), 'Branch label'); }); break;
      case 'avm': openAvmModal(id); break;
      case 'avmDefault': applyDefaultAvms(ids.length ? ids : [id], true); break;
      case 'avmDefaultsAll': { const all = []; T.walkDoc(S.doc, x => all.push(x.id)); applyDefaultAvms(all, false); break; }
      case 'avmFill': { const n = T.find(S.doc, id).node; if (!n.avm) { toast('No feature structure on this node.'); break; } try { setProp([id], 'avm', AVM.str(AVM.fullySpecify(AVM.parse(n.avm), signature())), 'Fully specify'); } catch (e) { toast(e.message); } break; }
      case 'feat': askText('Features (e.g. +wh, uφ, EPP)', T.find(S.doc, id).node.f || '').then(v => { if (v != null) setProp([id], 'f', v.trim(), 'Features'); }); break;
      case 'arrow': startPick('arrow', id); break;
      case 'moveChild': startPick('move-child', id); break;
      case 'moveBefore': startPick('move-before', id); break;
      case 'moveAfter': startPick('move-after', id); break;
      case 'moveAbove': startPick('move-above', id); break;
      case 'moveAdjR': startPick('move-adjr', id); break;
      case 'arrowsOn': { const a2 = allArrowIds().map(getArrow).find(x => x && (x.from === id || x.to === id)); if (a2) { S.selArrow = a2.id; S.sel = []; redraw(); } else toast('No arrows on this node.'); break; }
      case 'arrow2': addArrow(ids[0], ids[1]); break;
      case 'coindexWith': startPick('coindex', id); break;
      case 'coindex': coindex(ids); break;
      case 'group': groupAndEdit(''); break;
      case 'merge': merge(); break;
      case 'cut': copySel(true); break;
      case 'copy': copySel(false); break;
      case 'paste': pasteClip(id); break;
      case 'pasteRoot': pasteClip(null); break;
      case 'dup': { const h = T.find(S.doc, id); insertNew(T.clone(h.node, false), h.parent ? { id, zone: 'after' } : { zone: 'root' }); break; }
      case 'resetPos': setPos(id, 0, 0, 'Reset position'); break;
      case 'resetAllPos': commit('Reset all positions', () => { let any = false; T.walkDoc(S.doc, n => { if (n.pos) { delete n.pos; any = true; } }); return any ? undefined : false; }); break;
      case 'left': reorder(id, -1); break;
      case 'right': reorder(id, 1); break;
      case 'del': deleteNodes(ids); break;
      case 'splice': deleteNodes(ids, true); break;
      case 'alabel': askText('Arrow label (e.g. Agree, Case, θ)', a.label || '').then(v => { if (v != null) updateArrow(a.id, { label: v.trim() }, 'Label arrow'); }); break;
      case 'aside': updateArrow(a.id, { side: a.side === 'above' ? 'below' : 'above' }); break;
      case 'adash': updateArrow(a.id, { dash: !arrowDashed(a) }); break;
      case 'areset': updateArrow(a.id, Object.fromEntries(ARROW_KEYS.filter(k => k !== 'w').map(k => [k, undefined])), 'Reset arrow path'); break;
      case 'showArrows': showHiddenArrows(); break;
      case 'renumber': renumberChains(); break;
      case 'ashape': updateArrow(a.id, { shape: arg || undefined }, 'Arrow shape'); break;
      case 'aat1': updateArrow(a.id, { at1: arg === 'auto' ? undefined : arg, a1: undefined }, 'Arrow start'); break;
      case 'aat2': updateArrow(a.id, { at2: arg === 'auto' ? undefined : arg, a2: undefined }, 'Arrow end'); break;
      case 'aw': updateArrow(a.id, { w: arg || undefined }, 'Arrow thickness'); break;
      case 'arot': { const g = S.routes && S.routes.get(a.id); const k = arg; const cur = a['a' + k] ?? (g && g['ang' + k]) ?? 90; updateArrow(a.id, { shape: 'free', a1: a.a1 ?? (g && g.ang1), a2: a.a2 ?? (g && g.ang2), ['a' + k]: normDeg(cur + (+(cmd.split(':')[2]) || 15)) }, 'Arrow angle'); break; }
      case 'aheads': updateArrow(a.id, { heads: a.heads === 'both' ? 'none' : a.heads === 'none' ? 'end' : 'both' }); break;
      case 'arev': updateArrow(a.id, { from: a.to, to: a.from }); break;
      case 'adel': deleteArrow(a.id); break;
      case 'newtree': newAndEdit(() => addRoot()); break;
      case 'words': askText('Type a sentence — each word becomes a node', '').then(v => { if (v) addWords(v); }); break;
      case 'selall': { const all = []; T.walkDoc(S.doc, n => all.push(n.id)); select(all); break; }
      case 'fit': fit(); break;
      case 'clear': commit('Clear', () => { S.doc = { roots: [], arrows: [] }; }, { animate: false }); break;
    }
  }
  function copySel(cut) {
    const id = primary(); if (!id) return;
    const h = T.find(S.doc, id); S.clip = deep(h.node); S.clipText = T.toBracket({ roots: [h.node] });
    try { navigator.clipboard.writeText(S.clipText); } catch { /* ignore */ }
    if (cut) deleteNodes([id]); else toast('Copied — Ctrl+V pastes it under the selected node.');
  }
  function pasteClip(id, text) {
    let node = null;
    if (S.clip && (text === undefined || text.trim() === S.clipText)) node = T.clone(S.clip, false);
    else if (text) { try { const nd = T.parseBracket(text); if (nd.roots.length === 1) node = nd.roots[0]; else if (nd.roots.length > 1) { commit('Paste', () => { S.doc.roots.push(...nd.roots); }); return; } } catch { /* not a tree */ } }
    if (!node) return;
    insertNew(node, id ? { id, zone: 'child' } : { zone: 'root' });
  }

  /* ═════════════ Keyboard ═════════════ */
  document.addEventListener('keyup', e => { if (e.key === ' ') { S.spaceDown = false; wrap.classList.remove('spacepan'); } });
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (mod && k.toLowerCase() === 'k') { e.preventDefault(); if ($('#palette').hidden) openPalette(); else closePalette(null); return; }
    if (!$('#palette').hidden) return;
    // context menu: arrow keys move through items, Enter/Space activate
    if (!menu.hidden) {
      const items = [...menu.querySelectorAll('button')];
      const at = items.indexOf(document.activeElement);
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); const n = items.length; items[(at + (k === 'ArrowDown' ? 1 : -1) + n) % n].focus(); return; }
      if (k === 'Escape' || k === 'Tab') { e.preventDefault(); closeMenu(); wrap.focus({ preventScroll: true }); return; }
      return;
    }
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    if (!$('#modal').hidden) { if (k === 'Escape') closeModal(); return; }
    if (tag === 'button' && (k === 'Enter' || k === ' ') && !e.target.closest('#canvasWrap')) return;
    const id = primary();
    if (S.pick) {
      if (k === 'Escape') { e.preventDefault(); cancelPick(); return; }
      if (k.startsWith('Arrow')) { e.preventDefault(); const t = navTarget(S.pick.cursor, k); if (t) { S.pick.cursor = t; redraw(); ensureVisible(t); } return; }
      if (k === 'Enter' || k === ' ') { e.preventDefault(); finishPick(S.pick.cursor); return; }
      return;
    }
    if (k === 'ContextMenu' || (e.shiftKey && k === 'F10')) { e.preventDefault(); openMenuForSelection(); return; }
    if (k === ' ' && !mod) { e.preventDefault(); S.spaceDown = true; wrap.classList.add('spacepan'); return; }
    if (S.centerView && S.centerView !== 'tree') { if (mod && (k.toLowerCase() === 'z' || k.toLowerCase() === 'y')) { e.preventDefault(); thUndo(k.toLowerCase() === 'y' || e.shiftKey); } return; }
    if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k.toLowerCase() === 'm') { e.preventDefault(); merge(); return; }
    if (mod && k.toLowerCase() === 'g') { e.preventDefault(); if (S.sel.length) groupAndEdit(''); return; }
    if (mod && k.toLowerCase() === 's') { e.preventDefault(); saveFile(); return; }
    if (mod && k.toLowerCase() === 'a') { e.preventDefault(); const all = []; T.walkDoc(S.doc, n => all.push(n.id)); select(all); return; }
    if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomAt(1.2, wrap.clientWidth / 2, wrap.clientHeight / 2); return; }
    if (mod && k === '-') { e.preventDefault(); zoomAt(1 / 1.2, wrap.clientWidth / 2, wrap.clientHeight / 2); return; }
    if (mod && k === '0') { e.preventDefault(); fit(); return; }
    if (mod && (k.toLowerCase() === 'c' || k.toLowerCase() === 'x') && id) { e.preventDefault(); copySel(k.toLowerCase() === 'x'); return; }
    if (mod && k.toLowerCase() === 'd' && id) { e.preventDefault(); runCmd('dup'); return; }
    if (mod && e.altKey && k.startsWith('Arrow') && id) {
      e.preventDefault();
      const h = T.find(S.doc, id); const cur = h.node.pos && h.node.pos.sig === posSig(h.node, h.parent) ? h.node.pos : { dx: 0, dy: 0 };
      const st = e.shiftKey ? 24 : 8;
      setPos(id, cur.dx + (k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0), cur.dy + (k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0), 'Nudge node');
      return;
    }
    if (mod && e.shiftKey && k === 'ArrowUp' && id) { e.preventDefault(); insertProjection(id); return; }
    if (mod && k === 'ArrowUp' && id) { e.preventDefault(); runCmd('mother'); return; }
    if (mod && k === 'ArrowDown' && id) { e.preventDefault(); insertLayerBelow(id); return; }
    if (mod && !e.shiftKey && k.toLowerCase() === 'f') { e.preventDefault(); openFind(); return; }
    if (mod) return;
    if (S.selArrow) {
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteArrow(S.selArrow); return; }
      if (k === 'Enter') { e.preventDefault(); runCmd('alabel'); return; }
      const step = e.shiftKey ? 24 : 6;
      if (k === '[' || k === ']') { e.preventDefault(); runCmd(`arot:2:${k === ']' ? 15 : -15}`); return; }
      if (k === '{' || k === '}') { e.preventDefault(); runCmd(`arot:1:${k === '}' ? 15 : -15}`); return; }
      if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); nudgeArrow({ dy: k === 'ArrowUp' ? -step : step }); return; }
      if ((k === 'ArrowLeft' || k === 'ArrowRight') && e.altKey) { e.preventDefault(); nudgeArrow({ [e.shiftKey ? 'dx1' : 'dx2']: k === 'ArrowLeft' ? -6 : 6 }); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); cycleArrow(k === 'ArrowRight' ? 1 : -1); return; }
      if (k === 'Escape') { const a = getArrow(S.selArrow); S.selArrow = null; if (a) select(a.from); else redraw(); return; }
    }
    if (k === '?' && !id) { openHelp(); return; }
    if (k === 'Escape') { S.sel = []; S.selArrow = null; redraw(); return; }
    if ((k === 'f' || k === 'F') && !id) { fit(); return; }
    if (!id) {
      if (k === 'Enter') { e.preventDefault(); newAndEdit(() => addRoot()); return; }
      if (k.length === 1 && !S.doc.roots.length && !e.altKey) { e.preventDefault(); const nid = addRoot(); startEdit(nid, { isNew: true, initial: k }); return; }
      if (k.startsWith('Arrow') && S.doc.roots.length) { e.preventDefault(); select(S.doc.roots[0].id); }
      return;
    }
    // Shift+arrows extend the selection
    if (e.shiftKey && k.startsWith('Arrow') && !e.altKey) {
      e.preventDefault();
      const t = navTarget(id, k); if (!t) return;
      S.sel = [...S.sel.filter(x => x !== t), t]; S.selArrow = null; redraw(); ensureVisible(t); return;
    }
    if (S.sel.length > 1) {
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteNodes(S.sel.slice(), !e.shiftKey); return; }
      if (k === 'Enter') { e.preventDefault(); groupAndEdit(''); return; }
      if (k === 'F2') { e.preventDefault(); relabelMany(S.sel.slice()); return; }
      if (k.startsWith('Arrow')) { e.preventDefault(); select(navTarget(id, k) || id); return; }
      if (k.length === 1 && !e.altKey) { e.preventDefault(); groupAndEdit(k); return; }
      return;
    }
    const h = T.find(S.doc, id); if (!h) return;
    switch (k) {
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': {
        e.preventDefault();
        if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { reorder(id, k === 'ArrowLeft' ? -1 : 1); return; }
        const t = navTarget(id, k); if (t) select(t); return;
      }
      case 'Enter': case 'F2': e.preventDefault(); if (e.shiftKey) newAndEdit(() => addSister(id)); else startEdit(id); return;
      case 'Tab': e.preventDefault(); if (e.shiftKey) newAndEdit(() => addSister(id)); else newAndEdit(() => addChild(id, '', tabAt())); return;
      case 'Delete': case 'Backspace': e.preventDefault(); deleteNodes(S.sel.slice(), !e.shiftKey); return;
    }
    if (k.length === 1 && !e.altKey) { e.preventDefault(); startEdit(id, { initial: k }); }
  });
  function cycleArrow(dir) {
    const all = allArrowIds(); if (!all.length) return;
    const i = all.indexOf(S.selArrow);
    S.selArrow = all[(i + dir + all.length) % all.length]; S.sel = []; redraw();
  }
  // keep keyboard focus on the canvas after clicking toolbar buttons
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.closest('#modal, #palette, #ctxmenu, .menu, #inspector, .tab, .start-card, #lessonCard')) return;
    setTimeout(() => { if (!editing && document.activeElement === b) wrap.focus({ preventScroll: true }); }, 0);
  });
  document.addEventListener('paste', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
    if (!text.trim() && !S.clip) return;
    e.preventDefault();
    if (T.looksLikeLatex(text)) { importLatex(text, false); return; }
    if (text.trim() && !/^\s*\[/.test(text) && text.trim() !== S.clipText) { addWords(text); return; }
    pasteClip(primary(), text);
  });
  function acrossId(id, dir) {
    const L = S.layout; const r = L && L.recs.get(id); if (!r) return null;
    let best = null;
    L.recs.forEach(o => { if (o.pseudo || o.depth !== r.depth || o.id === id) return; const dx = (o.x - r.x) * dir; if (dx > 0 && (!best || dx < (best.x - r.x) * dir)) best = o; });
    if (!best) L.recs.forEach(o => { if (o.pseudo || o.id === id) return; const dx = (o.x - r.x) * dir; if (dx > 0 && (!best || Math.hypot(o.x - r.x, o.y - r.y) < Math.hypot(best.x - r.x, best.y - r.y))) best = o; });
    return best ? best.id : null;
  }
  function navTarget(id, key) {
    const h = T.find(S.doc, id); if (!h) return null;
    const sibs = arrOf(h); const i = sibs.indexOf(h.node);
    if (key === 'ArrowUp') return h.parent ? h.parent.id : null;
    if (key === 'ArrowDown') return h.node.ch.length ? h.node.ch[Math.floor((h.node.ch.length - 1) / 2)].id : null;
    if (key === 'ArrowLeft') return i > 0 ? sibs[i - 1].id : acrossId(id, -1);
    if (key === 'ArrowRight') return i < sibs.length - 1 ? sibs[i + 1].id : acrossId(id, 1);
    return null;
  }

  /* ═════════════ Inspector ═════════════ */
  function swatchRow(n) {
    return `<div class="swatch-row"><button data-cmd="color:" class="sw-none${!n.color ? ' on' : ''}" title="no colour"></button>${COLORS.map(c => `<button data-cmd="color:${c}" class="${n.color === c ? 'on' : ''}" title="${c}" style="background:var(--c-${c})"></button>`).join('')}
      <span class="spacer"></span><button class="shape-b${!n.shape ? ' on' : ''}" data-cmd="shape:">plain</button><button class="shape-b${n.shape === 'box' ? ' on' : ''}" data-cmd="shape:box">▭</button><button class="shape-b${n.shape === 'circle' ? ' on' : ''}" data-cmd="shape:circle">◯</button></div>`;
  }
  function renderInspector() {
    const box = $('#inspector');
    if (S.selArrow) {
      const a = getArrow(S.selArrow);
      const geo = a && S.routes && S.routes.get(a.id);
      if (a) {
        const lab = id => esc((T.find(S.doc, id) || { node: { label: '?' } }).node.label || '·');
        box.innerHTML = `<h2>${a.mv ? 'Movement arrow' : 'Arrow'}</h2><p class="small muted">From <b>${lab(a.from)}</b> to <b>${lab(a.to)}</b>${a.mv ? ' (drawn automatically from the trace/copy)' : ''}</p>
          <p class="small muted xhint">Drag the handles on the canvas: the ends move the start and tip anywhere; the middle sets how deep it runs; the small faded handle bends it freely. In a free curve, the two small handles set the angle and strength at each end (Shift snaps to 15°). Keys: <kbd>↑↓</kbd> depth, <kbd>Alt</kbd>+<kbd>←→</kbd> tip, <kbd>Alt</kbd>+<kbd>⇧</kbd>+<kbd>←→</kbd> start, <kbd>[</kbd> <kbd>]</kbd> rotate arrival angle, <kbd>{</kbd> <kbd>}</kbd> rotate leaving angle.</p>
          <label class="field">Label <input id="aLabel" value="${esc(a.label || '')}" placeholder="e.g. Agree, θ, Case"></label>
          <label class="field">Route <select id="aSide"><option value="below">below the tree</option><option value="above">above the tree</option></select></label>
          <label class="field">Heads <select id="aHeads"><option value="end">→ one end</option><option value="both">↔ both ends</option><option value="none">— none</option></select></label>
          <label class="check"><input type="checkbox" id="aDash" ${arrowDashed(a) ? 'checked' : ''}> Dashed</label>
          <h2>Path</h2>
          <label class="field">Shape <select id="aShape"><option value="">automatic (${(disp().arrowStyle || 'square') === 'curve' ? 'curve' : 'squared lane'})</option><option value="lane">squared lane</option><option value="curve">curve</option><option value="straight">straight line</option><option value="free">free curve — set the angles</option></select></label>
          <div class="grid2">
            <label class="field">Leaves from <select id="aAt1">${ANCHOR_OPTS}</select></label>
            <label class="field">Arrives at <select id="aAt2">${ANCHOR_OPTS}</select></label>
            <label class="field">Leaving angle° <input id="aA1" type="number" step="5" value="${geo && geo.ang1 !== undefined ? geo.ang1 : ''}"></label>
            <label class="field">Arriving from° <input id="aA2" type="number" step="5" value="${geo && geo.ang2 !== undefined ? geo.ang2 : ''}"></label>
            <label class="field">Leaving strength <input id="aL1" type="number" step="5" min="5" value="${geo && geo.L1 !== undefined ? geo.L1 : ''}" placeholder="auto"></label>
            <label class="field">Arriving strength <input id="aL2" type="number" step="5" min="5" value="${geo && geo.L2 !== undefined ? geo.L2 : ''}" placeholder="auto"></label>
          </div>
          <div class="angle-presets"><span class="small muted">Arrive from:</span>${[['↑', 90, 'below'], ['↓', 270, 'above'], ['→', 180, 'the left'], ['←', 0, 'the right'], ['↗', 135, 'lower left'], ['↖', 45, 'lower right']].map(([t, v, l]) => `<button data-a2="${v}" title="Arrive heading ${t} (from ${l})">${t}</button>`).join('')}</div>
          <p class="small muted xhint">Angles: 0° = right, 90° = down, 180° = left, 270° = up. “Arriving from” is the direction the tip comes in from. Changing an angle switches to a free curve.</p>
          <label class="field">Thickness <select id="aW"><option value="thin">thin</option><option value="">normal</option><option value="thick">thick</option></select></label>
          <div class="row wrap" style="margin-top:8px">${a.mv ? '' : '<button id="aRev">Reverse</button>'}<button id="aReset">Reset path</button><button id="aDel">${a.mv ? 'Hide arrow' : 'Delete arrow'}</button></div>`;
        $('#aSide').value = a.side || 'below'; $('#aHeads').value = a.heads || 'end';
        $('#aShape').value = a.shape || ''; $('#aAt1').value = a.at1 || 'auto'; $('#aAt2').value = a.at2 || 'auto'; $('#aW').value = a.w || '';
        const toFree = patch => updateArrow(a.id, { shape: 'free', a1: a.a1 ?? (geo && geo.ang1), a2: a.a2 ?? (geo && geo.ang2), ...patch }, 'Arrow angle');
        $('#aShape').addEventListener('change', e => updateArrow(a.id, { shape: e.target.value || undefined }, 'Arrow shape'));
        $('#aAt1').addEventListener('change', e => updateArrow(a.id, { at1: e.target.value === 'auto' ? undefined : e.target.value, a1: undefined, dx1: 0, dy1: 0 }, 'Arrow start'));
        $('#aAt2').addEventListener('change', e => updateArrow(a.id, { at2: e.target.value === 'auto' ? undefined : e.target.value, a2: undefined, dx2: 0, dy2: 0 }, 'Arrow end'));
        $('#aA1').addEventListener('change', e => toFree({ a1: normDeg(+e.target.value) }));
        $('#aA2').addEventListener('change', e => toFree({ a2: normDeg(+e.target.value) }));
        $('#aL1').addEventListener('change', e => toFree({ l1: e.target.value === '' ? undefined : Math.max(5, +e.target.value) }));
        $('#aL2').addEventListener('change', e => toFree({ l2: e.target.value === '' ? undefined : Math.max(5, +e.target.value) }));
        $$('[data-a2]').forEach(b => b.addEventListener('click', () => toFree({ a2: +b.dataset.a2 })));
        $('#aW').addEventListener('change', e => updateArrow(a.id, { w: e.target.value || undefined }, 'Arrow thickness'));
        $('#aLabel').addEventListener('change', e => updateArrow(a.id, { label: e.target.value.trim() }, 'Label arrow'));
        $('#aSide').addEventListener('change', e => updateArrow(a.id, { side: e.target.value }));
        $('#aHeads').addEventListener('change', e => updateArrow(a.id, { heads: e.target.value }));
        $('#aDash').addEventListener('change', e => updateArrow(a.id, { dash: e.target.checked }));
        if ($('#aRev')) $('#aRev').onclick = () => updateArrow(a.id, { from: a.to, to: a.from });
        $('#aReset').onclick = () => updateArrow(a.id, Object.fromEntries(ARROW_KEYS.filter(k => k !== 'w').map(k => [k, undefined])), 'Reset arrow path');
        $('#aDel').onclick = () => deleteArrow(a.id);
        return;
      }
    }
    const ids = S.sel;
    if (ids.length > 1) {
      box.innerHTML = `<h2>${ids.length} nodes selected</h2>
        <p class="muted small xhint"><b>Type a label</b> to group them under a new node — or:</p>
        <div class="card actions"><button data-act="relabelMany" title="F2">Relabel all…</button><button class="accent" data-act="group">Group</button>${ids.length === 2 ? '<button data-act="merge">Merge</button><button data-act="arrow2">Arrow ↷</button>' : ''}<button data-act="coindex">Coindex ᵢ</button><button data-act="delete">Delete</button></div>
        <h2>Style all</h2>${swatchRow({})}`;
      return;
    }
    const id = ids[0];
    const h = id && T.find(S.doc, id);
    if (!h) { box.innerHTML = hintsOn() ? guideHtml() : guideRootsOnly(); return; }
    const n = h.node;
    const inf = infoOf(id);
    let semHtml = '';
    if (inf && S.features.sem) {
      if (inf.red) {
        const reduced = inf.term && Logic.show(inf.term) !== Logic.show(inf.red);
        const vt = S.vals.get(id);
        let valHtml = '';
        if (vt && vt.ok) valHtml = `<span>Model</span><span class="valline ${typeof vt.v === 'boolean' ? (vt.v ? 't1' : 't0') : ''}">${esc(Logic.showVal(vt.v, S.C.model))}${typeof vt.v === 'boolean' ? (vt.v ? ' &nbsp;true' : ' &nbsp;false') : ''}</span>`;
        else if (vt && vt.hi) valHtml = `<span>Model</span><span class="small muted">higher-order function — see its λ-term</span>`;
        else if (vt && vt.err) valHtml = `<span>Model</span><span class="small ${vt.presup ? 'err' : 'muted'}">${esc(vt.err)}</span>`;
        semHtml = `<h2>Semantics</h2><div class="card">
          <div><span class="rulebadge">${esc(inf.rule || '')}</span></div>
          <p class="why">${esc(inf.why || '')}</p>
          <div class="kv" style="margin-top:8px">
            <span>Type</span><span class="tybadge">${esc(inf.tyStr)}</span>
            ${reduced ? `<span>Composed</span><span class="term">${showHtml(inf.term)}</span>` : ''}
            <span>${reduced ? 'Reduces to' : 'Denotation'}</span><span class="term">${showHtml(inf.red)}</span>
            ${valHtml}
          </div>
          <div class="actions">${reduced ? '<button class="accent" data-act="stepper">β-reduce step by step</button>' : ''}<button data-act="calc">Open in calculator</button><button data-act="copyterm">Copy</button></div>
        </div>`;
      } else if (inf.idx != null) semHtml = `<h2>Semantics</h2><div class="card"><span class="rulebadge">Index ${esc(inf.idx)}</span><p class="why">${esc(inf.why)}</p></div>`;
      else if (inf.vac) semHtml = `<h2>Semantics</h2><div class="card"><span class="rulebadge">${esc(inf.rule || 'Vacuous')}</span><p class="why">${esc(inf.why || '')}</p></div>`;
      else semHtml = `<h2>Semantics</h2><div class="card bad"><b>${inf.typeClash ? 'Type mismatch' : 'No denotation'}</b><p class="why" style="color:inherit">${esc(inf.err || inf.why || '')}</p>${inf.typeClash ? '<p class="why xhint">Try a different structure (e.g. move a quantifier with QR), or add a composition rule on the Theory tab.</p>' : ''}</div>`;
    }
    const issue = S.issues.get(id);
    const ante = n.ante && T.find(S.doc, n.ante);
    box.innerHTML = `<h2>Node</h2>
      <input class="insp-label" id="iLabel" value="${esc(n.label)}" list="labelList" spellcheck="false" placeholder="(no label)" title="Use _ for subscripts (DP_i) and ^ for superscripts; ' for bar levels">
      <label class="field">Note / gloss <input id="iNote" value="${esc(n.note || '')}" placeholder="shown under the label, e.g. ‘cat’, Agent" spellcheck="false"></label>
      <label class="field">Features <input id="iFeat" value="${esc(n.f || '')}" placeholder="e.g. +wh, uφ, EPP" spellcheck="false"></label>
      <div class="inline-checks">
        ${n.ch.length ? `<label class="check"><input type="checkbox" id="iRoof" ${n.roof ? 'checked' : ''}> △ Triangle</label>` : ''}
        <label class="check"><input type="checkbox" id="iSilent" ${n.silent ? 'checked' : ''}> Unpronounced</label>
        ${h.parent ? `<label class="check"><input type="checkbox" id="iDash" ${n.dash ? 'checked' : ''}> Dashed branch</label>` : ''}
      </div>
      ${swatchRow(n)}
      ${h.parent ? `<label class="field">Branch label <input id="iElabel" value="${esc(n.elabel || '')}" placeholder="e.g. H, C, S, A" spellcheck="false"></label>` : ''}
      <div class="need-avm"><h2>Feature structure <button class="linkbtn" data-act="avmBig" title="Open a large editor">⤢ large</button><button class="linkbtn" data-act="avmTex" title="This feature structure as LaTeX (avm.sty)">LaTeX</button>${defaultAvmFor(n.label) ? `<button class="linkbtn" data-act="avmDefault" title="${esc(defaultAvmFor(n.label))}">${n.avm ? 'reset to' : 'use'} default for ${esc(n.label)}</button>` : ''}</h2>
        <div class="avm-ed" id="avmEd"></div>
        <textarea class="avm-text" id="avmText" spellcheck="false" placeholder="[phrase HEAD #1 verb, SUBJ <#2 NP>, COMPS < >]">${esc(n.avm || '')}</textarea>
        <div class="err small" id="avmErr"></div></div>
      ${issue ? `<div class="card bad small">⚠ ${esc(issue)}</div>` : ''}
      ${ante ? `<p class="small muted">Trace/copy of <a href="#" data-act="ante">${esc(ante.node.label)}</a></p>` : ''}
      <div class="card actions" style="margin-top:6px"><button data-act="arrow">↷ Arrow from here</button><button data-act="coindexWith">ᵢ Coindex with…</button></div>
      ${semHtml}
      <details style="margin-top:10px"><summary class="small muted">Bracket notation of this subtree</summary><pre class="out" style="max-height:120px">${esc(T.toBracket({ roots: [n] }))}</pre></details>`;
    const bind = (sel, prop, desc) => $(sel).addEventListener('change', e => setProp([id], prop, e.target.value.trim() || undefined, desc));
    $('#iLabel').addEventListener('change', e => { const v = e.target.value; commit(`Relabel → ${v}`, () => { T.find(S.doc, id).node.label = v; }, { animate: false }); });
    bind('#iNote', 'note', 'Note'); bind('#iFeat', 'f', 'Features');
    if ($('#iElabel')) bind('#iElabel', 'elabel', 'Branch label');
    if (S.features.avm) mountAvmEditor($('#avmEd'), $('#avmText'), $('#avmErr'), id);
    if ($('#iRoof')) $('#iRoof').addEventListener('change', () => toggleProp([id], 'roof', 'Triangle'));
    $('#iSilent').addEventListener('change', () => toggleProp([id], 'silent', 'Unpronounced'));
    if ($('#iDash')) $('#iDash').addEventListener('change', () => toggleProp([id], 'dash', 'Dashed branch'));
  }
  function mountAvmEditor(edEl, textEl, errEl, id) {
    const get = () => (T.find(S.doc, id) || { node: {} }).node.avm || '';
    const set = text => { setProp([id], 'avm', text.trim() || undefined, 'Edit feature structure'); textEl.value = get(); };
    AVM.mountEditor(edEl, { get, set, signature, autoFill: () => !!S.theory.avmAutoFill });
    // tags are shared across the whole tree: say so when this node's tags also occur elsewhere
    const tagNote = () => {
      let note = errEl.nextElementSibling && errEl.nextElementSibling.classList.contains('tag-note') ? errEl.nextElementSibling : null;
      if (!note) { note = document.createElement('div'); note.className = 'tag-note small'; errEl.after(note); }
      const mine = new Set([...String(get()).matchAll(/#([\p{L}\p{N}]+)/gu)].map(m => m[1]));
      const hits = [];
      if (mine.size) { const r = T.rootOf(S.doc, id); if (r) T.walk(r, n => { if (n.id === id || !n.avm) return; const shared = [...new Set([...n.avm.matchAll(/#([\p{L}\p{N}]+)/gu)].map(m => m[1]))].filter(t => mine.has(t)); if (shared.length) hits.push(`${shared.map(t => '#' + t).join(' ')} in ${n.label || '·'}${n.ch.length === 1 && !n.ch[0].ch.length ? ` (${n.ch[0].label})` : ''}`); }); }
      note.innerHTML = hits.length ? `Tags are shared across the whole tree, so this is the same structure as ${hits.slice(0, 4).map(h => `<b>${esc(h)}</b>`).join(', ')}${hits.length > 4 ? '…' : ''}. For something local, use a free tag such as <b>#${maxTagIn(S.doc) + 1}</b>.` : '';
    };
    tagNote();
    const check = () => { try { AVM.parse(textEl.value); errEl.textContent = ''; return true; } catch (e) { errEl.textContent = e.message; return false; } };
    textEl.addEventListener('input', check);
    textEl.addEventListener('change', () => { if (check()) set(textEl.value); });
    textEl.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (check()) set(textEl.value); } });
  }
  function openAvmModal(id) {
    if (!S.features.avm) { S.features.avm = true; applyFeatures(); }
    const n = T.find(S.doc, id); if (!n) return;
    openModal(`<h2>Feature structure — ${esc(n.node.label || 'node')}</h2><p class="small muted"><kbd>Enter</kbd> next row · <kbd>[</kbd> <kbd>&lt;</kbd> <kbd>{</kbd> start an AVM / list / set · <kbd>#1</kbd> tag · <kbd>Alt</kbd>+<kbd>↑↓</kbd> move row · <kbd>⌫</kbd> on an empty name deletes the row · click a left bracket to fold</p><div class="avm-ed" id="avmEdBig"></div>
      <label class="field">Text <span class="hint">[type FEAT value, …] · #1 tag · &lt;list&gt; · {set} · *bold* · x_1</span><textarea class="avm-text" id="avmTextBig" rows="8" spellcheck="false">${esc(n.node.avm || '')}</textarea></label><div class="err small" id="avmErrBig"></div>`);
    $('.modal-box').classList.add('wide');
    const paint = () => mountAvmEditor($('#avmEdBig'), $('#avmTextBig'), $('#avmErrBig'), id);
    paint();
    const prevClose = modalClose; modalClose = () => { $('.modal-box').classList.remove('wide'); if (prevClose) prevClose(); };
  }
  function guideRootsOnly() {
    const g = guideHtml(); const i = g.indexOf('<div class="guide">');
    return (i > 0 ? g.slice(0, i) : '') + '<p class="quiet">Nothing selected</p>';
  }
  function guideHtml() {
    let roots = '';
    if (S.sem) {
      roots = S.doc.roots.map(r => {
        const inf = infoOf(r.id); if (!inf || !inf.red) return '';
        const v = S.vals.get(r.id);
        return `<div class="card"><div class="small muted">⟦${esc(T.yieldOf(r).join(' '))}⟧</div><div class="term">${showHtml(inf.red)}</div><div class="kv"><span>Type</span><span class="tybadge">${esc(inf.tyStr)}</span>${v && v.ok ? `<span>Model</span><span class="valline ${v.v === true ? 't1' : v.v === false ? 't0' : ''}">${esc(Logic.showVal(v.v, S.C.model))}</span>` : v && v.err ? `<span>Model</span><span class="small err">${esc(v.err)}</span>` : ''}</div></div>`;
      }).join('');
    }
    return `${roots}<div class="guide"><h2>Getting the tree out of your head</h2>
      <ol>
        <li><b>Type it top-down:</b> click the canvas, type <b>S</b>, <kbd>Tab</kbd> for a daughter, <kbd>⇧Tab</kbd> to go back up and add a sister, <kbd>Enter</kbd> to finish.</li>
        <li><b>Use templates:</b> after typing a label like <b>VP</b>, press <kbd>↓</kbd> and pick a structure. <kbd>Tab</kbd> jumps from slot to slot; slots you skip disappear.</li>
        <li><b>Fix things directly:</b> click a node for its toolbar (<b>+↙/+↘</b> left/right daughter, <b>+←/+→</b> sisters, <b>+↑</b> mother, △, ↷ arrow), or right-click for everything.</li>
        <li><b>Drag</b> to move: drop on the middle (daughter), a side (sister) or the top edge (adjoin).</li>
        <li><b>Only have the words?</b> Add them, drag a box around some and type a label to group them.</li>
      </ol>
      <div class="tip"><b>Labels:</b> <code>DP_i</code> → DP<sub>i</sub>, <code>X^max</code> → X<sup>max</sup>, <code>T'</code> → T′. Unlabelled nodes show as a dot.</div>
      <div class="tip"><b>Movement:</b> switch to <b>Drag to transform</b> (or hold <kbd>Shift</kbd>) — the moved phrase is indexed and leaves t<sub>i</sub> with an arrow. Typing <code>t_i</code> yourself links to the phrase marked <code>_i</code>.</div>
      <h2>Keys</h2>
      <table class="small"><tbody>
        <tr><td><kbd>Ctrl</kbd>+<kbd>K</kbd></td><td>every command by keyboard</td></tr>
        <tr><td><kbd>type</kbd></td><td>rename · with several selected: group</td></tr>
        <tr><td><kbd>⇧F10</kbd></td><td>context menu (↑↓ Enter)</td></tr>
        <tr><td><kbd>⇧</kbd>+arrows</td><td>extend selection</td></tr>
        <tr><td><kbd>Tab</kbd> / <kbd>⇧Tab</kbd></td><td>add daughter / sister</td></tr>
        <tr><td><kbd>arrows</kbd></td><td>move around · <kbd>Alt</kbd>+←→ reorder</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>↑</kbd></td><td>add mother</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>G</kbd> / <kbd>M</kbd></td><td>group / Merge</td></tr>
        <tr><td><kbd>Del</kbd> · <kbd>⇧Del</kbd></td><td>delete node only (keep daughters) · delete with everything below</td></tr>
        <tr><td><kbd>Space</kbd>+drag, scroll</td><td>pan · <kbd>Ctrl</kbd>+scroll zoom</td></tr>
      </tbody></table></div>`;
  }
  $('#inspector').addEventListener('click', e => {
    const c = e.target.closest('[data-cmd]'); if (c) { runCmd(c.dataset.cmd); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    e.preventDefault();
    const id = primary(); const inf = id && infoOf(id);
    switch (a.dataset.act) {
      case 'relabelMany': relabelMany(S.sel.slice()); break;
      case 'group': groupAndEdit(''); break;
      case 'merge': merge(); break;
      case 'arrow2': addArrow(S.sel[0], S.sel[1]); break;
      case 'coindex': coindex(S.sel.slice()); break;
      case 'delete': deleteNodes(S.sel.slice(), true); break;
      case 'arrow': startPick('arrow', id); break;
      case 'coindexWith': startPick('coindex', id); break;
      case 'stepper': if (inf) openStepper(inf, T.find(S.doc, id).node); break;
      case 'calc': if (inf) { switchTab('model'); $('#calcIn').value = Logic.show(inf.term || inf.red); runCalc(); } break;
      case 'copyterm': if (inf) { try { navigator.clipboard.writeText(Logic.show(inf.red, showOpts())); toast('Copied'); } catch { toast('Clipboard unavailable'); } } break;
      case 'ante': { const h = T.find(S.doc, id); if (h && h.node.ante) select(h.node.ante); break; }
      case 'avmBig': openAvmModal(id); break;
      case 'avmTex': exportNodeAvm(id); break;
      case 'avmDefault': applyDefaultAvms([id], true); break;
    }
  });

  /* ═════════════ β-reduction stepper ═════════════ */
  function openStepper(inf, node) {
    const steps = Logic.reductionSteps(inf.term);
    let cur = 0, timer = null;
    const body = () => `<h2>⟦${esc(node.label || '·')}⟧ <span class="rulebadge">${esc(inf.rule)}</span></h2>
      <p class="muted small">${esc(inf.why || '')}. Each step contracts the highlighted β-redex: (λx.φ)(a) ⇝ φ[a/x].</p>
      <ol class="steps-list">${steps.map((s, i) => `<li class="term ${i < cur ? '' : i === cur ? 'now' : 'future'}">${showHtml(s.term, i === cur ? s.redex : null)}${i > 0 ? '<span class="tag">β-conversion</span>' : '<span class="tag">composed by ' + esc(inf.rule) + '</span>'}${s.truncated ? '<span class="tag">…stopped (limit)</span>' : ''}</li>`).join('')}</ol>
      <div class="row" style="margin-top:12px"><button data-s="first">⏮</button><button data-s="prev">◀ Back</button><button class="accent" data-s="next">Next ▶</button><button data-s="play">▶ Play</button><button data-s="last">⏭</button><span class="muted small">step ${cur + 1} / ${steps.length}</span></div>`;
    const paint = () => { $('#modalBody').innerHTML = body(); };
    openModal('', () => clearInterval(timer));
    paint();
    $('#modalBody').onclick = e => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      const a = b.dataset.s;
      if (a === 'next') cur = Math.min(steps.length - 1, cur + 1);
      if (a === 'prev') cur = Math.max(0, cur - 1);
      if (a === 'first') cur = 0;
      if (a === 'last') cur = steps.length - 1;
      if (a === 'play') { cur = 0; clearInterval(timer); timer = setInterval(() => { if (cur >= steps.length - 1) { clearInterval(timer); return; } cur++; paint(); }, 1100 / speed()); }
      paint();
    };
  }

  /* ═════════════ Composition animation ═════════════
     Bottom-up, one local tree at a time, in the spirit of 3Blue1Brown / Manim:
       1. the local tree comes into focus (everything else dims);
       2. the daughters' meanings lift off and glide along arcs to the mother, where they line up as the
          unreduced combination (function and argument keep their colours);
       3. each β-reduction is a "transform matching shapes": symbols that survive slide to their new places,
          the argument flies into the variable's slot(s), the λ-prefix and brackets fade away;
       4. the types do the same (⟨e,t⟩ and e become t), then the mother's real line fades in.            */
  let compTimer = null, compRaf = null, compRun = 0;
  const easeS = t => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep, Manim's "smooth"
  const lerp = (a, b, t) => a + (b - a) * t;
  function tokensOf(s) { return String(s).match(/[\p{L}\p{N}_'′]+|\s+|./gu) || []; }
  // longest common subsequence on tokens → pairs [i, j]
  function lcsPairs(a, b) {
    const n = a.length, m = b.length; const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) { if (a[i] === b[j]) { out.push([i, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    return out;
  }
  // where a line of kind k sits on rec r (baseline, centre x), in canvas coordinates
  function lineAt(r, k) {
    if (!r) return null; let y = 2;
    for (const l of r.lines) { if (l.k === k) return { x: r.x, y: r.y + y + l.h - 5, text: l.text }; y += l.h; }
    return null;
  }
  // a run of tokens laid out centred on (cx, y): returns [{t, x, w}]
  function layoutTokens(toks, cx, size = 12.5) {
    const ws = toks.map(t => tw(t, size)); const total = ws.reduce((a, b) => a + b, 0);
    let x = cx - total / 2; return toks.map((t, i) => { const o = { t, x, w: ws[i] }; x += ws[i]; return o; });
  }
  const gAnim = () => { let g = $('#gAnim'); if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'gAnim'; $('#vp').appendChild(g); } return g; };
  function mkText(cls, t, x, y, color) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    e.setAttribute('class', cls); e.setAttribute('x', x); e.setAttribute('y', y); e.setAttribute('xml:space', 'preserve');
    if (color) e.style.fill = color;
    e.textContent = t; gAnim().appendChild(e); return e;
  }
  // run a tween: f(eased t) each frame; resolves when done (or when the run is cancelled)
  function tween(ms, f) {
    const run = compRun;
    return new Promise(res => {
      const t0 = performance.now(); const dur = Math.max(1, ms / speed());
      const frame = now => {
        if (run !== compRun) return res(false);
        const t = Math.min(1, (now - t0) / dur); f(easeS(t), t);
        if (t < 1) compRaf = requestAnimationFrame(frame); else res(true);
      };
      compRaf = requestAnimationFrame(frame);
    });
  }
  const wait = ms => new Promise(res => { compTimer = setTimeout(res, ms / speed()); });
  const FN = 'var(--c-blue)', ARG = 'var(--c-orange)', GLUE = 'var(--ink-3)';
  // morph token run A (array of {t,x,el}) into the string `to`, centred at (cx, y)
  async function morphTokens(A, to, cx, y, cls, hiNew) {
    const B = layoutTokens(tokensOf(to), cx);
    const pairs = lcsPairs(A.map(a => a.t), B.map(b => b.t));
    const fromOf = new Map(pairs.map(([i, j]) => [j, i]));
    const usedA = new Set(pairs.map(p => p[0]));
    const moves = [];
    B.forEach((b, j) => {
      if (/^\s+$/.test(b.t)) return;
      let i = fromOf.get(j);
      // not kept in place: fly in from a same-looking symbol (the substituted argument), else fade in
      if (i === undefined) { let best = -1, bd = 1e9; A.forEach((a, k) => { if (a.t === b.t && !/^\s+$/.test(a.t)) { const d = Math.abs(a.x - b.x) + (usedA.has(k) ? 30 : 0); if (d < bd) { bd = d; best = k; } } }); i = best >= 0 ? best : undefined; }
      const src = i !== undefined ? A[i] : null;
      const el = mkText(cls, b.t, src ? src.x : b.x, src ? src.y ?? y : y + 6, src ? (src.el.style.fill || '') : '');
      el.style.opacity = src ? 1 : 0;
      moves.push({ el, b, src, flies: src && fromOf.get(j) === undefined });
    });
    // kept symbols are carried by their copies in `moves`; the rest (λx, brackets, the old argument) fade away
    A.forEach((a, k) => { if (usedA.has(k)) a.el.style.opacity = 0; });
    const fading = A.filter((a, k) => !usedA.has(k) && !/^\s+$/.test(a.t));
    await tween(820, (e) => {
      for (const m of moves) {
        const sx = m.src ? m.src.x : m.b.x, sy = m.src ? (m.src.y ?? y) : y + 6;
        const lift = m.flies ? Math.sin(Math.PI * e) * 12 : 0; // substituted symbols swing in from below
        m.el.setAttribute('x', lerp(sx, m.b.x, e)); m.el.setAttribute('y', lerp(sy, y, e) + lift);
        if (!m.src) m.el.style.opacity = e;
        if (m.flies && hiNew) m.el.style.fill = hiNew;
      }
      for (const a of fading) { a.el.style.opacity = 1 - e; a.el.setAttribute('y', (a.y ?? y) - 8 * e); }
    });
    A.forEach(a => a.el.remove());
    return moves.map(m => ({ t: m.b.t, x: m.b.x, y, el: m.el }));
  }
  function focusLocal(ids) {
    const svg = $('#svg'); svg.classList.add('composing');
    $$('#gNodes .node').forEach(g => g.classList.toggle('cfocus', ids.has(g.dataset.id)));
  }
  function hideLines(id, on) { $$(`#gNodes .node[data-id="${id}"] text.den, #gNodes .node[data-id="${id}"] text.ty, #gNodes .node[data-id="${id}"] text.val`).forEach(t => { t.style.opacity = on ? 0 : ''; t.style.transition = on ? '' : 'opacity .35s'; }); }
  async function composeStep(id, run) {
    const h = T.find(S.doc, id); if (!h) return;
    const n = h.node, inf = infoOf(id);
    const kids = n.ch.filter(c => infoOf(c.id) && infoOf(c.id).red && S.reveal.has(c.id));
    // reveal the mother's line: let the layout make room smoothly, but keep the new lines invisible for now
    const prev = S.layout; S.reveal.add(id); S.pulse = null;
    const L = layout(S.doc);
    await new Promise(res => { animate(prev, L, 380 / speed(), res); S.layout = L; });
    if (run !== compRun) return;
    focusLocal(new Set([id, ...n.ch.map(c => c.id)])); hideLines(id, true);
    const rec = S.layout.recs.get(id);
    const den = lineAt(rec, 'den'), ty = lineAt(rec, 'ty');
    const caption = (rule, txt) => showCaption(`<span class="rule">${esc(rule)}</span><span class="term">${txt}</span>`, 0);
    if (!inf || !inf.red) { hideLines(id, false); if (inf && inf.err) caption('Error', `<span class="err">${esc(inf.err)}</span>`); await wait(inf && inf.err ? 1400 : 120); return; }
    const lhs = `⟦${esc(n.label || '·')}⟧`;
    // terminal: the meaning rises out of the word
    if (!kids.length) {
      caption(inf.rule || 'Terminal Node', `${lhs} = ${showHtml(inf.red)}`);
      const word = n.ch[0] ? S.layout.recs.get(n.ch[0].id) : rec;
      const parts = [];
      if (den) parts.push(['den', den, showTerm(inf.red)]); if (ty) parts.push(['ty', ty, inf.tyStr]);
      const els = parts.map(([cls, at, s]) => { const e = mkText(cls, s, at.x, at.y + 10, ''); e.setAttribute('text-anchor', 'middle'); e.style.opacity = 0; return [e, at]; });
      void word;
      await tween(520, e => els.forEach(([el, at]) => { el.style.opacity = e; el.setAttribute('y', at.y + 10 * (1 - e)); }));
      els.forEach(([el]) => el.remove()); hideLines(id, false);
      await wait(260); return;
    }
    if (!den) { caption(inf.rule || 'Composition', `${lhs} : ${esc(inf.tyStr)}`); hideLines(id, false); await wait(900); return; }
    // 1. daughters' meanings fly up to the mother and line up as the unreduced term
    const steps = inf.term ? Logic.reductionSteps(inf.term) : [{ term: inf.red }];
    const s0 = showTerm(steps[0].term);
    caption(inf.rule || 'Composition', `${lhs} = ${showHtml(steps[0].term)}`);
    const target = layoutTokens(tokensOf(s0), den ? den.x : rec.x);
    const ty0 = den ? den.y : rec.y + rec.h;
    let runToks = [];
    const claimed = new Set();
    const flights = [];
    // which daughter is the function? the one whose meaning comes first in the combined term
    const posIn = cid => { const kt = tokensOf(showTerm(infoOf(cid).red)); for (let s = 0; s + kt.length <= target.length; s++) if (kt.every((t, k) => target[s + k].t === t)) return s; return 1e9; };
    const firstKid = kids.length > 1 ? kids.reduce((a, c) => (posIn(c.id) < posIn(a.id) ? c : a)).id : null;
    const roleColor = cid => (cid === firstKid ? FN : ARG);
    kids.forEach((c, ci) => {
      const kr = S.layout.recs.get(c.id); const kd = lineAt(kr, 'den'); if (!kd) return;
      const ks = showTerm(infoOf(c.id).red); const kt = tokensOf(ks);
      // find this daughter's tokens inside the combined term (first unclaimed occurrence)
      let at = -1;
      for (let s = 0; s + kt.length <= target.length; s++) { if (claimed.has(s)) continue; if (kt.every((t, k) => target[s + k].t === t)) { at = s; break; } }
      const color = kids.length > 1 ? roleColor(c.id) : FN;
      const from = layoutTokens(kt, kd.x);
      kt.forEach((t, k) => {
        if (/^\s+$/.test(t)) return;
        const el = mkText('den', t, from[k].x, kd.y, color);
        const dest = at >= 0 ? target[at + k] : { x: from[k].x - kd.x + (den ? den.x : rec.x), t };
        if (at >= 0) claimed.add(at + k);
        flights.push({ el, sx: from[k].x, sy: kd.y, dx: dest.x, t, idx: at >= 0 ? at + k : null });
      });
      $$(`#gNodes .node[data-id="${c.id}"] text.den`).forEach(e => { e.style.opacity = 0.18; });
    });
    // daughters' types travel too
    const tyFlights = [];
    if (ty) [...kids].sort((a, b) => (a.id === firstKid ? -1 : b.id === firstKid ? 1 : 0)).forEach(c => { const kty = lineAt(S.layout.recs.get(c.id), 'ty'); if (!kty) return; const e = mkText('ty', kty.text, kty.x, kty.y, kids.length > 1 ? roleColor(c.id) : ''); e.setAttribute('text-anchor', 'middle'); tyFlights.push({ el: e, sx: kty.x, sy: kty.y }); });
    const tyGap = 14;
    const one = kids.length === 1;
    await tween(one ? 560 : 950, e => {
      for (const f of flights) {
        const cx = (f.sx + f.dx) / 2, cy = Math.min(f.sy, ty0) - (one ? 16 : 46); // a gentle arc
        const x = (1 - e) * (1 - e) * f.sx + 2 * (1 - e) * e * cx + e * e * f.dx, y = (1 - e) * (1 - e) * f.sy + 2 * (1 - e) * e * cy + e * e * ty0;
        f.el.setAttribute('x', x); f.el.setAttribute('y', y);
      }
      tyFlights.forEach((f, k) => { const tx = ty.x + (k - (tyFlights.length - 1) / 2) * (tw(f.el.textContent, 12.5) + tyGap); f.el.setAttribute('x', lerp(f.sx, tx, e)); f.el.setAttribute('y', lerp(f.sy, ty.y, e) - Math.sin(Math.PI * e) * 30); });
    });
    if (run !== compRun) return;
    // glue (λ, brackets, the rule's own symbols) fades in around the arrived pieces
    const glue = target.map((g, i) => ({ g, i })).filter(({ g, i }) => !claimed.has(i) && !/^\s+$/.test(g.t)).map(({ g }) => { const el = mkText('den', g.t, g.x, ty0 - 6, GLUE); el.style.opacity = 0; return { el, g }; });
    await tween(360, e => glue.forEach(({ el }) => { el.style.opacity = e; el.setAttribute('y', ty0 - 6 * (1 - e)); }));
    runToks = target.map((g, i) => {
      if (/^\s+$/.test(g.t)) return { t: g.t, x: g.x, y: ty0, el: mkText('den', g.t, g.x, ty0, '') };
      const f = flights.find(x => x.idx === i); const gl = glue.find(x => x.g === g);
      return { t: g.t, x: g.x, y: ty0, el: f ? f.el : gl.el };
    });
    flights.filter(f => f.idx === null).forEach(f => f.el.remove());
    await wait(one ? 120 : 380);
    // 2. β-reduction, one redex at a time
    for (let k = 1; k < steps.length; k++) {
      if (run !== compRun) return;
      caption('β-reduction', `${lhs} = ${showHtml(steps[k - 1].term, steps[k - 1].redex)}`);
      await wait(420);
      runToks = await morphTokens(runToks, showTerm(steps[k].term), den.x, ty0, 'den', ARG);
      caption(k === steps.length - 1 ? (inf.rule || 'Composition') : 'β-reduction', `${lhs} = ${showHtml(steps[k].term)}`);
      await wait(320);
    }
    // 3. types collapse into the mother's type
    if (ty && tyFlights.length) {
      const fin = mkText('ty', inf.tyStr, ty.x, ty.y, ''); fin.setAttribute('text-anchor', 'middle'); fin.style.opacity = 0;
      await tween(520, e => { tyFlights.forEach(f => { f.el.style.opacity = 1 - e; f.el.setAttribute('x', lerp(+f.el.getAttribute('x'), ty.x, e * 0.35)); }); fin.style.opacity = e; });
      tyFlights.forEach(f => f.el.remove()); fin.remove();
    }
    // 4. hand over to the real line, return colours to normal
    if (run !== compRun) return;
    hideLines(id, false);
    await tween(300, e => runToks.forEach(r => { r.el.style.opacity = 1 - e; }));
    runToks.forEach(r => r.el.remove());
    $$(`#gNodes .node text.den`).forEach(e => { e.style.opacity = ''; });
    await wait(one ? 160 : 380);
  }
  async function composeAnim() {
    if (!hasSem()) { toast('This theory has no composition rules (Theory tab).'); return; }
    if (S.reveal) { stopCompose(); return; }
    const order = S.sem.order.filter(id => T.find(S.doc, id));
    if (!order.length) return;
    const d = disp(); if (!d.showDen && !d.showTypes) { d.showDen = true; syncDisplayControls(); }
    const run = ++compRun;
    S.reveal = new Set();
    $('#btnCompose').textContent = '■ Stop';
    S.layout = layout(S.doc); draw(S.layout);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { order.forEach(id => S.reveal.add(id)); stopCompose(); return; }
    for (const id of order) { if (run !== compRun) return; await composeStep(id, run); }
    if (run === compRun) { await wait(500); stopCompose(); }
  }
  function stopCompose() {
    compRun++; clearTimeout(compTimer); cancelAnimationFrame(compRaf);
    const g = $('#gAnim'); if (g) g.innerHTML = '';
    $('#svg').classList.remove('composing');
    S.reveal = null; S.pulse = null; $('#btnCompose').textContent = '▶ Compose'; $('#caption').hidden = true; render({ animate: false });
  }
  $('#btnCompose').onclick = composeAnim;

  /* ═════════════ Bracket bar ═════════════ */
  const bin = $('#bracketIn');
  let bracketSession = false;
  let bspans = new Map();
  function syncBracket() { if (document.activeElement === bin) return; const m = T.toBracketMap(S.doc); bin.value = m.text; bspans = m.spans; $('#bracketErr').textContent = ''; autoRows(); updateBracketHL(); }
  // highlight the selected node's brackets (an overlay behind the transparent textarea)
  function updateBracketHL() {
    const hl = $('#bracketHL'); if (!hl) return;
    const id = primary(); const sp = id && bspans.get(id); const t = bin.value;
    if (!sp || sp[1] > t.length) { hl.textContent = t; return; }
    hl.innerHTML = esc(t.slice(0, sp[0])) + '<mark>' + esc(t.slice(sp[0], sp[1])) + '</mark>' + esc(t.slice(sp[1])) + '\n';
    if (document.activeElement !== bin) {
      const mk = hl.querySelector('mark');
      if (mk && (mk.offsetTop < bin.scrollTop || mk.offsetTop > bin.scrollTop + bin.clientHeight - 18)) bin.scrollTop = Math.max(0, mk.offsetTop - 6);
    }
    hl.scrollTop = bin.scrollTop;
  }
  bin.addEventListener('scroll', () => { $('#bracketHL').scrollTop = bin.scrollTop; });
  // caret in the brackets selects the innermost node around it
  function caretSelect() {
    const pos = bin.selectionStart; let best = null, bl = Infinity;
    for (const [id, [a, b]] of bspans) if (a <= pos && pos <= b && b - a < bl && T.find(S.doc, id)) { best = id; bl = b - a; }
    if (best && best !== primary()) { S.sel = [best]; S.selArrow = null; redraw(); ensureVisible(best); }
    else updateBracketHL();
  }
  bin.addEventListener('click', caretSelect);
  bin.addEventListener('keyup', e => { if (/^(Arrow|Home|End|Page)/.test(e.key)) caretSelect(); });
  function autoRows() { bin.rows = Math.min(6, Math.max(1, Math.ceil(bin.value.length / Math.max(40, bin.clientWidth / 7.8)))); }
  const STYLE_PROPS = ['color', 'shape', 'dash', 'note', 'ante', 'arrow', 'avm', 'elabel', 'pos', 'fold'];
  function reuseIds(nd, od) {
    const go = (a, b) => { a.id = b.id; STYLE_PROPS.forEach(p => { if (b[p] !== undefined && a[p] === undefined) a[p] = b[p]; }); a.ch.forEach((c, i) => { if (b.ch[i]) go(c, b.ch[i]); }); };
    nd.roots.forEach((r, i) => { if (od.roots[i]) go(r, od.roots[i]); });
    const seen = new Set(); T.walkDoc(nd, n => { if (seen.has(n.id)) n.id = T.newId(); seen.add(n.id); });
    T.walkDoc(nd, n => { if (n.ante && !seen.has(n.ante)) delete n.ante; });
    nd.arrows = arrowsOf(od).filter(a => seen.has(a.from) && seen.has(a.to));
  }
  bin.addEventListener('focus', () => { bracketSession = false; });
  bin.addEventListener('input', debounce(() => {
    autoRows();
    try {
      let nd;
      if (T.looksLikeLatex(bin.value)) { // pasted LaTeX: convert it in place
        nd = T.parseLatex(bin.value); bin.value = T.toBracket(nd); autoRows();
        if (!bracketSession) { S.undo.push(snapshot()); S.redo = []; bracketSession = true; }
        nd.arrows = (nd.arrows || []).filter(a => !isMovementArrow(nd, a));
        S.doc = nd; bspans = T.toBracketMap(nd).spans; $('#bracketErr').textContent = '';
        render({ keepText: true, animate: false, fit: true }); toast('Converted LaTeX to a tree.');
        return;
      }
      const rg = new Map();
      nd = T.parseBracket(bin.value, rg);
      reuseIds(nd, S.doc);
      bspans = new Map([...rg].map(([n, r]) => [n.id, r]));
      if (!bracketSession) { S.undo.push(snapshot()); S.redo = []; bracketSession = true; }
      S.doc = nd; $('#bracketErr').textContent = '';
      render({ keepText: true, animate: false });
    } catch (e) { $('#bracketErr').textContent = e.message; }
  }, 250));
  bin.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fit(); return; }
    const a = bin.selectionStart, b = bin.selectionEnd;
    if (e.key === '[') { e.preventDefault(); const inner = bin.value.slice(a, b); bin.setRangeText('[' + inner + ']', a, b, 'start'); bin.setSelectionRange(a + 1, a + 1 + inner.length); bin.dispatchEvent(new Event('input')); return; }
    if (e.key === ']' && a === b && bin.value[a] === ']') { e.preventDefault(); bin.setSelectionRange(a + 1, a + 1); return; }
    if (e.key === 'Backspace' && a === b && bin.value[a - 1] === '[' && bin.value[a] === ']') { e.preventDefault(); bin.setRangeText('', a - 1, a + 1, 'start'); bin.dispatchEvent(new Event('input')); }
  });
  bin.addEventListener('blur', () => { if (S.features.deriv && S.deriv.rec && bracketSession) addStep('Edit brackets', S.undo[S.undo.length - 1]); syncBracket(); renderTimeline(); if (bracketSession) fit(); });

  /* ═════════════ Panels: labels, structures, lexicon, examples, parse ═════════════ */
  function fillPalette() {
    const C = S.C;
    let cats = C.cats.map(c => c.label);
    if (!cats.length) { const s = new Set(); C.gram.rules.forEach(r => { s.add(r.lhs); r.rhs.forEach(x => s.add(x.s)); }); C.lex.entries.forEach(e => s.add(e.cat)); cats = [...s]; }
    const pc = $('#palCats');
    pc.innerHTML = cats.length ? cats.map(c => { const rl = richLabel(c); const cc = catColor(c); return `<span class="chip" data-cat="${esc(c)}"${cc ? ` style="--cc:${cc}"` : ''} title="Click: label / group / add under the selection · Drag: drop anywhere"><span${rl.bar ? ` class="ovl${rl.bar > 1 ? '2' : ''}"` : ''}>${esc(rl.base)}</span>${rl.sub ? `<sub>${esc(rl.sub)}</sub>` : ''}</span>`; }).join('') : '<span class="muted small">No labels yet — press <b>edit</b> to add some.</span>';
    pc.querySelectorAll('.chip').forEach(el => chipPointer(el, () => T.mk(el.dataset.cat), el.dataset.cat, () => applyLabel(el.dataset.cat)));
    fillStructs();
    fillLex();
    updateChipHint();
  }
  function updateChipHint() {
    const el = $('#chipHint'); if (!el) return;
    const n = S.sel.length;
    el.textContent = n > 1 ? `Click a label to group the ${n} selected nodes under it.` : n === 1 ? 'Click a label: words get it as a mother, empty nodes get labelled, others get a new daughter.' : 'Click to start a new tree · drag onto a node to attach it.';
  }
  function insertTemplate(t) {
    const head = ($('#xHead').value || 'X').trim() || 'X';
    const e = T.expandTemplate(t, T.labelForTemplate(t, head), t.trigger.includes('$X') ? head : '');
    const id = primary(); const h = id && T.find(S.doc, id);
    if (!h) insertNew(e.node, { zone: 'root' });
    else if (!h.node.ch.length && h.node.label === '') insertNew(e.node, { id, zone: 'replace' });
    else insertNew(e.node, { id, zone: 'child' });
    startSnippet(e.holes);
  }
  function fillStructs() {
    const box = $('#palStruct');
    const list = (S.tpl && S.tpl.list) || [];
    const head = () => ($('#xHead').value || 'X').trim() || 'X';
    box.innerHTML = list.length ? list.map((t, i) => `<span class="chip struct" data-t="${i}" title="${esc(T.templatePreview(t, T.labelForTemplate(t, head())))} — click: insert under the selection (or fill an empty slot) · drag: drop anywhere">${esc(t.name)}</span>`).join('') : '<span class="muted small">No templates — press <b>edit</b> to write some.</span>';
    box.querySelectorAll('.chip').forEach(el => {
      const t = list[+el.dataset.t];
      const make = () => { const e = T.expandTemplate(t, T.labelForTemplate(t, head()), t.trigger.includes('$X') ? head() : ''); S.pendingHoles = e.holes; return e.node; };
      chipPointer(el, make, t.name, () => insertTemplate(t));
    });
  }
  function fillLex() {
    const f = $('#lexFilter').value.trim().toLowerCase();
    const seen = new Set();
    const items = S.C.lex.entries.filter(e => { const k = e.word + '|' + e.cat; if (seen.has(k)) return false; seen.add(k); return !f || e.word.toLowerCase().includes(f) || e.cat.toLowerCase().includes(f); }).slice(0, 120);
    const pl = $('#palLex');
    pl.innerHTML = items.length ? items.map((e, i) => `<span class="chip" data-i="${i}" title="${esc(e.cat)}${e.type ? ' : ' + esc(e.type) : ''}${e.term ? ' — ' + esc(e.term) : ''}">${esc(e.word)}<small>${esc(e.cat)}</small></span>`).join('') : '<span class="muted small">Lexicon is empty.</span>';
    pl.querySelectorAll('.chip').forEach(el => {
      const e = items[+el.dataset.i];
      const make = () => T.mk(e.cat, [T.mk(e.word)]);
      chipPointer(el, make, `${e.cat} ${e.word}`, () => { const p = primary(); insertNew(make(), p ? { id: p, zone: 'child' } : { zone: 'root' }); });
    });
  }
  $('#lexFilter').addEventListener('input', fillLex);
  $('#tplEditBtn').onclick = () => { const t = $('#tplText'); t.hidden = !t.hidden; $('#tplEditBtn').textContent = t.hidden ? 'edit' : 'done'; if (!t.hidden) t.focus(); };
  $('#xHead').addEventListener('input', fillStructs);
  $('#catEditBtn').onclick = () => { const t = $('#catText'); t.hidden = !t.hidden; $('#catEditBtn').textContent = t.hidden ? 'edit' : 'done'; if (!t.hidden) t.focus(); };
  function fillExamples() {
    const ex = S.theory.examples || [];
    $('#examples').innerHTML = ex.length ? ex.map((x, i) => `<button data-ex="${i}">${esc(x.name)}</button>`).join('') : '<span class="muted small">No examples in this theory.</span>';
  }
  $('#examples').addEventListener('click', e => { const b = e.target.closest('[data-ex]'); if (!b) return; loadExample(S.theory.examples[+b.dataset.ex]); });
  function loadExample(x) {
    if (!x) return;
    if (x.doc) {
      S.undo.push(snapshot()); S.redo = []; S.doc = deep(x.doc);
      if (S.theory.avmAutoFill) T.walkDoc(S.doc, n => { if (!n.avm) return; try { n.avm = AVM.str(AVM.fullySpecify(AVM.parse(n.avm), signature())); } catch { /* leave as is */ } }); arrowsOf(S.doc); T.bumpIds(S.doc); S.sel = []; render({ fit: true, animate: false }); }
    else loadTree(x.tree);
    if (x.build && S.features.avm) setTimeout(() => { hpGrammar(); runBuild('tree'); setTimeout(() => fit(), 50); }, 0);
  }
  function fillDatalist() {
    const s = new Set(); S.C.cats.forEach(c => s.add(c.label)); S.C.gram.rules.forEach(r => s.add(r.lhs)); S.C.lex.entries.forEach(e => s.add(e.word));
    $('#labelList').innerHTML = [...s].slice(0, 300).map(x => `<option value="${esc(x)}">`).join('');
  }
  function loadTree(src) {
    try {
      const nd = T.parseBracket(src || '');
      nd.arrows = [];
      S.undo.push(snapshot()); S.redo = [];
      S.doc = nd; S.sel = []; S.selArrow = null;
      render({ fit: true, animate: false });
    } catch (e) { toast('Could not read tree: ' + e.message); }
  }
  function doParse() {
    const s = $('#parseIn').value.trim(); if (!s) return;
    const out = $('#parseOut');
    try {
      if (!S.C.gram.rules.length) throw new Error('This theory has no grammar rules (Theory tab).');
      const res = T.parseSentence(s, S.C.gram, S.C.lex);
      S.parse = { results: res, i: 0 };
      if (!res.length) { out.innerHTML = `<span class="err">No parse.</span> The grammar does not generate this sentence from ${esc(S.C.gram.start || '?')}.`; return; }
      showParse();
    } catch (e) { out.innerHTML = `<span class="err">${esc(e.message)}</span>`; }
  }
  function showParse() {
    const { results, i } = S.parse;
    $('#parseOut').innerHTML = `<div class="row" style="margin-top:6px"><span>${results.length > 1 ? `<b>${results.length}</b> parses (ambiguous)` : '1 parse'}</span><span class="spacer"></span>${results.length > 1 ? `<button data-p="-1">◀</button><span>${i + 1}/${results.length}</span><button data-p="1">▶</button>` : ''}</div>`;
    S.undo.push(snapshot()); S.redo = [];
    S.doc = { roots: [T.clone(results[i], true)], arrows: [] }; S.sel = [];
    render({ fit: true, animate: false });
  }
  $('#parseBtn').onclick = doParse;
  $('#parseIn').addEventListener('keydown', e => { if (e.key === 'Enter') doParse(); });
  $('#parseOut').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; const n = S.parse.results.length; S.parse.i = (S.parse.i + +b.dataset.p + n) % n; showParse(); });
  const wordsGo = (inp) => { addWords(inp.value); inp.value = ''; };
  $('#wordsBtn').onclick = () => wordsGo($('#wordsIn'));
  $('#wordsIn').addEventListener('keydown', e => { if (e.key === 'Enter') wordsGo(e.target); });
  $('#startWordsBtn').onclick = () => wordsGo($('#startWords'));
  $('#startWords').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') wordsGo(e.target); });
  $('#startTop').onclick = () => newAndEdit(() => addRoot());
  $('#startBrackets').onclick = () => { bin.focus(); bin.value = '[S [NP ] [VP ]]'; bin.setSelectionRange(7, 7); };
  $('#startExample').onclick = () => loadExample(S.theory.examples[0]);
  $('#startLearn').onclick = () => startLesson(Theories.lessons[0]);

  /* ═════════════ Transform tab ═════════════ */
  function refreshRules() {
    updateChipHint();
    const box = $('#rwList'); if (!box || !S.C || !S.features.tx) return;
    const rules = S.C.rew.rules;
    const id = primary(); const h = id && T.find(S.doc, id);
    if (!rules.length) { box.innerHTML = '<p class="muted small">No transformations defined yet. Write one above, e.g.<br><code>Swap: [$X ?a ?b] =&gt; [$X ?b ?a]</code></p>'; return; }
    box.innerHTML = rules.map((r, i) => {
      const m = h && T.matchRule(r, h.node, S.C.strip);
      return `<div class="rw-item${m ? ' match' : ''}"><b>${esc(r.name)}${r.manual ? ' <span class="hint">manual</span>' : ''}</b><span class="row"><button data-rw="${i}" ${m ? 'class="accent"' : ''} title="${m ? 'Apply to the selected node' : 'Apply where it first matches'}">${m ? 'Apply here' : 'Apply'}</button></span><code>${esc(r.src.replace(/^.*?:\s*/, ''))}</code></div>`;
    }).join('');
  }
  function applyRule(rule, id) {
    let target = id;
    if (!target || !T.matchRule(rule, T.find(S.doc, target).node, S.C.strip)) {
      const m = T.findMatch(S.doc, [rule], S.C.strip);
      if (!m) { toast(`${rule.name}: no match ${id ? 'at the selection or ' : ''}anywhere in the tree.`); return; }
      target = m.id;
    }
    let nid;
    commit(rule.name, () => { nid = T.applyRuleAt(S.doc, rule, target, S.C.strip); return nid ? undefined : false; }, { record: true });
    if (typeof nid === 'string') { S.sel = [nid]; redraw(); }
    showCaption(`<span class="rule">Transformation</span>${esc(rule.name)}`, 1500);
  }
  $('#rwList').addEventListener('click', e => { const b = e.target.closest('[data-rw]'); if (!b) return; applyRule(S.C.rew.rules[+b.dataset.rw], primary()); });
  $('#rwOnce').onclick = () => {
    const rules = S.C.rew.rules.filter(r => !r.manual);
    const m = T.findMatch(S.doc, rules, S.C.strip);
    if (!m) { toast('No rule matches anywhere.'); return; }
    applyRule(m.rule, m.id);
  };
  $('#rwNormalize').onclick = () => {
    const rules = S.C.rew.rules.filter(r => !r.manual);
    if (!rules.length) { toast('No (non-manual) rules to apply.'); return; }
    setFeatures({ deriv: true });
    const before = snapshot();
    const work = deep(S.doc); const steps = [];
    for (let i = 0; i < 100; i++) {
      const m = T.findMatch(work, rules, S.C.strip); if (!m) break;
      T.applyRuleAt(work, m.rule, m.id, S.C.strip);
      steps.push({ doc: deep(work), desc: m.rule.name });
    }
    if (!steps.length) { toast('Already normal: no rule applies.'); return; }
    const D = S.deriv;
    if (D.cur >= 0 && D.cur < D.steps.length - 1) D.steps.length = D.cur + 1;
    const startIdx = D.steps.length && JSON.stringify(D.steps[D.steps.length - 1].doc) === before ? D.steps.length - 1 : D.steps.length;
    if (startIdx === D.steps.length) D.steps.push({ doc: JSON.parse(before), desc: D.steps.length ? 'Before normalizing' : 'Start' });
    D.steps.push(...steps);
    S.undo.push(before); S.redo = [];
    D.cur = startIdx;
    toast(`${steps.length} rewrite step${steps.length > 1 ? 's' : ''}${steps.length === 100 ? ' (stopped at 100 — rules may loop)' : ''}. Playing…`);
    renderTimeline();
    S.playing = false; play();
  };

  /* ═════════════ λ-calculator ═════════════ */
  function runCalc() {
    const src = $('#calcIn').value.trim(); const out = $('#calcOut');
    if (!src) { out.innerHTML = ''; return; }
    try {
      const t = Logic.parseTerm(src);
      let tyHtml;
      try { tyHtml = `<span class="tybadge">${esc(Logic.typeStr(Logic.infer(t, S.C.tctx).type, disp().typeStyle))}</span>`; }
      catch (e) { tyHtml = `<span class="err small">${esc(e.message)}</span>`; }
      const steps = Logic.reductionSteps(t);
      const nf = steps[steps.length - 1].term;
      let valHtml;
      try { valHtml = `<span class="valline">${esc(Logic.showVal(Logic.evaluate(nf, S.C.model), S.C.model))}</span>`; }
      catch (e) { valHtml = `<span class="small muted">${esc(e.message)}</span>`; }
      out.innerHTML = `<div class="card"><div class="kv"><span>Type</span>${tyHtml}<span>Normal form</span><span class="term">${showHtml(nf)}</span><span>Model</span>${valHtml}</div></div>
        ${steps.length > 1 ? `<ol class="steps-list">${steps.map(s => `<li class="term">${showHtml(s.term, s.redex)}</li>`).join('')}</ol>` : ''}`;
    } catch (e) { out.innerHTML = `<div class="errbox">${esc(e.message)}</div>`; }
  }
  $('#calcIn').addEventListener('input', debounce(runCalc, 250));
  $('#calcIn').addEventListener('input', () => {
    const el = $('#calcIn'); const v = el.value; const pos = el.selectionStart;
    const nv = v.replace(/\\(?![/])/g, 'λ').replace(/->/g, '→');
    if (nv !== v) { el.value = nv; const d = v.length - nv.length; el.setSelectionRange(pos - d, pos - d); }
  });

  /* ═════════════ Tabs & form bindings ═════════════ */
  function switchTab(name) {
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    $$('.tab').forEach(t => { t.hidden = t.id !== 'tab-' + name; });
    if (name === 'transform') refreshRules();
    if (name === 'model') runCalc();
  }
  $$('.tabs button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $$('[data-th]').forEach(el => {
    const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => { S.theory[el.dataset.th] = el.type === 'checkbox' ? el.checked : el.value; if (['leave', 'moveIndex', 'dragMode'].includes(el.dataset.th)) syncDisplayControls(); onTheoryEdit(); });
  });
  $('#th-name').addEventListener('input', e => { S.theory.name = e.target.value; const o = $('#modeSel').selectedOptions[0]; if (o && o.value === 'custom') o.textContent = e.target.value; autosave(); });
  $$('[data-disp]').forEach(el => {
    if (el.tagName === 'BUTTON') el.addEventListener('click', () => { const k = el.dataset.disp; disp()[k] = !disp()[k]; syncDisplayControls(); render(); });
    else el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      const k = el.dataset.disp; disp()[k] = el.type === 'checkbox' ? el.checked : el.value; syncDisplayControls(); fillPalette(); render(); runCalc();
    });
  });
  function setDrag(kind, leave) {
    if (kind) S.theory.dragMode = kind;
    if (leave) S.theory.leave = leave;
    syncDisplayControls(); autosave();
    if (hintsOn()) toast(dragKind() === 'rearrange' ? 'Drag to rearrange: nodes just move (hold Shift to transform instead).' : `Drag to transform: a moved phrase ${LEAVE_TEXT[leaveKind()]}${leaveKind() === 'nothing' ? '' : ' and gets an arrow'} (hold Shift to just rearrange).`, 3500);
  }
  $$('[data-dmode]').forEach(b => b.addEventListener('click', () => setDrag(b.dataset.dmode)));
  $('#leaveSel').addEventListener('change', async e => {
    const v = e.target.value;
    if (v === 'custom') { const l = await askText('Leave behind which label? (e.g. ∅, e, PRO, ec, __)', S.theory.leaveLabel || '∅'); if (l == null || !l.trim()) { syncDisplayControls(); return; } S.theory.leaveLabel = l.trim(); const f = $('[data-th="leaveLabel"]'); if (f) f.value = S.theory.leaveLabel; }
    setDrag(null, v);
  });
  function sizeModeSel() {
    const ms = $('#modeSel'), o = ms.selectedOptions[0]; if (!o) return;
    const c = sizeModeSel.c || (sizeModeSel.c = document.createElement('canvas').getContext('2d'));
    c.font = getComputedStyle(ms).font; ms.style.width = Math.ceil(c.measureText(o.textContent).width + 8) + 'px';
  }
  new MutationObserver(sizeModeSel).observe($('#modeSel'), { childList: true, subtree: true, characterData: true });
  $('#modeSel').addEventListener('input', sizeModeSel);
  $('#modeSel').addEventListener('change', e => {
    const ts = $('#theorySel'); ts.value = e.target.value; ts.dispatchEvent(new Event('change')); e.target.blur();
  });
  $('#theorySel').addEventListener('change', e => {
    const v = e.target.value;
    if (v.startsWith('my:')) { const t = myTheories()[+v.slice(3)]; if (t) setTheory(t, v); }
    else if (v !== 'custom') setTheory(Theories.byId(v), v);
    $('#featMenu').hidden = true;
  });
  $('#thSave').onclick = () => {
    const name = prompt('Save theory as:', S.theory.name); if (!name) return;
    S.theory.name = name; $('#th-name').value = name;
    const list = myTheories(); const i = list.findIndex(t => t.name === name);
    if (i >= 0) list[i] = deep(S.theory); else list.push(deep(S.theory));
    store.set('arbor.theories', JSON.stringify(list));
    S.presetId = 'my:' + (i >= 0 ? i : list.length - 1); fillTheorySelect(); toast('Saved to “My theories” in this browser.');
  };
  $('#thReset').onclick = () => {
    const base = S.presetId.startsWith('my:') ? myTheories()[+S.presetId.slice(3)] : Theories.byId(S.presetId);
    if (!base) { toast('Nothing to reset to.'); return; }
    if (!confirm('Discard your edits to this theory?')) return;
    setTheory(base, S.presetId, { loadExample: false });
  };
  $('#thImport').onclick = () => { fileMode = 'theory'; $('#fileIn').click(); };

  /* ═════════════ Files, share, export ═════════════ */
  let fileMode = 'workspace';
  function workspace() { return { arbor: 2, doc: S.doc, theory: S.theory, presetId: S.presetId, deriv: { steps: S.deriv.steps, cur: S.deriv.cur } }; }
  function download(name, text, type = 'application/json') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const fileBase = () => (T.yieldOf(S.doc.roots[0] || { label: 'tree', ch: [] }).slice(0, 5).join('-') || 'tree').replace(/[^\p{L}\p{N}-]+/gu, '_');
  function saveFile() { download(`${fileBase()}.treditor.json`, JSON.stringify(workspace(), null, 1)); }
  function loadWorkspace(w) {
    if (!w || !w.doc || !Array.isArray(w.doc.roots)) throw new Error('Not an Treditor file');
    S.theory = normalizeTheory(w.theory || Theories.byId('syn'));
    S.presetId = w.presetId && (Theories.byId(w.presetId) || w.presetId.startsWith('my:')) ? w.presetId : 'custom';
    S.doc = w.doc; arrowsOf(S.doc); T.bumpIds(S.doc);
    S.deriv = { steps: (w.deriv && w.deriv.steps) || [], cur: (w.deriv && w.deriv.cur) ?? -1, rec: false };
    S.deriv.steps.forEach(s => T.bumpIds(s.doc));
    S.sel = []; recompile(); fillTheorySelect(); fillTheoryForm();
    render({ fit: true, animate: false });
  }
  $('#btnSave').onclick = saveFile;
  $('#btnOpen').onclick = () => { fileMode = 'workspace'; $('#fileIn').click(); };
  $('#fileIn').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (fileMode === 'theory' || (!data.doc && data.lexicon !== undefined)) { setTheory(data.theory || data, 'custom', { loadExample: false }); toast('Theory imported.'); }
      else { S.undo.push(snapshot()); loadWorkspace(data); toast('Opened ' + f.name); }
    } catch (err) { toast('Could not open: ' + err.message); }
  });
  $('#btnNew').onclick = () => { if (S.doc.roots.length && !confirm('Start over with an empty canvas? (Undo can bring it back.)')) return; commit('Clear', () => { S.doc = { roots: [], arrows: [] }; }, { animate: false }); S.sel = []; };
  $('#btnUndo').onclick = () => (S.centerView && S.centerView !== 'tree' ? thUndo(false) : undo()); $('#btnRedo').onclick = () => (S.centerView && S.centerView !== 'tree' ? thUndo(true) : redo());

  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  async function pack(obj) {
    const stream = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return b64u(await new Response(stream).arrayBuffer());
  }
  async function unpack(s) {
    const stream = new Blob([unb64u(s)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(stream).text());
  }
  $('#btnShare').onclick = async () => {
    try {
      const url = location.origin + location.pathname + '#w=' + await pack({ ...workspace(), features: S.features });
      history.replaceState(null, '', url);
      try { await navigator.clipboard.writeText(url); toast(`Link copied (${Math.round(url.length / 1024)} KB) — it contains the whole tree.`); }
      catch { prompt('Copy this link:', url); }
    } catch (e) { toast('Sharing failed: ' + e.message); }
  };

  const toggleMenu = (btn, m) => { $(btn).onclick = e => { e.stopPropagation(); const hidden = $(m).hidden; $$('.menu-wrap .menu').forEach(x => { x.hidden = true; }); $(m).hidden = !hidden; }; };
  toggleMenu('#btnExport', '#exportMenu'); toggleMenu('#btnFeatures', '#featMenu'); toggleMenu('#btnFile', '#fileMenu'); toggleMenu('#btnDisplay', '#dispMenu');
  $('#fileMenu').addEventListener('click', e => { if (e.target.closest('button')) $('#fileMenu').hidden = true; });
  document.addEventListener('click', e => { if (!e.target.closest('.menu-wrap')) $$('.menu-wrap .menu').forEach(x => { x.hidden = true; }); });
  $('#exportMenu').addEventListener('click', e => {
    const b = e.target.closest('[data-exp]'); if (!b) return;
    $('#exportMenu').hidden = true;
    const kind = b.dataset.exp;
    if (kind === 'png' || kind === 'svg') return exportImage(kind);
    if (kind === 'theory') return download(`${(S.theory.name || 'theory').replace(/[^\w-]+/g, '_')}.theory.json`, JSON.stringify(S.theory, null, 1));
    const links = disp().arrows ? movementLinks(S.doc).map(a => ({ ...a, dash: a.dash !== false })) : [];
    let text = '';
    if (kind === 'bracket') text = T.toBracket(S.doc, true);
    // export what the canvas shows: the computed structure in the current view (Textbook / Fully specified), else what was written
    const avmTex = S.features.avm ? (n => { const v = shownAvm(n); if (!v) return ''; return avmLatexStyle() === 'langsci' ? `{\\avm{${AVM.tex(v)}}}` : `{${AVM.avmStyBlock(v, { isType: avmIsType })}}`; }) : null;
    const fx = { bars: disp().bars === 'prime' ? 'prime' : 'bar', anchor: disp().arrowToHead === false ? null : headNodeId, geom: id => (S.layout && S.layout.recs.get(id)) || null };
    if (kind === 'forest') text = T.toForest(S.doc, { links, avm: avmTex, ...fx });
    if (kind === 'forestsem') text = T.toForest(S.doc, { ...fx, links, extra: n => { const i = infoOf(n.id); if (!i || !i.red) return ''; return `$${texMath(i.tyStr)}$\\\\$${texMath(Logic.show(i.red, showOpts()))}$`; } });
    if (kind === 'qtree') text = T.toQtree(S.doc);
    if (kind === 'deriv') {
      const steps = S.deriv.steps.length ? S.deriv.steps : [{ doc: S.doc, desc: 'Tree' }];
      text = `% Derivation exported from Treditor — needs \\usepackage[linguistics]{forest}\n` + steps.map((s, i) => `% Step ${i}: ${s.desc}\n\\noindent\\textbf{Step ${i}}: ${T.texLabel(s.desc)}\\\\[2pt]\n${T.toForest(s.doc)}\n\\bigskip`).join('\n\n');
    }
    if (kind === 'forest' || kind === 'forestsem') {
      const boxed = text.includes('\\begin{lrbox}{\\treebox}');
      text = `% \\usepackage[linguistics]{forest}  \\usepackage[normalem]{ulem} (for \\sout)${S.features.avm ? (avmLatexStyle() === 'langsci' ? '  \\usepackage{langsci-avm}' : '  \\usepackage{avm}') : ''}${boxed ? '\n% plus \\usepackage{graphicx} and, once in the preamble, \\newsavebox{\\treebox}' : ''}\n${text}`;
    }
    if (kind === 'qtree') text = `% \\usepackage{qtree}\n${text}`;
    showExport(kind, text);
  });
  // the feature structure a node shows on the canvas (computed view), else what was written
  function shownAvm(n) { const d = HP.disp && HP.disp.get(n.id); if (d && d.v) return d.v; const a = n.avm && avmOf(n.avm); return a && a.v ? a.v : null; }
  const avmLatexStyle = () => disp().avmLatex || 'avm';
  // atoms set in italics: grammar types with features of their own (verb, 3sing …), not plain values (fin, nom …)
  function avmIsType(name) { const G = typeof hpGrammar === 'function' ? hpGrammar() : null; if (!G || !G.types.has(name)) return false; try { const c = G.expC(name); return !!(c && c.f && c.f.size); } catch { return false; } }
  // one node on its own: its full structure (as computed in the tree), with tags numbered from 1 within it
  function standaloneAvm(id) {
    const G = typeof hpGrammar === 'function' ? hpGrammar() : null; const h = T.find(S.doc, id);
    if (!G || !h || hpView() === 'written') return h ? shownAvm(h.node) : null;
    const root = T.rootOf(S.doc, id); const nodes = [];
    T.walk(root, n => { if (n.avm) { const a = avmOf(n.avm); if (a && a.v) nodes.push({ id: n.id, avm: a.v }); } });
    try {
      const rd = TFS.readTree(nodes, G); const r = rd.roots.get(id); if (!r) return shownAvm(h.node);
      const hide = new Set(String(S.theory.avmHide || '').split(/[\s,]+/).filter(Boolean));
      return TFS.toAVM([r], G, { compact: hpView() === 'compact', hide })[0];
    } catch { return shownAvm(h.node); }
  }
  function exportNodeAvm(id) {
    const h = T.find(S.doc, id); const v = h && standaloneAvm(id);
    if (!v) { toast('This node has no feature structure.'); return; }
    const text = avmLatexStyle() === 'langsci' ? `% \\usepackage{langsci-avm}\n\\avm{${AVM.tex(v)}}` : `% \\usepackage{avm}\n${AVM.avmStyBlock(v, { isType: avmIsType })}`;
    showExport('avm', text);
  }
  function texMath(s) {
    const map = { 'λ': '\\lambda ', '∀': '\\forall ', '∃': '\\exists ', '¬': '\\neg ', '∧': '\\wedge ', '∨': '\\vee ', '→': '\\rightarrow ', '↔': '\\leftrightarrow ', 'ι': '\\iota ', '⟨': '\\langle ', '⟩': '\\rangle ', '≠': '\\neq ', '≤': '\\leq ', '≥': '\\geq ', '⊤': '\\top ', '⊥': '\\bot ' };
    return s.replace(/([A-Za-z])_?(\d+)/g, '$1_{$2}').replace(/[A-Za-z]{2,}/g, w => `\\mathit{${w}}`).replace(/[λ∀∃¬∧∨→↔ι⟨⟩≠≤≥⊤⊥]/g, c => map[c]);
  }
  function showExport(kind, text) {
    openModal(`<h2>Export</h2><pre class="out" id="expText"></pre><div class="row"><button class="accent" id="expCopy">Copy</button><button id="expDl">Download</button></div>`);
    $('#expText').textContent = text;
    $('#expCopy').onclick = async () => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Clipboard unavailable — select the text instead.'); } };
    $('#expDl').onclick = () => download(`${fileBase()}.${kind === 'bracket' ? 'txt' : 'tex'}`, text, 'text/plain');
  }
  function exportImage(kind) {
    const L = S.layout; if (!L || !L.recs.size) { toast('Nothing to export.'); return; }
    const keepSel = S.sel, keepA = S.selArrow; S.sel = []; S.selArrow = null; draw(L);
    const pad = 24, b = L.bbox;
    const W = b.x1 - b.x0 + pad * 2, H = b.y1 - b.y0 + pad * 2;
    const ns = 'http://www.w3.org/2000/svg';
    const out = document.createElementNS(ns, 'svg');
    out.setAttribute('xmlns', ns); out.setAttribute('viewBox', `${b.x0 - pad} ${b.y0 - pad} ${W} ${H}`);
    out.setAttribute('width', W); out.setAttribute('height', H);
    out.style.position = 'absolute'; out.style.left = '-99999px';
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim() || '#fff';
    out.innerHTML = `<rect x="${b.x0 - pad}" y="${b.y0 - pad}" width="${W}" height="${H}" fill="${bg}"/>` + $('#svg defs').outerHTML + $('#gEdges').outerHTML + $('#gArrows').outerHTML + $('#gNodes').outerHTML;
    document.body.appendChild(out);
    const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-family', 'font-size', 'font-style', 'font-weight', 'opacity', 'paint-order', 'color'];
    out.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      const st = props.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';');
      el.setAttribute('style', st + ';' + (el.getAttribute('style') || ''));
      el.removeAttribute('class');
    });
    out.querySelectorAll('title, .uarrow-hit').forEach(t => t.remove());
    out.querySelectorAll('[data-id],[data-arrow]').forEach(el => { el.removeAttribute('data-id'); el.removeAttribute('data-arrow'); });
    out.style.position = ''; out.style.left = '';
    const xml = new XMLSerializer().serializeToString(out);
    out.remove();
    S.sel = keepSel; S.selArrow = keepA; draw(L);
    if (kind === 'svg') return download(`${fileBase()}.svg`, xml, 'image/svg+xml');
    const img = new Image();
    img.onload = () => {
      const scale = 2; const c = document.createElement('canvas');
      c.width = W * scale; c.height = H * scale;
      const g = c.getContext('2d'); g.scale(scale, scale); g.drawImage(img, 0, 0);
      c.toBlob(bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = `${fileBase()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); });
    };
    img.onerror = () => toast('PNG export failed — try SVG.');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  }

  /* ═════════════ Modal, help, lessons ═════════════ */
  let modalClose = null;
  function openModal(html, onClose) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; modalClose = onClose || null; $('#modalBody').onclick = null; }
  function closeModal() { $('#modal').hidden = true; if (modalClose) modalClose(); modalClose = null; }
  $('#modalX').onclick = closeModal;
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
  function openHelp() {
    openModal(`<h2>Treditor — reference</h2>
      <label class="check"><input type="checkbox" id="hintsToggle" ${hintsOn() ? 'checked' : ''}> Show hints around the app (panel tips, guide, slot captions)</label>
      <p class="muted">A tree editor for any syntactic theory. Labels are free text; nothing is checked unless you turn on <b>Grammar</b> in the Features menu.</p>
      <h3>Everything by keyboard</h3><table><tbody>
        <tr><td><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd></td><td>command palette: search any action (triangle, arrow, move, colour, export, theory…) — ↑↓ + Enter</td></tr>
        <tr><td><kbd>Shift</kbd>+<kbd>F10</kbd> / Menu key</td><td>context menu for the selection — ↑↓ + Enter</td></tr>
        <tr><td><kbd>↓</kbd> in a label box</td><td>template suggestions — ↑↓ + Enter inserts; then <kbd>Tab</kbd>/<kbd>⇧Tab</kbd> walk the slots</td></tr>
        <tr><td>Choosing a target</td><td>arrows, coindexing and “Move to…”: <kbd>←↑↓→</kbd> move the orange cursor, <kbd>Enter</kbd> picks, <kbd>Esc</kbd> cancels</td></tr>
        <tr><td><kbd>Shift</kbd>+arrows</td><td>extend the selection, then type a label to group</td></tr>
        <tr><td>Selected arrow</td><td><kbd>Enter</kbd> label · <kbd>←/→</kbd> next arrow · <kbd>Del</kbd> delete · <kbd>Esc</kbd> back to its node</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>=</kbd>/<kbd>-</kbd>/<kbd>0</kbd></td><td>zoom in / out / fit</td></tr>
      </tbody></table>
      <h3>Building</h3><table><tbody>
        <tr><td>Type a sentence → <b>Add words</b></td><td>each word becomes a node; select some and type a label to group them</td></tr>
        <tr><td>Drag a box on the canvas</td><td>select several nodes (Shift adds) · Shift-click also adds</td></tr>
        <tr><td>Type with nodes selected</td><td>one node: rename it · several: group them under a new node with that label</td></tr>
        <tr><td>Click a label chip</td><td>several selected: group under it · word: give it that mother · empty node: label it · otherwise: new daughter</td></tr>
        <tr><td><kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd></td><td>while typing a label: commit + new daughter / commit + new sister of the mother. Tab adds daughters on the right by default — switch to the left under Build → Options or with Ctrl+K “Tab adds…”. Left/right daughters are also in the node toolbar (+↙ / +↘), menu and palette.</td></tr>
        <tr><td><kbd>Shift</kbd>+<kbd>Enter</kbd></td><td>commit + new sister</td></tr>
        <tr><td>Arrows · <kbd>Alt</kbd>+←/→</td><td>navigate · reorder sisters</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>↑</kbd> · <kbd>Ctrl</kbd>+<kbd>G</kbd> · <kbd>Ctrl</kbd>+<kbd>M</kbd></td><td>add mother · group · Merge</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>↓</kbd></td><td>insert a layer below (the new node takes all the daughters)</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>⇧</kbd>+<kbd>↑</kbd></td><td>insert a projection above, with a head: type VP, Tab (V is filled in), Tab, the word</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>F</kbd></td><td>find &amp; replace labels and words (case, whole label, regex with $1)</td></tr>
        <tr><td><kbd>F2</kbd> with several selected</td><td>relabel them all · right-click → “Select all with this label” first</td></tr>
        <tr><td>Bracket bar</td><td>the selected node is highlighted; click inside the brackets to select that node · paste forest / qtree LaTeX to convert it</td></tr>
        <tr><td><kbd>Del</kbd> · <kbd>Shift</kbd>+<kbd>Del</kbd></td><td>delete just the node (keep daughters) · delete with everything below</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>X</kbd>/<kbd>V</kbd>/<kbd>D</kbd></td><td>copy / cut / paste as daughter / duplicate — pasting bracket text or a sentence works too</td></tr>
        <tr><td>Right-click / long-press</td><td>every action for nodes, arrows and the canvas</td></tr>
      </tbody></table>
      <h3>Moving</h3><table><tbody>
        <tr><td><kbd>Ctrl</kbd>/<kbd>⌘</kbd>+drag · <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+arrows</td><td>nudge a node (and its subtree) by hand — it resists a little, keeps clear of its sisters, and snaps back if its mother or sisters change. Reset from the right-click menu.</td></tr>
        <tr><td>Drop zones</td><td><b>middle</b> of a node = daughter · <b>left/right edge</b> = sister · <b>top edge</b> = adjoin above (Merge) · empty canvas = separate tree</td></tr>
        <tr><td>Drag to rearrange / Drag to transform</td><td>rearranging just moves nodes; transforming is syntactic movement and leaves behind a trace, an unpronounced copy, nothing, or a custom placeholder (pick next to the switch; labels and index style under Build → Options). <kbd>Shift</kbd> while dropping does the other one · <kbd>Alt</kbd> copies</td></tr>
        <tr><td>Traces</td><td>a node labelled <code>t_i</code> (or an unpronounced <code>&lt;DP_i&gt;</code>) automatically gets an arrow to the node marked <code>_i</code></td></tr>
        <tr><td>Arrows</td><td>select a node → ↷ → click the target. Arrows run in tidy lanes automatically; click any arrow (movement ones too) and drag its round handles to reshape it — middle = depth, ends = slide sideways; double-click a handle to reset. Keys: <kbd>↑↓</kbd> depth, <kbd>Alt</kbd>+<kbd>←→</kbd> / <kbd>Alt</kbd>+<kbd>⇧</kbd>+<kbd>←→</kbd> ends. Label, dash, route above/below, hide or delete from the inspector or right-click. Squared or curved style under Build → Options.</td></tr>
      </tbody></table>
      <h3>Labels &amp; bracket notation</h3><table><tbody>
        <tr><td><code>DP_i</code> · <code>X^max</code> · <code>T'</code></td><td>subscript · superscript · bar level (show as X′ or X̄ under Build → Options)</td></tr>
        <tr><td><code>[S [NP Kim] [VP sleeps]]</code></td><td>labelled bracketing (<code>[.S …]</code> also works)</td></tr>
        <tr><td><code>[NP^ the old man]</code></td><td>triangle over the words</td></tr>
        <tr><td><code>[T{uφ, EPP} will]</code></td><td>features</td></tr>
        <tr><td><code>&lt;DP&gt;</code></td><td>unpronounced / struck-out copy</td></tr>
        <tr><td><code>{New York}</code></td><td>one leaf containing spaces</td></tr>
      </tbody></table>
      <h3>Advanced (Features menu)</h3>
      <p><b>Semantics</b> adds types, λ-terms, composition rules and models. <b>Grammar</b> checks trees against phrase-structure rules and parses sentences. <b>Transformations</b> are tree-rewriting rules (<code>Name: [pattern] =&gt; [result]</code> with <code>?x</code>, <code>?x*</code>, <code>$X</code>). The <b>Derivation timeline</b> records steps and plays them back as an animation. Everything about a theory is editable text on the Theory tab.</p>`);
  }
  $('#btnHelp').onclick = openHelp;
  function openContact() {
    const C = window.CONTACT || {}, esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const pretty = u => esc(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''));
    const rows = [['Email', C.email && `<a href="mailto:${esc(C.email)}">${esc(C.email)}</a>`],
      ...[['Website', 'website'], ['GitHub', 'github'], ['Social', 'twitter'], ['LinkedIn', 'linkedin'], ['Support', 'support']]
        .map(([l, k]) => [l, C[k] && `<a href="${esc(C[k])}" target="_blank" rel="noopener">${pretty(C[k])}</a>`])].filter(r => r[1]);
    openModal(`<h2>${C.name ? 'Made by ' + esc(C.name) : 'Contact'}</h2>
      ${C.blurb ? `<p>${esc(C.blurb)}</p>` : ''}
      ${rows.length ? `<table class="contact"><tbody>${rows.map(([l, v]) => `<tr><td class="muted">${l}</td><td>${v}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">No contact details yet — fill in <code>js/contact.js</code>.</p>'}`);
  }
  $('#btnContact').onclick = openContact;
  $('#byline').onclick = openContact;
  if ((window.CONTACT || {}).name) $('#bylineName').textContent = window.CONTACT.name;
  document.addEventListener('change', e => { if (e.target.id === 'hintsToggle') setHints(e.target.checked); });
  $('#btnLearn').onclick = () => {
    const tag = l => { const f = Object.keys(l.features || {}).filter(k => l.features[k]); return f.length ? `<span>uses ${f.map(k => ({ sem: 'semantics', gram: 'grammar', tx: 'transformations', deriv: 'timeline' }[k])).join(', ')}</span>` : '<span>basics</span>'; };
    openModal(`<h2>Learn by doing</h2><p class="muted">Short, hands-on tasks. Lessons that use advanced features switch them on for you.</p><div class="lessons">${Theories.lessons.map((l, i) => `<button data-lesson="${i}"><b>${esc(l.title)}</b>${tag(l)}</button>`).join('')}</div>`);
    $('#modalBody').onclick = e => { const b = e.target.closest('[data-lesson]'); if (!b) return; closeModal(); startLesson(Theories.lessons[+b.dataset.lesson]); };
  };
  function startLesson(l) {
    const th = Theories.byId(l.theory);
    setFeatures(l.features || {});
    if (S.presetId !== th.id) setTheory(th, th.id, { loadExample: false });
    const ex0 = th.examples[l.exampleIndex || 0];
    const tree = l.tree !== undefined ? l.tree : ex0 && ex0.tree;
    if (l.tree === undefined && ex0 && ex0.doc) loadExample(ex0); else loadTree(tree || '');
    S.deriv = { steps: [], cur: -1, rec: false }; renderTimeline();
    switchTab(l.tab || 'build');
    const card = $('#lessonCard');
    card.innerHTML = `<button class="x" aria-label="Close">×</button><h4>${esc(l.title)}</h4><ol>${l.steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
    card.hidden = false;
    card.querySelector('.x').onclick = () => { card.hidden = true; };
    if (!tree) setTimeout(() => $('#startWords').focus(), 50);
  }

  $('#btnPanels').onclick = () => document.body.classList.toggle('panels-open');

  /* ═════════════ Command palette (every action by keyboard) ═════════════ */
  const pal = { items: [], all: [], hi: 0, mode: 'cmd', resolve: null };
  function commandList() {
    const C = []; const add = (grp, t, run, k = '') => C.push({ grp, t, run, k });
    if (S.centerView === 'theory' && WS && WS.commands) C.push(...WS.commands());
    if (S.centerView === 'model' && MW && MW.commands) C.push(...MW.commands());
    if (S.centerView && S.centerView !== 'tree') {
      add('Edit', 'Undo the last theory change', () => thUndo(false), 'Ctrl+Z'); add('Edit', 'Redo', () => thUndo(true), 'Ctrl+⇧Z');
      add('View', 'Tree view', () => setView('tree'), 'Ctrl+1'); add('View', 'Theory editor', () => setView('theory'), 'Ctrl+2'); if (S.features.sem) add('View', 'Model editor', () => setView('model'), 'Ctrl+3');
      return C;
    }
    const id = primary(); const h = id && T.find(S.doc, id); const multi = S.sel.length > 1;
    const a = S.selArrow && getArrow(S.selArrow);
    const tl = disp().tabSide === 'left';
    if (a) {
      add('Arrow', 'Label…', () => runCmd('alabel'), 'Enter'); add('Arrow', a.side === 'above' ? 'Route below the tree' : 'Route above the tree', () => runCmd('aside'));
      add('Arrow', arrowDashed(a) ? 'Solid line' : 'Dashed line', () => runCmd('adash')); add('Arrow', 'Change arrowheads (one / both / none)', () => runCmd('aheads'));
      add('Arrow', 'Run deeper', () => nudgeArrow({ dy: 12 }), '↓'); add('Arrow', 'Run shallower', () => nudgeArrow({ dy: -12 }), '↑');
      add('Arrow', 'Reset path', () => runCmd('areset'));
      [['', 'automatic'], ['lane', 'squared lane'], ['curve', 'curve'], ['straight', 'straight line'], ['free', 'free curve (angles)']].forEach(([v, l]) => add('Arrow', `Shape: ${l}`, () => runCmd('ashape:' + v)));
      ['auto', 'bottom', 'top', 'left', 'right', 'center'].forEach(v => { add('Arrow', `Leave from: ${v}`, () => runCmd('aat1:' + v)); add('Arrow', `Arrive at: ${v}`, () => runCmd('aat2:' + v)); });
      add('Arrow', 'Rotate arrival angle +15°', () => runCmd('arot:2:15'), ']'); add('Arrow', 'Rotate arrival angle −15°', () => runCmd('arot:2:-15'), '[');
      add('Arrow', 'Rotate leaving angle +15°', () => runCmd('arot:1:15'), '}'); add('Arrow', 'Rotate leaving angle −15°', () => runCmd('arot:1:-15'), '{');
      [['thin', 'thin'], ['', 'normal'], ['thick', 'thick']].forEach(([v, l]) => add('Arrow', `Thickness: ${l}`, () => runCmd('aw:' + v)));
      if (!a.mv) add('Arrow', 'Reverse direction', () => runCmd('arev'));
      add('Arrow', 'Next arrow', () => cycleArrow(1), '→'); add('Arrow', a.mv ? 'Hide' : 'Delete', () => runCmd('adel'), 'Del');
    }
    if (movementLinks(S.doc).length || arrowsOf(S.doc).length) add('Arrow', 'Select an arrow', () => cycleArrow(1));
    add('Arrow', 'Show hidden arrows', () => runCmd('showArrows'));
    add('Drag', 'Renumber movement chains in cyclic order', () => runCmd('renumber'));
    if (h && !multi) {
      const n = h.node, N = 'Node';
      add(N, 'Rename', () => runCmd('rename'), 'Enter');
      if (S.features.avm && shownAvm(n)) add('Export', 'Copy this feature structure as LaTeX', () => exportNodeAvm(n.id));
      add(N, 'Add daughter on the left', () => runCmd('childL'), tl ? 'Tab' : ''); add(N, 'Add daughter on the right', () => runCmd('childR'), tl ? '' : 'Tab');
      add(N, 'Add sister on the left', () => runCmd('sisL')); add(N, 'Add sister on the right', () => runCmd('sisR'), '⇧Tab');
      add(N, 'Add mother', () => runCmd('mother'), 'Ctrl+↑');
      add(N, 'Insert layer below (new node takes the daughters)', () => runCmd('layerBelow'), 'Ctrl+↓');
      add(N, 'Insert projection above, head on the left', () => runCmd('projection'), 'Ctrl+⇧↑'); add(N, 'Insert projection above, head on the right', () => runCmd('projectionR'));
      add(N, 'Select all nodes with this label', () => runCmd('sameLabel'));
      if (n.ch.length) add(N, n.roof ? 'Remove triangle' : 'Triangle over the words', () => runCmd('roof'));
      add(N, n.silent ? 'Make pronounced' : 'Make unpronounced (strike out)', () => runCmd('silent'));
      if (h.parent) add(N, n.dash ? 'Solid branch' : 'Dashed branch to mother', () => runCmd('dash'));
      add(N, 'Note / gloss…', () => runCmd('note')); add(N, 'Features…', () => runCmd('feat'));
      if (h.parent) add(N, 'Branch label…', () => runCmd('elabel'));
      add(N, 'Feature structure (AVM)…', () => runCmd('avm'));
      if (n.avm) add(N, 'Fully specify feature structure (from the signature)', () => runCmd('avmFill'));
      if (defaultAvmFor(n.label)) add(N, `${n.avm ? 'Reset to' : 'Use'} default feature structure for ${n.label}`, () => runCmd('avmDefault'));
      COLORS.forEach(c => add('Colour', c, () => runCmd('color:' + c))); add('Colour', 'none', () => runCmd('color:'));
      add('Shape', 'box', () => runCmd('shape:box')); add('Shape', 'circle', () => runCmd('shape:circle')); add('Shape', 'none', () => runCmd('shape:'));
      add('Link', 'Draw arrow from here to…', () => runCmd('arrow')); add('Link', 'Coindex with…', () => runCmd('coindexWith'));
      if (arrowsOf(S.doc).some(x => x.from === id || x.to === id)) add('Link', 'Select an arrow on this node', () => runCmd('arrowsOn'));
      add('Move', 'Move to… as daughter', () => runCmd('moveChild')); add('Move', 'Move to… as left sister', () => runCmd('moveBefore'));
      add('Move', 'Move to… as right sister', () => runCmd('moveAfter')); add('Move', 'Move to… adjoined on the left (intervening node)', () => runCmd('moveAbove'));
      add('Move', 'Move to… adjoined on the right (intervening node)', () => runCmd('moveAdjR'));
      if (n.pos) add('Move', 'Reset manual position', () => runCmd('resetPos'));
      add('Move', 'Move left among sisters', () => runCmd('left'), 'Alt+←'); add('Move', 'Move right among sisters', () => runCmd('right'), 'Alt+→');
      add('Edit', 'Cut', () => runCmd('cut'), 'Ctrl+X'); add('Edit', 'Copy', () => runCmd('copy'), 'Ctrl+C');
      if (S.clip) add('Edit', 'Paste as daughter', () => runCmd('paste'), 'Ctrl+V');
      add('Edit', 'Duplicate', () => runCmd('dup'), 'Ctrl+D'); add('Edit', 'Delete only this node', () => runCmd('splice'), 'Del');
      if (n.ch.length) add('Edit', 'Delete with everything below', () => runCmd('del'), '⇧Del');
      ((S.tpl && S.tpl.list) || []).forEach(t => add('Template', `${t.name} — insert under ${n.label || 'this node'}`, () => insertTemplate(t)));
      (S.C ? S.C.cats : []).forEach(c => add('Label', c.label, () => applyLabel(c.label)));
    }
    if (multi) {
      add('Selection', 'Relabel all selected…', () => runCmd('relabelMany'), 'F2');
      add('Selection', 'Group under a new node', () => runCmd('group'), 'type a label');
      if (S.sel.length === 2) { add('Selection', 'Merge (first projects)', () => runCmd('merge'), 'Ctrl+M'); add('Selection', 'Arrow from first to second', () => runCmd('arrow2')); }
      add('Selection', 'Coindex', () => runCmd('coindex')); add('Selection', 'Triangle', () => runCmd('roof')); add('Selection', 'Unpronounced', () => runCmd('silent'));
      COLORS.forEach(c => add('Colour', c, () => runCmd('color:' + c))); add('Colour', 'none', () => runCmd('color:'));
      add('Selection', 'Delete all (keep what’s under them)', () => runCmd('splice'), 'Del'); add('Selection', 'Delete all with everything below', () => runCmd('del'), '⇧Del');
      (S.C ? S.C.cats : []).forEach(c => add('Label', `Group as ${c.label}`, () => applyLabel(c.label)));
    }
    if (!h && !multi) ((S.tpl && S.tpl.list) || []).forEach(t => add('Template', `${t.name} — new tree`, () => insertTemplate(t)));
    add('Tree', 'Find & replace labels', () => runCmd('find'), 'Ctrl+F'); add('File', 'Import LaTeX (forest / qtree)…', () => runCmd('importTex'));
    add('Tree', 'New tree', () => runCmd('newtree')); add('Tree', 'Add words from a sentence…', () => runCmd('words'));
    add('Tree', 'Select all', () => runCmd('selall'), 'Ctrl+A'); add('Tree', 'Undo', undo, 'Ctrl+Z'); add('Tree', 'Redo', redo, 'Ctrl+⇧Z');
    add('Tree', 'Clear canvas', () => runCmd('clear')); add('Tree', 'Edit bracket notation', () => bin.focus());
    add('View', 'Fit to screen', () => fit(), 'Ctrl+0');
    add('View', 'Reset all manual node positions', () => runCmd('resetAllPos')); add('View', 'Zoom in', () => zoomAt(1.2, wrap.clientWidth / 2, wrap.clientHeight / 2), 'Ctrl+=');
    add('View', 'Zoom out', () => zoomAt(1 / 1.2, wrap.clientWidth / 2, wrap.clientHeight / 2), 'Ctrl+-');
    const dToggle = (k, on, off) => add('View', disp()[k] ? off : on, () => { disp()[k] = !disp()[k]; syncDisplayControls(); render(); });
    dToggle('arrows', 'Show arrows', 'Hide movement arrows'); dToggle('alignLeaves', 'Align words at the bottom', 'Stop aligning words'); dToggle('compact', 'Compact spacing', 'Normal spacing');
    [['straight', 'Straight'], ['elbow', 'Square'], ['curve', 'Curved']].forEach(([v, l]) => add('View', `Branches: ${l}`, () => { disp().edge = v; syncDisplayControls(); render(); }));
    add('View', disp().bars === 'bar' ? 'Show bar levels as X′' : 'Show bar levels as X̄', () => { disp().bars = disp().bars === 'bar' ? 'prime' : 'bar'; syncDisplayControls(); fillPalette(); render(); });
    add('Settings', tl ? 'Tab adds daughters on the right' : 'Tab adds daughters on the left', () => { disp().tabSide = tl ? 'right' : 'left'; syncDisplayControls(); renderNodebar(); autosave(); toast(`Tab now adds daughters on the ${tl ? 'right' : 'left'}.`); });
    if (S.features.avm) add('Export', avmLatexStyle() === 'langsci' ? 'LaTeX AVMs: use avm.sty (\\begin{avm} \\[ … \\])' : 'LaTeX AVMs: use langsci-avm (\\avm{[ … ]})', () => { disp().avmLatex = avmLatexStyle() === 'langsci' ? 'avm' : 'langsci'; autosave(); toast(`LaTeX AVMs now use ${avmLatexStyle() === 'langsci' ? 'langsci-avm' : 'avm.sty'}`); });
    add('Drag', 'Drag to rearrange', () => setDrag('rearrange'));
    [['trace', 'leave a trace'], ['copy', 'leave an unpronounced copy'], ['nothing', 'leave nothing'], ['custom', 'leave a custom placeholder']].forEach(([v, l]) => add('Drag', `Drag to transform — ${l}`, () => setDrag('transform', v)));
    [['number', '1, 2, 3'], ['letter', 'i, j, k'], ['none', 'no index']].forEach(([v, l]) => add('Drag', `Index moved phrases: ${l}`, () => { S.theory.moveIndex = v; syncDisplayControls(); autosave(); }));
    add('Drag', S.theory.cyclicIndex === false ? 'Number chains in cyclic order' : 'Stop numbering chains in cyclic order', () => { S.theory.cyclicIndex = S.theory.cyclicIndex === false; syncDisplayControls(); autosave(); if (S.theory.cyclicIndex) renumberChains(); });
    add('View', disp().arrowToHead === false ? 'Arrows point to the head of a phrase' : 'Arrows point below the whole phrase', () => { disp().arrowToHead = disp().arrowToHead === false; autosave(); render(); });
    add('View', (disp().arrowStyle || 'square') === 'curve' ? 'Arrows: squared lanes' : 'Arrows: smooth curves', () => { disp().arrowStyle = (disp().arrowStyle || 'square') === 'curve' ? 'square' : 'curve'; syncDisplayControls(); render(); });
    [['png', 'PNG image'], ['svg', 'SVG image'], ['forest', 'LaTeX (forest)'], ['qtree', 'LaTeX (qtree)'], ['bracket', 'Bracket notation']].forEach(([v, l]) => add('Export', l, () => $(`[data-exp="${v}"]`).click()));
    add('File', 'Save', saveFile, 'Ctrl+S'); add('File', 'Open…', () => $('#btnOpen').click()); add('File', 'Copy share link', () => $('#btnShare').click());
    [['avm', 'feature structures (AVMs)'], ['sem', 'semantics'], ['gram', 'grammar & lexicon'], ['tx', 'transformations'], ['deriv', 'derivation timeline']].forEach(([f, l]) => add('Features', `${S.features[f] ? 'Turn off' : 'Turn on'} ${l}`, () => { S.features[f] = !S.features[f]; applyFeatures(); fillPalette(); render(); }));
    Theories.presets.forEach(p => add('Theory', p.name, () => setTheory(p, p.id)));
    (S.theory.examples || []).forEach(x => add('Example', x.name, () => loadExample(x)));
    Theories.lessons.forEach(l => add('Lesson', l.title, () => startLesson(l)));
    if (isHpsg()) {
      add('HPSG', 'Build tree (lexicalize + all phrases)', () => runBuild('tree')); add('HPSG', 'Lexicalize words', () => runBuild('lex'));
      if (primary()) add('HPSG', 'Build selected node from its daughters', () => runBuild('node'));
      [['written', 'as written'], ['compact', 'textbook'], ['full', 'fully specified']].forEach(([v, l]) => add('HPSG', `View AVMs ${l}`, () => { disp().avmView = v; syncAvmView(); render({ animate: false }); }));
      add('HPSG', 'Type hierarchy', () => openTypeHierarchy());
      add('HPSG', 'Give every node without a feature structure its label’s default', () => runCmd('avmDefaultsAll'));
      if (primary()) add('HPSG', 'Unfold everything on this node', () => setProp([primary()], 'fold', undefined, 'Unfold all'));
    }
    add('View', 'Tree view', () => setView('tree'), 'Ctrl+1'); add('View', 'Theory editor', () => setView('theory'), 'Ctrl+2');
    if (S.features.sem) add('View', 'Model editor', () => setView('model'), 'Ctrl+3');
    add('Help', 'Keyboard & notation reference', openHelp, '?');
    add('Help', hintsOn() ? 'Hide hints' : 'Show hints', () => setHints(!hintsOn()));
    return C;
  }
  function openPalette() {
    pal.back = S.centerView && S.centerView !== 'tree' && document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    closeMenu(); if (editing) finishEdit(true);
    pal.mode = 'cmd'; pal.all = commandList(); pal.resolve = null;
    $('#palTitle').textContent = S.selArrow ? 'Arrow selected' : S.sel.length > 1 ? `${S.sel.length} nodes selected` : primary() ? `Node “${(T.find(S.doc, primary()).node.label) || '·'}” selected` : '';
    $('#palIn').value = ''; $('#palIn').placeholder = 'Type a command… (triangle, arrow, move, daughter, export, X-bar…)';
    $('#palette').hidden = false; filterPalette(); $('#palIn').focus();
  }
  function closePalette(val) {
    $('#palette').hidden = true;
    if (pal.resolve) { const r = pal.resolve; pal.resolve = null; r(val === undefined ? null : val); }
    if (S.centerView && S.centerView !== 'tree') { if (pal.back && pal.back.isConnected && document.activeElement === document.body || document.activeElement === $('#palIn')) { try { pal.back.focus(); } catch { /* gone */ } } pal.back = null; return; }
    if (!editing) wrap.focus({ preventScroll: true });
  }
  function askText(title, initial = '') {
    return new Promise(res => {
      closeMenu();
      pal.mode = 'ask'; pal.resolve = res;
      $('#palTitle').textContent = title; $('#palIn').placeholder = 'Type and press Enter';
      $('#palIn').value = initial; $('#palList').innerHTML = '<div class="pal-empty">Enter to confirm · Esc to cancel · leave empty to remove</div>';
      $('#palette').hidden = false; $('#palIn').focus(); $('#palIn').select();
      setTimeout(() => { $('#palIn').focus(); $('#palIn').select(); }, 0);
    });
  }
  function filterPalette() {
    const q = $('#palIn').value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    pal.items = pal.all.map((c, i) => {
      const hay = (c.grp + ' ' + c.t).toLowerCase();
      if (!words.every(w => hay.includes(w))) return null;
      const title = c.t.toLowerCase();
      return { c, s: (q && title.startsWith(q) ? 0 : q && title.includes(q) ? 1 : 2) * 1000 + i };
    }).filter(Boolean).sort((a, b) => a.s - b.s).map(x => x.c);
    pal.hi = 0; paintPalette();
  }
  function paintPalette() {
    const L = $('#palList');
    L.innerHTML = pal.items.length ? pal.items.map((c, i) => `<div class="pal-item${i === pal.hi ? ' hi' : ''}" data-i="${i}"><span><span class="grp">${esc(c.grp)}</span>${esc(c.t)}</span>${c.k ? `<small>${esc(c.k)}</small>` : ''}</div>`).join('') : '<div class="pal-empty">No matching command</div>';
    const hi = L.querySelector('.hi'); if (hi) hi.scrollIntoView({ block: 'nearest' });
  }
  function runPalette(i) { const c = pal.items[i]; closePalette(); if (c) setTimeout(() => c.run(), 0); }
  $('#palIn').addEventListener('input', () => { if (pal.mode === 'cmd') filterPalette(); });
  $('#palIn').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closePalette(null); return; }
    if (pal.mode === 'ask') { if (e.key === 'Enter') { e.preventDefault(); closePalette($('#palIn').value); } return; }
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); pal.hi = Math.min(pal.items.length - 1, pal.hi + 1); paintPalette(); }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); pal.hi = Math.max(0, pal.hi - 1); paintPalette(); }
    else if (e.key === 'PageDown') { e.preventDefault(); pal.hi = Math.min(pal.items.length - 1, pal.hi + 8); paintPalette(); }
    else if (e.key === 'PageUp') { e.preventDefault(); pal.hi = Math.max(0, pal.hi - 8); paintPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); runPalette(pal.hi); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); closePalette(null); }
  });
  $('#palList').addEventListener('click', e => { const it = e.target.closest('.pal-item'); if (it) runPalette(+it.dataset.i); });
  $('#palette').addEventListener('pointerdown', e => { if (e.target.id === 'palette') closePalette(null); });
  $('#btnCmd').onclick = openPalette;



  /* ═════════════ HPSG toolkit (typed feature structures) ═════════════ */
  const HP = { G: null, key: null, words: [], disp: new Map(), dispKey: null, issues: new Map() };
  function hpGrammar() {
    if (!S.features.avm) return null;
    const th = S.theory;
    const key = JSON.stringify([th.signature, th.hpsgLex, th.hpsgRules, th.hpsgPrinciples]);
    if (HP.key !== key) {
      HP.key = key; HP.dispKey = null;
      try { HP.G = TFS.compile(th.signature || '', th.hpsgLex || '', th.hpsgRules || '', { principles: th.hpsgPrinciples || {} }); }
      catch (e) { HP.G = null; console.error(e); }
      try { HP.words = HP.G ? TFS.generateWords(HP.G) : []; } catch (e) { HP.words = []; console.error(e); }
      if (HP.G) HP.words.forEach(w => { w.label = TFS.labelFor(w.tfs, HP.G) || ''; });
      fillHpsgPanel();
    }
    return HP.G;
  }
  const hpView = () => disp().avmView || 'written';
  const treeOrder = root => { const ids = []; T.walk(root, n => ids.push(n.id)); return ids; };
  // per-tree display AVMs for the Textbook / Fully specified views (tree-global tags)
  function computeAvmDisplay() {
    const G = hpGrammar();
    if (!G || !showAvms() || hpView() === 'written') { HP.disp = new Map(); return; }
    const key = JSON.stringify([HP.key, hpView(), S.theory.avmHide, S.doc.roots.map(r => { const a = []; T.walk(r, n => { if (n.avm) a.push([n.id, n.avm]); }); return a; })]);
    if (key === HP.dispKey) return;
    HP.dispKey = key; HP.disp = new Map();
    const hide = new Set(String(S.theory.avmHide || '').split(/[\s,]+/).filter(Boolean));
    for (const root of S.doc.roots) {
      const nodes = []; T.walk(root, n => { if (n.avm) { const a = avmOf(n.avm); if (a && a.v) nodes.push({ id: n.id, avm: a.v }); } });
      if (!nodes.length) continue;
      const rd = TFS.readTree(nodes, G);
      for (const [id, e] of rd.errors) HP.disp.set(id, { err: `Not well-formed: ${e}` });
      try {
        const out = TFS.writeTree(rd.roots, treeOrder(root), G, { compact: hpView() === 'compact', hide });
        for (const [id, v] of out) HP.disp.set(id, { v });
      } catch (e) { console.error(e); }
    }
  }
  function foldOpts(n) {
    const names = s => new Set(String(s || '').split(/[\s,]+/).filter(Boolean));
    return { fold: new Set(n.fold || []), foldNames: names(S.theory.avmFold), hide: hpView() === 'written' ? names(S.theory.avmHide) : null };
  }
  function toggleFold(id, path) {
    const h = T.find(S.doc, id); if (!h) return;
    const f = new Set(h.node.fold || []);
    if (f.has(path)) f.delete(path); else f.add(path);
    setProp([id], 'fold', f.size ? [...f] : undefined, f.has(path) ? 'Fold' : 'Unfold');
  }

  // lexicon browser
  function fillHpsgPanel() {
    const box = $('#hpWords'); if (!box) return;
    const G = HP.G;
    $('#hpCount').textContent = G ? `${G.lexicon.length} entries · ${G.rules.length} rules · ${HP.words.length} words` : '';
    const q = ($('#hpSearch').value || '').trim().toLowerCase();
    const list = HP.words.filter(w => !q || [w.form, w.entry, w.label, ...w.chain].join(' ').toLowerCase().includes(q)).slice(0, 250);
    box.innerHTML = list.length ? list.map((w, i) => `<div class="hp-w" data-w="${HP.words.indexOf(w)}" title="${esc(w.entry)}${w.chain.length ? ' → ' + esc(w.chain.join(' → ')) : ''} · click: insert under the selection · drag: drop anywhere"><b>${esc(w.form)}</b><span class="cat">${esc(w.label)}</span><small>${esc(w.chain.join(' › ') || 'lexical')}</small></div>`).join('')
      : `<div class="quiet" style="padding:6px 8px">${G && !G.lexicon.length ? 'The lexicon is empty — write entries on the Theory tab (HPSG lexicon).' : 'No matches.'}</div>`;
    box.querySelectorAll('.hp-w').forEach(el => { const w = HP.words[+el.dataset.w]; chipPointer(el, () => wordNode(w), w.form, () => insertWord(w)); });
    const pr = { ...TFS.DEFAULT_PRINCIPLES, ...(S.theory.hpsgPrinciples || {}) };
    const NAMES = { builtin: 'Built-in schemata (Head-Complement, Head-Specifier, …)', hfp: 'Head Feature Principle', valence: 'Valence Principle', sip: 'Semantic Inheritance', scp: 'Semantic Compositionality (RESTR ⊕)', gap: 'GAP Principle', phon: 'PHON = daughters’ PHON ⊕', caseC: 'Case Constraint (outranked NPs are [CASE acc])', binding: 'Binding Theory (Principles A and B)', aap: 'Anaphoric Agreement (coindexed NPs agree)', coordForm: 'Coordination shares FORM and VAL only (SWB ch. 9)', headOnly: 'Head-Only rule (off: a lone head is a Head-Complement phrase with no complements, and heads take all their complements)', leafTypes: 'Every structure resolves to a leaf type (total well-typedness)' };
    $('#hpPrinciples').innerHTML = Object.keys(NAMES).map(k => `<label class="check"><input type="checkbox" data-pr="${k}" ${pr[k] ? 'checked' : ''}> ${NAMES[k]}</label>`).join('');
    $('#hpTypeList').innerHTML = G ? [...G.types.keys()].map(t => `<option value="${esc(t)}">`).join('') : '';
  }
  function wordAvmText(w, offset = 0) {
    const v = TFS.toAVM([w.tfs], HP.G, { compact: true })[0];
    if (offset) (function walk(x) { if (!x || typeof x !== 'object') return; if (x.tag && /^\d+$/.test(x.tag)) x.tag = String(+x.tag + offset); (x.feats || []).forEach(r => walk(r.v)); (x.items || []).forEach(walk); (x.args || []).forEach(walk); (x.parts || []).forEach(walk); walk(x.avm); walk(x.def); })(v);
    return AVM.str(v);
  }
  function maxTagIn(doc) { let m = 0; T.walkDoc(doc, n => { if (n.avm) for (const t of n.avm.matchAll(/#(\d+)/g)) m = Math.max(m, +t[1]); }); return m; }
  function wordNode(w) { const n = T.mk(w.label || 'W', [T.mk(w.form)]); n.avm = wordAvmText(w, maxTagIn(S.doc)); return n; }
  // default feature structures for labels: the theory's table first, then the grammar's @abbr definitions
  function labelAvmTable() {
    const m = new Map();
    String(S.theory.labelAvms || '').split('\n').forEach(l => { const mm = /^\s*([^#:\s][^:]*?)\s*:\s*(\[[\s\S]*)$/.exec(l); if (mm) m.set(mm[1].trim(), mm[2].trim()); });
    return m;
  }
  function defaultAvmFor(label) {
    if (!label) return null;
    const rl = /^(.+?)(?:_\{?([^}]+)\}?)?$/.exec(label); const base = rl[1], sub = rl[2];
    let txt = labelAvmTable().get(base) || labelAvmTable().get(label);
    if (!txt) { const G = hpGrammar(); const a = G && G.abbr.get(base); if (a) txt = AVM.str(a); }
    if (!txt) return null;
    if (sub && !/[_^]/.test(sub)) { try { const v = AVM.parse(txt); if (v && v.k === 'avm') { v.feats.push({ f: 'SEM', v: { k: 'avm', type: null, feats: [{ f: 'INDEX', v: { k: 'atom', v: sub } }] } }); txt = AVM.str(v); } } catch { /* keep */ } }
    return txt;
  }
  function applyDefaultAvms(ids, overwrite) {
    let n = 0;
    commit('Default feature structures', () => {
      ids.forEach(id => { const h = T.find(S.doc, id); if (!h) return; if (h.node.avm && !overwrite) return; const d = defaultAvmFor(h.node.label); if (d) { h.node.avm = d; n++; } });
      if (!n) return false;
    }, { animate: false });
    if (!n) toast('No default feature structure for these labels — add them under Theory → Default AVMs.'); else toast(`${n} node(s) given their default feature structure`, 1800);
    if (!S.features.avm && n) { S.features.avm = true; applyFeatures(); render({ animate: false }); }
  }
  function insertWord(w) {
    const id = primary(); const h = id && T.find(S.doc, id);
    const n = wordNode(w);
    if (h && !h.node.ch.length && h.node.label.toLowerCase() === w.form.toLowerCase()) { const p = h.parent; if (p) { insertNew(n, { id, zone: 'replace' }); return; } }
    insertNew(n, h ? { id, zone: 'child' } : { zone: 'root' });
  }
  $('#hpSearch').addEventListener('input', fillHpsgPanel);
  $('#hpPrinciples').addEventListener('change', e => { const k = e.target.dataset.pr; if (!k) return; S.theory.hpsgPrinciples = { ...(S.theory.hpsgPrinciples || {}), [k]: e.target.checked }; onTheoryEdit(); });
  $$('[data-avmview]').forEach(b => b.addEventListener('click', () => { disp().avmView = b.dataset.avmview; syncAvmView(); render({ animate: false }); }));
  function syncAvmView() { $$('[data-avmview]').forEach(b => b.classList.toggle('on', hpView() === b.dataset.avmview)); }

  // lexicalize: preterminals (one leaf daughter) get the lexical feature structure of their word
  function lexicalize(doc) {
    let done = 0; const missing = [];
    T.walkDoc(doc, n => {
      if (n.avm || n.ch.length !== 1 || n.ch[0].ch.length) return;
      const form = n.ch[0].label;
      const cands = HP.words.filter(w => w.form.toLowerCase() === form.toLowerCase());
      if (!cands.length) { missing.push(form); return; }
      const want = strip(n.label);
      const w = cands.find(c => c.label === want) || cands[0];
      n.avm = wordAvmText(w, maxTagIn(doc));
      if (!n.label || (S.theory.hpsgLabels && !TFS.labelFits(strip(n.label), w.tfs, HP.G))) n.label = w.label || n.label;
      done++;
    });
    // bare words directly under a phrase: give them a preterminal
    return { done, missing };
  }
  // build every phrase bottom-up; returns per-node issues
  function buildTree(doc, onlyId = null, given = null) {
    const G = HP.G; const issues = new Map(); const report = [];
    for (const root of doc.roots) {
      const nodes = []; T.walk(root, n => { if (given && given.has(n.id)) nodes.push({ id: n.id }); else if (n.avm) { const a = avmOf(n.avm); if (a && a.v) nodes.push({ id: n.id, avm: a.v }); } });
      const rd = TFS.readTree(nodes, G, given);
      for (const [id, e] of rd.errors) issues.set(id, e);
      let roots = rd.roots; let changed = false;
      const post = []; T.walk(root, n => post.unshift(n)); // reverse pre-order ≈ children before parents
      const ordered = []; (function po(n) { n.ch.forEach(po); ordered.push(n); })(root);
      void post;
      const built = new Set([...roots.keys()]);
      for (const n of ordered) {
        if (!n.ch.length || (n.ch.length === 1 && !n.ch[0].ch.length)) continue; // leaves and preterminals
        if (onlyId && n.id !== onlyId) continue;
        const cids = n.ch.map(c => c.id);
        if (cids.some(id => !built.has(id))) { if (onlyId) issues.set(n.id, 'Build the daughters first (or lexicalize the words).'); continue; }
        const hIdx = n.ch.findIndex(c => c.elabel === 'H');
        const r = TFS.buildAt(roots, n.id, cids, G, hIdx >= 0 ? hIdx : null);
        if (r.err) { issues.set(n.id, r.err); continue; }
        roots = r.roots; built.add(n.id); changed = true;
        report.push(`${n.label || '·'}: ${r.schema.name}`);
        if (S.theory.hpsgHeads && r.head != null && !n.ch[r.head].elabel) n.ch[r.head].elabel = 'H';
      }
      // principles stated over the whole tree (Case Constraint, Binding Theory, Anaphoric Agreement)
      if (!onlyId) for (const v of TFS.checkTree(roots, G)) { if (!issues.has(v.id)) issues.set(v.id, v.msg); changed = true; }
      if (!onlyId && built.has(root.id) && root.ch.length) { const m = TFS.checkRoot(roots.get(root.id), G); if (m) issues.set(root.id, m); else if (G.root) { roots.set(root.id, TFS.D(roots.get(root.id))); changed = true; } }
      if (changed) {
        const out = TFS.writeTree(roots, treeOrder(root), G, { compact: true });
        T.walk(root, n => {
          const v = out.get(n.id); if (!v) return;
          n.avm = AVM.str(v);
          if (S.theory.hpsgLabels && n.ch.length && !(n.ch.length === 1 && !n.ch[0].ch.length)) { const lab = TFS.labelFor(roots.get(n.id), G); if (lab) n.label = lab; }
        });
      }
    }
    return { issues, report };
  }
  // lexical analyses for a preterminal (label-matching ones first)
  function candidatesFor(n) {
    const form = n.ch[0].label.toLowerCase();
    const all = HP.words.filter(w => w.form.toLowerCase() === form);
    const want = strip(n.label);
    const same = all.filter(w => w.label === want);
    return same.length ? same : all;
  }
  // try combinations of lexical analyses (ambiguous words) and keep the one that builds best
  function buildBest(doc) {
    const pre = [];
    T.walkDoc(doc, n => { if (!n.avm && n.ch.length === 1 && !n.ch[0].ch.length) pre.push({ id: n.id, c: candidatesFor(n), form: n.ch[0].label }); });
    const missing = pre.filter(x => !x.c.length).map(x => x.form);
    const amb = pre.filter(x => x.c.length);
    let best = null;
    const idx = amb.map(() => 0);
    for (let tries = 0; tries < 64; tries++) {
      const d2 = deep(doc); const given = new Map();
      amb.forEach((x, k) => { const n = T.find(d2, x.id).node; const w = x.c[idx[k]]; given.set(x.id, w.tfs); n.avm = wordAvmText(w); if (!n.label || (S.theory.hpsgLabels && !TFS.labelFits(strip(n.label), w.tfs, HP.G))) n.label = w.label || n.label; });
      const br = buildTree(d2, null, given);
      const score = br.issues.size * 100 - br.report.length;
      if (!best || score < best.score) best = { d2, br, score };
      if (!br.issues.size) break;
      let k = 0; while (k < amb.length) { idx[k]++; if (idx[k] < amb[k].c.length) break; idx[k] = 0; k++; }
      if (k === amb.length) break;
    }
    return { doc: best ? best.d2 : doc, br: best ? best.br : { issues: new Map(), report: [] }, lx: { done: amb.length, missing } };
  }
  function runBuild(mode) {
    const G = hpGrammar(); if (!G) { toast('Turn on Feature structures and write a grammar first.'); return; }
    const rep = $('#hpReport');
    let lx = { done: 0, missing: [] }, br = { issues: new Map(), report: [] };
    commit(mode === 'lex' ? 'Lexicalize' : 'Build feature structures', () => {
      if (mode === 'tree') { const r = buildBest(S.doc); S.doc = r.doc; br = r.br; lx = r.lx; if (!lx.done && !br.report.length && !br.issues.size) return false; return; }
      if (mode !== 'node') lx = lexicalize(S.doc);
      if (mode !== 'lex') br = buildTree(S.doc, mode === 'node' ? primary() : null);
      if (!lx.done && !br.report.length && !br.issues.size) return false;
    }, { animate: false });
    HP.issues = br.issues; render({ animate: false });
    const bad = [...br.issues].map(([id, m]) => `<div class="hp-bad"><b>${esc((T.find(S.doc, id) || { node: { label: '?' } }).node.label || '·')}</b> — ${esc((m.split('\n').find(l => /do not unify|clashes|ARG|agree/i.test(l)) || m.split('\n')[0]))}</div>`).join('');
    rep.innerHTML = `${lx.done ? `<div class="hp-ok">${lx.done} word(s) lexicalized</div>` : ''}${lx.missing.length ? `<div class="hp-bad">Not in the lexicon: ${esc([...new Set(lx.missing)].join(', '))}</div>` : ''}${br.report.length ? `<div class="hp-ok">Built: ${esc(br.report.join(' · '))}</div>` : ''}${bad}`;
    if (br.issues.size) toast(`${br.issues.size} node(s) could not be built — see the HPSG tab (hover a red node for details).`, 3500);
  }
  $('#hpLex').onclick = () => runBuild('lex');
  $('#hpDefaults').onclick = () => runCmd('avmDefaultsAll');
  $('#hpBuild').onclick = () => runBuild('tree');
  $('#hpBuildNode').onclick = () => { if (!primary()) { toast('Select a node to build.'); return; } runBuild('node'); };

  // type hierarchy
  function typeInfoHtml(t) {
    const G = HP.G; if (!G || !G.types.has(t)) return t ? `<p class="quiet">No type “${esc(t)}”.</p>` : '';
    const T0 = G.types.get(t);
    const subs = G.subs.get(t) || [];
    const own = T0.avm ? avmSvg(T0.avm) : '<span class="quiet">no constraint of its own</span>';
    let exp = '';
    try { const c = G.expC(t); exp = c ? avmSvg(TFS.toAVM([c], G, { compact: false })[0]) : ''; } catch (e) { exp = `<span class="err">${esc(e.message)}</span>`; }
    return `<div class="tinfo"><div class="tl">${esc(t)}</div>
      <div>supertypes: ${T0.sups.map(x => `<a data-type="${esc(x)}">${esc(x)}</a>`).join('') || '—'}</div>
      <div>subtypes: ${subs.map(x => `<a data-type="${esc(x)}">${esc(x)}</a>`).join('') || '—'}</div>
      <h2 style="margin-top:8px">Own constraint</h2><div class="avm-svg-wrap">${own}</div>
      <h2>With everything inherited</h2><div class="avm-svg-wrap">${exp}</div></div>`;
  }
  function avmSvg(v) {
    if (!v) return '';
    const m = AVM.measure(v, atw);
    return `<svg width="${Math.ceil(m.w) + 4}" height="${Math.ceil(m.h) + 4}" style="display:block">${AVM.draw(v, m, 2, 2)}</svg>`;
  }
  $('#hpTypeSearch').addEventListener('change', e => { hpGrammar(); $('#hpTypeInfo').innerHTML = typeInfoHtml(e.target.value.trim()); });
  $('#hpTypeInfo').addEventListener('click', e => { const a = e.target.closest('[data-type]'); if (a) { $('#hpTypeSearch').value = a.dataset.type; $('#hpTypeInfo').innerHTML = typeInfoHtml(a.dataset.type); } });
  function openTypeHierarchy(focus) {
    const G = hpGrammar(); if (!G) { toast('Turn on Feature structures first.'); return; }
    const depth = new Map(); const dOf = t => { if (t === TFS.TOP) return 0; if (depth.has(t)) return depth.get(t); depth.set(t, 0); const T0 = G.types.get(t); const d = 1 + Math.max(0, ...(T0 ? T0.sups : [TFS.TOP]).map(dOf)); depth.set(t, d); return d; };
    const types = [TFS.TOP, ...G.types.keys()]; types.forEach(dOf); depth.set(TFS.TOP, 0);
    const layers = []; types.forEach(t => { const d = depth.get(t); (layers[d] = layers[d] || []).push(t); });
    const pos = new Map(); const W = t => tw(t, 11.5) + 14;
    layers.forEach((L, d) => {
      if (d > 0) L.sort((a, b) => { const bx = t => { const s = G.types.get(t).sups.map(x => (pos.get(x) || { x: 0 }).x); return s.reduce((p, q) => p + q, 0) / s.length; }; return bx(a) - bx(b); });
      let x = 10; L.forEach(t => { pos.set(t, { x: x + W(t) / 2, y: 20 + d * 56, w: W(t) }); x += W(t) + 10; });
    });
    const maxX = Math.max(...[...pos.values()].map(p => p.x + p.w / 2)) + 10, maxY = 20 + layers.length * 56;
    let lines = '', boxes = '';
    for (const t of G.types.keys()) for (const s of G.types.get(t).sups) { const a = pos.get(s), b = pos.get(t); if (a && b) lines += `<line data-e="${esc(s)}|${esc(t)}" x1="${a.x}" y1="${a.y + 9}" x2="${b.x}" y2="${b.y - 9}"/>`; }
    for (const [t, p] of pos) boxes += `<g data-type="${esc(t)}"><rect x="${p.x - p.w / 2}" y="${p.y - 10}" width="${p.w}" height="20"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle">${esc(t)}</text></g>`;
    openModal(`<h2>Type hierarchy <span class="hint">${G.types.size} types · click a type</span></h2>
      <div class="th-split"><div class="avm-svg-wrap" style="max-height:70vh"><svg class="type-svg" width="${maxX}" height="${maxY}">${lines}${boxes}</svg></div><div id="thInfo" style="max-height:70vh;overflow:auto"></div></div>`);
    $('.modal-box').classList.add('wide');
    const show = t => { $$('.type-svg g').forEach(g => g.classList.toggle('on', g.dataset.type === t)); $('#thInfo').innerHTML = typeInfoHtml(t); };
    $('#modalBody').onclick = e => { const g = e.target.closest('[data-type]'); if (g) show(g.dataset.type); };
    const prev = modalClose; modalClose = () => { $('.modal-box').classList.remove('wide'); if (prev) prev(); };
    if (focus) show(focus);
  }
  $('#hpTypes').onclick = () => openTypeHierarchy($('#hpTypeSearch').value.trim() || null);

  // a small rendering of a tree (template previews)
  function miniTree(node, o = {}) {
    if (!node) return '';
    const fs = o.fs || 11, hg = 7, vg = 17;
    const meas = n => { n._w = n.label ? tw(n.label, fs) + 4 : 7; if (n.roof || !n.ch.length) { n._sw = n._w + (n.roof ? 10 : 0); return; } n.ch.forEach(meas); n._cw = n.ch.reduce((a, c) => a + c._sw, 0) + hg * (n.ch.length - 1); n._sw = Math.max(n._w, n._cw); };
    const place = (n, l, d) => { n._y = d * vg + 10; if (n.roof || !n.ch.length) { n._x = l + n._sw / 2; return; } let x = l + (n._sw - n._cw) / 2; n.ch.forEach(c => { place(c, x, d + 1); x += c._sw + hg; }); n._x = (n.ch[0]._x + n.ch[n.ch.length - 1]._x) / 2; };
    const c = T.clone(node); meas(c); place(c, 2, 0);
    let out = '', H = 0;
    const go = n => {
      H = Math.max(H, n._y + 6);
      if (n.roof) out += `<path d="M${n._x} ${n._y + 3}l-${n._sw / 2 - 2} ${vg - 8}h${n._sw - 4}z"/>`;
      else n.ch.forEach(k => { out += `<line x1="${n._x}" y1="${n._y + 3}" x2="${k._x}" y2="${k._y - 9}"/>`; go(k); });
      out += n.label ? `<text x="${n._x}" y="${n._y}" text-anchor="middle">${esc(n.label.replace(/''$/, '″').replace(/'$/, '′'))}</text>` : `<circle class="slot" cx="${n._x}" cy="${n._y - 3}" r="2.6"/>`;
    };
    go(c);
    return `<svg class="mini-tree" width="${Math.ceil(c._sw + 4)}" height="${Math.ceil(H + 2)}">${out}</svg>`;
  }
  function templateMini(t, label) { try { const e = T.expandTemplate(t, label || T.labelForTemplate(t, 'X') || 'XP'); return e ? miniTree(e.node) : ''; } catch { return ''; } }

  /* ═════════════ Theory & model workspaces (centre pane) ═════════════ */
  let WS = null, MW = null;
  const ruleCache = { key: null, map: new Map() };
  const TH = { undo: [], redo: [] };
  function thRecord(f) {
    const now = Date.now(); const top = TH.undo[TH.undo.length - 1];
    if (top && top.f === f && now - top.t < 1200) { top.t = now; return; } // coalesce typing bursts
    TH.undo.push({ f, before: S.theory[f] || '', t: now }); if (TH.undo.length > 200) TH.undo.shift(); TH.redo = [];
  }
  function thUndo(redoing) {
    const from = redoing ? TH.redo : TH.undo, to = redoing ? TH.undo : TH.redo;
    const h = from.pop(); if (!h) { toast(redoing ? 'Nothing to redo in the theory.' : 'Nothing to undo in the theory.'); return; }
    to.push({ f: h.f, before: S.theory[h.f] || '', t: 0 });
    S.theory[h.f] = h.before;
    if (h.f === 'model') { const ms = modelsOf(); ms[S.theory.activeModel].text = h.before; }
    const ta = document.querySelector(`[data-th="${h.f}"]`); if (ta) ta.value = h.before;
    recompile(); render({ animate: false });
    if (WS && S.centerView === 'theory') WS.repaint(); if (MW && S.centerView === 'model') MW.show();
    toast(`${redoing ? 'Redid' : 'Undid'} a change to ${h.f === 'signature' ? 'types' : h.f}`, 1600);
  }
  const wsApi = {
    get: f => S.theory[f] || '',
    datalists: () => {
      const cats = new Set([...(S.C ? S.C.cats.map(c => c.label) : []), ...(S.C ? S.C.lex.entries.map(e => e.cat) : [])].filter(Boolean));
      const types = new Set(['e', 't', '<e,t>', '<e,<e,t>>', '<<e,t>,t>', '<<e,t>,e>', '<<e,t>,<<e,t>,t>>', '<<e,t>,<e,t>>', '<t,t>', '<t,<t,t>>']);
      String(S.theory.lexicon || '').split('\n').forEach(l => { const t = (l.split(':')[2] || '').trim(); if (t) types.add(t); });
      String(S.theory.varTypes || '').split('\n').forEach(l => { const k = l.lastIndexOf(':'); if (k > 0) { const t = l.slice(k + 1).trim(); if (t) types.add(t); } });
      const opt = v => `<option value="${esc(v)}">`;
      return `<datalist id="twCats">${[...cats].map(opt).join('')}</datalist><datalist id="twTypes">${[...types].map(opt).join('')}</datalist>`;
    },
    toModel: () => setView('model'),
    set: (f, text) => { if ((S.theory[f] || '') !== text) thRecord(f); S.theory[f] = text; const ta = document.querySelector(`[data-th="${f}"]`); if (ta && document.activeElement !== ta) ta.value = text; onTheoryEdit(); },
    features: () => S.features,
    isHpsg,
    errors: () => (S.C ? S.C.errors : []),
    lexCats: () => (S.C ? [...new Set(S.C.lex.entries.map(e => e.cat))] : []),
    lexInfo: line => { if (!S.C) return null; const es = S.C.lexSem.filter(e => e.line === line && e.typeObj); return es.length ? [...new Set(es.map(e => Logic.typeStr(e.typeObj, disp().typeStyle)))].join(' / ') : null; },
    rewriteMatches: r => { try { const p = Tree.parseRewrite(`${r.name || 'r'}: ${r.lhs} => ${r.rhs}`); if (!p.rules.length) return 0; let n = 0; T.walkDoc(S.doc, x => { if (T.matchRule(p.rules[0], x, S.C.strip)) n++; }); return n; } catch { return 0; } },
    tw: (t, sz) => tw(t, sz),
    templateMini: (body, trigger) => { const p = T.parseTemplates(`x: ${trigger || '*'} => ${body}`); return p.list[0] ? templateMini(p.list[0]) : ''; },
    mountAvm: (el, o) => AVM.mountEditor(el, { get: o.get, set: o.set, signature, autoFill: () => !!S.theory.avmAutoFill }),
    expandedSvg: name => { const G = hpGrammar(); if (!G) return ''; try { const c = G.expC(name); return c ? avmSvg(TFS.toAVM([c], G, { compact: false })[0]) : ''; } catch (e) { return `<span class="err">${esc(e.message)}</span>`; } },
    typeNames: () => (HP.G ? [...HP.G.types.keys()] : []),
    labelCount: lab => { let n = 0; T.walkDoc(S.doc, x => { if (S.C.strip(x.label) === lab) n++; }); return n; },
    words: () => HP.words,
    toast,
    ruleApplies: name => {
      const G = hpGrammar(); if (!G) return { list: [] };
      if (ruleCache.key !== HP.key) { ruleCache.key = HP.key; ruleCache.map = new Map(); }
      if (ruleCache.map.has(name)) return ruleCache.map.get(name);
      const r = G.rules.find(x => x.name === name);
      let res;
      if (!r) { const e = G.errors.find(x => x.section === 'Lexical rules'); res = { list: [], err: e ? e.msg : 'this rule has an error' }; }
      else { const list = []; for (const e of G.lexicon) { const a = TFS.applyRule(r, e.tfs, G); if (a.tfs) list.push(TFS.stemOf(a.tfs, G) || e.name); } res = { list: [...new Set(list)] }; }
      ruleCache.map.set(name, res); return res;
    },
  };
  // models: several per theory; the active one is what the semantics evaluates in
  function modelsOf() {
    const th = S.theory;
    if (!Array.isArray(th.models) || !th.models.length) th.models = [{ name: 'M1', text: th.model || '' }];
    if (!(th.activeModel >= 0 && th.activeModel < th.models.length)) th.activeModel = 0;
    return th.models;
  }
  const modelCache = new Map();
  const mwApi = {
    models: modelsOf,
    activeModel: () => { modelsOf(); return S.theory.activeModel; },
    setActive: i => { const ms = modelsOf(); ms[S.theory.activeModel].text = S.theory.model || ''; S.theory.activeModel = i; S.theory.model = ms[i].text; onTheoryEdit(); },
    setModelText: t => { if ((S.theory.model || '') !== t) thRecord('model'); const ms = modelsOf(); ms[S.theory.activeModel].text = t; S.theory.model = t; const ta = document.querySelector('[data-th="model"]'); if (ta) ta.value = t; onTheoryEdit(); },
    addModel: dup => { const ms = modelsOf(); ms[S.theory.activeModel].text = S.theory.model || ''; const cur = ms[S.theory.activeModel]; let k = ms.length + 1; while (ms.some(m => m.name === `M${k}`)) k++; ms.push({ name: `M${k}`, text: dup ? cur.text : `D = {${(Logic.parseModel(cur.text).atoms || []).join(', ')}}` }); mwApi.setActive(ms.length - 1); },
    deleteModel: () => { const ms = modelsOf(); if (ms.length < 2) return; ms.splice(S.theory.activeModel, 1); S.theory.activeModel = 0; S.theory.model = ms[0].text; onTheoryEdit(); },
    renameModel: (i, nm) => { modelsOf()[i].name = nm; autosave(); },
    mountModelEditor: el => ModelEditor.mount(el, { getText: () => S.theory.model || '', setText: t => mwApi.setModelText(t), consts: () => (S.C ? S.C.consts : new Map()), typeStr: t => Logic.typeStr(t, disp().typeStyle) }),
    pasteFacts: facts => { const r = ModelEditor.addFacts(S.theory.model || '', facts); mwApi.setModelText(r.text); return r.n; },
    compareRows: () => {
      const rows = [];
      if (S.sem) S.doc.roots.forEach(r => { const inf = infoOf(r.id); if (inf && inf.red && inf.tyStr === 't') rows.push({ label: T.yieldOf(r).join(' ') || r.label, term: Logic.show(inf.red), red: inf.red }); });
      (S.theory.cmpFormulas || []).forEach((f, i) => { try { rows.push({ label: f, term: f, red: Logic.normalize(Logic.parseTerm(f)), formula: true, fi: i }); } catch (e) { rows.push({ label: f, formula: true, fi: i, err: e.message }); } });
      return rows;
    },
    evalIn: (row, i) => {
      if (row.err) return { text: '?', cls: 'warn', title: row.err };
      const text = modelsOf()[i].text;
      const key = text + '\u0001' + JSON.stringify([...(S.C ? S.C.consts : new Map()).keys()]);
      if (!modelCache.has(key)) { if (modelCache.size > 50) modelCache.clear(); modelCache.set(key, Logic.parseModel(text, S.C ? S.C.consts : new Map())); }
      try { const v = Logic.evaluate(row.red, modelCache.get(key)); return typeof v === 'boolean' ? { text: v ? '1' : '0', cls: v ? 't1' : 't0' } : { text: Logic.showVal(v, modelCache.get(key)), cls: '' }; }
      catch (e) { return { text: /Presupposition/.test(e.message) ? '#' : '?', cls: 'warn', title: e.message }; }
    },
    addFormula: f => { S.theory.cmpFormulas = [...(S.theory.cmpFormulas || []), f]; autosave(); },
    removeFormula: i => { const r = mwApi.compareRows()[i]; if (r && r.formula) { S.theory.cmpFormulas.splice(r.fi, 1); autosave(); } },
    toast,
  };
  function setView(v) {
    if (v === 'model' && !S.features.sem) v = 'tree';
    S.centerView = v;
    document.body.classList.toggle('view-ws', v !== 'tree');
    $$('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    const tree = v === 'tree';
    ['#canvasbar', '#canvasWrap', '#textbar'].forEach(sel => { $(sel).hidden = !tree; });
    $('#timeline').style.display = tree ? '' : 'none';
    $('#workspace').hidden = v !== 'theory'; $('#modelspace').hidden = v !== 'model'; $('#statusbar').hidden = !tree;
    if (!tree) document.activeElement && document.activeElement.blur && document.activeElement.blur();
    if (v === 'theory') { if (!WS) WS = TheoryWS.mount($('#workspace'), wsApi); WS.repaint(); }
    if (v === 'model') { if (!MW) MW = TheoryWS.mountModels($('#modelspace'), mwApi); MW.show(); }
    if (tree) { render({ animate: false }); wrap.focus({ preventScroll: true }); }
  }
  $$('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const m = { Digit1: 'tree', Digit2: 'theory', Digit3: 'model' }[e.code]; if (!m) return;
    e.preventDefault(); setView(m);
  }, true);

  /* ═════════════ Find & replace ═════════════ */
  const FB = { cs: false, whole: false, re: false, i: -1 };
  function findRegex(global = true) {
    const q = $('#fFind').value; if (!q) return null;
    let src = FB.re ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (FB.whole) src = `^(?:${src})$`;
    return new RegExp(src, (global ? 'g' : '') + (FB.cs ? '' : 'i') + 'u');
  }
  function findMatches() {
    let rx; try { rx = findRegex(false); } catch (e) { return { err: e.message, ids: [] }; }
    if (!rx) return { ids: [] };
    const scope = $('#fScope').value; const ids = [];
    T.walkDoc(S.doc, n => { const leaf = !n.ch.length; if (scope === 'labels' && leaf && !(n.label && catSet().has(n.label))) return; if (scope === 'words' && !leaf) return; if (rx.test(n.label)) ids.push(n.id); });
    return { ids };
  }
  function refreshFind() {
    const r = findMatches(); const c = $('#fCount');
    S.findIds = new Set(r.ids);
    c.classList.toggle('err', !!r.err);
    c.textContent = r.err ? 'bad regex' : $('#fFind').value ? `${r.ids.length ? (Math.max(0, r.ids.indexOf(primary())) + 1) + ' / ' : ''}${r.ids.length} match${r.ids.length === 1 ? '' : 'es'}` : '';
    redraw(); return r.ids;
  }
  function openFind() {
    if (S.centerView && S.centerView !== 'tree') setView('tree');
    const bar = $('#findBar'); bar.hidden = false;
    const h = primary() && T.find(S.doc, primary());
    if (h && !$('#fFind').value) $('#fFind').value = h.node.label;
    $('#fFind').focus(); $('#fFind').select(); refreshFind();
  }
  function closeFind() { $('#findBar').hidden = true; S.findIds = null; redraw(); wrap.focus({ preventScroll: true }); }
  function stepFind(dir) { const ids = refreshFind(); if (!ids.length) return; const k = ids.indexOf(primary()); const n = ids[(k + dir + ids.length) % ids.length]; S.sel = [n]; redraw(); ensureVisible(n); refreshFind(); }
  function replaceIn(ids, desc) {
    let rx; try { rx = findRegex(true); } catch { return; } if (!rx || !ids.length) return;
    const rep = $('#fRepl').value;
    commit(desc, () => { let n = 0; ids.forEach(id => { const h = T.find(S.doc, id); if (!h) return; const nl = h.node.label.replace(rx, rep); if (nl !== h.node.label) { h.node.label = nl; n++; } }); if (!n) return false; }, { animate: false });
    refreshFind();
  }
  $('#fFind').addEventListener('input', refreshFind);
  $('#fScope').addEventListener('change', refreshFind);
  [['#fCase', 'cs'], ['#fWhole', 'whole'], ['#fRe', 're']].forEach(([sel, k]) => $(sel).addEventListener('click', () => { FB[k] = !FB[k]; $(sel).classList.toggle('on', FB[k]); refreshFind(); }));
  $('#fNext').onclick = () => stepFind(1); $('#fPrev').onclick = () => stepFind(-1);
  $('#fSel').onclick = () => { const ids = refreshFind(); if (ids.length) { S.sel = ids.slice(); redraw(); } };
  $('#fOne').onclick = () => { const ids = refreshFind(); const cur = ids.includes(primary()) ? primary() : ids[0]; if (cur) { replaceIn([cur], 'Replace'); stepFind(1); } };
  $('#fAll').onclick = () => { const ids = refreshFind(); replaceIn(ids, `Replace ${ids.length}`); toast(`Replaced in ${ids.length} node(s)`, 1600); };
  $('#fClose').onclick = closeFind;
  $('#findBar').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeFind(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.altKey)) { e.preventDefault(); $('#fAll').click(); return; }
    if (e.key === 'Enter' && e.target.id === 'fRepl') { e.preventDefault(); $('#fOne').click(); return; }
    if (e.key === 'Enter') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
  });

  /* ═════════════ LaTeX import ═════════════ */
  // an imported arrow that starts at a trace (or a node containing it) and ends at its antecedent is the movement arrow
  function isMovementArrow(doc, a) {
    const from = T.find(doc, a.from); if (!from) return false;
    return movementLinks(doc).some(l => l.to === a.to && (l.from === a.from || T.contains(from.node, l.from)));
  }
  function importLatex(text, replace) {
    let ld;
    try { ld = T.parseLatex(text); } catch (err) { toast('Could not read that LaTeX: ' + err.message, 4000); return false; }
    commit('Import LaTeX', () => {
      if (replace) S.doc = { roots: [], arrows: [] };
      S.doc.roots.push(...ld.roots);
      // a drawn arrow from a trace to its antecedent is already the movement arrow
      arrowsOf(S.doc).push(...ld.arrows.filter(a => !isMovementArrow(S.doc, a)));
    }, { fit: true, animate: false });
    toast(`Imported ${ld.roots.length} tree${ld.roots.length > 1 ? 's' : ''}${ld.arrows.length ? ` and ${ld.arrows.length} arrow(s)` : ''} from LaTeX`);
    return true;
  }
  function openImportTex() {
    openModal(`<h2>Import LaTeX</h2><p class="muted small">Paste <code>forest</code>, <code>qtree</code> or <code>tikz-qtree</code> code — whole documents are fine; every tree in it is imported. Subscripts, bars, triangles, <code>\\sout</code>, <code>name=</code> + <code>\\draw</code> arrows and edge labels come along.</p>
      <textarea id="texIn" rows="12" spellcheck="false" placeholder="\\begin{forest}\n  [CP [DP$_i$ [what]] [C$'$ …]]\n\\end{forest}"></textarea>
      <div class="row" style="margin-top:8px"><button class="accent" id="texAdd">Add to canvas</button><button id="texRep">Replace canvas</button><span class="err small" id="texErr"></span></div>`);
    const go = rep => { const t = $('#texIn').value; try { T.parseLatex(t); } catch (e) { $('#texErr').textContent = e.message; return; } closeModal(); importLatex(t, rep); };
    $('#texAdd').onclick = () => go(false); $('#texRep').onclick = () => go(true);
    setTimeout(() => $('#texIn').focus(), 0);
  }
  $('#btnImportTex').onclick = openImportTex;

  /* ═════════════ Persistence ═════════════ */
  const autosave = debounce(() => { store.set('arbor.v2', JSON.stringify(workspace())); }, 600);

  /* ═════════════ Init ═════════════ */
  async function init() {
    loadFeatures();
    S.theory = normalizeTheory(deep(Theories.byId('syn')));
    mountModelEditor();
    applyFeatures();
    let loaded = false;
    const hm = /#w=([\w-]+)/.exec(location.hash);
    if (hm) {
      try { const w = await unpack(hm[1]); if (w.features) { Object.assign(S.features, w.features); applyFeatures(); } loadWorkspace(w); loaded = true; toast('Opened shared tree.'); }
      catch (e) { toast('Shared link could not be read: ' + e.message); }
    }
    if (!loaded) {
      const saved = store.get('arbor.v2');
      if (saved) { try { loadWorkspace(JSON.parse(saved)); loaded = true; } catch { /* ignore */ } }
    }
    if (!loaded) setTheory(Theories.byId('syn'), 'syn', { loadExample: false });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { mcache.clear(); render({ animate: false, fit: true }); });
  }
  init();
})();
