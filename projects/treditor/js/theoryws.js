/* Treditor — theory & model workspaces: everything in a theory edited directly, keyboard-first.
   The text format stays the source of truth: every editor reads a theory field, edits rows / types /
   entries, and writes the field back (so the plain-text editors on the Theory tab stay in sync).   */
'use strict';
const TheoryWS = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const debounce = (f, ms) => { let t; const g = (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; g.flush = (...a) => { clearTimeout(t); f(...a); }; return g; };
  const IDB = '(^|[^\\w*+\'-])', IDE = '(?=$|[^\\w*+\'-])';
  const renameIn = (text, from, to) => String(text || '').replace(new RegExp(IDB + from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + IDE, 'g'), (m, pre) => pre + to);
  const commentPrefix = text => { const lines = String(text || '').split('\n'); const out = []; for (const l of lines) { if (/^\s*([;#]|$)/.test(l)) out.push(l); else break; } while (out.length && !out[out.length - 1].trim()) out.pop(); return out.join('\n'); };

  /* ───────── generic rows editor ───────── */
  // cfg: { fields: [{key, label, kind:'text'|'check'|'select'|'color', w, ph, options, mono, list}], parse(text)→rows,
  //        serialize(rows)→text, status(row, i)→{ok, msg, info}, addLabel, hint }
  const isLong = f => (!f.kind || f.kind === 'text') && !f.list && !f.short;
  function rowsEditor(el, api, cfg) {
    let rows = cfg.parse(api.get(cfg.field));
    let lastText = api.get(cfg.field);
    const save = debounce(() => { lastText = cfg.serialize(rows); api.set(cfg.field, lastText); }, 250);
    const cols = cfg.fields.map(f => (f.kind === 'check' ? '44px' : f.kind === 'color' ? '60px' : f.w || '1fr')).join(' ');
    function paint(focus) {
      el.innerHTML = `<div class="rw-head" style="grid-template-columns:22px ${cols} 1.2fr 24px"><span></span>${cfg.fields.map(f => `<span>${esc(f.label)}</span>`).join('')}<span>check</span><span></span></div>
        <div class="rw-body">${rows.map((r, i) => rowHtml(r, i)).join('')}</div>
        <div class="row" style="margin-top:6px"><button class="rw-add" title="Enter on any row also adds one below">+ ${esc(cfg.addLabel || 'row')}</button>${cfg.hint ? `<span class="hint">${cfg.hint}</span>` : ''}</div>
        ${api.datalists ? api.datalists() : ''}
        ${rows.length ? '' : `<p class="quiet">Nothing here yet. Press <b>+ ${esc(cfg.addLabel || 'row')}</b> and type; <kbd>Enter</kbd> adds the next one.</p>`}`;
      paintStatus();
      if (focus) { const t = el.querySelector(`[data-r="${focus.r}"][data-k="${focus.k}"]`) || el.querySelector(`[data-r="${focus.r}"] input`); if (t) { t.focus(); if (t.select && focus.sel !== false) t.select(); } }
    }
    function rowHtml(r, i) {
      if (r._comment !== undefined) return `<div class="rw-row rw-comment" data-row="${i}" draggable="true"><span class="rw-grip" title="Drag to reorder">⋮⋮</span><input data-r="${i}" data-k="_comment" value="${esc(r._comment)}" spellcheck="false"><button class="rw-del" data-del="${i}" title="Delete">×</button></div>`;
      return `<div class="rw-row" data-row="${i}" draggable="true" style="grid-template-columns:22px ${cols} 1.2fr 24px"><span class="rw-grip" title="Drag to reorder">⋮⋮</span>${cfg.fields.map(f => {
        const v = r[f.key] ?? '';
        if (f.kind === 'check') return `<input type="checkbox" data-r="${i}" data-k="${f.key}" ${v ? 'checked' : ''}>`;
        if (f.kind === 'select') return `<select data-r="${i}" data-k="${f.key}">${f.options.map(o => `<option value="${esc(o[0])}"${o[0] === v ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
        if (f.kind === 'color') return `<span class="rw-color"><input type="color" data-r="${i}" data-k="${f.key}" value="${/^#[0-9a-f]{6}$/i.test(v) ? v : '#888888'}"${v ? '' : ' class="unset"'}>${v ? `<button class="mini" data-clr="${i}" title="No colour">×</button>` : ''}</span>`;
        // an example placeholder only on a blank row; on a filled row show what an empty field means
        const blankRow = cfg.fields.every(g => !r[g.key]);
        const ph = blankRow ? f.ph || '' : (cfg.emptyMeans ? cfg.emptyMeans(r, f.key) || '' : '');
        if (isLong(f)) return `<textarea rows="1" data-r="${i}" data-k="${f.key}" placeholder="${esc(ph)}" spellcheck="false" class="rw-ta${f.mono ? ' mono' : ''}">${esc(v)}</textarea>`;
        return `<input data-r="${i}" data-k="${f.key}" value="${esc(v)}" title="${esc(v)}" placeholder="${esc(ph)}" spellcheck="false" autocomplete="off"${f.mono ? ' class="mono"' : ''}${f.list ? ` list="${f.list}"` : ''}>`;
      }).join('')}<span class="rw-status" data-st="${i}"></span><button class="rw-del" data-del="${i}" title="Delete row (Backspace on an empty row)">×</button></div>`;
    }
    function paintStatus() {
      rows.forEach((r, i) => {
        const el2 = el.querySelector(`[data-st="${i}"]`); if (!el2 || r._comment !== undefined) return;
        let st = null; try { st = cfg.status ? cfg.status(r, i, rows) : null; } catch (e) { st = { ok: false, msg: e.message }; }
        el2.className = 'rw-status ' + (st ? (st.ok ? 'ok' : 'bad') : '');
        if (st && st.ok && st.html) el2.innerHTML = st.html; else el2.textContent = st ? (st.ok ? (st.info ? st.info : '✓') : st.msg) : '';
        el2.title = st ? (st.ok ? st.info || 'OK' : st.msg) : '';
      });
    }
    const blank = () => Object.fromEntries(cfg.fields.map(f => [f.key, f.kind === 'check' ? false : '']));
    el.addEventListener('input', e => { const t = e.target; if (t.dataset.r === undefined) return; const r = rows[+t.dataset.r]; r[t.dataset.k] = t.type === 'checkbox' ? t.checked : t.value; if (t.type === 'color') t.classList.remove('unset'); save(); });
    el.addEventListener('change', e => { const t = e.target; if (t.tagName === 'SELECT' || t.type === 'checkbox') { rows[+t.dataset.r][t.dataset.k] = t.type === 'checkbox' ? t.checked : t.value; save.flush(); } });
    el.addEventListener('click', e => {
      if (e.target.closest('.rw-add')) { rows.push(blank()); save(); paint({ r: rows.length - 1, k: cfg.fields[0].key }); return; }
      const d = e.target.closest('[data-del]'); if (d) { rows.splice(+d.dataset.del, 1); save.flush(); paint(); return; }
      const c = e.target.closest('[data-clr]'); if (c) { rows[+c.dataset.clr].color = ''; save.flush(); paint(); }
    });
    el.addEventListener('keydown', e => {
      const t = e.target; if (t.dataset.r === undefined) return;
      const i = +t.dataset.r, k = t.dataset.k;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Enter' && !mod) { e.preventDefault(); rows.splice(i + 1, 0, blank()); save(); paint({ r: i + 1, k: cfg.fields[0].key }); return; }
      if (e.key === 'ArrowDown' && e.altKey && i < rows.length - 1) { e.preventDefault(); [rows[i], rows[i + 1]] = [rows[i + 1], rows[i]]; save(); paint({ r: i + 1, k, sel: false }); return; }
      if (e.key === 'ArrowUp' && e.altKey && i > 0) { e.preventDefault(); [rows[i], rows[i - 1]] = [rows[i - 1], rows[i]]; save(); paint({ r: i - 1, k, sel: false }); return; }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.altKey && t.tagName !== 'SELECT') {
        const j = i + (e.key === 'ArrowDown' ? 1 : -1); const n = el.querySelector(`[data-r="${j}"][data-k="${k}"]`) || el.querySelector(`[data-r="${j}"] input`);
        if (n) { e.preventDefault(); n.focus(); }
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); rows.splice(i + 1, 0, { ...rows[i] }); save(); paint({ r: i + 1, k }); return; }
      if (e.key === 'Backspace' && t.value === '' && Object.entries(rows[i]).every(([kk, v]) => !v || kk.startsWith('_') && kk !== '_comment')) { e.preventDefault(); rows.splice(i, 1); save.flush(); paint({ r: Math.max(0, i - 1), k }); }
    });
    // drag to reorder
    let dragFrom = null;
    el.addEventListener('dragstart', e => { const r = e.target.closest('.rw-row'); if (!r) return; dragFrom = +r.dataset.row; e.dataTransfer.effectAllowed = 'move'; r.classList.add('dragging'); });
    el.addEventListener('dragover', e => { if (dragFrom == null) return; e.preventDefault(); el.querySelectorAll('.rw-row').forEach(x => x.classList.remove('drop-above')); const r = e.target.closest('.rw-row'); if (r) r.classList.add('drop-above'); });
    el.addEventListener('drop', e => { if (dragFrom == null) return; e.preventDefault(); const r = e.target.closest('.rw-row'); const to = r ? +r.dataset.row : rows.length; const [m] = rows.splice(dragFrom, 1); rows.splice(to > dragFrom ? to - 1 : to, 0, m); dragFrom = null; save.flush(); paint(); });
    el.addEventListener('dragend', () => { dragFrom = null; el.querySelectorAll('.dragging,.drop-above').forEach(x => x.classList.remove('dragging', 'drop-above')); });
    paint();
    return {
      refresh() { const t = api.get(cfg.field); if (t !== lastText && !el.contains(document.activeElement)) { rows = cfg.parse(t); lastText = t; paint(); } else paintStatus(); },
      add() { rows.push(blank()); save(); paint({ r: rows.length - 1, k: cfg.fields[0].key }); },
      focusRow(i) { const n = Math.max(0, Math.min(rows.length - 1, i)); paint({ r: n, k: cfg.fields[0].key, sel: false }); const row = el.querySelector(`[data-row="${n}"]`); if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1200); } },
      addLabel: cfg.addLabel || 'row',
    };
  }
  const lineRows = (text, toRow) => String(text || '').split('\n').filter((l, i, a) => l.trim() || i < a.length - 1).map(l => (/^\s*(#|\/\/|;)/.test(l) || !l.trim() ? { _comment: l } : toRow(l))).filter(r => !(r._comment !== undefined && !r._comment.trim()));
  const errAt = (api, section, i) => api.errors().find(e => e.section === section && e.line === i + 1);

  /* ───────── section definitions (row editors) ───────── */
  const SECTIONS = [
    { id: 'labels', name: 'Labels', always: true, field: 'categories', addLabel: 'label',
      fields: [{ key: 'label', label: 'Label', ph: 'NP' }, { key: 'color', label: 'Colour', kind: 'color' }],
      parse: t => lineRows(t, l => { const m = /^(.+?)(?:\s+(#[0-9a-fA-F]{3,8}))?\s*$/.exec(l.trim()); return { label: m ? m[1] : l.trim(), color: m && m[2] || '' }; }),
      serialize: rows => rows.map(r => (r._comment !== undefined ? r._comment : `${r.label}${r.color ? ' ' + r.color : ''}`)).filter(x => x !== undefined && x !== 'undefined').join('\n'),
      status: r => (r.label ? null : { ok: false, msg: 'empty' }) },
    { id: 'templates', name: 'Templates', always: true, field: 'templates', addLabel: 'template', hint: '$X = head you type (VP → V) · _ = slot · * = any label',
      fields: [{ key: 'name', label: 'Name', ph: 'X-bar phrase' }, { key: 'trigger', label: 'Trigger', w: '.6fr', ph: '$XP' }, { key: 'body', label: 'Structure', w: '2fr', mono: true, ph: "[$XP _ [$X' [$X _] _]]" }],
      parse: t => lineRows(t, l => { const m = /^(.*?):\s*(\S+)\s*=>\s*(.+)$/.exec(l.trim()); return m ? { name: m[1], trigger: m[2], body: m[3] } : { name: l, trigger: '', body: '' }; }),
      serialize: rows => rows.map(r => (r._comment !== undefined ? r._comment : `${r.name}: ${r.trigger || '*'} => ${r.body}`)).join('\n'),
      status: (r, i, rows, api) => { const p = Tree.parseTemplates(`${r.name}: ${r.trigger || '*'} => ${r.body}`); if (p.errors.length) return { ok: false, msg: p.errors[0].msg }; const tt = p.list[0]; return { ok: true, info: Tree.templatePreview(tt, Tree.labelForTemplate(tt, 'X')), html: api.templateMini ? api.templateMini(r.body, r.trigger) : '' }; } },
    { id: 'grammar', name: 'Phrase-structure rules', feature: 'gram', field: 'grammar', addLabel: 'rule', hint: 'alternatives with | · (X) optional · X* X+',
      fields: [{ key: 'lhs', label: 'Category', w: '.5fr', ph: 'VP', list: 'twCats' }, { key: 'rhs', label: 'Expands to', w: '2fr', ph: 'V NP | V NP PP' }],
      parse: t => lineRows(t, l => { const m = /^(\S+)\s*(?:->|→|::=)\s*(.*)$/.exec(l.trim()); return m ? { lhs: m[1], rhs: m[2] } : { lhs: l, rhs: '' }; }),
      serialize: rows => rows.map(r => (r._comment !== undefined ? r._comment : `${r.lhs} -> ${r.rhs}`)).join('\n'),
      status: (r, i, rows, api) => {
        const known = new Set([...rows.filter(x => x.lhs).map(x => x.lhs), ...api.lexCats()]);
        const syms = String(r.rhs).split(/[\s|]+/).map(x => x.replace(/^\(|\)$|[?*+]$/g, '')).filter(Boolean);
        const unknown = syms.filter(x => !known.has(x));
        return unknown.length ? { ok: false, msg: `no rule or word for ${unknown.join(', ')}` } : { ok: true, info: `${String(r.rhs).split('|').length} expansion(s)` };
      } },
    { id: 'lexicon', name: 'Lexicon', feature: ['gram', 'sem'], field: 'lexicon', addLabel: 'word', hint: 'an empty λ-term means a constant named after the word',
      emptyMeans: (r, k) => (k === 'term' && r.words ? `${r.words.split(',')[0].trim().toLowerCase()}   (constant)` : k === 'type' && r.words ? '(by convention)' : ''),
      fields: [{ key: 'words', label: 'Word(s)', ph: 'Kim, Lee' }, { key: 'cat', label: 'Category', w: '.5fr', ph: 'NP', list: 'twCats' }, { key: 'type', label: 'Type', w: '1fr', ph: '<e,t>', list: 'twTypes' }, { key: 'term', label: 'λ-term', w: '1.6fr', mono: true, ph: 'λx.sleep(x)' }],
      parse: t => lineRows(t, l => { const p = l.split(':'); return { words: (p[0] || '').trim(), cat: (p[1] || '').trim(), type: (p[2] || '').trim(), term: p.slice(3).join(':').trim() }; }),
      serialize: rows => rows.map(r => (r._comment !== undefined ? r._comment : [r.words, r.cat, r.type, r.term].map(x => (x || '').trim()).join(' : ').replace(/(\s:\s)+$/, ''))).join('\n'),
      status: (r, i, rows, api) => { const e = errAt(api, 'Lexicon', i); if (e) return { ok: false, msg: e.msg }; const info = api.lexInfo(i + 1); return info ? { ok: true, info } : null; } },
    { id: 'composition', name: 'Composition rules', feature: 'sem', field: 'composition', addLabel: 'rule', hint: 'patterns: types with variables, idx, * · template: #0 #1 daughters, $i index',
      fields: [{ key: 'name', label: 'Name', w: '.5fr', ph: 'FA' }, { key: 'opts', label: 'Options', w: '.7fr', ph: 'label=^∧$; fixed' }, { key: 'pats', label: 'Daughters', w: '.8fr', ph: '<a,b>, a' }, { key: 'tpl', label: 'Result', w: '1.2fr', mono: true, ph: '#0(#1)' }],
      parse: t => lineRows(t, l => { const m = /^([^:{]+?)\s*(?:\{([^}]*)\})?\s*:\s*(.*?)\s*(?:=>|⇒)\s*(.+)$/u.exec(l.trim()); return m ? { name: m[1], opts: m[2] || '', pats: m[3], tpl: m[4] } : { name: l, opts: '', pats: '', tpl: '' }; }),
      serialize: rows => rows.map(r => (r._comment !== undefined ? r._comment : `${r.name}${r.opts ? ` {${r.opts}}` : ''}: ${r.pats} => ${r.tpl}`)).join('\n'),
      status: (r, i, rows, api) => { const e = errAt(api, 'Composition', i); return e ? { ok: false, msg: e.msg } : { ok: true }; } },
    { id: 'vartypes', name: 'Variable conventions', feature: 'sem', field: 'varTypes', addLabel: 'convention',
      fields: [{ key: 'names', label: 'Names (or /regex/)', ph: 'x, y, z' }, { key: 'type', label: 'Type', ph: 'e', list: 'twTypes' }],
      parse: t => lineRows(t, l => { const k = l.lastIndexOf(':'); return k < 0 ? { names: l, type: '' } : { names: l.slice(0, k).trim(), type: l.slice(k + 1).trim() }; }),
      serialize: rows => rows.map(r => (r._comment !== undefined ? r._comment : `${r.names} : ${r.type}`)).join('\n'),
      status: (r, i, rows, api) => { const e = errAt(api, 'Variable types', i); return e ? { ok: false, msg: e.msg } : { ok: true }; } },
    { id: 'rewrite', name: 'Transformations', feature: 'tx', field: 'rewrite', addLabel: 'transformation', hint: '?x subtree · ?x* sisters · $X any label · <?x> silent copy',
      fields: [{ key: 'name', label: 'Name', w: '.6fr', ph: 'Passive' }, { key: 'manual', label: 'Manual', kind: 'check' }, { key: 'lhs', label: 'Pattern', w: '1.3fr', mono: true, ph: '[S ?a [VP ?v ?b]]' }, { key: 'rhs', label: 'Result', w: '1.3fr', mono: true, ph: '[S ?b [VP ?v ?a]]' }],
      parse: t => lineRows(t, l => { const m = /^(.*?):\s*(.+?)\s*(=>|⇒|-->)\s*(.+)$/.exec(l.trim()); if (!m) return { name: l, manual: false, lhs: '', rhs: '' }; return { name: m[1].replace(/\{manual\}/, '').trim(), manual: /\{manual\}/.test(m[1]), lhs: m[2], rhs: m[4] }; }),
      serialize: rows => rows.map(r => (r._comment !== undefined ? r._comment : `${r.name}${r.manual ? ' {manual}' : ''}: ${r.lhs} => ${r.rhs}`)).join('\n'),
      status: (r, i, rows, api) => { const e = errAt(api, 'Transformations', i); if (e) return { ok: false, msg: e.msg }; const n = api.rewriteMatches(r); return { ok: true, info: n ? `matches ${n} node(s) now` : 'no match in the current tree' }; } },
  ];

  /* ───────── types (TDL statements) ───────── */
  function parseTypes(text) {
    const prefix = commentPrefix(text);
    const out = { prefix, dirs: [], types: [] };
    for (const st of TFS.splitStatements(text)) {
      const s = st.s.trim();
      if (s.startsWith('@')) { const m = /^@(\w+)\s+(\S+)?\s*([\s\S]*)$/.exec(s); out.dirs.push({ kind: m ? m[1] : 'alias', name: m ? m[2] || '' : '', value: m ? (m[3] || '').trim() : s }); continue; }
      let m = /^([^\s:=]+)\s*:=\s*([\s\S]+)$/.exec(s);
      if (m) {
        const parts = splitTop(m[2]);
        const sups = parts.filter(p => /^[^\s[<{"]+$/.test(p));
        const avm = parts.filter(p => !/^[^\s[<{"]+$/.test(p)).join(' & ');
        out.types.push({ name: m[1], sups, avm });
        continue;
      }
      m = /^([^\s:<]+)\s*(?:<\s*([^:]+?))?\s*(?::\s*([\s\S]*))?$/.exec(s.replace(/\n/g, ' '));
      if (m) { const rows = (m[3] || '').split(/[\s,]+/).filter(Boolean).map(x => { const [f, t] = x.split(':'); return `${f} ${t || '*top*'}`; }); out.types.push({ name: m[1], sups: m[2] ? m[2].split(/[&,\s]+/).filter(Boolean) : [], avm: rows.length ? `[${rows.join(', ')}]` : '' }); }
    }
    return out;
  }
  function splitTop(rhs) { const parts = []; let d = 0, cur = '', q = false; for (const c of rhs) { if (c === '"') q = !q; if (!q && '[<{('.includes(c)) d++; if (!q && ']>})'.includes(c)) d--; if (c === '&' && !d && !q) { parts.push(cur.trim()); cur = ''; } else cur += c; } if (cur.trim()) parts.push(cur.trim()); return parts; }
  function serializeTypes(m) {
    const oneLine = s => String(s || '').replace(/\s*\n\s*/g, ' ');
    const dirs = m.dirs.map(d => `@${d.kind} ${d.name}${d.value ? ' ' + oneLine(d.value) : ''}`.trim());
    const types = m.types.map(t => { const sups = t.sups.filter(x => x && x !== '*top*'); const rhs = [...sups, ...(t.avm && t.avm.trim() && t.avm.trim() !== '[]' ? [oneLine(t.avm)] : [])]; return rhs.length ? `${t.name} := ${rhs.join(' & ')}.` : `${t.name}.`; });
    return [m.prefix, dirs.join('\n'), types.join('\n')].filter(Boolean).join('\n\n');
  }

  function typesEditor(el, api) {
    let model = parseTypes(api.get('signature')); let last = api.get('signature');
    let sel = model.types[0] ? model.types[0].name : null;
    const save = (t = 0) => { last = serializeTypes(model); api.set('signature', last, t); };
    const descendants = name => { const out = new Set(); const st = [name]; while (st.length) { const x = st.pop(); for (const t of model.types) if (t.sups.includes(x) && !out.has(t.name)) { out.add(t.name); st.push(t.name); } } return out; };
    const supsOf = t => (t.sups.length ? t.sups : ['*top*']);
    function layout() {
      const all = ['*top*', ...model.types.map(t => t.name)];
      const byName = new Map(model.types.map(t => [t.name, t]));
      const depth = new Map([['*top*', 0]]);
      const dOf = (n, seen = new Set()) => { if (depth.has(n)) return depth.get(n); if (seen.has(n)) return 1; seen.add(n); const t = byName.get(n); const d = 1 + Math.max(0, ...(t ? supsOf(t) : ['*top*']).map(s => dOf(s, seen))); depth.set(n, d); return d; };
      all.forEach(n => dOf(n));
      const layers = []; all.forEach(n => { const d = depth.get(n); (layers[d] = layers[d] || []).push(n); });
      const pos = new Map(); const W = n => api.tw(n, 11.5) + 16;
      layers.forEach((L, d) => {
        if (d > 0) L.sort((a, b) => { const bx = n => { const s = supsOf(byName.get(n)).map(x => (pos.get(x) || { x: 0 }).x); return s.reduce((p, q) => p + q, 0) / s.length; }; return bx(a) - bx(b); });
        let x = 10; L.forEach(n => { pos.set(n, { x: x + W(n) / 2, y: 22 + d * 52, w: W(n), d }); x += W(n) + 8; });
      });
      return { pos, layers, w: Math.max(300, ...[...pos.values()].map(p => p.x + p.w / 2 + 10)), h: 22 + layers.length * 52 };
    }
    function paint() {
      const L = layout(); const t = model.types.find(x => x.name === sel);
      let lines = '', boxes = '';
      for (const ty of model.types) for (const s of supsOf(ty)) { const a = L.pos.get(s), b = L.pos.get(ty.name); if (a && b) lines += `<line x1="${a.x}" y1="${a.y + 9}" x2="${b.x}" y2="${b.y - 9}"${sel && (ty.name === sel || s === sel) ? ' class="hl"' : ''}/>`; }
      for (const [n, p] of L.pos) boxes += `<g data-type="${esc(n)}"${n === sel ? ' class="on"' : ''}><rect x="${p.x - p.w / 2}" y="${p.y - 10}" width="${p.w}" height="20"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle">${esc(n)}</text></g>`;
      el.innerHTML = `<div class="tw-split">
        <div class="tw-graph" tabindex="0" title="Drag a type onto another to make it its supertype (Shift: add as an extra supertype) · arrows move · Enter renames · + adds a subtype · Del deletes">
          <div class="row tw-tools"><input class="tw-find" placeholder="find type…" list="twTypeList" spellcheck="false"><datalist id="twTypeList">${model.types.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist><button data-act="newtop" title="New type directly under *top*">+ type</button>${sel ? `<button data-act="newsub" title="New subtype of ${esc(sel)} (+)">+ subtype of ${esc(sel)}</button>` : ''}</div>
          <svg class="type-svg" width="${L.w}" height="${L.h}">${lines}${boxes}<g class="tw-ghost"></g></svg>
        </div>
        <div class="tw-detail">${t ? detailHtml(t) : '<p class="quiet">Select a type, or add one.</p>'}</div></div>
        <h3 class="tw-h">Shorthands &amp; abbreviations</h3><div class="tw-dirs"></div>`;
      if (t) mountDetail(t);
      mountDirs(el.querySelector('.tw-dirs'));
      el.querySelector('.tw-graph').focus({ preventScroll: true });
    }
    function detailHtml(t) {
      const subs = model.types.filter(x => x.sups.includes(t.name)).map(x => x.name);
      const err = api.errors().find(e => e.section === 'Types' && new RegExp('^' + t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(e.msg));
      return `<label class="field">Type name <input class="tw-name" value="${esc(t.name)}" spellcheck="false" title="Renaming updates every reference (types, lexicon, rules)"></label>
        <div class="field">Supertypes <div class="chips tw-sups">${supsOf(t).map(s => `<span class="me-chip"><span data-goto="${esc(s)}">${esc(s)}</span>${s !== '*top*' || t.sups.length ? `<button data-rmsup="${esc(s)}" title="Remove">×</button>` : ''}</span>`).join('')}<input class="me-add tw-addsup" placeholder="+ supertype" list="twTypeList" size="12"></div></div>
        <div class="field">Subtypes <div class="chips">${subs.map(s => `<span class="me-chip"><span data-goto="${esc(s)}">${esc(s)}</span></span>`).join('') || '<span class="quiet">none</span>'}</div></div>
        ${err ? `<div class="errbox">${esc(err.msg)}</div>` : ''}
        <h3 class="tw-h">Constraint</h3><div class="avm-ed tw-avm"></div>
        <textarea class="avm-text tw-avmtext" rows="3" spellcheck="false" placeholder="[FEATURE value, …]">${esc(t.avm || '')}</textarea>
        <h3 class="tw-h">With everything inherited</h3><div class="avm-svg-wrap">${api.expandedSvg(t.name)}</div>
        <div class="row" style="margin-top:8px"><button data-act="dup">Duplicate</button><button data-act="del" title="Delete (its subtypes move up to its supertypes)">Delete type</button></div>`;
    }
    function mountDetail(t) {
      const name = el.querySelector('.tw-name');
      name.addEventListener('change', () => renameType(t, name.value.trim()));
      name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } });
      const addSup = el.querySelector('.tw-addsup');
      addSup.addEventListener('keydown', e => { if (e.key !== 'Enter') return; e.preventDefault(); const v = addSup.value.trim(); if (!v || v === t.name || descendants(t.name).has(v)) { api.toast('That would create a cycle.'); return; } if (!model.types.some(x => x.name === v) && v !== '*top*') model.types.push({ name: v, sups: [], avm: '' }); t.sups = [...t.sups.filter(s => s !== '*top*'), v]; save(); paint(); });
      const ta = el.querySelector('.tw-avmtext');
      const ed = el.querySelector('.tw-avm');
      api.mountAvm(ed, { get: () => t.avm || '', set: v => { t.avm = v; ta.value = v; save(); } });
      ta.addEventListener('change', () => { t.avm = ta.value.trim(); save(); paint(); });
    }
    function mountDirs(box) {
      const dirApi = { get: () => model.dirs.map(d => `${d.kind}\t${d.name}\t${d.value}`).join('\n'), set: (k, text) => { model.dirs = text.split('\n').filter(Boolean).map(l => { const [kind, name, ...v] = l.split('\t'); return { kind, name, value: v.join('\t') }; }); save(); }, errors: api.errors };
      rowsEditor(box, dirApi, {
        field: 'x', addLabel: 'shorthand',
        fields: [{ key: 'kind', label: 'Kind', kind: 'select', w: '.6fr', options: [['alias', 'feature alias'], ['abbr', 'abbreviation'], ['abbrindex', 'subscript binds'], ['irreg', 'irregular form']] }, { key: 'name', label: 'Name', w: '.6fr', ph: 'HEAD / NP' }, { key: 'value', label: 'Path / AVM', w: '2fr', mono: true, ph: 'SYN|HEAD  or  [HEAD noun, SPR < >]' }],
        parse: t => String(t || '').split('\n').filter(Boolean).map(l => { const [kind, name, ...v] = l.split('\t'); return { kind, name, value: v.join('\t') }; }),
        serialize: rows => rows.map(r => `${r.kind}\t${r.name}\t${r.value}`).join('\n'),
        status: r => { if (r.kind === 'abbr') { try { AVM.parse(r.value); return { ok: true }; } catch (e) { return { ok: false, msg: e.message }; } } return r.name ? { ok: true } : { ok: false, msg: 'name?' }; },
      });
    }
    function renameType(t, to) {
      if (!to || to === t.name) return;
      if (model.types.some(x => x.name === to)) { api.toast(`There is already a type “${to}”.`); paint(); return; }
      const from = t.name;
      for (const x of model.types) { x.sups = x.sups.map(s => (s === from ? to : s)); x.avm = renameIn(x.avm, from, to); }
      model.dirs.forEach(d => { d.value = renameIn(d.value, from, to); });
      t.name = to; sel = to;
      save();
      api.set('hpsgLex', renameIn(api.get('hpsgLex'), from, to));
      api.set('hpsgRules', renameIn(api.get('hpsgRules'), from, to));
      paint();
    }
    function addType(sup) {
      let n = 1, name = sup && sup !== '*top*' ? `${sup}-sub` : 'new-type';
      while (model.types.some(x => x.name === name)) name = `${sup && sup !== '*top*' ? sup + '-sub' : 'new-type'}${++n}`;
      model.types.push({ name, sups: sup && sup !== '*top*' ? [sup] : [], avm: '' }); sel = name; save(); paint();
      const inp = el.querySelector('.tw-name'); if (inp) { inp.focus(); inp.select(); }
    }
    function deleteType(t) {
      if (!confirm(`Delete type ${t.name}? Its subtypes move up to its supertypes.`)) return;
      for (const x of model.types) if (x.sups.includes(t.name)) x.sups = [...new Set([...x.sups.filter(s => s !== t.name), ...t.sups])];
      model.types = model.types.filter(x => x !== t); sel = t.sups[0] || (model.types[0] && model.types[0].name) || null; save(); paint();
    }
    // clicks, drag-to-reparent, keyboard
    let drag = null;
    el.addEventListener('pointerdown', e => { const g = e.target.closest('.type-svg [data-type]'); if (!g) return; drag = { name: g.dataset.type, x: e.clientX, y: e.clientY, moved: false }; });
    el.addEventListener('pointermove', e => {
      if (!drag || drag.name === '*top*') return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
      if (!drag.moved) return;
      el.querySelectorAll('.type-svg g.drop').forEach(x => x.classList.remove('drop'));
      const over = document.elementFromPoint(e.clientX, e.clientY); const g = over && over.closest('.type-svg [data-type]');
      if (g && g.dataset.type !== drag.name && !descendants(drag.name).has(g.dataset.type)) g.classList.add('drop');
    });
    el.addEventListener('pointerup', e => {
      const d = drag; drag = null; if (!d) return;
      el.querySelectorAll('.type-svg g.drop').forEach(x => x.classList.remove('drop'));
      if (!d.moved) { sel = d.name === '*top*' ? sel : d.name; paint(); return; }
      const over = document.elementFromPoint(e.clientX, e.clientY); const g = over && over.closest('.type-svg [data-type]');
      if (!g || g.dataset.type === d.name || descendants(d.name).has(g.dataset.type)) return;
      const t = model.types.find(x => x.name === d.name); const to = g.dataset.type;
      t.sups = e.shiftKey ? [...new Set([...t.sups.filter(s => s !== '*top*'), to].filter(s => s !== '*top*'))] : (to === '*top*' ? [] : [to]);
      sel = t.name; save(); paint(); api.toast(e.shiftKey ? `${t.name} now also inherits from ${to}` : `${t.name} is now a subtype of ${to}`);
    });
    el.addEventListener('click', e => {
      const go = e.target.closest('[data-goto]'); if (go && go.dataset.goto !== '*top*') { sel = go.dataset.goto; paint(); return; }
      const rm = e.target.closest('[data-rmsup]'); if (rm) { const t = model.types.find(x => x.name === sel); t.sups = t.sups.filter(s => s !== rm.dataset.rmsup); save(); paint(); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      const t = model.types.find(x => x.name === sel);
      if (a.dataset.act === 'newtop') addType(null);
      if (a.dataset.act === 'newsub') addType(sel);
      if (a.dataset.act === 'del' && t) deleteType(t);
      if (a.dataset.act === 'dup' && t) { let n = 2; while (model.types.some(x => x.name === `${t.name}-${n}`)) n++; model.types.push({ name: `${t.name}-${n}`, sups: [...t.sups], avm: t.avm }); sel = `${t.name}-${n}`; save(); paint(); }
    });
    el.addEventListener('change', e => { if (e.target.classList.contains('tw-find')) { const v = e.target.value.trim(); if (model.types.some(x => x.name === v)) { sel = v; paint(); } } });
    el.addEventListener('keydown', e => {
      if (!e.target.classList || !e.target.classList.contains('tw-graph')) return;
      const L = layout(); const cur = L.pos.get(sel); if (!cur) return;
      const byName = new Map(model.types.map(t => [t.name, t]));
      let next = null;
      if (e.key === 'ArrowUp') next = supsOf(byName.get(sel))[0];
      if (e.key === 'ArrowDown') next = (model.types.find(x => x.sups.includes(sel)) || {}).name;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const layer = L.layers[cur.d]; const i = layer.indexOf(sel); next = layer[i + (e.key === 'ArrowRight' ? 1 : -1)]; }
      if (e.key === 'Enter') { e.preventDefault(); const inp = el.querySelector('.tw-name'); if (inp) { inp.focus(); inp.select(); } return; }
      if (e.key === '+' || e.key === 'Insert') { e.preventDefault(); addType(sel); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); const t = byName.get(sel); if (t) deleteType(t); return; }
      if (next && next !== '*top*' && byName.has(next)) { e.preventDefault(); sel = next; paint(); }
    });
    paint();
    return { refresh() { const t = api.get('signature'); if (t !== last && !el.contains(document.activeElement)) { model = parseTypes(t); last = t; if (!model.types.some(x => x.name === sel)) sel = model.types[0] && model.types[0].name; paint(); } } };
  }

  /* ───────── HPSG lexicon table ───────── */
  function parseLex(text) {
    const prefix = commentPrefix(text); const entries = []; const dirs = [];
    for (const st of TFS.splitStatements(text)) {
      const s = st.s.trim();
      if (s.startsWith('@')) { dirs.push(s); continue; }
      const m = /^([^\s:=]+)\s*:=\s*([\s\S]+)$/.exec(s); if (!m) continue;
      const parts = splitTop(m[2]); const type = parts.find(p => /^[^\s[<{"]+$/.test(p)) || '';
      entries.push({ name: m[1], type, avm: parts.filter(p => p !== type).join(' & ') });
    }
    return { prefix, entries, dirs };
  }
  const serializeLex = m => [m.prefix, m.dirs.join('\n'), m.entries.map(e => `${e.name} := ${[e.type, ...(e.avm && e.avm.trim() ? [e.avm.replace(/\s*\n\s*/g, ' ')] : [])].filter(Boolean).join(' & ')}.`).join('\n')].filter(Boolean).join('\n\n');
  const formOf = avm => { const m = /PHON\s*<\s*"([^"]*)"/.exec(avm || ''); return m ? m[1] : ''; };
  function lexiconEditor(el, api) {
    let model = parseLex(api.get('hpsgLex')); let last = api.get('hpsgLex'); let open = null; let q = '';
    const save = () => { last = serializeLex(model); api.set('hpsgLex', last); };
    function paint() {
      const words = api.words();
      const types = api.typeNames();
      const list = model.entries.map((e, i) => ({ e, i })).filter(({ e }) => !q || [e.name, e.type, formOf(e.avm)].join(' ').toLowerCase().includes(q));
      el.innerHTML = `<div class="row tw-tools"><input class="lx-q" placeholder="search entries…" value="${esc(q)}" spellcheck="false"><button data-act="add">+ entry</button><span class="hint">${model.entries.length} entries · ${words.length} word forms</span></div>
        <datalist id="lxTypes">${types.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
        <div class="lx-table"><div class="lx-row lx-head"><span>Entry</span><span>Lexical type</span><span>Form</span><span>Word forms</span><span></span></div>
        ${list.map(({ e, i }) => {
          const err = api.errors().find(x => x.section === 'Lexicon' && x.msg.startsWith(e.name));
          const ws = words.filter(w => w.entry === e.name);
          return `<div class="lx-row${open === i ? ' open' : ''}" data-i="${i}"><input data-k="name" value="${esc(e.name)}" spellcheck="false"><input data-k="type" value="${esc(e.type)}" list="lxTypes" spellcheck="false"><input data-k="form" value="${esc(formOf(e.avm))}" placeholder="—" spellcheck="false"><span class="${err ? 'rw-status bad' : 'rw-status ok'}" title="${esc(err ? err.msg : ws.map(w => w.form + ' (' + (w.chain.join(' › ') || 'lexical') + ')').join('\n'))}">${err ? esc(err.msg) : esc([...new Set(ws.map(w => w.form))].slice(0, 6).join(', ')) || '—'}</span><span class="row"><button class="mini" data-act="open" title="Edit the feature structure">${open === i ? '▾' : '▸'}</button><button class="mini" data-act="del" title="Delete">×</button></span></div>
            ${open === i ? `<div class="lx-detail"><div class="avm-ed lx-avm"></div><textarea class="avm-text lx-avmtext" rows="3" spellcheck="false">${esc(e.avm || '')}</textarea></div>` : ''}`;
        }).join('')}</div>
        <h3 class="tw-h">Irregular forms</h3><div class="lx-irr"></div>`;
      if (open != null && model.entries[open]) {
        const e = model.entries[open]; const ta = el.querySelector('.lx-avmtext');
        api.mountAvm(el.querySelector('.lx-avm'), { get: () => e.avm || '', set: v => { e.avm = v; ta.value = v; save(); } });
        ta.addEventListener('change', () => { e.avm = ta.value.trim(); save(); paint(); });
      }
      const irrApi = { get: () => model.dirs.filter(d => d.startsWith('@irreg')).map(d => d.replace(/^@irreg\s+/, '').split(/\s+/).join('\t')).join('\n'), set: (k, text) => { model.dirs = [...model.dirs.filter(d => !d.startsWith('@irreg')), ...text.split('\n').filter(Boolean).map(l => `@irreg ${l.split('\t').join(' ')}`)]; save(); }, errors: api.errors };
      rowsEditor(el.querySelector('.lx-irr'), irrApi, {
        field: 'x', addLabel: 'irregular form',
        fields: [{ key: 'stem', label: 'Stem', ph: 'see' }, { key: 'cls', label: 'Form', kind: 'select', options: [['3sg', '3rd sg'], ['past', 'past'], ['psp', 'past participle'], ['prp', 'present participle'], ['pl', 'plural'], ['er', 'agent -er']] }, { key: 'form', label: 'Spelled', ph: 'saw' }],
        parse: t => String(t || '').split('\n').filter(Boolean).map(l => { const [stem, cls, form] = l.split('\t'); return { stem, cls: cls || 'past', form }; }),
        serialize: rows => rows.filter(r => r.stem).map(r => `${r.stem}\t${r.cls}\t${r.form}`).join('\n'),
        status: r => (r.stem && r.form ? { ok: true } : null),
      });
    }
    el.addEventListener('input', e => { if (e.target.classList.contains('lx-q')) { q = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; paint(); const n = el.querySelector('.lx-q'); n.focus(); n.setSelectionRange(pos, pos); } });
    el.addEventListener('change', e => {
      const row = e.target.closest('.lx-row'); if (!row || !e.target.dataset.k) return;
      const en = model.entries[+row.dataset.i]; const k = e.target.dataset.k; const v = e.target.value.trim();
      if (k === 'form') { en.avm = /PHON\s*<[^>]*>/.test(en.avm || '') ? en.avm.replace(/PHON\s*<[^>]*>/, `PHON <"${v}">`) : (en.avm && en.avm.trim().startsWith('[') ? en.avm.replace(/^\[\s*/, `[PHON <"${v}">, `) : `[PHON <"${v}">]`); }
      else en[k] = v;
      save(); paint();
    });
    el.addEventListener('keydown', e => {
      const row = e.target.closest('.lx-row'); if (!row || !e.target.dataset.k) return;
      if (e.key === 'Enter') { e.preventDefault(); e.target.dispatchEvent(new Event('change', { bubbles: true })); const i = +row.dataset.i; open = open === i ? null : i; paint(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const rows = [...el.querySelectorAll('.lx-row[data-i]')]; const j = rows.indexOf(row) + (e.key === 'ArrowDown' ? 1 : -1); const n = rows[j] && rows[j].querySelector(`[data-k="${e.target.dataset.k}"]`); if (n) { e.preventDefault(); n.focus(); n.select(); } }
    });
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      const row = e.target.closest('.lx-row'); const i = row ? +row.dataset.i : -1;
      if (a.dataset.act === 'add') { let n = 1; while (model.entries.some(x => x.name === `entry${n}`)) n++; model.entries.push({ name: `entry${n}`, type: '', avm: '[PHON <"">]' }); open = model.entries.length - 1; q = ''; save(); paint(); const inp = el.querySelector(`.lx-row[data-i="${open}"] [data-k="name"]`); if (inp) { inp.focus(); inp.select(); } }
      if (a.dataset.act === 'open') { open = open === i ? null : i; paint(); }
      if (a.dataset.act === 'del' && confirm(`Delete entry ${model.entries[i].name}?`)) { model.entries.splice(i, 1); open = null; save(); paint(); }
    });
    paint();
    return { refresh() { const t = api.get('hpsgLex'); if (t !== last && !el.contains(document.activeElement)) { model = parseLex(t); last = t; } paint(); } };
  }

  /* ───────── lexical rules as INPUT ⇒ OUTPUT cards ───────── */
  function parseRules(text) {
    const lines = String(text || '').split('\n'); const prefix = []; const rules = [];
    for (const l of lines) {
      const m = /^(.+?)\s*\(\s*([idp])\w*\s*(?:,\s*([^)]*?))?\s*\)\s*:\s*(.+?)\s*(?:=>|⇒)\s*(.+)$/.exec(l.trim());
      if (m) rules.push({ name: m[1].trim(), kind: m[2], morph: (m[3] || '').trim(), inp: m[4], out: m[5] });
      else if (!rules.length) prefix.push(l);
    }
    while (prefix.length && !prefix[prefix.length - 1].trim()) prefix.pop();
    return { prefix: prefix.join('\n'), rules };
  }
  const flat = s => String(s || '').replace(/\s*\n\s*/g, ' ').trim();
  const serializeRules = m => [m.prefix, m.rules.map(r => `${r.name} (${r.kind}${r.morph ? ', ' + r.morph : ''}): ${flat(r.inp) || '[]'} => ${flat(r.out) || '[]'}`).join('\n')].filter(Boolean).join('\n');
  function rulesEditor(el, api) {
    let model = parseRules(api.get('hpsgRules')); let last = api.get('hpsgRules');
    const save = () => { last = serializeRules(model); api.set('hpsgRules', last); };
    function paint() {
      el.innerHTML = `<div class="row tw-tools"><button data-act="add">+ lexical rule</button><span class="hint">inflectional: lexeme → word, output adds to the input · derivational / post-inflectional: output keeps whatever it doesn't override</span></div>
        ${model.rules.map((r, i) => {
          const res = api.ruleApplies(r.name);
          return `<div class="lr-card" data-i="${i}">
            <div class="lr-head"><input data-k="name" value="${esc(r.name)}" spellcheck="false"><select data-k="kind">${[['i', 'inflectional'], ['d', 'derivational'], ['p', 'post-inflectional']].map(([v, l]) => `<option value="${v}"${r.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
              <input data-k="morph" value="${esc(r.morph)}" list="lrMorph" placeholder="morphology (3sg, +ed, un+, …)" spellcheck="false"><button class="mini" data-act="del" title="Delete">×</button></div>
            <div class="lr-io"><div><div class="lr-lab">INPUT</div><div class="avm-ed lr-in"></div></div><div class="lr-arrow">⇒</div><div><div class="lr-lab">OUTPUT</div><div class="avm-ed lr-out"></div></div></div>
            <div class="small ${res.err ? 'err' : 'muted'}">${res.err ? esc(res.err) : res.list.length ? `applies to: ${esc(res.list.slice(0, 14).join(', '))}${res.list.length > 14 ? ` … (${res.list.length})` : ''}` : 'applies to no entry yet'}</div>
          </div>`;
        }).join('')}
        <datalist id="lrMorph"><option value="3sg"><option value="pl"><option value="past"><option value="psp"><option value="prp"><option value="er"><option value="="></datalist>`;
      el.querySelectorAll('.lr-card').forEach(card => {
        const r = model.rules[+card.dataset.i];
        api.mountAvm(card.querySelector('.lr-in'), { get: () => r.inp, set: v => { r.inp = v; save(); } });
        api.mountAvm(card.querySelector('.lr-out'), { get: () => r.out, set: v => { r.out = v; save(); } });
      });
    }
    el.addEventListener('change', e => { const card = e.target.closest('.lr-card'); if (!card || !e.target.dataset.k) return; model.rules[+card.dataset.i][e.target.dataset.k] = e.target.value.trim(); save(); });
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'add') { model.rules.push({ name: 'New rule', kind: 'i', morph: '', inp: '[]', out: '[]' }); save(); paint(); const c = el.querySelectorAll('.lr-card'); const n = c[c.length - 1] && c[c.length - 1].querySelector('[data-k="name"]'); if (n) { n.focus(); n.select(); } }
      if (a.dataset.act === 'del') { const i = +e.target.closest('.lr-card').dataset.i; if (confirm(`Delete ${model.rules[i].name}?`)) { model.rules.splice(i, 1); save(); paint(); } }
    });
    paint();
    return { refresh() { const t = api.get('hpsgRules'); if (t !== last && !el.contains(document.activeElement)) { model = parseRules(t); last = t; paint(); } else if (!el.contains(document.activeElement)) paint(); } };
  }

  /* ───────── the workspace shell ───────── */
  function mount(el, api) {
    let current = null, editor = null;
    const sections = () => [
      ...SECTIONS.filter(s => s.always || [].concat(s.feature || []).some(f => api.features()[f])).map(s => ({ id: s.id, name: s.name, mk: box => rowsEditor(box, { ...api, get: api.get, set: api.set }, { ...s, status: s.status ? (r, i, rows) => s.status(r, i, rows, api) : null }) })),
      ...(api.isHpsg() ? [
        { id: 'labelavms', name: 'Default AVMs', mk: box => rowsEditor(box, api, {
          field: 'labelAvms', addLabel: 'default', hint: 'invoked per node (button, right-click, Ctrl+K) or for all empty nodes (HPSG tab)',
          fields: [{ key: 'label', label: 'Label', w: '.4fr', ph: 'NP' }, { key: 'avm', label: 'Default feature structure', w: '2.2fr', mono: true, ph: '[phrase SYN [HEAD noun, VAL [SPR < >, COMPS < >]]]' }],
          parse: t => lineRows(t, l => { const m = /^\s*([^:]+?)\s*:\s*(.*)$/.exec(l); return m ? { label: m[1], avm: m[2] } : { label: l, avm: '' }; }),
          serialize: rows => rows.map(r => (r._comment !== undefined ? r._comment : `${r.label}: ${r.avm}`)).join('\n'),
          status: r => { try { AVM.parse(r.avm); } catch (e) { return { ok: false, msg: e.message }; } const n = api.labelCount ? api.labelCount(r.label) : 0; return { ok: true, info: n ? `${n} node(s) labelled ${r.label}` : '✓' }; },
        }) },
        { id: 'types', name: 'Types & constraints', mk: box => typesEditor(box, api) },
        { id: 'hlex', name: 'HPSG lexicon', mk: box => lexiconEditor(box, api) },
        { id: 'lrules', name: 'Lexical rules', mk: box => rulesEditor(box, api) },
      ] : []),
    ];
    function paint() {
      const secs = sections();
      if (!secs.some(s => s.id === current)) current = secs[0].id;
      el.innerHTML = `<nav class="ws-nav">${secs.map((s, i) => `<button data-sec="${s.id}"${s.id === current ? ' class="on"' : ''} title="Alt+${i + 1}">${esc(s.name)}</button>`).join('')}<div class="ws-errs"></div></nav><div class="ws-main"><h2 class="ws-title">${esc(secs.find(s => s.id === current).name)}</h2><div class="ws-body"></div></div>`;
      editor = secs.find(s => s.id === current).mk(el.querySelector('.ws-body'));
      paintErrors();
    }
    const ERR_SEC = { Lexicon: 'lexicon', Grammar: 'grammar', Composition: 'composition', 'Variable types': 'vartypes', Transformations: 'rewrite', Templates: 'templates' };
    function paintErrors() {
      const errs = api.errors(); const box = el.querySelector('.ws-errs'); if (!box) return;
      box.innerHTML = errs.length ? `<div class="errbox"><b>${errs.length} problem${errs.length > 1 ? 's' : ''}</b>${errs.slice(0, 6).map((e, i) => `<button class="ws-err" data-err="${i}" title="Go there">${esc(e.section)}${e.line ? ' · line ' + e.line : ''}: ${esc(e.msg)}</button>`).join('')}${errs.length > 6 ? `<span class="small">… and ${errs.length - 6} more</span>` : ''}</div>` : '<div class="small hp-ok">✓ theory compiles</div>';
    }
    function goToError(i) {
      const e = api.errors()[i]; if (!e) return;
      if (e.section === 'Model') { api.toModel && api.toModel(); return; }
      const sec = ERR_SEC[e.section]; if (!sec || !sections().some(s => s.id === sec)) return;
      current = sec; paint();
      if (e.line && editor && editor.focusRow) editor.focusRow(e.line - 1);
    }
    el.addEventListener('click', e => {
      const er = e.target.closest('[data-err]'); if (er) { goToError(+er.dataset.err); return; }
      const b = e.target.closest('[data-sec]'); if (b) { current = b.dataset.sec; paint(); b.blur(); const f = el.querySelector('.ws-body input, .ws-body textarea, .ws-body button'); if (f) f.focus({ preventScroll: true }); }
    });
    el.addEventListener('keydown', e => {
      const b = e.target.closest && e.target.closest('.ws-nav [data-sec]'); if (!b || !(e.key === 'ArrowDown' || e.key === 'ArrowUp')) return;
      e.preventDefault(); const secs = sections(); const i = secs.findIndex(s => s.id === b.dataset.sec); const s = secs[(i + (e.key === 'ArrowDown' ? 1 : -1) + secs.length) % secs.length];
      current = s.id; paint(); const nb = el.querySelector(`.ws-nav [data-sec="${s.id}"]`); if (nb) nb.focus();
    });
    el.addEventListener('keydown', e => { if (e.altKey && /^Digit[1-9]$/.test(e.code)) { const secs = sections(); const s = secs[+e.code.slice(5) - 1]; if (s) { e.preventDefault(); current = s.id; paint(); } } });
    // commands for the Ctrl+K palette while this view is open
    function commands() {
      const C = []; const add = (t, run, k = '') => C.push({ grp: 'Theory', t, run, k });
      const secs = sections(); const cur = secs.find(s => s.id === current);
      if (editor && editor.add) add(`Add a ${editor.addLabel} to ${cur.name}`, () => editor.add(), 'Enter');
      // every "+ …" button in the current section is a command too
      el.querySelectorAll('.ws-body button').forEach(b => { const t = b.textContent.trim(); if (/^\+\s*\S/.test(t) && !b.classList.contains('rw-add') && !b.closest('[hidden]')) add(`${cur.name}: ${t.replace(/^\+\s*/, 'add ')}`, () => b.click()); });
      secs.forEach((s, i) => add(`Go to ${s.name}`, () => { current = s.id; paint(); }, i < 9 ? `Alt+${i + 1}` : ''));
      api.errors().slice(0, 8).forEach((e, i) => add(`Fix: ${e.section}${e.line ? ' line ' + e.line : ''} — ${e.msg}`, () => goToError(i)));
      return C;
    }
    return {
      show(sec) { if (sec) current = sec; paint(); },
      refresh() { if (editor && editor.refresh) editor.refresh(); paintErrors(); },
      repaint: paint,
      commands,
    };
  }

  /* ───────── model workspace: several models, compare truth values ───────── */
  function mountModels(el, api) {
    let ed = null;
    function paint() {
      const ms = api.models(); const act = api.activeModel();
      el.innerHTML = `<div class="mw-tabs">${ms.map((m, i) => `<button data-m="${i}"${i === act ? ' class="on"' : ''} title="Double-click to rename">${esc(m.name)}</button>`).join('')}<button data-act="addm" title="New empty model">+ model</button><button data-act="dupm" title="Copy this model">duplicate</button>${ms.length > 1 ? '<button data-act="delm">delete</button>' : ''}</div>
        <div class="mw-split"><div class="mw-ed"><div id="mwEd"></div>
          <details class="me-text"><summary>Paste facts</summary><textarea class="mw-paste" rows="5" spellcheck="false" placeholder="smokes: john, mary&#10;loves(john, mary)&#10;loves: (ann, felix), (mary, john)&#10;D: john, mary, ann&#10;— or a table: first row individuals, then  pred  1 0 1 …"></textarea><button data-act="paste">Add to model</button></details>
          <details class="me-text"><summary>Edit as text</summary><textarea class="mw-text" rows="8" spellcheck="false"></textarea></details></div>
        <div class="mw-cmp"><h3 class="tw-h">Compare across models</h3><div class="mw-table"></div>
          <div class="row" style="margin-top:6px"><input class="mw-formula" placeholder="add a formula: ∃x.cat(x) ∧ sleeps(x)" spellcheck="false"><button data-act="addf">add</button></div></div></div>`;
      ed = api.mountModelEditor(el.querySelector('#mwEd'));
      el.querySelector('.mw-text').value = ms[act].text;
      paintCompare();
    }
    function paintCompare() {
      const ms = api.models(); const rows = api.compareRows();
      const box = el.querySelector('.mw-table'); if (!box) return;
      box.innerHTML = rows.length ? `<table class="mw-cmp-t"><tr><th></th>${ms.map(m => `<th>${esc(m.name)}</th>`).join('')}<th></th></tr>${rows.map((r, ri) => `<tr><td class="term" title="${esc(r.term || '')}">${esc(r.label)}</td>${ms.map((m, i) => { const v = api.evalIn(r, i); return `<td class="${v.cls}" title="${esc(v.title || '')}">${esc(v.text)}</td>`; }).join('')}<td>${r.formula ? `<button class="mini" data-delf="${ri}">×</button>` : ''}</td></tr>`).join('')}</table>`
        : '<p class="quiet">Trees with a truth value (and formulas you add) appear here, evaluated in every model.</p>';
    }
    el.addEventListener('click', e => {
      const m = e.target.closest('[data-m]'); if (m) { api.setActive(+m.dataset.m); paint(); return; }
      const df = e.target.closest('[data-delf]'); if (df) { api.removeFormula(+df.dataset.delf); paintCompare(); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'addm') { api.addModel(false); paint(); }
      if (a.dataset.act === 'dupm') { api.addModel(true); paint(); }
      if (a.dataset.act === 'delm' && confirm('Delete this model?')) { api.deleteModel(); paint(); }
      if (a.dataset.act === 'paste') { const n = api.pasteFacts(el.querySelector('.mw-paste').value); api.toast(`${n} fact(s) added`); el.querySelector('.mw-paste').value = ''; paint(); }
      if (a.dataset.act === 'addf') { const v = el.querySelector('.mw-formula').value.trim(); if (v) { api.addFormula(v); paintCompare(); } }
    });
    el.addEventListener('dblclick', e => { const m = e.target.closest('[data-m]'); if (!m) return; const nm = prompt('Model name:', api.models()[+m.dataset.m].name); if (nm) { api.renameModel(+m.dataset.m, nm.trim()); paint(); } });
    el.addEventListener('change', e => { if (e.target.classList.contains('mw-text')) { api.setModelText(e.target.value); paint(); } });
    el.addEventListener('keydown', e => { if (e.target.classList.contains('mw-formula') && e.key === 'Enter') { e.preventDefault(); const v = e.target.value.trim(); if (v) { api.addFormula(v); e.target.value = ''; paintCompare(); } } });
    function commands() {
      const C = []; const add = (t, run, k = '') => C.push({ grp: 'Model', t, run, k });
      const focusSel = sel => () => { const x = el.querySelector(sel); if (x) { x.scrollIntoView({ block: 'center' }); x.focus(); } };
      const openDet = sel => () => { const t = el.querySelector(sel); if (!t) return; t.closest('details').open = true; t.focus(); };
      add('Add an individual', focusSel('#mwEd [data-add="ind"], #mwEd .me-add-ind, #mwEd input[placeholder*="individual"]'));
      add('Add a predicate', focusSel('#mwEd input[placeholder*="predicate"]'));
      add('Add a relation', focusSel('#mwEd input[placeholder*="relation"]'));
      add('Name an individual / set a value', focusSel('#mwEd input[placeholder*="name ="]'));
      add('Paste facts…', openDet('.mw-paste'));
      add('Edit the model as text', openDet('.mw-text'));
      add('Add a formula to compare', focusSel('.mw-formula'));
      add('New empty model', () => { api.addModel(false); paint(); });
      add('Duplicate this model', () => { api.addModel(true); paint(); });
      add('Rename this model…', () => { const i = api.activeModel(); const nm = prompt('Model name:', api.models()[i].name); if (nm) { api.renameModel(i, nm.trim()); paint(); } });
      if (api.models().length > 1) add('Delete this model', () => { if (confirm('Delete this model?')) { api.deleteModel(); paint(); } });
      api.models().forEach((m, i) => { if (i !== api.activeModel()) add(`Switch to model ${m.name}`, () => { api.setActive(i); paint(); }); });
      return C;
    }
    return { show: paint, commands, refresh() { if (ed) ed.refresh(); const t = el.querySelector('.mw-text'); if (t && document.activeElement !== t) t.value = api.models()[api.activeModel()].text; paintCompare(); } };
  }

  return { mount, mountModels, rowsEditor, parseTypes, serializeTypes };
})();
