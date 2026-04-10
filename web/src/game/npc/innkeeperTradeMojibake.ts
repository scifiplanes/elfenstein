import type { ItemDefId } from '../types'
import { mojibakeFakeWord, mojibakeFakeWords, mojibakeFromUtf8Text } from './gibberish'

function mix(seed: number, salt: string): number {
  let h = seed >>> 0
  for (let i = 0; i < salt.length; i++) {
    h = Math.imul(h ^ salt.charCodeAt(i)!, 0x9e3779b1) >>> 0
  }
  return h >>> 0
}

/**
 * Opening trade: one mojibake token per wanted **`ItemDefId`**
 * (same order as **They want** in `TradeModal`). Pure-ASCII names use a fake word seeded from id + label.
 * When there are no wants, a short single fake word is used instead.
 */
export function innkeeperSpeechWelcome(
  wants: readonly ItemDefId[],
  seed: number,
  itemDisplayName: (id: ItemDefId) => string,
): string {
  if (wants.length === 0) {
    const w = mojibakeFakeWords(2, mix(seed, '|wel0|'))
    return `${w[0]}.`
  }
  const garbled = wants.map((id, i) => {
    const name = itemDisplayName(id)
    const fromUtf8 = mojibakeFromUtf8Text(name)
    if (fromUtf8 !== name) return fromUtf8
    return mojibakeFakeWord(mix(mix(mix(seed, `|want${i}|`), id), name))
  })
  return `${garbled.join(', ')}.`
}

/** Player selected stock; offer slot empty. At most two mojibake “words”. */
export function innkeeperSpeechAskNoOffer(seed: number): string {
  const w = mojibakeFakeWords(2, mix(seed, '|ask0|'))
  const variant = seed % 3
  if (variant === 0) return w[0]!
  if (variant === 1) return `${w[0]} ${w[1]}`
  return `${w[0]}?`
}

/** Player selected stock while offer slot is filled. */
export function innkeeperSpeechAskWithOffer(seed: number): string {
  const w = mojibakeFakeWords(2, mix(seed, '|ask1|'))
  return seed % 2 === 0 ? `${w[0]} ${w[1]}` : `${w[0]}!`
}

/** Trade click: request only, no offer. */
export function innkeeperSpeechExecuteRequestOnly(seed: number): string {
  const w = mojibakeFakeWords(2, mix(seed, '|ex0|'))
  return seed % 2 === 0 ? `${w[0]}?` : `${w[0]} ${w[1]}`
}

/** Trade click: offer only (gift). */
export function innkeeperSpeechExecuteOfferGift(seed: number): string {
  const w = mojibakeFakeWords(2, mix(seed, '|ex1|'))
  return seed % 2 === 0 ? w[0]! : `${w[0]} ${w[1]}`
}

/** Trade click: full barter. */
export function innkeeperSpeechExecuteBarter(seed: number): string {
  const w = mojibakeFakeWords(2, mix(seed, '|ex2|'))
  return seed % 2 === 0 ? `${w[0]} ${w[1]}` : `${w[0]}…`
}
