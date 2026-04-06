import type { NpcLanguage } from '../types'

const COMBINING = [
  '\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0305', '\u0306', '\u0307', '\u0308',
  '\u0309', '\u030A', '\u030B', '\u030C', '\u0310', '\u0311', '\u0312', '\u0313', '\u0314',
  '\u0315', '\u031B', '\u0323', '\u0324', '\u0325', '\u0326', '\u0327', '\u0328', '\u0329',
  '\u0330', '\u0331', '\u0332', '\u0333', '\u0334', '\u0335', '\u0336', '\u0337', '\u0338',
  '\u0342', '\u0343', '\u0344',
]

export function toGibberish(lang: NpcLanguage, english: string, seed: number) {
  if (lang === 'Mojibake') return mojibake(english)
  if (lang === 'Zalgo') return zalgo(english, seed)
  return deepGnome(english, seed)
}

function mojibake(s: string) {
  // Deterministic “broken encoding”-like look.
  return s
    .replaceAll('a', 'Ã¤')
    .replaceAll('e', 'Ã«')
    .replaceAll('i', 'Ã¯')
    .replaceAll('o', 'Ã¶')
    .replaceAll('u', 'Ã¼')
    .replaceAll('A', 'Ã„')
    .replaceAll('E', 'Ã‹')
    .replaceAll('I', 'Ã�')
    .replaceAll('O', 'Ã–')
    .replaceAll('U', 'Ãœ')
}

function zalgo(s: string, seed: number) {
  const rnd = mul(seed)
  let out = ''
  for (const ch of s) {
    out += ch
    if (ch.trim().length === 0) continue
    const n = 1 + Math.floor(rnd() * 3)
    for (let i = 0; i < n; i++) out += COMBINING[Math.floor(rnd() * COMBINING.length)]
  }
  return out
}

function deepGnome(s: string, seed: number) {
  const rnd = mul(seed)
  const syl = ['gr', 'gn', 'br', 'kr', 'zh', 'uk', 'ak', 'th', 'sk', 'dr', 'um', 'ig']
  const words = s.split(/\s+/).filter(Boolean)
  return words
    .map((w) => {
      const core = w.replace(/[^a-z]/gi, '').toLowerCase()
      const n = Math.max(2, Math.min(5, Math.round(core.length / 2)))
      let o = ''
      for (let i = 0; i < n; i++) o += syl[Math.floor(rnd() * syl.length)]
      return o
    })
    .join(' ')
}

function mul(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

