/* Treditor — attribute-value matrices (typed feature structures) for HPSG and friends.
   Text syntax (also what the visual editor writes):
     [type FEAT value, FEAT|PATH value, …]     AVM; newlines or commas separate rows; FEAT is CAPS
     #1  #1 value  #1_x                         structure-sharing tag (with optional value / subscript)
     <a, b>  ⟨ ⟩    {a, b}                      list, set
     word  "two words"  *bold*  s_1  NP_i       atoms (single-letter/variables render italic)
     VP[SPR <NP>]                               atom with an attached AVM                         */
'use strict';
const AVM = (() => {
  const FEAT = /^[A-Z][A-Z0-9-]*([|.][A-Z][A-Z0-9-]*)*$/;
  class AvmError extends Error {}

  /* ───────── parse ───────── */
  function parse(src) {
    const s = String(src || ''); let i = 0;
    const ws = () => { while (i < s.length && /[\s,]/.test(s[i])) i++; };
    const peek = () => s[i];
    const err = m => new AvmError(`${m} (at ${i})`);
    function word() {
      if (s[i] === '"') { const j = s.indexOf('"', i + 1); if (j < 0) throw err('unclosed "'); const w = s.slice(i + 1, j); i = j + 1; return { w, q: true }; }
      const m = /^(?:[^\s,[\]<>{}⟨⟩"&⊕/()]|\([^\s()]*\))+/u.exec(s.slice(i)); if (!m) return null;
      i += m[0].length; return { w: m[0] };
    }
    const sp = () => { while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++; };
    const isEnd = c => c === undefined || c === '\n' || c === ',' || /[\]>})⟩]/.test(c);
    // a CAPS word followed by more material on the same row is the next FEATURE, not a value
    function featureAhead() {
      const save = i; const w = word(); if (!w || w.q || !FEAT.test(w.w)) { i = save; return false; }
      sp(); const c = s[i]; i = save; return !isEnd(c);
    }
    function value(inAvm) {
      let v = primary(inAvm);
      for (;;) {
        sp();
        if (s[i] === '&') { i++; v = conj(v, primary(inAvm)); continue; }
        if (s[i] === '⊕' || s.startsWith('++', i)) { i += s[i] === '⊕' ? 1 : 2; v = { k: 'app', args: [v, primary(inAvm)] }; continue; }
        break;
      }
      if (s[i] === '/' && s[i + 1] !== '/') { i++; v.def = primary(inAvm); }
      return v;
    }
    function conj(a, b) {
      if (a.k === 'atom' && !a.avm && b.k === 'avm' && !b.type) return { ...b, type: a.v, tag: a.tag || b.tag, tagSub: a.tagSub || b.tagSub };
      if (a.k === 'avm' && b.k === 'avm') return { ...a, type: a.type || b.type, feats: [...a.feats, ...b.feats], tag: a.tag || b.tag };
      if (a.k === 'atom' && b.k === 'atom' && !a.avm && !b.avm) return { k: 'conj', parts: [a, b] };
      return { k: 'conj', parts: [a, b], tag: a.tag || b.tag };
    }
    function primary(inAvm) {
      ws();
      if (s[i] === '/' && s[i + 1] !== '/') { i++; return { k: 'none', def: primary(inAvm) }; }
      let tag = null, tagSub = null;
      const tm = /^#([\p{L}\p{N}]+)(?:_\{?([\p{L}\p{N}]+)\}?)?/u.exec(s.slice(i));
      if (tm) {
        tag = tm[1]; tagSub = tm[2] || null; i += tm[0].length; sp();
        if (isEnd(s[i]) || s[i] === '⊕' || s[i] === '&' || s[i] === '/' || s.startsWith('++', i) || (inAvm && featureAhead())) { const v = { k: 'none', tag }; if (tagSub) v.tagSub = tagSub; return v; }
      }
      const c = peek();
      let v;
      if (c === '[') v = avm();
      else if (c === '<' || c === '⟨') v = seq(c === '<' ? '>' : '⟩', 'list');
      else if (c === '{') v = seq('}', 'set');
      else if (isEnd(c)) v = { k: 'none' };
      else {
        const w = word(); if (!w) throw err(`unexpected '${c}'`);
        v = { k: 'atom', v: w.w, q: !!w.q };
        if (s[i] === '[') v.avm = avm();
      }
      if (tag) { v.tag = tag; if (tagSub) v.tagSub = tagSub; }
      return v;
    }
    function seq(close, k) {
      i++; const items = []; let open = false;
      for (;;) {
        ws();
        if (i >= s.length) throw err(`missing '${close}'`);
        if (s[i] === close) { i++; break; }
        if (s.startsWith('...', i) || s[i] === '…') { i += s[i] === '…' ? 1 : 3; open = true; continue; }
        if (/[\]})>⟩]/.test(s[i])) throw err(`missing '${close}' before '${s[i]}'`);
        if (s[i] === '(') { i++; const v = value(); ws(); if (s[i] !== ')') throw err("missing ')' after optional item"); i++; v.opt = true; items.push(v); continue; }
        const at = i; items.push(value());
        if (i === at) throw err(`unexpected '${s[i]}'`);
      }
      const out = { k, items }; if (open) out.open = true;
      return out;
    }
    function avm() {
      i++; const node = { k: 'avm', type: null, feats: [] };
      ws();
      const tg = /^#([\p{L}\p{N}]+)(?:_\{?([\p{L}\p{N}]+)\}?)?/u.exec(s.slice(i));
      if (tg) { node.tag = tg[1]; if (tg[2]) node.tagSub = tg[2]; i += tg[0].length; ws(); }
      if (s[i] !== ']') {
        const save = i; const w = word();
        if (w && !(FEAT.test(w.w) && !w.q)) node.type = w.w; else i = save;
      }
      for (;;) {
        ws();
        if (i >= s.length) throw err("missing ']'");
        if (s[i] === ']') { i++; break; }
        const w = word();
        if (!w || !FEAT.test(w.w)) throw err(`expected a FEATURE name, got '${w ? w.w : s[i]}'`);
        const v = value(true);
        addPath(node, w.w.split(/[|.]/), v);
      }
      if (node.tag && !node.type && !node.feats.length) { const t = { k: 'none', tag: node.tag }; if (node.tagSub) t.tagSub = node.tagSub; return t; }
      return node;
    }
    ws();
    if (i >= s.length) return null;
    const v = value(); ws();
    if (i < s.length) throw err(`unexpected '${s[i]}'`);
    return v;
  }
  function addPath(node, path, v) {
    const [f, ...rest] = path;
    if (!rest.length) { node.feats.push({ f, v }); return; }
    let row = node.feats.find(r => r.f === f && r.v.k === 'avm');
    if (!row) { row = { f, v: { k: 'avm', type: null, feats: [] } }; node.feats.push(row); }
    addPath(row.v, rest, v);
  }

  /* ───────── serialize ───────── */
  function str(v, ind = '') {
    if (!v) return '';
    const tag = v.tag ? `#${v.tag}${v.tagSub ? '_' + v.tagSub : ''}` : '';
    let body = '';
    if (v.k === 'atom') body = (v.q || /[\s,[\]<>{}"]/.test(v.v) ? `"${v.v}"` : v.v) + (v.avm ? str(v.avm, ind) : '');
    else if (v.k === 'list') { const it = v.items.map(x => (x.opt ? `(${str(x, ind)})` : str(x, ind))); if (v.open) it.push('...'); body = it.length ? `<${it.join(', ')}>` : '< >'; }
    else if (v.k === 'app') body = v.args.map(x => str(x, ind)).join(' ⊕ ');
    else if (v.k === 'conj') body = v.parts.map(x => str(x, ind)).join(' & ');
    else if (v.k === 'set') body = `{${v.items.map(x => str(x, ind)).join(', ')}}`;
    else if (v.k === 'avm') {
      const rows = v.feats.map(r => `${r.f} ${str(r.v, ind)}`).join(', ');
      const flat = `[${v.type ? v.type + (rows ? ' ' : '') : ''}${rows}]`;
      if (flat.length <= 64 && !flat.includes('\n')) body = flat;
      else {
        const inner = ind + '  ';
        body = `[${v.type || ''}${v.feats.map((r, k) => `${k || v.type ? '\n' + inner : ''}${r.f} ${str(r.v, inner)}`).join('')}]`;
      }
    }
    let out = tag && body ? `${tag} ${body}` : tag || body;
    if (v.def) out = `${out ? out + ' ' : ''}/ ${str(v.def, ind)}`;
    return out;
  }

  /* ───────── signature (type → appropriate features, with inheritance) ───────── */
  function parseSignature(src) {
    const types = new Map();
    String(src || '').split('\n').forEach(raw => {
      const line = raw.replace(/#.*$/, '').trim(); if (!line) return;
      const m = /^([^\s:<]+)\s*(?:<\s*([^\s:]+))?\s*:?\s*(.*)$/.exec(line); if (!m) return;
      const defs = m[3].split(/[\s,]+/).filter(Boolean).map(x => { const [f, t] = x.split(':'); return { f, t: t || null }; });
      types.set(m[1], { sup: m[2] || null, defs, feats: defs.map(d => d.f) });
    });
    // features appropriate for a type, inherited from its supertypes (supertype features first)
    const featDefs = t => {
      const chain = []; const seen = new Set(); let cur = t;
      while (cur && types.has(cur) && !seen.has(cur)) { seen.add(cur); chain.unshift(types.get(cur)); cur = types.get(cur).sup; }
      const out = []; chain.forEach(d => d.defs.forEach(x => { const i = out.findIndex(y => y.f === x.f); if (i >= 0) out[i] = x; else out.push(x); }));
      return out;
    };
    const featsOf = t => featDefs(t).map(d => d.f);
    return { types, featsOf, featDefs, typeNames: [...types.keys()] };
  }

  /* ───────── fill a structure out from the signature ───────── */
  function blankOf(t, sig, depth) {
    if (!t) return { k: 'none' };
    if (t === 'list' || t === 'set' || /^(list|set)\(/.test(t)) return { k: 'atom', v: t }; // "some list", not the empty list < >
    if (sig.featDefs(t).length && depth < 10) return fullySpecify({ k: 'avm', type: t, feats: [] }, sig, depth + 1);
    return { k: 'atom', v: t };
  }
  function fullySpecify(v, sig, depth = 0) {
    if (!v || depth > 12) return v;
    if (v.k === 'avm') {
      if (v.type) {
        for (const d of sig.featDefs(v.type)) {
          const row = v.feats.find(r => r.f === d.f);
          if (!row) v.feats.push({ f: d.f, v: blankOf(d.t, sig, depth) });
          else if (row.v.k === 'avm' && !row.v.type && d.t && sig.featDefs(d.t).length) row.v.type = d.t;
        }
        // keep the signature's feature order
        const order = sig.featsOf(v.type);
        v.feats.sort((a, b) => (order.indexOf(a.f) + 1 || 999) - (order.indexOf(b.f) + 1 || 999));
      }
      v.feats.forEach(r => { r.v = fullySpecify(r.v, sig, depth + 1); });
    } else if (v.k === 'list' || v.k === 'set') v.items = v.items.map(x => fullySpecify(x, sig, depth + 1));
    else if (v.k === 'atom' && v.avm) v.avm = fullySpecify(v.avm, sig, depth + 1);
    return v;
  }

  /* ───────── layout & SVG rendering ───────── */
  const FS = { feat: 11.5, val: 13.5, type: 13, tag: 10, sub: 9.5 };
  const PAD = 6, TICK = 4, GAP = 10, ROWGAP = 2, LINE = 17;
  const isVar = w => /^[a-z](_?[\p{L}\p{N}]+)?'*$/u.test(w) || /^[a-z]\d+$/.test(w);
  function atomParts(w) {
    let bold = false, txt = w;
    const bm = /^\*(.+)\*$/.exec(txt); if (bm) { bold = true; txt = bm[1]; }
    const sm = /^(.+?)_\{?([^}]+)\}?$/.exec(txt);
    return { bold, base: sm ? sm[1] : txt, sub: sm ? sm[2] : '', ital: !bold && isVar(txt) };
  }
  // o = { fold: Set(paths folded on this node), foldNames: Set(feature names always folded), hide: Set(feature names hidden) }
  function measure(v, tw, o = {}, path = '') {
    if (!v) return { w: 0, h: 0 };
    let m;
    const tagW = v.tag ? 13 + (v.tagSub ? tw(v.tagSub, FS.sub, true) + 1 : 0) : 0;
    switch (v.k) {
      case 'none': m = { w: 0, h: LINE }; break;
      case 'atom': {
        const p = atomParts(v.v);
        const w = tw(p.base, FS.val, p.ital, p.bold) + (p.sub ? tw(p.sub, FS.sub, true) + 1 : 0);
        if (v.avm) { const a = measure(v.avm, tw, o, path); m = { w: w + 2 + a.w, h: Math.max(LINE, a.h), aw: w, a }; }
        else m = { w, h: LINE, p };
        break;
      }
      case 'list': case 'set': {
        const items = v.items.map((x, k) => measure(x, tw, o, `${path}<${k}>`));
        const par = tw('(', FS.val);
        items.forEach((im, k) => { if (v.items[k].opt) im.optW = par; });
        const comma = tw(', ', FS.val), ell = v.open ? tw(', …', FS.val) : 0;
        const inner = items.reduce((a, x) => a + x.w + (x.optW ? 2 * x.optW : 0), 0) + comma * Math.max(0, items.length - 1) + ell;
        const h = Math.max(LINE, ...items.map(x => x.h));
        const br = v.k === 'list' ? 7 + (h > LINE ? 2 : 0) : 6 + (h > LINE ? 3 : 0);
        m = { w: inner + br * 2 + 4 + (items.length || v.open ? 0 : 4), h: h + (h > LINE ? 4 : 0), items, br, comma, ih: h, ell };
        break;
      }
      case 'app': case 'conj': {
        const parts = (v.k === 'app' ? v.args : v.parts).map((x, k) => measure(x, tw, o, path));
        const opw = tw(v.k === 'app' ? ' ⊕ ' : ' & ', FS.val);
        m = { w: parts.reduce((a, x) => a + x.w, 0) + opw * (parts.length - 1), h: Math.max(LINE, ...parts.map(x => x.h)), parts, opw };
        break;
      }
      case 'avm': {
        const rows = [];
        for (const r of v.feats) {
          if (o.hide && o.hide.has(r.f)) continue;
          const rp = path ? `${path}|${r.f}` : r.f;
          const folded = (o.fold && o.fold.has(rp)) || (o.foldNames && o.foldNames.has(r.f));
          const vm = folded ? { w: tw('[…]', FS.val), h: LINE, folded: true } : measure(r.v, tw, o, rp);
          rows.push({ f: r.f, fw: tw(r.f, FS.feat), vm, v: r.v, path: rp });
        }
        const fw = Math.max(0, ...rows.map(r => r.fw));
        const vw = Math.max(0, ...rows.map(r => r.vm.w));
        const typeW = v.type ? tw(v.type, FS.type, true) : 0;
        const rowsH = rows.map(r => Math.max(LINE, r.vm.h));
        const h = (v.type ? LINE : 0) + rowsH.reduce((a, b) => a + b + ROWGAP, 0) + 4;
        const inner = Math.max(typeW, rows.length ? fw + GAP + vw : 10);
        m = { w: inner + PAD * 2, h: Math.max(h, LINE + 4), rows, fw, rowsH, typeW };
        break;
      }
      default: m = { w: 0, h: LINE };
    }
    if (v.def) { const dm = measure(v.def, tw, o, path); const sl = tw(' / ', FS.val); m = { ...m, base: m, w: m.w + sl + dm.w, h: Math.max(m.h, dm.h), dm, sl, hasDef: true }; }
    if (v.tag) { m = { ...m, inner: m, w: tagW + (v.k === 'none' && !v.def ? 0 : 3 + m.w), h: Math.max(m.h, 14), tagW }; m.isTagged = true; }
    return m;
  }
  const TAG_HUES = [222, 14, 145, 285, 38, 330, 188, 95, 255, 0];
  function tagColor(t) { const n = parseInt(t, 10); let h = Number.isFinite(n) ? TAG_HUES[(n - 1 + TAG_HUES.length * 10) % TAG_HUES.length] : [...String(t)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7); return `hsl(${h} 62% var(--tagL, 42%))`; }
  const escx = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // returns SVG markup; (x, y) = top-left; centred vertically within height H if given
  function draw(v, m, x, y, H) {
    if (!v) return '';
    if (H && H > m.h) y += (H - m.h) / 2;
    let out = '';
    if (m.isTagged) {
      const ty = y + m.h / 2 - 6;
      out += `<g class="avm-tag" data-tag="${escx(v.tag)}" style="--tc:${tagColor(v.tag)}"><rect class="avm-tagbox" x="${x}" y="${ty}" width="11" height="11"/><text class="avm-tagnum" x="${x + 5.5}" y="${ty + 8.6}" text-anchor="middle">${escx(v.tag)}</text></g>`;
      if (v.tagSub) out += `<text class="avm-val it" style="font-size:${FS.sub}px" x="${x + 12.5}" y="${ty + 13}">${escx(v.tagSub)}</text>`;
      if (v.k === 'none' && !v.def) return out;
      const inner = m.inner; x += m.tagW + 3; m = inner;
      return out + drawDef(v, m, x, y + (m.h < 14 ? (14 - m.h) / 2 : 0));
    }
    return out + drawDef(v, m, x, y);
  }
  function drawDef(v, m, x, y) {
    if (!m.hasDef) return drawBody(v, m, x, y);
    const b = m.base; let out = v.k === 'none' ? '' : drawBody(v, b, x, y + (m.h - b.h) / 2);
    const bx = x + (v.k === 'none' ? 0 : b.w);
    out += `<text class="avm-def" x="${bx}" y="${y + m.h / 2 + 4.5}">${v.k === 'none' ? '/ ' : ' / '}</text>`;
    return out + `<g class="avm-defv">${draw(v.def, m.dm, bx + m.sl, y, m.h)}</g>`;
  }
  function atomSvg(p, x, baseline) {
    const cls = `avm-val${p.ital ? ' it' : ''}${p.bold ? ' b' : ''}`;
    return `<text class="${cls}" x="${x}" y="${baseline}">${escx(p.base)}${p.sub ? `<tspan class="it" style="font-size:${FS.sub}px;font-style:italic" dy="3.5">${escx(p.sub)}</tspan>` : ''}</text>`;
  }
  function drawBody(v, m, x, y) {
    let out = '';
    switch (v.k) {
      case 'atom': {
        const p = atomParts(v.v);
        if (v.avm) {
          out += atomSvg(p, x, y + m.h / 2 + 4.5);
          out += draw(v.avm, m.a, x + m.aw + 2, y, m.h);
        } else out += atomSvg(p, x, y + m.h / 2 + 4.5);
        break;
      }
      case 'list': case 'set': {
        const { br, ih } = m; const top = y + 1, bot = y + m.h - 1, mid = y + m.h / 2;
        if (v.k === 'list') {
          out += `<path class="avm-br" d="M${x + br - 1} ${top}L${x + 1} ${mid}L${x + br - 1} ${bot}"/>`;
          out += `<path class="avm-br" d="M${x + m.w - br + 1} ${top}L${x + m.w - 1} ${mid}L${x + m.w - br + 1} ${bot}"/>`;
        } else {
          const brace = (bx, d) => `<path class="avm-br" d="M${bx + d * 4} ${top}Q${bx} ${top} ${bx} ${top + 4}V${mid - 3}Q${bx} ${mid} ${bx - d * 3} ${mid}Q${bx} ${mid} ${bx} ${mid + 3}V${bot - 4}Q${bx} ${bot} ${bx + d * 4} ${bot}"/>`;
          out += brace(x + 4, 1) + brace(x + m.w - 4, -1);
        }
        let cx = x + br + 2;
        m.items.forEach((im, k) => {
          if (im.optW) { out += `<text class="avm-val" x="${cx}" y="${mid + 4.5}">(</text>`; cx += im.optW; }
          out += draw(v.items[k], im, cx, y + (m.h - ih) / 2, ih);
          cx += im.w;
          if (im.optW) { out += `<text class="avm-val" x="${cx}" y="${mid + 4.5}">)</text>`; cx += im.optW; }
          if (k < m.items.length - 1) { out += `<text class="avm-val" x="${cx}" y="${mid + 4.5}">,</text>`; cx += m.comma; }
        });
        if (v.open) out += `<text class="avm-val" x="${cx}" y="${mid + 4.5}">${m.items.length ? ', …' : '…'}</text>`;
        break;
      }
      case 'app': case 'conj': {
        const parts = v.k === 'app' ? v.args : v.parts; let cx = x;
        m.parts.forEach((pm, k) => {
          out += draw(parts[k], pm, cx, y, m.h); cx += pm.w;
          if (k < m.parts.length - 1) { out += `<text class="avm-op" x="${cx + m.opw / 2}" y="${y + m.h / 2 + 4.5}" text-anchor="middle">${v.k === 'app' ? '⊕' : '&amp;'}</text>`; cx += m.opw; }
        });
        break;
      }
      case 'avm': {
        const t = y, b = y + m.h;
        out += `<path class="avm-br" d="M${x + TICK} ${t}H${x}V${b}H${x + TICK}"/><path class="avm-br" d="M${x + m.w - TICK} ${t}H${x + m.w}V${b}H${x + m.w - TICK}"/>`;
        let cy = y + 2;
        if (v.type) { out += `<text class="avm-type" x="${x + PAD}" y="${cy + 13}">${escx(v.type)}</text>`; cy += LINE; }
        m.rows.forEach((r, k) => {
          const rh = m.rowsH[k];
          out += `<text class="avm-feat" data-fpath="${escx(r.path)}" x="${x + PAD}" y="${cy + rh / 2 + 4}">${escx(r.f)}</text>`;
          if (r.vm.folded) out += `<text class="avm-fold" data-fpath="${escx(r.path)}" x="${x + PAD + m.fw + GAP}" y="${cy + rh / 2 + 4.5}">[…]</text>`;
          else out += draw(r.v, r.vm, x + PAD + m.fw + GAP, cy, rh);
          cy += rh + ROWGAP;
        });
        break;
      }
    }
    return out;
  }

  /* ───────── LaTeX (langsci-avm) ───────── */
  function tex(v) {
    if (!v) return '';
    // langsci-avm has \\1 … \\9 as shortcuts; anything else goes through \\tag{…}
    const tg = v.tag ? `\\${/^[1-9]$/.test(v.tag) ? v.tag : 'tag{' + v.tag + '}'}${v.tagSub ? '$_{' + v.tagSub + '}$' : ''}` : '';
    let b = '';
    const atom = w => { const p = atomParts(w); const base = p.bold ? `\\textbf{${p.base}}` : p.ital ? `\\textit{${p.base}}` : p.base; return p.sub ? `${base}$_{${p.sub}}$` : base; };
    if (v.k === 'atom') b = atom(v.v) + (v.avm ? tex(v.avm) : '');
    else if (v.k === 'list') b = `< ${[...v.items.map(x => (x.opt ? `(${tex(x)})` : tex(x))), ...(v.open ? ['\\ldots'] : [])].join(', ')} >`;
    else if (v.k === 'app') b = v.args.map(tex).join(' $\\oplus$ ');
    else if (v.k === 'conj') b = v.parts.map(tex).join(' \\& ');
    else if (v.k === 'set') b = `\\{ ${v.items.map(tex).join(', ')} \\}`;
    else if (v.k === 'avm') b = `[${v.type ? `\\type{${v.type}}` + (v.feats.length ? '\\\\ ' : '') : ''}${v.feats.map(r => `${r.f} & ${tex(r.v)}`).join('\\\\ ')}]`;
    let out = [tg, b].filter(Boolean).join(' ');
    if (v.def) out += ` / ${tex(v.def)}`;
    return out;
  }

  /* ───────── LaTeX for Manning's avm.sty ─────────
     \begin{avm} \[ FEAT & value \\ … \] \end{avm}, lists \< … \>, tags \@1 / \@{12}, types in \textit{},
     relation names (RELN values) in \textbf{}, signs as $+$ / $-$, subscripts as NP$_j$.
     Rows are broken and indented so the source stays readable, with the feature names aligned.
     o.isType(name) → true for atoms that are types with features of their own (set in italics, like 3sing). */
  function texAvmSty(v, o = {}) {
    const esc = t => String(t).replace(/([&%#$])/g, '\\$1').replace(/~/g, '\\textasciitilde{}');
    const tagTex = x => (x.tag ? `\\@${/^[0-9]$/.test(x.tag) ? x.tag : '{' + esc(x.tag) + '}'}${x.tagSub ? '$_{' + esc(x.tagSub) + '}$' : ''}` : '');
    const atom = (w, feat) => {
      if (w === '+' || w === '-' || w === '−') return `$${w === '+' ? '+' : '-'}$`;
      const p = atomParts(w);
      let base = esc(p.base);
      if (p.bold || feat === 'RELN') base = `\\textbf{${base}}`;
      else if (o.isType && o.isType(p.base)) base = `\\textit{${base}}`;
      else if (p.ital && /^[a-z]$|^[a-z]\d+$/.test(p.base)) base = `\\textit{${base}}`; // index variables i, j, s1
      return p.sub ? `${base}$_{${esc(p.sub)}}$` : base;
    };
    // col = column where this value starts (for indenting continuation lines)
    function go(x, col, feat) {
      if (!x) return '';
      const tg = tagTex(x);
      const lead = tg ? tg + (x.k === 'none' && !x.def ? '' : ' ') : '';
      const c = col + lead.length;
      let b = '';
      if (x.k === 'none') b = '';
      else if (x.k === 'atom') b = atom(x.v, feat) + (x.avm ? go({ ...x.avm, tag: null }, c + atom(x.v, feat).length) : '');
      else if (x.k === 'list' || x.k === 'set') {
        const [op, cl] = x.k === 'list' ? ['\\<', '\\>'] : ['\\{', '\\}'];
        if (!x.items.length && !x.open) b = `${op}${cl}`;
        else {
          let cur = c + op.length; const parts = [];
          x.items.forEach((it, k) => { const t = it.opt ? `(${go(it, cur + 1)})` : go(it, cur); parts.push(t); const last = t.split('\n').pop(); cur = (t.includes('\n') ? last.length : cur + t.length) + 2; void k; });
          if (x.open) parts.push('\\ldots');
          b = `${op}${parts.join(', ')}${cl}`;
        }
      } else if (x.k === 'app') b = x.args.map(a => go(a, c)).join(' $\\oplus$ ');
      else if (x.k === 'conj') b = x.parts.map(a => go(a, c)).join(' \\& ');
      else if (x.k === 'avm') {
        const inner = c + 2; // after "\["
        const w = Math.max(0, ...x.feats.map(r => r.f.length));
        const rows = [];
        if (x.type) rows.push(`\\textit{${esc(x.type)}}`);
        for (const r of x.feats) { const head = `${r.f.padEnd(w)} & `; rows.push(head + go(r.v, inner + head.length, r.f)); }
        b = `\\[${rows.join(`\\\\\n${' '.repeat(inner)}`)}\\]`;
      }
      let out = lead + b;
      if (x.def) out += ` / ${go(x.def, c + b.length + 3)}`;
      return out;
    }
    return go(v, o.col || 0);
  }
  function avmStyBlock(v, o = {}) {
    if (!v) return '';
    const body = texAvmSty(v, { ...o, col: 2 });
    return `\\begin{avm}\n  ${body}\n\\end{avm}`;
  }

  /* ───────── visual editor ─────────
     Looks like the printed AVM and is driven from the keyboard:
       Tab / Shift+Tab   next / previous field          Enter     commit; on a value, start a new feature row below
       [  <  {  as the first character of a value: turn it into an AVM, list or set
       #2 value          tag a value (structure sharing)  Backspace on an empty name: delete the row
       Alt+↑ / Alt+↓     move the row                      Esc       undo the edit in this field
     Any value can be typed in the text syntax (a ⊕ b, x & y, v / d, VP[SPR <NP>] …), so nothing is ever lost. */
  let pendingFocus = null; // survives the host re-rendering the panel after a save
  let draft = null;        // the last saved structure, with its still-empty rows and items
  let saving = false;      // the host re-renders synchronously inside api.set
  function mountEditor(el, api) {
    // api: { get() -> text, set(text), signature() -> {featsOf, typeNames, types}, autoFill() }
    let root = null, err = null; const folded = new Set();
    const load = () => {
      const txt = api.get();
      if (draft && draft.text === txt) { root = JSON.parse(draft.json); err = null; return; }
      try { root = parse(txt); err = null; } catch (e) { root = null; err = e.message; }
    };
    const clean = v => {
      if (!v) return v;
      if (v.k === 'avm') return { ...v, feats: v.feats.filter(r => r.f).map(r => ({ ...r, v: clean(r.v) })) };
      if (v.k === 'list' || v.k === 'set') return { ...v, items: v.items.filter(x => !(x.k === 'none' && !x.tag && !x.def)).map(clean) };
      return v;
    };
    const sig = () => api.signature();
    const save = focus => {
      if (focus) pendingFocus = { ...focus, t: Date.now() };
      const text = root ? str(clean(root)) : '';
      draft = { text: text.trim(), json: JSON.stringify(root) };
      saving = true; try { api.set(text); } finally { saving = false; }
    };
    const leafText = v => str({ ...v, tag: undefined, tagSub: undefined });
    const isLeaf = v => !(v.k === 'avm' || ((v.k === 'list' || v.k === 'set') && !v.def));
    const size = s => Math.max(2, [...String(s)].length + 1);
    function tagChip(v, path) {
      if (!v.tag) return '';
      const c = tagColor(v.tag);
      return `<input class="avx-tag" data-p="${path}" data-k="tag" value="${escx(v.tag + (v.tagSub ? '_' + v.tagSub : ''))}" size="${size(v.tag)}" style="--tc:${c}" title="Tag — values with the same tag are token-identical. Clear it to remove.">`;
    }
    function valEd(v, path) {
      let body;
      if (v.k === 'avm') body = avmEd(v, path);
      else if (!isLeaf(v) && (v.k === 'list' || v.k === 'set')) {
        const [o, c] = v.k === 'list' ? ['⟨', '⟩'] : ['{', '}'];
        const items = v.items.map((it, k) => `<span class="avx-item">${valEd(it, `${path}.${k}`)}<button class="avx-x" data-p="${path}.${k}" data-a="delitem" tabindex="-1" title="Remove item">×</button></span>`);
        body = `<span class="avx-list"><span class="avx-ang">${o}</span>${items.join('<span class="avx-comma">,</span>')}${v.open ? '<span class="avx-comma">, …</span>' : ''}<button class="avx-add" data-p="${path}" data-a="additem" tabindex="-1" title="Add an item (or Enter in the last item)">+</button><span class="avx-ang">${c}</span></span>`;
      } else {
        const t = v.k === 'none' && !v.def ? '' : leafText(v);
        body = `<input class="avx-val${/^[a-z]$|^[a-z]_|^\*/.test(t) ? '' : ''}" data-p="${path}" data-k="val" value="${escx(t)}" size="${size(t || '')}" placeholder="${v.tag ? '' : '—'}" spellcheck="false" autocomplete="off" list="avxTypes">`;
      }
      return `<span class="avx-v">${tagChip(v, path)}${body}</span>`;
    }
    function avmEd(v, path) {
      if (folded.has(path)) return `<span class="avx-box avx-folded"><button class="avx-br" data-p="${path}" data-a="fold" tabindex="-1" title="Unfold">[</button><span class="avx-typ"><i>${escx(v.type || '')}</i> <button class="avx-more" data-p="${path}" data-a="fold" tabindex="-1">… ${v.feats.length} features</button></span><span class="avx-brr">]</span></span>`;
      const s = sig(); const have = new Set(v.feats.map(r => r.f));
      const missing = v.type && s.featsOf ? s.featsOf(v.type).filter(f => !have.has(f)) : [];
      const rows = v.feats.map((r, k) => {
        const rp = `${path}.f${k}`;
        return `<span class="avx-row" data-row="${rp}"><span class="avx-f"><button class="avx-x" data-p="${rp}" data-a="delrow" tabindex="-1" title="Remove this feature">×</button><input class="avx-feat" data-p="${rp}" data-k="feat" value="${escx(r.f)}" size="${size(r.f)}" spellcheck="false" autocomplete="off" list="avxFeats" placeholder="FEATURE"></span><span class="avx-cell">${valEd(r.v, rp + '.v')}</span></span>`;
      }).join('');
      return `<span class="avx-box"><button class="avx-br" data-p="${path}" data-a="fold" tabindex="-1" title="Fold">[</button>` +
        `<span class="avx-typ"><input class="avx-type" data-p="${path}" data-k="type" value="${escx(v.type || '')}" size="${size(v.type || 'type')}" placeholder="type" spellcheck="false" autocomplete="off" list="avxTypes"></span>` +
        rows +
        `<span class="avx-foot">${missing.slice(0, 12).map(f => `<button class="avx-miss" data-p="${path}" data-a="addfeat" data-f="${escx(f)}" tabindex="-1" title="Appropriate for ${escx(v.type)}">+${escx(f)}</button>`).join('')}` +
        `${missing.length > 1 ? `<button class="avx-miss avx-fill" data-p="${path}" data-a="fill" tabindex="-1" title="Add every appropriate feature, recursively">fill all</button>` : ''}` +
        `<button class="avx-add" data-p="${path}" data-a="addrow" tabindex="-1" title="Add a feature (or Enter on a value)">+ feature</button></span>` +
        `<span class="avx-brr">]</span></span>`;
    }
    function resolve(path) {
      const parts = path.split('.').slice(1);
      let parent = null, key = null, cur = root;
      for (const p of parts) {
        parent = cur;
        if (p[0] === 'f') { key = ['feats', +p.slice(1)]; cur = cur.feats[+p.slice(1)]; }
        else if (p === 'v') { key = ['v']; cur = cur.v; }
        else { key = ['items', +p]; cur = cur.items[+p]; }
      }
      return {
        cur, parent, key,
        set(nv) { if (!parent) root = nv; else if (key[0] === 'v') parent.v = nv; else parent[key[0]][key[1]] = nv; },
        remove() { if (!parent) root = null; else if (key[0] !== 'v') parent[key[0]].splice(key[1], 1); },
      };
    }
    const featNames = () => {
      const s = sig(); const out = new Set();
      try { (s.typeNames || []).forEach(t => (s.featsOf(t) || []).forEach(f => out.add(f))); } catch { /* signature may be partial */ }
      (function walk(v) { if (!v) return; (v.feats || []).forEach(r => { out.add(r.f); walk(r.v); }); (v.items || []).forEach(walk); })(root);
      return [...out].filter(Boolean).sort();
    };
    function paint(focus) {
      load();
      const s = sig();
      el.classList.add('avx');
      el.innerHTML = `<datalist id="avxTypes">${(s.typeNames || []).map(t => `<option value="${escx(t)}">`).join('')}</datalist><datalist id="avxFeats">${featNames().map(f => `<option value="${escx(f)}">`).join('')}</datalist>` +
        (err ? `<div class="avx-err">Can't show this structure yet: ${escx(err)}. Fix it in the text below.</div>`
          : root ? `<div class="avx-root">${valEd(root, 'r')}</div>`
          : `<div class="avx-empty">${['word', 'phrase'].filter(t => s.types && s.types.has(t)).map(t => `<button data-a="new" data-t="${t}" title="A fully specified ${t}, from the type signature">+ ${t}</button>`).join('')}<button data-a="new">+ empty AVM</button><input class="avx-val" data-k="rootval" placeholder="or type: [HEAD noun, …]" spellcheck="false" size="22"></div>`);
      const f = focus || (pendingFocus && Date.now() - pendingFocus.t < 1500 ? pendingFocus : null);
      if (f) {
        if (!focus) pendingFocus = null; // a remount after the host re-rendered: consume it
        const inp = [...el.querySelectorAll('input[data-k]')].find(i => i.dataset.p === f.p && i.dataset.k === f.k) || (f.p && el.querySelector(`input[data-p^="${f.p}"]`));
        if (inp) { inp.focus(); if (f.sel === 'all') inp.select(); else { const n = inp.value.length; inp.setSelectionRange(n, n); } }
      }
    }
    const commit = focus => { save(focus); paint(focus); };
    // parse the text of one value; keeps an existing tag unless a new one is typed
    function parseValue(text, old) {
      const t = text.trim();
      if (!t) return old && old.tag ? { k: 'none', tag: old.tag, tagSub: old.tagSub } : { k: 'none' };
      const v = parse(t);
      if (old && old.tag && !v.tag) { v.tag = old.tag; if (old.tagSub) v.tagSub = old.tagSub; }
      return v;
    }
    function applyField(inp) {
      const k = inp.dataset.k, val = inp.value.trim();
      if (k === 'rootval') { if (!val) return true; root = parse(val); return true; }
      const r = resolve(inp.dataset.p);
      if (k === 'type') { r.cur.type = val || null; if (val && api.autoFill && api.autoFill()) fullySpecify(r.cur, sig()); }
      else if (k === 'feat') { r.cur.f = val.toUpperCase().replace(/\s+/g, '-'); }
      else if (k === 'tag') {
        const m = /^#?([\p{L}\p{N}]+)(?:_(.+))?$/u.exec(val);
        if (m) { r.cur.tag = m[1]; if (m[2]) r.cur.tagSub = m[2]; else delete r.cur.tagSub; }
        else { delete r.cur.tag; delete r.cur.tagSub; }
      } else if (k === 'val') r.set(parseValue(val, r.cur));
      return true;
    }
    function tryApply(inp) {
      try { applyField(inp); inp.classList.remove('bad'); inp.removeAttribute('data-err'); return true; }
      catch (e) { inp.classList.add('bad'); inp.title = e.message; return false; }
    }
    const nextTag = () => { const used = new Set(); (function walk(v) { if (!v) return; if (v.tag) used.add(v.tag); (v.feats || []).forEach(f => walk(f.v)); (v.items || []).forEach(walk); if (v.avm) walk(v.avm); if (v.def) walk(v.def); })(root); let n = 1; while (used.has(String(n))) n++; return String(n); };
    const parentAvm = p => { const m = /^(.*)\.f(\d+)(?:\.v)?$/.exec(p); return m ? { path: m[1], i: +m[2] } : null; };
    const parentList = p => { const m = /^(.*)\.(\d+)$/.exec(p); return m ? { path: m[1], i: +m[2] } : null; };

    el.addEventListener('input', e => {
      const t = e.target; if (!t.dataset.k) return;
      t.size = size(t.value || t.placeholder || '');
      t.classList.remove('bad');
      // structural shortcuts: the first character of an empty value decides its kind
      if (t.dataset.k === 'val' && t.value.length === 1 && '[<{'.includes(t.value)) {
        const r = resolve(t.dataset.p); const tag = r.cur.tag ? { tag: r.cur.tag } : {};
        const ch = t.value;
        if (ch === '[') { r.set({ k: 'avm', type: null, feats: [], ...tag }); commit({ p: t.dataset.p, k: 'type' }); }
        else if (ch === '<' || ch === '{') { r.set({ k: ch === '<' ? 'list' : 'set', items: [{ k: 'none' }], ...tag }); commit({ p: t.dataset.p + '.0', k: 'val' }); }
      }
    });
    el.addEventListener('change', e => {
      const t = e.target; if (!t.dataset.k || saving || !t.isConnected || !el.isConnected) return;
      if (tryApply(t)) commit(document.activeElement && el.contains(document.activeElement) && document.activeElement !== t ? { p: document.activeElement.dataset.p, k: document.activeElement.dataset.k } : null);
    });
    el.addEventListener('keydown', e => {
      const t = e.target; if (!t.dataset || !t.dataset.k) return;
      const k = t.dataset.k, p = t.dataset.p;
      if (e.key === 'Escape') { t.value = t.defaultValue; t.blur(); e.stopPropagation(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!tryApply(t)) return;
        if (k === 'feat') return commit({ p: p + '.v', k: 'val' });
        if (k === 'type') { const r = resolve(p); return commit(r.cur.feats && r.cur.feats.length ? { p: p + '.f0', k: 'feat' } : null); }
        if (k === 'val' || k === 'tag') {
          const li = parentList(p);
          if (li && /^(list|set)$/.test((resolve(li.path).cur || {}).k)) { resolve(li.path).cur.items.splice(li.i + 1, 0, { k: 'none' }); return commit({ p: `${li.path}.${li.i + 1}`, k: 'val' }); }
          const pa = parentAvm(p);
          if (pa) { resolve(pa.path).cur.feats.splice(pa.i + 1, 0, { f: '', v: { k: 'none' } }); return commit({ p: `${pa.path}.f${pa.i + 1}`, k: 'feat' }); }
        }
        return commit(null);
      }
      if (e.key === 'Backspace' && !t.value) {
        if (k === 'feat') { e.preventDefault(); const pa = parentAvm(p); resolve(p).remove(); return commit(pa && pa.i > 0 ? { p: `${pa.path}.f${pa.i - 1}.v`, k: 'val' } : pa ? { p: pa.path, k: 'type' } : null); }
        if (k === 'val') { const li = parentList(p); if (li && /^(list|set)$/.test((resolve(li.path).cur || {}).k)) { e.preventDefault(); resolve(p).remove(); return commit(li.i > 0 ? { p: `${li.path}.${li.i - 1}`, k: 'val' } : { p: li.path }); } }
      }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const pa = parentAvm(p) || (k === 'feat' ? parentAvm(p) : null); if (!pa) return;
        e.preventDefault(); tryApply(t);
        const fs = resolve(pa.path).cur.feats, j = pa.i + (e.key === 'ArrowUp' ? -1 : 1);
        if (j < 0 || j >= fs.length) return;
        [fs[pa.i], fs[j]] = [fs[j], fs[pa.i]];
        return commit({ p: `${pa.path}.f${j}${p.endsWith('.v') || k !== 'feat' ? '.v' : ''}`, k });
      }
    });
    el.addEventListener('mousedown', e => { if (e.target.closest('button[data-a]')) e.preventDefault(); }); // keep focus in the field being edited
    // leaving the editor tidies away rows and items that were started but left empty
    el.addEventListener('focusout', e => {
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      setTimeout(() => {
        if (el.contains(document.activeElement) || !root || !el.isConnected) return;
        const before = JSON.stringify(root), tidy = clean(root);
        if (JSON.stringify(tidy) !== before) { root = tidy; if (draft) draft.json = JSON.stringify(root); paint(); }
      }, 0);
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a, p = b.dataset.p;
      const act = document.activeElement; if (act && el.contains(act) && act.dataset && act.dataset.k) tryApply(act);
      if (a === 'new') { root = b.dataset.t ? fullySpecify({ k: 'avm', type: b.dataset.t, feats: [] }, sig()) : { k: 'avm', type: null, feats: [] }; return commit({ p: 'r', k: 'type' }); }
      if (a === 'fold') { folded.has(p) ? folded.delete(p) : folded.add(p); return paint(); }
      const r = resolve(p);
      if (a === 'fill') { fullySpecify(r.cur, sig()); return commit(null); }
      if (a === 'additem') { r.cur.items.push({ k: 'none' }); return commit({ p: `${p}.${r.cur.items.length - 1}`, k: 'val' }); }
      if (a === 'delitem' || a === 'delrow') { r.remove(); return commit(null); }
      if (a === 'addrow') { r.cur.feats.push({ f: '', v: { k: 'none' } }); return commit({ p: `${p}.f${r.cur.feats.length - 1}`, k: 'feat' }); }
      if (a === 'addfeat') {
        const s = sig(); const d = (s.featDefs ? s.featDefs(r.cur.type) : []).find(x => x.f === b.dataset.f);
        r.cur.feats.push({ f: b.dataset.f, v: d && d.t && api.autoFill && api.autoFill() ? fullySpecify(blankOf(d.t, s, 0), s) : { k: 'none' } });
        const order = s.featsOf(r.cur.type); r.cur.feats.sort((x, y) => (order.indexOf(x.f) + 1 || 999) - (order.indexOf(y.f) + 1 || 999));
        return commit({ p: `${p}.f${r.cur.feats.findIndex(x => x.f === b.dataset.f)}.v`, k: 'val' });
      }
    });
    paint();
    return { refresh: () => paint() };
  }

  return { parse, str, measure, draw, tex, texAvmSty, avmStyBlock, parseSignature, fullySpecify, mountEditor, AvmError };
})();
if (typeof module !== 'undefined') module.exports = AVM;
