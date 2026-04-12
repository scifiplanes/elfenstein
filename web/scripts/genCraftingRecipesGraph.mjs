import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')
const itemsPath = path.join(root, 'web', 'src', 'game', 'content', 'items.ts')
const recipesPath = path.join(root, 'web', 'src', 'game', 'content', 'recipes.ts')
const outPath = path.join(root, 'CraftingRecipesGraph.md')
const vizPath = path.join(root, 'web', 'public', 'crafting-graph.html')

const itemsSrc = fs.readFileSync(itemsPath, 'utf8')
const recipesSrc = fs.readFileSync(recipesPath, 'utf8')

const emojiById = {}
// Icon objects may include tintFilter / displayScale after value (same line or folded).
const itemRe = /id: '([^']+)'[^]*?icon: \{ kind: 'emoji', value: '([^']+)'[^}]*\}/g
let m
while ((m = itemRe.exec(itemsSrc)) !== null) {
  emojiById[m[1]] = m[2]
}

function e(id) {
  const x = emojiById[id]
  if (!x) throw new Error(`Missing emoji for ${id}`)
  return x
}

const arrMatch = recipesSrc.match(/export const ALL_RECIPES:\s*RecipeDef\[\]\s*=\s*\[/)
if (!arrMatch) throw new Error('Could not find ALL_RECIPES array')
const start = recipesSrc.indexOf('export const ALL_RECIPES')
const body = recipesSrc.slice(start)
const lines = body.split('\n')

let section = 'Core'
const recipes = []
for (const line of lines) {
  const com = line.match(/^\s*\/\/\s*(.+?)\s*$/)
  if (com) {
    section = com[1].replace(/\.$/, '').trim()
    continue
  }
  const rec = line.match(/a:\s*'([^']+)',\s*b:\s*'([^']+)',\s*result:\s*'([^']+)'/)
  if (rec) recipes.push({ a: rec[1], b: rec[2], result: rec[3], section })
}

const sectionDisplay = {
  Core: 'Base recipes',
  'Weapon/tool assembly': 'Weapon / tool assembly',
  'Remedies & cooking (edible so feed interactions work; some have extra cure logic)': 'Remedies & cooking',
  'Remedies & cooking (most remedies stay `feed` for portrait-mouth use; **Bandage strip** applies on portrait body instead)': 'Remedies & cooking',
  'Headwear (hat slot)': 'Headwear',
  'A few extra “breadth” combos (directional flavor, order-sensitive by design)': 'Breadth combos',
  'Content expansion: light, bio, food, tools': 'Light, bio, food, tools',
  'Alternates (new ingredient pairs → existing results)': 'Alternates',
  'Order-sensitive pairs (reverse order → different result)': 'Order-sensitive pairs',
  'Swarm tools (inventory craft; world capture onto Swarm remains separate)': 'Swarm tools',
}

function displayTitle(section) {
  return sectionDisplay[section] ?? section
}

function slug(s) {
  const key = displayTitle(s)
  return (
    'sec_' +
    key
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48)
  )
}

const bySection = new Map()
for (const r of recipes) {
  if (!bySection.has(r.section)) bySection.set(r.section, [])
  bySection.get(r.section).push(r)
}

const out = [
  '# Crafting recipes graph',
  '',
  'Emoji icons match [`web/src/game/content/items.ts`](web/src/game/content/items.ts). Drag source **A** onto target **B** (see [`web/src/game/content/recipes.ts`](web/src/game/content/recipes.ts)). Each link is labeled with **B**.',
  '',
  'Regenerate after editing recipes or item icons:',
  '',
  '```bash',
  'node web/scripts/genCraftingRecipesGraph.mjs',
  '```',
  '',
  '```mermaid',
  'flowchart LR',
]

