/* Treditor — visual model editor.  Edits the theory's model text through a structured view:
   domain chips, predicate grid, relation matrices, names and values, plus "missing from the lexicon". */
'use strict';
const ModelEditor = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const IDENT = /^[\p{L}_][\p{L}\p{N}_']*$/u;

  // ── text ⇄ structure ──
  function parse(text) {
    const m = { domain: [], sums: false, cumulative: new Set(), preds: [], rels: [], names: [], values: [], raw: [] };
    for (const rawLine of String(text || '').split('\n')) {
      const line = rawLine.replace(/(^|\s)(#|\/\/).*$/, '').trim();
      if (!line) continue;
      if (line === '@sums') { m.sums = true; continue; }
      let mm = /^@cumulative\s+(.*)$/.exec(line);
      if (mm) { mm[1].split(/[\s,]+/).filter(Boolean).forEach(n => m.cumulative.add(n)); continue; }
      mm = /^([^=]+?)\s*=\s*(.+)$/.exec(line);
      if (!mm) { m.raw.push(rawLine); continue; }
      const name = mm[1].trim(), rhs = mm[2].trim();
      if (/^(D|domain|D_e|De)$/i.test(name)) { m.domain = Logic.splitTop(rhs.replace(/^[{[]|[}\]]$/g, '')); continue; }
      if (/^\{.*\}$/.test(rhs)) {
        const items = Logic.splitTop(rhs.slice(1, -1));
        const tuples = items.map(it => { const t = /^[(<⟨](.*)[)>⟩]$/.exec(it); return t ? Logic.splitTop(t[1]) : [it]; });
        const arity = tuples.length ? tuples[0].length : 1;
        if (arity === 1 && !tuples.some(t => t.length !== 1)) m.preds.push({ name, ext: new Set(tuples.map(t => t[0])) });
        else m.rels.push({ name, arity, tuples: tuples.map(t => t.join(',')) });
        continue;
      }
      if (/^(true|false|T|F|⊤|⊥|-?\d+(\.\d+)?)$/.test(rhs)) { m.values.push({ name, value: rhs }); continue; }
      if (IDENT.test(rhs)) { m.names.push({ name, ref: rhs }); continue; }
      m.raw.push(rawLine);
    }
    return m;
  }
  function serialize(m) {
    const out = [`D = {${m.domain.join(', ')}}`];
    if (m.sums) out.push('@sums');
    const cum = [...m.cumulative].filter(n => m.preds.some(p => p.name === n));
    if (m.sums && cum.length) out.push(`@cumulative ${cum.join(', ')}`);
    m.preds.forEach(p => out.push(`${p.name} = {${[...p.ext].join(', ')}}`));
    m.rels.forEach(r => out.push(`${r.name} = {${r.tuples.map(t => `(${t.split(',').join(', ')})`).join(', ')}}`));
    m.names.forEach(n => out.push(`${n.name} = ${n.ref}`));
    m.values.forEach(v => out.push(`${v.name} = ${v.value}`));
    m.raw.forEach(r => out.push(r));
    return out.join('\n');
  }

  function mount(el, api) {
    // api: { getText(), setText(text), consts() -> Map(name -> type), typeStr(type) }
    let m = parse(api.getText());
    let openRel = null, showSums = false, last = null;
    let focusCell = null;
    const commit = () => {
      const a = document.activeElement; focusCell = a && el.contains(a) && a.dataset && a.dataset.g ? { g: a.dataset.g, r: a.dataset.r, c: a.dataset.c } : null;
      last = serialize(m); api.setText(last); paint();
      if (focusCell) { const t = el.querySelector(`[data-g="${focusCell.g}"][data-r="${focusCell.r}"][data-c="${focusCell.c}"]`); if (t) t.focus(); }
    };
    const arityOf = t => { let n = 0; while (t && t.f && t.f[0].b === 'e') { n++; t = t.f[1]; } return t && t.b === 't' ? n : -1; };
    const defined = name => m.preds.some(p => p.name === name) || m.rels.some(r => r.name === name) || m.names.some(n => n.name === name) || m.values.some(v => v.name === name) || m.domain.includes(name) || m.raw.some(r => r.trim().startsWith(name + ' '));
    function missing() {
      const out = [];
      for (const [name, t] of api.consts()) {
        if (defined(name) || ['atom', 'star'].includes(name)) continue;
        if (t.b === 'e') out.push({ name, kind: 'name', t });
        else if (t.b === 't') out.push({ name, kind: 'value', t });
        else { const a = arityOf(t); if (a === 1) out.push({ name, kind: 'pred', t }); else if (a >= 2) out.push({ name, kind: 'rel', a, t }); }
      }
      return out;
    }
    function addMissing(x) {
      if (x.kind === 'name') { if (!m.domain.includes(x.name)) m.domain.push(x.name); }
      else if (x.kind === 'value') m.values.push({ name: x.name, value: 'false' });
      else if (x.kind === 'pred') m.preds.push({ name: x.name, ext: new Set() });
      else m.rels.push({ name: x.name, arity: x.a, tuples: [] });
    }
    const cols = () => (m.sums && showSums ? Logic.allSums(m.domain) : m.domain);
    function paint() {
      const miss = missing();
      const C = cols();
      const head = `<tr><th></th>${C.map(d => `<th class="me-col" title="${esc(d)}">${esc(d)}</th>`).join('')}${m.sums ? '<th title="Cumulative: closed under sum (mass / plural predicates)">∗</th>' : ''}<th></th></tr>`;
      const predRows = m.preds.map((p, i) => `<tr><th class="me-rowh"><span class="me-name" data-ren="p:${i}">${esc(p.name)}</span></th>${C.map((d, ci) => `<td><button class="me-cell${p.ext.has(d) ? ' on' : ''}" data-tog="${i}|${esc(d)}" data-g="p" data-r="${i}" data-c="${ci}" aria-label="${esc(p.name)}(${esc(d)})" title="${esc(p.name)}(${esc(d)})"></button></td>`).join('')}${m.sums ? `<td><button class="me-cum${m.cumulative.has(p.name) ? ' on' : ''}" data-cum="${i}" title="Cumulative (∗): if it holds of x and y it holds of x⊕y">∗</button></td>` : ''}<td><button class="me-x" data-delp="${i}" title="Remove">×</button></td></tr>`).join('');
      const rel = openRel != null && m.rels[openRel];
      let relHtml = '';
      if (rel && rel.arity === 2) {
        const set = new Set(rel.tuples);
        relHtml = `<table class="me-grid me-rel"><tr><th class="me-corner">${esc(rel.name)}(x, y)<br><small>x ↓ · y →</small></th>${C.map(d => `<th class="me-col">${esc(d)}</th>`).join('')}</tr>${C.map((x, ri) => `<tr><th class="me-rowh">${esc(x)}</th>${C.map((y, ci) => `<td><button class="me-cell${set.has(x + ',' + y) ? ' on' : ''}" data-rt="${esc(x)},${esc(y)}" data-g="r" data-r="${ri}" data-c="${ci}" aria-label="${esc(rel.name)}(${esc(x)}, ${esc(y)})" title="${esc(rel.name)}(${esc(x)}, ${esc(y)})"></button></td>`).join('')}</tr>`).join('')}</table>`;
      } else if (rel) {
        relHtml = `<label class="field">${esc(rel.name)} — ${rel.arity}-tuples, one per line (a, b, c)<textarea data-rtext rows="4" spellcheck="false">${esc(rel.tuples.map(t => t.split(',').join(', ')).join('\n'))}</textarea></label>`;
      }
      el.innerHTML = `
        <div class="me-sec"><div class="me-h">Domain</div>
          <div class="me-chips">${m.domain.map((d, i) => `<span class="me-chip"><span data-ren="d:${i}">${esc(d)}</span><button data-deld="${i}" title="Remove ${esc(d)}">×</button></span>`).join('')}<input class="me-add" data-add="d" placeholder="+ individual" size="10"></div>
          <label class="me-check"><input type="checkbox" data-sums ${m.sums ? 'checked' : ''}> plurals &amp; mass — sums (a⊕b), ⊑, σ, star</label>
          ${m.sums ? `<label class="me-check"><input type="checkbox" data-showsums ${showSums ? 'checked' : ''}> show sum individuals as columns (${Logic.allSums(m.domain).length})</label>` : ''}
        </div>
        ${miss.length ? `<div class="me-sec me-miss"><div class="me-h">Used in the lexicon, not in the model <button class="me-link" data-addall>add all</button></div><div class="me-chips">${miss.map((x, i) => `<button class="me-mchip" data-miss="${i}" title="${esc(api.typeStr(x.t))}">+ ${esc(x.name)} <small>${esc(api.typeStr(x.t))}</small></button>`).join('')}</div></div>` : ''}
        <div class="me-sec"><div class="me-h">Predicates <small>click cells to toggle</small></div>
          ${m.preds.length && C.length ? `<div class="me-scroll"><table class="me-grid">${head}${predRows}</table></div>` : ''}
          <input class="me-add" data-add="p" placeholder="+ predicate">
        </div>
        <div class="me-sec"><div class="me-h">Relations</div>
          <div class="me-chips">${m.rels.map((r, i) => `<span class="me-chip${openRel === i ? ' open' : ''}"><span data-openr="${i}">${esc(r.name)}<small>/${r.arity} · ${r.tuples.length}</small></span><button data-delr="${i}" title="Remove">×</button></span>`).join('')}<input class="me-add" data-add="r" placeholder="+ relation (name or name/3)" size="16"></div>
          ${relHtml ? `<div class="me-scroll">${relHtml}</div>` : ''}
        </div>
        <div class="me-sec"><div class="me-h">Names &amp; values</div>
          ${m.names.map((n, i) => `<div class="me-kv"><span>${esc(n.name)}</span><select data-name="${i}">${[...new Set([...C, n.ref])].map(d => `<option${d === n.ref ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select><button class="me-x" data-deln="${i}">×</button></div>`).join('')}
          ${m.values.map((v, i) => `<div class="me-kv"><span>${esc(v.name)}</span><input data-val="${i}" value="${esc(v.value)}" size="6"><button class="me-x" data-delv="${i}">×</button></div>`).join('')}
          <input class="me-add" data-add="n" placeholder="+ name = individual, or name = 1/0/number" size="28">
        </div>
        ${m.raw.length ? `<div class="me-sec"><div class="me-h">Other definitions <small>edit as text below</small></div><pre class="me-raw">${esc(m.raw.join('\n'))}</pre></div>` : ''}`;
    }
    const ok = name => IDENT.test(name) || /⊕/.test(name);
    el.addEventListener('click', e => {
      const t = e.target.closest('button, [data-ren], [data-openr]'); if (!t) return;
      const d = t.dataset;
      if (d.tog) { const [i, x] = [d.tog.slice(0, d.tog.indexOf('|')), d.tog.slice(d.tog.indexOf('|') + 1)]; const p = m.preds[+i]; p.ext.has(x) ? p.ext.delete(x) : p.ext.add(x); return commit(); }
      if (d.rt) { const r = m.rels[openRel]; const k = r.tuples.indexOf(d.rt); k >= 0 ? r.tuples.splice(k, 1) : r.tuples.push(d.rt); return commit(); }
      if (d.cum !== undefined) { const n = m.preds[+d.cum].name; m.cumulative.has(n) ? m.cumulative.delete(n) : m.cumulative.add(n); return commit(); }
      if (d.deld !== undefined) { const x = m.domain[+d.deld]; m.domain.splice(+d.deld, 1); m.preds.forEach(p => p.ext.delete(x)); m.rels.forEach(r => { r.tuples = r.tuples.filter(tp => !tp.split(',').includes(x)); }); return commit(); }
      if (d.delp !== undefined) { m.preds.splice(+d.delp, 1); return commit(); }
      if (d.delr !== undefined) { m.rels.splice(+d.delr, 1); openRel = null; return commit(); }
      if (d.deln !== undefined) { m.names.splice(+d.deln, 1); return commit(); }
      if (d.delv !== undefined) { m.values.splice(+d.delv, 1); return commit(); }
      if (d.openr !== undefined) { openRel = openRel === +d.openr ? null : +d.openr; return paint(); }
      if (d.miss !== undefined) { addMissing(missing()[+d.miss]); return commit(); }
      if (d.addall !== undefined) { missing().forEach(addMissing); return commit(); }
      if (d.ren) {
        const [k, i] = d.ren.split(':'); const old = k === 'd' ? m.domain[+i] : m.preds[+i].name;
        const nv = prompt('Rename', old); if (!nv || nv === old || !ok(nv.trim())) return;
        const v = nv.trim();
        if (k === 'd') { m.domain[+i] = v; m.preds.forEach(p => { if (p.ext.delete(old)) p.ext.add(v); }); m.rels.forEach(r => { r.tuples = r.tuples.map(tp => tp.split(',').map(x => (x === old ? v : x)).join(',')); }); m.names.forEach(n => { if (n.ref === old) n.ref = v; }); }
        else { if (m.cumulative.delete(old)) m.cumulative.add(v); m.preds[+i].name = v; }
        return commit();
      }
    });
    el.addEventListener('change', e => {
      const d = e.target.dataset;
      if (d.sums !== undefined) { m.sums = e.target.checked; return commit(); }
      if (d.showsums !== undefined) { showSums = e.target.checked; return paint(); }
      if (d.name !== undefined) { m.names[+d.name].ref = e.target.value; return commit(); }
      if (d.val !== undefined) { m.values[+d.val].value = e.target.value.trim(); return commit(); }
      if (d.rtext !== undefined) { const r = m.rels[openRel]; r.tuples = e.target.value.split('\n').map(l => l.replace(/[()⟨⟩<>]/g, '').split(',').map(x => x.trim()).filter(Boolean)).filter(t => t.length === r.arity).map(t => t.join(',')); return commit(); }
    });
    el.addEventListener('keydown', e => {
      const g = e.target.dataset && e.target.dataset.g;
      if (g && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const r = +e.target.dataset.r + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
        const c = +e.target.dataset.c + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
        const n = el.querySelector(`[data-g="${g}"][data-r="${r}"][data-c="${c}"]`); if (n) n.focus();
        return;
      }
      const t = e.target; if (!t.dataset || t.dataset.add === undefined || e.key !== 'Enter') return;
      e.preventDefault();
      const v = t.value.trim(); if (!v) return;
      const kind = t.dataset.add;
      if (kind === 'd') v.split(/[\s,]+/).filter(ok).forEach(x => { if (!m.domain.includes(x)) m.domain.push(x); });
      if (kind === 'p') v.split(/[\s,]+/).filter(ok).forEach(x => { if (!defined(x)) m.preds.push({ name: x, ext: new Set() }); });
      if (kind === 'r') { const mm = /^([^/\s]+)(?:\/(\d+))?$/.exec(v); if (mm && ok(mm[1])) { m.rels.push({ name: mm[1], arity: Math.max(2, +(mm[2] || 2)), tuples: [] }); openRel = m.rels.length - 1; } }
      if (kind === 'n') { const mm = /^(\S+)\s*=\s*(\S+)$/.exec(v); if (mm) { if (/^(true|false|T|F|-?\d+(\.\d+)?)$/.test(mm[2]) || mm[2] === '1' || mm[2] === '0') m.values.push({ name: mm[1], value: mm[2] === '1' ? 'true' : mm[2] === '0' ? 'false' : mm[2] }); else { if (!m.domain.includes(mm[2])) m.domain.push(mm[2]); m.names.push({ name: mm[1], ref: mm[2] }); } } }
      commit();
      const again = el.querySelector(`[data-add="${kind}"]`); if (again) again.focus();
    });
    paint();
    return { refresh() { const t = api.getText(); if (t === last && el.childElementCount) return; last = t; m = parse(t); if (openRel != null && !m.rels[openRel]) openRel = null; paint(); } };
  }
  function addFacts(text, facts) {
    const m = parse(text); let n = 0;
    const addInd = x => { if (x && !m.domain.includes(x)) { m.domain.push(x); } };
    const pred = name => { let p = m.preds.find(q => q.name === name); if (!p) { p = { name, ext: new Set() }; m.preds.push(p); } return p; };
    const rel = (name, ar) => { let r = m.rels.find(q => q.name === name); if (!r) { r = { name, arity: ar, tuples: [] }; m.rels.push(r); } return r; };
    const add = (name, args) => {
      args.forEach(addInd);
      if (args.length === 1) { pred(name).ext.add(args[0]); n++; }
      else if (args.length > 1) { const r = rel(name, args.length); const k = args.join(','); if (!r.tuples.includes(k)) { r.tuples.push(k); n++; } }
    };
    const lines = String(facts || '').split('\n').map(l => l.trim()).filter(Boolean);
    // table: first row = individuals, then "pred 1 0 1" rows (tabs, commas or spaces)
    const cells = l => l.split(/\t|,|\s+/).map(x => x.trim()).filter(x => x !== '');
    if (lines.length > 1 && !/[:(]/.test(lines[0]) && lines.slice(1).every(l => /^\S+[\s,\t]+([01xX✓·-][\s,\t]*)+$/.test(l))) {
      const inds = cells(lines[0]); if (inds.length === cells(lines[1]).length) inds.shift(); inds.forEach(addInd);
      for (const l of lines.slice(1)) { const [p, ...v] = cells(l); v.forEach((x, i) => { if (/^[1xX✓]$/.test(x) && inds[i]) add(p, [inds[i]]); }); }
      return { text: serialize(m), n };
    }
    for (const l of lines) {
      let mm = /^(D|domain)\s*[:=]\s*\{?([^}]*)\}?$/i.exec(l);
      if (mm) { Logic.splitTop(mm[2]).forEach(addInd); continue; }
      mm = /^([\p{L}_][\p{L}\p{N}_']*)\s*\(([^)]*)\)\.?$/u.exec(l);
      if (mm) { add(mm[1], mm[2].split(',').map(x => x.trim()).filter(Boolean)); continue; }
      mm = /^([\p{L}_][\p{L}\p{N}_']*)\s*[:=]\s*\{?(.*?)\}?$/u.exec(l);
      if (mm) {
        const items = Logic.splitTop(mm[2]);
        for (const it of items) { const t = /^[(<⟨](.*)[)>⟩]$/.exec(it); add(mm[1], t ? t[1].split(',').map(x => x.trim()) : [it]); }
      }
    }
    return { text: serialize(m), n };
  }
  return { mount, parse, serialize, addFacts };
})();
