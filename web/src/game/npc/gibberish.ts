import type { NpcLanguage } from '../types'

const COMBINING = [
  '\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0305', '\u0306', '\u0307', '\u0308',
  '\u0309', '\u030A', '\u030B', '\u030C', '\u0310', '\u0311', '\u0312', '\u0313', '\u0314',
  '\u0315', '\u031B', '\u0323', '\u0324', '\u0325', '\u0326', '\u0327', '\u0328', '\u0329',
  '\u0330', '\u0331', '\u0332', '\u0333', '\u0334', '\u0335', '\u0336', '\u0337', '\u0338',
  '\u0342', '\u0343', '\u0344',
]

/** Safe variants of “gnome” (diacritics on vowels, optional ñ). Exported for tests. */
export const GNOME_FORMS = [
  'gnome',
  'gn\u00f2me',
  'gn\u00f4me',
  'gnom\u00e9',
  'g\u00f1ome',
  'gn\u014dme',
  'gnom\u00e8',
  'gn\u00f3me',
  'gn\u00f6me',
  'gnom\u00eb',
  'gn\u00f5me',
  'gn\u00f4m\u00e8',
  'g\u00f1\u00f2me',
  'gn\u00f3m\u00eb',
  'gn\u014dm\u00e9',
  'gn\u00f2m\u00e9',
  'gn\u00f4m\u00e9',
  'g\u00f1om\u00eb',
  'gn\u00e8me',
  'gn\u00e9m\u00e8',
]

/**
 * Renders NPC dialog speech flavor. Does not encode English; quest meaning stays in mechanics.
 * @param _english Reserved for future phrasebook hooks; currently unused.
 * @param salt e.g. npc id so two NPCs on the same floor are not identical.
 */
export function toGibberish(lang: NpcLanguage, _english: string, seed: number, salt = ''): string {
  const base = mixSeed(seed >>> 0, salt)
  if (lang === 'Mojibake') return mojibakePhrase(mixSeed(base, '|mjb|'))
  if (lang === 'Zalgo') return zalgoPhrase(mixSeed(base, '|zlg|'))
  return deepGnomePhrase(mixSeed(base, '|dgn|'))
}

function deepGnomePhrase(subseed: number): string {
  const rnd = mul(subseed)
  const n = 4 + Math.floor(rnd() * 5)
  const tokens: string[] = []
  for (let i = 0; i < n; i++) {
    tokens.push(GNOME_FORMS[Math.floor(rnd() * GNOME_FORMS.length)]!)
  }
  return tokens.join(' ')
}

/** Longer fake words: UTF-8 bytes misread as single-byte Latin (mojibake look). */
function mojibakePhrase(subseed: number): string {
  const rnd = mul(subseed)
  const nWords = 2 + Math.floor(rnd() * 3)
  const parts: string[] = []
  const multibytePool = ['\u304b', '\u30af', '\u5b57', '\u03a9', '\u00ea', '\u00f1', '\u00df', '\u00b1', '\u00a7']
  for (let w = 0; w < nWords; w++) {
    const byteTarget = 12 + Math.floor(rnd() * 9)
    let s = ''
    while (new TextEncoder().encode(s).length < byteTarget) {
      if (rnd() < 0.4) s += multibytePool[Math.floor(rnd() * multibytePool.length)]!
      else s += String.fromCharCode(97 + Math.floor(rnd() * 26))
    }
    parts.push(utf8BytesAsLatin1String(new TextEncoder().encode(s)))
  }
  return parts.join(' ')
}

function utf8BytesAsLatin1String(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]!)
  return out
}

/** Shorter fake Latin words, then combining-mark clutter (zalgo look). */
function zalgoPhrase(subseed: number): string {
  const rnd = mul(subseed)
  const nWords = 2 + Math.floor(rnd() * 4)
  const words: string[] = []
  for (let i = 0; i < nWords; i++) {
    const len = 3 + Math.floor(rnd() * 5)
    let w = ''
    for (let j = 0; j < len; j++) w += String.fromCharCode(97 + Math.floor(rnd() * 26))
    words.push(zalgoLatinWord(w, rnd))
  }
  return words.join(' ')
}

function zalgoLatinWord(s: string, rnd: () => number): string {
  let out = ''
  for (const ch of s) {
    out += ch
    if (ch.trim().length === 0) continue
    const n = 1 + Math.floor(rnd() * 3)
    for (let i = 0; i < n; i++) out += COMBINING[Math.floor(rnd() * COMBINING.length)]!
  }
  return out
}

function mixSeed(seed: number, salt: string): number {
  let h = seed >>> 0
  for (let i = 0; i < salt.length; i++) {
    h = Math.imul(h ^ salt.charCodeAt(i)!, 0x9e3779b1) >>> 0
  }
  return h >>> 0
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
