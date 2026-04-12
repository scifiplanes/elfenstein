/**
 * Builds web/public/consumables-viz.html from DEFAULT_ITEMS feed stats.
 * Run from web/: npm run gen:consumables-viz
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ItemDef } from '../src/game/content/contentDb'
import { DEFAULT_ITEMS } from '../src/game/content/items'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.join(__dirname, '..', 'public', 'consumables-viz.html')

function iconGlyph(def: ItemDef): string {
  if (def.icon.kind === 'emoji') return def.icon.value
  return '◇'
}

function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

type Row = {
  id: string
  name: string
  glyph: string
  stamina: number
  hp: number
  hunger: number
  thirst: number
  primaryStamina: boolean
  statusNote: string
  tags: string[]
}

function buildRows(items: ItemDef[]): Row[] {
  const rows: Row[] = []
  for (const def of items) {
    const f = def.feed
    if (!f) continue
    const stamina = f.stamina ?? 0
    const hp = f.hp ?? 0
    const hunger = f.hunger ?? 0
    const thirst = f.thirst ?? 0
    if (stamina + hp + thirst + hunger <= 0) continue

    const statusParts =
      f.statusChances?.map((sc) => `${sc.status} ${sc.pct}%${sc.onlySpecies ? ` (${sc.onlySpecies})` : ''}`) ?? []
    const statusNote = statusParts.join('; ')

    rows.push({
      id: def.id,
      name: def.name,
      glyph: iconGlyph(def),
      stamina,
      hp,
      hunger,
      thirst,
      primaryStamina: f.primaryStamina === true,
      statusNote,
      tags: [...def.tags],
    })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))
  return rows
}

const rows = buildRows(DEFAULT_ITEMS)
const maxSta = Math.max(10, ...rows.map((r) => r.stamina), 1)
const maxHp = Math.max(12, ...rows.map((r) => r.hp), 1)

const dataJson = JSON.stringify({ rows, maxSta, maxHp })

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consumables — stamina &amp; HP — Elfenstein</title>
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
      --titleShadow: 0 1px 3px rgba(0, 0, 0, 0.45), 0 0 12px rgba(0, 0, 0, 0.22);
      --axis: rgba(171, 136, 107, 0.55);
      --grid: rgba(255, 255, 255, 0.06);
      --ptDrink: #6eb8d4;
      --ptFood: #c4a882;
      --ptBoth: #b8a6e0;
      --ptThirst: #5a9e7a;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      display: flex;
      flex-direction: column;
      font: 14px/1.35 var(--sans);
      color: var(--text0);
      background: var(--bg0);
      background-image: radial-gradient(ellipse 120% 80% at 50% 0%, var(--bg1) 0%, var(--bg0) 55%);
      -webkit-font-smoothing: antialiased;
    }
    #bar {
      flex: 0 0 auto;
      margin: 12px 12px 0;
      padding: 14px 16px 16px;
      background: var(--panel);
      border: 2px solid var(--panelBorder);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65);
    }
    h1 {
      margin: 0 0 8px;
      font-family: var(--title);
      font-size: clamp(26px, 4vw, 34px);
      font-weight: 700;
      letter-spacing: 0.02em;
      text-shadow: var(--titleShadow);
    }
    .blurb {
      margin: 0 0 12px;
      color: var(--text1);
      font-size: 15px;
      max-width: 72ch;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--text1);
      margin-bottom: 10px;
    }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    #wrap {
      flex: 1 1 auto;
      margin: 12px;
      min-height: 420px;
      background: var(--panel);
      border: 2px solid var(--panelBorder);
      position: relative;
      overflow: auto;
    }
    #chart { display: block; width: 100%; height: min(72vh, 640px); min-height: 400px; }
    #tip {
      position: fixed;
      display: none;
      max-width: 280px;
      padding: 10px 12px;
      background: rgba(12, 14, 20, 0.95);
      border: 1px solid var(--panelBorder);
      font-size: 12px;
      font-family: var(--mono);
      line-height: 1.45;
      color: var(--text0);
      pointer-events: none;
      z-index: 50;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    #tip strong { color: var(--text0); }
    .footer {
      margin: 10px 12px 16px;
      font-size: 12px;
      color: var(--muted);
      font-family: var(--mono);
    }
    .footer code { color: var(--text1); }
    table {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--mono);
      font-size: 11px;
      margin-top: 8px;
    }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--grid); }
    th { color: var(--muted); font-weight: 600; position: sticky; top: 0; background: rgba(18,20,28,0.98); }
    th.sort { cursor: pointer; user-select: none; }
    th.sort:hover { color: var(--text0); }
    tr:hover td { background: rgba(255,255,255,0.03); }
    #tblWrap { display: none; padding: 12px; max-height: 50vh; overflow: auto; }
    #tblWrap.open { display: block; }
    .toggle {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--text1);
      background: transparent;
      border: 1px solid var(--panelBorder);
      padding: 6px 12px;
      cursor: pointer;
      margin-right: 8px;
    }
    .toggle:hover { color: var(--text0); border-color: rgba(171, 136, 107, 0.95); }
  </style>
</head>
<body>
  <div id="bar">
    <h1>Consumable vitals</h1>
    <p class="blurb">
      Each point is one item with a <code>feed</code> definition in <code>items.ts</code>.
      Axes are <strong>stamina</strong> and <strong>HP</strong> gained per use (clamped to max vitals in-game).
      Bubble area scales with hunger + thirst fill. Remedies with no vital deltas are omitted.
      <strong>Bandage strip</strong> is not shown (portrait apply, not mouth feed stats).
    </p>
    <div class="legend">
      <span><i class="dot" style="background:var(--ptDrink)"></i> Drink-leaning (thirst ≥ stamina+HP)</span>
      <span><i class="dot" style="background:var(--ptFood)"></i> Food-leaning</span>
      <span><i class="dot" style="background:var(--ptBoth)"></i> Strong STA &amp; HP</span>
      <span><i class="dot" style="background:var(--ptThirst)"></i> Thirst-only (vessels)</span>
    </div>
    <button type="button" class="toggle" id="btnTable">Show sortable table</button>
  </div>
  <div id="wrap">
    <svg id="chart" xmlns="http://www.w3.org/2000/svg" aria-label="Stamina versus HP scatter"></svg>
    <div id="tblWrap">
      <table id="tbl">
        <thead>
          <tr>
            <th data-k="name" class="sort">Item</th>
            <th data-k="stamina" class="sort">STA</th>
            <th data-k="hp" class="sort">HP</th>
            <th data-k="hunger" class="sort">Hunger</th>
            <th data-k="thirst" class="sort">Thirst</th>
            <th data-k="statusNote" class="sort">Status / notes</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
  <p class="footer">Regenerate: <code>npm run gen:consumables-viz</code> from <code>web/</code> · Served as <code>/consumables-viz.html</code></p>
  <div id="tip" role="tooltip"></div>
  <script>
    window.__CONSUMABLES__ = ${dataJson};
  </script>
  <script>
(function () {
  var DATA = window.__CONSUMABLES__;
  var rows = DATA.rows;
  var maxSta = DATA.maxSta;
  var maxHp = DATA.maxHp;

  var svg = document.getElementById('chart');
  var tip = document.getElementById('tip');
  var btnTable = document.getElementById('btnTable');
  var tblWrap = document.getElementById('tblWrap');
  var tbody = document.querySelector('#tbl tbody');

  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function category(r) {
    var sta = r.stamina, hp = r.hp, th = r.thirst;
    if (sta <= 0 && hp <= 0 && th > 0) return 'thirst';
    if (th >= sta + hp && th > 0) return 'drink';
    if (sta >= 4 && hp >= 4) return 'both';
    return 'food';
  }

  function color(cat) {
    if (cat === 'thirst') return 'var(--ptThirst)';
    if (cat === 'drink') return 'var(--ptDrink)';
    if (cat === 'both') return 'var(--ptBoth)';
    return 'var(--ptFood)';
  }

  function render() {
    var w = svg.clientWidth || 800;
    var h = svg.clientHeight || 480;
    var padL = 52, padR = 24, padT = 24, padB = 48;
    var iw = w - padL - padR;
    var ih = h - padT - padB;

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

    var gGrid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(gGrid);

    var nx = Math.min(11, maxSta + 1);
    var ny = Math.min(14, maxHp + 1);
    for (var i = 0; i <= nx; i++) {
      var x = padL + (i / nx) * iw;
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x); line.setAttribute('x2', x);
      line.setAttribute('y1', padT); line.setAttribute('y2', padT + ih);
      line.setAttribute('stroke', 'var(--grid)');
      gGrid.appendChild(line);
    }
    for (var j = 0; j <= ny; j++) {
      var y = padT + ih - (j / ny) * ih;
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('y1', y); line.setAttribute('y2', y);
      line.setAttribute('x1', padL); line.setAttribute('x2', padL + iw);
      line.setAttribute('stroke', 'var(--grid)');
      gGrid.appendChild(line);
    }

    function xScale(sta) { return padL + (sta / maxSta) * iw; }
    function yScale(hp) { return padT + ih - (hp / maxHp) * ih; }

    var xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', padL); xAxis.setAttribute('x2', padL + iw);
    xAxis.setAttribute('y1', padT + ih); xAxis.setAttribute('y2', padT + ih);
    xAxis.setAttribute('stroke', 'var(--axis)');
    xAxis.setAttribute('stroke-width', '2');
    svg.appendChild(xAxis);

    var yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', padL); yAxis.setAttribute('x2', padL);
    yAxis.setAttribute('y1', padT); yAxis.setAttribute('y2', padT + ih);
    yAxis.setAttribute('stroke', 'var(--axis)');
    yAxis.setAttribute('stroke-width', '2');
    svg.appendChild(yAxis);

    var xl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xl.setAttribute('x', padL + iw / 2);
    xl.setAttribute('y', h - 12);
    xl.setAttribute('text-anchor', 'middle');
    xl.setAttribute('fill', 'var(--text1)');
    xl.setAttribute('font-family', 'var(--mono)');
    xl.setAttribute('font-size', '12');
    xl.textContent = 'Stamina +' + maxSta + ' →';
    svg.appendChild(xl);

    var yl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yl.setAttribute('x', 16);
    yl.setAttribute('y', padT + ih / 2);
    yl.setAttribute('transform', 'rotate(-90 ' + 16 + ' ' + (padT + ih / 2) + ')');
    yl.setAttribute('text-anchor', 'middle');
    yl.setAttribute('fill', 'var(--text1)');
    yl.setAttribute('font-family', 'var(--mono)');
    yl.setAttribute('font-size', '12');
    yl.textContent = 'HP +' + maxHp + ' →';
    svg.appendChild(yl);

    var gPts = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(gPts);

    rows.forEach(function (r) {
      var cat = category(r);
      var hx = hashStr(r.id);
      var jx = ((hx % 17) - 8) * 0.45;
      var jy = (((hx >>> 8) % 17) - 8) * 0.45;
      var cx = xScale(r.stamina) + jx;
      var cy = yScale(r.hp) + jy;
      var fill = r.hunger + r.thirst;
      var rad = 5 + Math.sqrt(Math.min(fill, 80)) * 0.55;

      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', cx);
      c.setAttribute('cy', cy);
      c.setAttribute('r', rad);
      c.setAttribute('fill', color(cat));
      c.setAttribute('stroke', 'rgba(0,0,0,0.35)');
      c.setAttribute('stroke-width', '1');
      c.style.cursor = 'default';
      c.addEventListener('mouseenter', function (ev) {
        tip.style.display = 'block';
        var ps = r.primaryStamina ? ' <span style="color:#9fd4ff">(stamina snack)</span>' : '';
        tip.innerHTML =
          '<strong>' + r.glyph + ' ' + r.name + '</strong>' + ps + '<br/>' +
          'STA +' + r.stamina + ' · HP +' + r.hp + '<br/>' +
          'Hunger +' + r.hunger + ' · Thirst +' + r.thirst + '<br/>' +
          (r.statusNote ? '<span style="color:#e8b88a">Risk: ' + r.statusNote + '</span>' : '');
        moveTip(ev);
      });
      c.addEventListener('mousemove', moveTip);
      c.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
      gPts.appendChild(c);

      if (rad < 14) {
        var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', cx);
        t.setAttribute('y', cy + 3);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-size', '9px');
        t.setAttribute('fill', 'rgba(255,255,255,0.85)');
        t.setAttribute('pointer-events', 'none');
        t.textContent = r.glyph;
        gPts.appendChild(t);
      }
    });
  }

  function moveTip(ev) {
    tip.style.left = (ev.clientX + 14) + 'px';
    tip.style.top = (ev.clientY + 14) + 'px';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function rowHtml(r) {
    var note = r.statusNote + (r.primaryStamina ? '; primaryStamina' : '');
    return (
      '<td>' + r.glyph + ' ' + escapeHtml(r.name) + '</td>' +
      '<td>' + r.stamina + '</td><td>' + r.hp + '</td><td>' + r.hunger + '</td><td>' + r.thirst + '</td>' +
      '<td>' + escapeHtml(note || '—') + '</td>'
    );
  }

  function fillTable(list) {
    tbody.innerHTML = '';
    list.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML = rowHtml(r);
      tbody.appendChild(tr);
    });
  }

  var sortKey = 'name';
  var sortDir = 1;
  function cmp(a, b) {
    var ka = sortKey;
    var va = a[ka];
    var vb = b[ka];
    if (typeof va === 'number' && typeof vb === 'number') return sortDir * (va - vb);
    return sortDir * String(va).localeCompare(String(vb));
  }

  function resort() {
    var list = rows.slice().sort(cmp);
    fillTable(list);
  }

  fillTable(rows.slice().sort(cmp));

  document.querySelectorAll('#tbl th.sort').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-k');
      if (k === sortKey) sortDir = -sortDir;
      else {
        sortKey = k;
        sortDir = k === 'name' || k === 'statusNote' ? 1 : -1;
      }
      resort();
    });
  });

  btnTable.addEventListener('click', function () {
    var open = tblWrap.classList.toggle('open');
    btnTable.textContent = open ? 'Hide table' : 'Show sortable table';
  });

  window.addEventListener('resize', function () { render(); });
  render();
})();
  </script>
</body>
</html>
`

fs.writeFileSync(outPath, html, 'utf8')
console.log('Wrote', outPath, '(' + rows.length + ' items)')
