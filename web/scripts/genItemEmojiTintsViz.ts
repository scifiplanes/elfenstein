/**
 * Builds web/public/item-emoji-tints-viz.html — item emoji icons rendered with the same
 * canvas pipeline as `renderItemEmojiIconCanvas.ts` (optional CSS filter blit).
 * Run from web/: npm run gen:item-emoji-tints-viz
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ItemDef } from '../src/game/content/contentDb'
import { ITEM_ICON_CANVAS_FONT, ITEM_ICON_CANVAS_SIZE } from '../src/game/renderItemEmojiIconCanvas'
import { DEFAULT_ITEMS } from '../src/game/content/items'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '..', 'public', 'item-emoji-tints-viz.html')

type VizEntry = {
  id: string
  name: string
  tintFilter?: string
  displayScale?: number
  rotateDeg?: number
  flipHorizontal?: boolean
  flipVertical?: boolean
}

type VizGroup = { glyph: string; items: VizEntry[] }

type SingleTintRow = VizEntry & { glyph: string }

function toEntry(def: ItemDef): VizEntry {
  const ic = def.icon
  if (ic.kind !== 'emoji') throw new Error('expected emoji')
  return {
    id: def.id,
    name: def.name,
    tintFilter: ic.tintFilter?.trim() || undefined,
    displayScale: ic.displayScale,
    rotateDeg: ic.rotateDeg,
    flipHorizontal: ic.flipHorizontal === true ? true : undefined,
    flipVertical: ic.flipVertical === true ? true : undefined,
  }
}

function buildDuplicateGroups(items: ItemDef[]): VizGroup[] {
  const byGlyph = new Map<string, ItemDef[]>()
  for (const def of items) {
    if (def.icon.kind !== 'emoji') continue
    const g = def.icon.value
    const list = byGlyph.get(g) ?? []
    list.push(def)
    byGlyph.set(g, list)
  }
  const groups: VizGroup[] = []
  for (const [glyph, list] of byGlyph) {
    if (list.length < 2) continue
    groups.push({
      glyph,
      items: list.map(toEntry).sort((a, b) => a.id.localeCompare(b.id)),
    })
  }
  groups.sort((a, b) => a.glyph.localeCompare(b.glyph))
  return groups
}

function buildSingleTinted(items: ItemDef[], duplicateGlyphs: Set<string>): SingleTintRow[] {
  const rows: SingleTintRow[] = []
  for (const def of items) {
    const ic = def.icon
    if (ic.kind !== 'emoji') continue
    if (!ic.tintFilter?.trim()) continue
    if (duplicateGlyphs.has(ic.value)) continue
    rows.push({ ...toEntry(def), glyph: ic.value })
  }
  rows.sort((a, b) => a.id.localeCompare(b.id))
  return rows
}

const duplicateGroups = buildDuplicateGroups(DEFAULT_ITEMS)
const dupGlyphSet = new Set(duplicateGroups.map((g) => g.glyph))
const singleTinted = buildSingleTinted(DEFAULT_ITEMS, dupGlyphSet)

const dataJson = JSON.stringify({
  canvasSize: ITEM_ICON_CANVAS_SIZE,
  font: ITEM_ICON_CANVAS_FONT,
  duplicateGroups,
  singleTinted,
})

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Item emoji tints — Elfenstein</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Jim+Nightshade&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg0: #0b0c10;
      --bg1: #10121a;
      --panel: rgba(18, 20, 28, 0.92);
      --panelBorder: rgba(171, 136, 107, 0.75);
      --text0: rgba(255, 255, 255, 0.92);
      --text1: rgba(255, 255, 255, 0.72);
      --muted: rgba(255, 255, 255, 0.5);
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      --title: 'Jim Nightshade', cursive;
      --checker: rgba(255, 255, 255, 0.06);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px 18px 32px;
      font: 14px/1.4 var(--sans);
      color: var(--text0);
      background: var(--bg0);
      background-image: radial-gradient(ellipse 120% 80% at 50% 0%, var(--bg1) 0%, var(--bg0) 55%);
      -webkit-font-smoothing: antialiased;
    }
    h1 {
      font-family: var(--title);
      font-size: clamp(26px, 4vw, 34px);
      margin: 0 0 8px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.45);
    }
    .blurb {
      color: var(--text1);
      max-width: 70ch;
      margin: 0 0 20px;
    }
    .blurb code { font-family: var(--mono); font-size: 12px; color: var(--muted); }
    h2 {
      font-size: 18px;
      margin: 28px 0 12px;
      color: var(--text0);
      border-bottom: 1px solid var(--panelBorder);
      padding-bottom: 6px;
    }
    .group {
      background: var(--panel);
      border: 2px solid var(--panelBorder);
      margin-bottom: 16px;
      border-radius: 2px;
      overflow: hidden;
    }
    .group-h {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: rgba(0,0,0,0.25);
      font-family: var(--mono);
      font-size: 15px;
    }
    .glyph-preview {
      font-size: 28px;
      line-height: 1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--mono);
      font-size: 12px;
    }
    th, td {
      text-align: left;
      padding: 10px 12px;
      border-top: 1px solid rgba(255,255,255,0.06);
      vertical-align: middle;
    }
    th {
      color: var(--muted);
      font-weight: 600;
      background: rgba(12, 14, 20, 0.6);
    }
    tr:hover td { background: rgba(255,255,255,0.03); }
    .cell-icon {
      width: 88px;
    }
    .icon-wrap {
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #1a1d28;
      background-image:
        linear-gradient(45deg, var(--checker) 25%, transparent 25%),
        linear-gradient(-45deg, var(--checker) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, var(--checker) 75%),
        linear-gradient(-45deg, transparent 75%, var(--checker) 75%);
      background-size: 12px 12px;
      background-position: 0 0, 0 6px, 6px -6px, -6px 0;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 4px;
    }
    .icon-wrap canvas {
      width: 64px;
      height: 64px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    .id { color: #9ec5e8; }
    .tint-none { color: var(--muted); font-style: italic; }
    .meta { color: var(--text1); font-size: 11px; }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: var(--muted);
      font-family: var(--mono);
    }
  </style>
</head>
<body>
  <h1>Item emoji tints</h1>
  <p class="blurb">
    Canvas rendering mirrors <code>web/src/game/renderItemEmojiIconCanvas.ts</code> (glyph + optional CSS <code>filter</code> on a second blit).
    <strong>Shared glyphs</strong> lists every item that reuses the same emoji. <strong>Other tinted</strong> lists items whose emoji is unique but still uses <code>tintFilter</code>.
  </p>
  <div id="root"></div>
  <p class="footer">Regenerate: <code>npm run gen:item-emoji-tints-viz</code> (from <code>web/</code>). Open via dev server: <code>/item-emoji-tints-viz.html</code></p>
  <script type="application/json" id="viz-data">${dataJson.replace(/</g, '\\u003c')}</script>
  <script>
(function () {
  var el = document.getElementById('viz-data');
  var DATA = JSON.parse(el.textContent);
  var W = DATA.canvasSize;
  var H = DATA.canvasSize;
  var FONT = DATA.font;
  var root = document.getElementById('root');

  function renderIcon(glyph, entry) {
    var tintFilter = entry.tintFilter && String(entry.tintFilter).trim();
    var displayScale = entry.displayScale != null && entry.displayScale !== 1 ? entry.displayScale : 1;
    var rotateDeg = entry.rotateDeg != null ? entry.rotateDeg : 0;
    var flipHorizontal = entry.flipHorizontal === true;
    var flipVertical = entry.flipVertical === true;
    var cx = W / 2;
    var cy = H / 2;

    var scratch = document.createElement('canvas');
    scratch.width = W;
    scratch.height = H;
    var sctx = scratch.getContext('2d');
    if (!sctx) return scratch;
    sctx.clearRect(0, 0, W, H);
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.font = FONT;
    sctx.filter = 'none';

    var rotRad = ((rotateDeg % 360) + 360) % 360 !== 0 ? (rotateDeg * Math.PI) / 180 : 0;
    sctx.save();
    sctx.translate(cx, cy);
    if (rotRad !== 0) sctx.rotate(rotRad);
    sctx.scale(displayScale, displayScale);
    if (flipHorizontal) sctx.scale(-1, 1);
    if (flipVertical) sctx.scale(1, -1);
    sctx.translate(-cx, -cy);
    sctx.fillStyle = 'rgba(0,0,0,0.55)';
    sctx.fillText(glyph, cx + 4, cy + 6);
    sctx.fillStyle = 'rgba(255,255,255,0.92)';
    sctx.fillText(glyph, cx, cy);
    sctx.restore();

    if (!tintFilter) return scratch;

    var out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    var octx = out.getContext('2d');
    if (!octx) return scratch;
    octx.filter = tintFilter;
    octx.drawImage(scratch, 0, 0);
    octx.filter = 'none';
    return out;
  }

  function transformLabel(entry) {
    var parts = [];
    if (entry.displayScale != null && entry.displayScale !== 1) parts.push('scale ' + entry.displayScale);
    if (entry.rotateDeg != null && ((entry.rotateDeg % 360) + 360) % 360 !== 0) {
      parts.push('rotate ' + entry.rotateDeg + '°');
    }
    if (entry.flipHorizontal) parts.push('flip H');
    if (entry.flipVertical) parts.push('flip V');
    return parts.length ? parts.join(' · ') : '—';
  }

  function rowSharedGlyph(glyph, entry) {
    var tr = document.createElement('tr');
    var c0 = document.createElement('td');
    c0.className = 'cell-icon';
    var wrap = document.createElement('div');
    wrap.className = 'icon-wrap';
    wrap.appendChild(renderIcon(glyph, entry));
    c0.appendChild(wrap);
    var c1 = document.createElement('td');
    c1.innerHTML = '<span class="id">' + entry.id.replace(/</g, '&lt;') + '</span>';
    var c2 = document.createElement('td');
    c2.textContent = entry.name;
    var c3 = document.createElement('td');
    if (entry.tintFilter) c3.textContent = entry.tintFilter;
    else c3.innerHTML = '<span class="tint-none">(none)</span>';
    var c4 = document.createElement('td');
    c4.className = 'meta';
    c4.textContent = transformLabel(entry);
    tr.appendChild(c0);
    tr.appendChild(c1);
    tr.appendChild(c2);
    tr.appendChild(c3);
    tr.appendChild(c4);
    return tr;
  }

  function sectionDuplicateGroups(groups) {
    var h = document.createElement('h2');
    h.textContent = 'Shared emoji glyphs (' + groups.length + ' groups)';
    root.appendChild(h);
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g];
      var box = document.createElement('div');
      box.className = 'group';
      var head = document.createElement('div');
      head.className = 'group-h';
      var prev = document.createElement('span');
      prev.className = 'glyph-preview';
      prev.textContent = grp.glyph;
      head.appendChild(prev);
      var label = document.createElement('span');
      label.textContent = grp.items.length + ' items';
      head.appendChild(label);
      box.appendChild(head);
      var tbl = document.createElement('table');
      var thead = document.createElement('thead');
      var hr = document.createElement('tr');
      ['Icon', 'Id', 'Name', 'tintFilter', 'Transform'].forEach(function (col) {
        var th = document.createElement('th');
        th.textContent = col;
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      tbl.appendChild(thead);
      var tb = document.createElement('tbody');
      for (var i = 0; i < grp.items.length; i++) {
        tb.appendChild(rowSharedGlyph(grp.glyph, grp.items[i]));
      }
      tbl.appendChild(tb);
      box.appendChild(tbl);
      root.appendChild(box);
    }
  }

  function sectionSingle(entries) {
    var h = document.createElement('h2');
    h.textContent = 'Other tinted emoji (single glyph use)';
    root.appendChild(h);
    if (!entries.length) {
      var p = document.createElement('p');
      p.className = 'blurb';
      p.textContent = 'None.';
      root.appendChild(p);
      return;
    }
    var box = document.createElement('div');
    box.className = 'group';
    var head = document.createElement('div');
    head.className = 'group-h';
    head.textContent = entries.length + ' items';
    box.appendChild(head);
    var tbl = document.createElement('table');
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['Icon', 'Id', 'Name', 'Glyph', 'tintFilter', 'Transform'].forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    tbl.appendChild(thead);
    var tb = document.createElement('tbody');
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var tr = document.createElement('tr');
      var c0 = document.createElement('td');
      c0.className = 'cell-icon';
      var wrap = document.createElement('div');
      wrap.className = 'icon-wrap';
      wrap.appendChild(renderIcon(e.glyph, e));
      c0.appendChild(wrap);
      var c1 = document.createElement('td');
      c1.innerHTML = '<span class="id">' + e.id.replace(/</g, '&lt;') + '</span>';
      var c2 = document.createElement('td');
      c2.textContent = e.name;
      var cg = document.createElement('td');
      cg.textContent = e.glyph;
      var c3 = document.createElement('td');
      c3.textContent = e.tintFilter || '';
      var c4 = document.createElement('td');
      c4.className = 'meta';
      c4.textContent = transformLabel(e);
      tr.appendChild(c0);
      tr.appendChild(c1);
      tr.appendChild(c2);
      tr.appendChild(cg);
      tr.appendChild(c3);
      tr.appendChild(c4);
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    box.appendChild(tbl);
    root.appendChild(box);
  }

  sectionDuplicateGroups(DATA.duplicateGroups || []);
  sectionSingle(DATA.singleTinted || []);
})();
  </script>
</body>
</html>
`

fs.writeFileSync(outPath, html, 'utf8')
console.log('Wrote', outPath)