for (const [sec, list] of bySection) {
  const id = slug(sec)
  const title = displayTitle(sec).replace(/"/g, "'")
  out.push(`  subgraph ${id}["${title}"]`)
  for (const r of list) {
    const ea = e(r.a)
    const eb = e(r.b)
    const er = e(r.result)
    out.push(`    ${r.a}["${ea}"] -->|"+ ${eb}"| ${r.result}["${er}"]`)
  }
  out.push('  end')
}

out.push('```', '')
fs.writeFileSync(outPath, out.join('\n'))
console.log('Wrote', outPath, 'recipes:', recipes.length, 'sections:', bySection.size)

// --- Interactive HTML (vis-network, data embedded; works from file:// or dev server)
const asIngredient = new Set()
const asResult = new Set()
for (const r of recipes) {
  asIngredient.add(r.a)
  asIngredient.add(r.b)
  asResult.add(r.result)
}
const nodeIds = new Set([...asIngredient, ...asResult])
const vizNodes = [...nodeIds].map((id) => {
  const emoji = emojiById[id] || '?'
  let group = 'both'
  if (!asResult.has(id)) group = 'raw'
  else if (!asIngredient.has(id)) group = 'product'
  return { id, label: emoji, title: id, group }
})
const vizEdges = recipes.map((r, i) => ({
  id: `r${i}`,
  from: r.a,
  to: r.result,
  label: `+ ${e(r.b)}`,
  title: `${r.a} + ${r.b} → ${r.result}\n${displayTitle(r.section)}`,
}))

const payload = { nodes: vizNodes, edges: vizEdges }
const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c')

const vizHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Crafting graph — Elfenstein</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Jim+Nightshade&display=swap" rel="stylesheet" />
  <script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
  <style>
    :root {
      --bg0: #0b0c10;
      --bg1: #10121a;
      --panel: rgba(18, 20, 28, 0.92);
      --panelBorder: rgba(171, 136, 107, 0.75);
      --text0: rgba(255, 255, 255, 0.92);
      --text1: rgba(255, 255, 255, 0.72);
      --muted: rgba(255, 255, 255, 0.5);
      --shadow: rgba(0, 0, 0, 0.55);
      --hudSlotBorder: rgba(171, 136, 107, 0.75);
      --hudStaminaFill: #d6bdb5;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      --title: 'Jim Nightshade', cursive;
      --titleShadow: 0 1px 3px rgba(0, 0, 0, 0.45), 0 0 12px rgba(0, 0, 0, 0.22);
      --nodeRawBg: #1a221c;
      --nodeRawBorder: #4d6048;
      --nodeBothBg: #161a22;
      --nodeBothBorder: rgba(171, 136, 107, 0.82);
      --nodeProductBg: #221a16;
      --nodeProductBorder: rgba(171, 136, 107, 0.95);
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
      text-rendering: geometricPrecision;
    }
    #bar {
      flex: 0 0 auto;
      margin: 12px 12px 0;
      padding: 14px 16px 16px;
      background: var(--panel);
      border: 2px solid var(--panelBorder);
      border-radius: 0;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65);
    }
    h1 {
      margin: 0 0 10px;
      font-family: var(--title);
      font-size: clamp(28px, 5vw, 37px);
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.2;
      color: var(--text0);
      text-shadow: var(--titleShadow);
    }
    .blurb {
      font-family: var(--title);
      font-size: 21px;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.45;
      color: var(--text1);
      text-shadow: var(--titleShadow);
      margin: 0 0 12px;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      margin: 0 0 10px;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--text1);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .legend span { display: inline-flex; align-items: center; gap: 8px; }
    .dot {
      width: 11px;
      height: 11px;
      border-radius: 0;
      border: 1px solid var(--hudSlotBorder);
      flex-shrink: 0;
    }
    .dot.raw { background: var(--nodeRawBg); }
    .dot.both { background: var(--nodeBothBg); }
    .dot.product { background: var(--nodeProductBg); }
    .footer {
      margin: 0;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }
    .footer code {
      font-size: 11px;
      padding: 3px 8px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text1);
    }
    .searchRow {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 12px;
      margin: 0 0 12px;
    }
    .searchRow label {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--text1);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    #itemSearch {
      flex: 1 1 200px;
      min-width: 0;
      max-width: 420px;
      padding: 10px 12px;
      font: 14px/1.3 var(--sans);
      color: var(--text0);
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(171, 136, 107, 0.45);
      border-radius: 0;
      outline: none;
    }
    #itemSearch::placeholder {
      color: var(--muted);
    }
    #itemSearch:focus {
      border-color: rgba(214, 189, 181, 0.65);
      box-shadow: 0 0 0 1px rgba(214, 189, 181, 0.25);
    }
    #focusMatches {
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 10px 14px;
      color: var(--text0);
      background: rgba(34, 26, 22, 0.95);
      border: 1px solid rgba(171, 136, 107, 0.65);
      border-radius: 0;
      cursor: pointer;
    }
    #focusMatches:hover {
      border-color: rgba(214, 189, 181, 0.85);
    }
    #focusMatches:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    #searchHint {
      flex: 1 1 100%;
      margin: 0;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      line-height: 1.45;
    }
    #graphWrap {
      flex: 1 1 auto;
      min-height: 0;
      margin: 12px;
      border: 2px solid var(--panelBorder);
      border-radius: 0;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
      background: rgba(12, 14, 18, 0.65);
    }
    #graph { width: 100%; height: 100%; min-height: 320px; }
  </style>
