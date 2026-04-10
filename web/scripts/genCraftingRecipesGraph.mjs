import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')
const itemsPath = path.join(root, 'web', 'src', 'game', 'content', 'items.ts')
const recipesPath = path.join(root, 'web', 'src', 'game', 'content', 'recipes.ts')
const outPath = path.join(root, 'CraftingRecipesGraph.md')

const itemsSrc = fs.readFileSync(itemsPath, 'utf8')
const recipesSrc = fs.readFileSync(recipesPath, 'utf8')

const emojiById = {}
const itemRe = /id: '([^']+)'[^]*?icon: \{ kind: 'emoji', value: '([^']+)' \}/g
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