</head>
<body>
  <div id="bar">
    <h1>Crafting graph</h1>
    <p class="blurb">Each node is an item (hover for its id). Arrows show <strong style="color:var(--text0)">A → result</strong>; the edge label is slot <strong style="color:var(--text0)">B</strong> — drag source A onto B in the inventory.</p>
    <div class="legend">
      <span><i class="dot raw"></i> Raw — never crafted</span>
      <span><i class="dot both"></i> Intermediate</span>
      <span><i class="dot product"></i> Product — not an ingredient elsewhere</span>
    </div>
    <div class="searchRow">
      <label for="itemSearch">Find item</label>
      <input type="search" id="itemSearch" placeholder="Type item id (e.g. Spear, Waterbag)…" autocomplete="off" spellcheck="false" aria-describedby="searchHint" />
      <button type="button" id="focusMatches" disabled>Focus matches</button>
      <p id="searchHint">Matches item ids (case-insensitive). Enter or Focus zooms the graph to hits.</p>
    </div>
    <p class="footer">Regenerate: <code>node web/scripts/genCraftingRecipesGraph.mjs</code> · Served as <code>/crafting-graph.html</code></p>
  </div>
  <div id="graphWrap"><div id="graph"></div></div>
  <script type="application/json" id="crafting-data">${payloadJson}</script>
  <script>
    (function () {
      var data = JSON.parse(document.getElementById('crafting-data').textContent)
      var container = document.getElementById('graph')
      var nodes = new vis.DataSet(data.nodes)
      var edges = new vis.DataSet(data.edges)
      var searchInput = document.getElementById('itemSearch')
      var focusBtn = document.getElementById('focusMatches')
      var searchHint = document.getElementById('searchHint')
      var groupBg = { raw: '#1a221c', both: '#161a22', product: '#221a16' }
      var groupBorder = { raw: '#5a6e54', both: 'rgba(171, 136, 107, 0.82)', product: 'rgba(171, 136, 107, 0.95)' }
      var matchBorder = 'rgba(255, 220, 180, 0.95)'
      var borderHi = 'rgba(255, 200, 200, 0.45)'
      var net = new vis.Network(
        container,
        { nodes: nodes, edges: edges },
        {
          nodes: {
            shape: 'box',
            shapeProperties: { borderRadius: 0 },
            margin: 12,
            borderWidth: 2,
            font: { size: 24, color: 'rgba(255, 248, 240, 0.96)' },
            color: { highlight: { border: borderHi } },
          },
          edges: {
            arrows: { to: { enabled: true, scaleFactor: 0.55 } },
            font: {
              size: 12,
              color: 'rgba(255, 255, 255, 0.48)',
              strokeWidth: 0,
              align: 'middle',
              face: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
            },
            smooth: { type: 'continuous', roundness: 0.35 },
            color: { color: 'rgba(171, 136, 107, 0.42)', highlight: 'rgba(214, 189, 181, 0.75)' },
          },
          groups: {
            raw: {
              color: { background: '#1a221c', border: '#5a6e54' },
            },
            both: {
              color: { background: '#161a22', border: 'rgba(171, 136, 107, 0.82)' },
            },
            product: {
              color: { background: '#221a16', border: 'rgba(171, 136, 107, 0.95)' },
            },
          },
          physics: {
            enabled: true,
            barnesHut: { gravitationalConstant: -2600, centralGravity: 0.11, springLength: 145, springConstant: 0.032 },
            stabilization: { iterations: 220, updateInterval: 25 },
          },
          interaction: { hover: true, tooltipDelay: 120, zoomView: true, dragView: true },
        }
      )
      net.once('stabilizationIterationsDone', function () {
        net.setOptions({ physics: false })
      })

      function matchIdsForQuery(q) {
        var qq = (q || '').trim().toLowerCase()
        if (!qq) return []
        var out = []
        for (var i = 0; i < data.nodes.length; i++) {
          var n = data.nodes[i]
          if (n.id.toLowerCase().indexOf(qq) !== -1) out.push(n.id)
        }
        return out
      }

      function applySearchVisual(q) {
        var qq = (q || '').trim().toLowerCase()
        var upd = []
        if (!qq) {
          for (var i = 0; i < data.nodes.length; i++) {
            var bn = data.nodes[i]
            var bg0 = groupBg[bn.group] || groupBg.both
            var br0 = groupBorder[bn.group] || groupBorder.both
            upd.push({
              id: bn.id,
              label: bn.label,
              title: bn.title,
              group: bn.group,
              opacity: 1,
              borderWidth: 2,
              color: { background: bg0, border: br0 },
            })
          }
          nodes.update(upd)
          return
        }
        for (var j = 0; j < data.nodes.length; j++) {
          var n = data.nodes[j]
          var hit = n.id.toLowerCase().indexOf(qq) !== -1
          var bg = groupBg[n.group] || groupBg.both
          var br = groupBorder[n.group] || groupBorder.both
          upd.push({
            id: n.id,
            label: n.label,
            title: n.title,
            group: n.group,
            opacity: hit ? 1 : 0.22,
            borderWidth: hit ? 3 : 2,
            color: { background: bg, border: hit ? matchBorder : br },
          })
        }
        nodes.update(upd)
      }

      function refreshSearchUi() {
        var q = searchInput.value
        var mids = matchIdsForQuery(q)
        var hasQ = q.trim().length > 0
        focusBtn.disabled = !hasQ || mids.length === 0
        if (!hasQ) {
          searchHint.textContent = 'Matches item ids (case-insensitive). Enter or Focus zooms the graph to hits.'
        } else if (mids.length === 0) {
          searchHint.textContent = 'No item ids contain “' + q.trim() + '”.'
        } else {
          searchHint.textContent = mids.length + ' match' + (mids.length === 1 ? '' : 'es') + ' · Enter or Focus to zoom'
        }
      }

      function focusMatches() {
        var mids = matchIdsForQuery(searchInput.value)
        if (mids.length === 0) return
        net.fit({
          nodes: mids,
          animation: { duration: 350, easingFunction: 'easeInOutQuad' },
        })
      }

      searchInput.addEventListener('input', function () {
        applySearchVisual(searchInput.value)
        refreshSearchUi()
      })
      searchInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault()
          focusMatches()
        }
      })
      focusBtn.addEventListener('click', focusMatches)
      refreshSearchUi()
    })()
  </script>
</body>
</html>
`

fs.mkdirSync(path.dirname(vizPath), { recursive: true })
fs.writeFileSync(vizPath, vizHtml)
console.log('Wrote', vizPath)
