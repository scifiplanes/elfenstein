import { describe, expect, it } from 'vitest'
import { ContentDB } from '../content/contentDb'
import { makeInitialState } from './initialState'
import { PORTRAIT_TOAST_QUEUE_CAP, pushPortraitToast } from './portraitToasts'

const CONTENT = ContentDB.createDefault()

describe('portraitToasts', () => {
  it('queues more than three rows for one character', () => {
    let s = makeInitialState(CONTENT)
    const cid = s.party.chars[0]!.id
    for (let i = 0; i < 6; i++) {
      s = pushPortraitToast(s, { characterId: cid, kind: 'status', text: `line${i}` })
    }
    const forChar = (s.ui.portraitToasts ?? []).filter((t) => t.characterId === cid)
    expect(forChar).toHaveLength(6)
    expect(forChar.map((t) => t.text)).toEqual(['line0', 'line1', 'line2', 'line3', 'line4', 'line5'])
  })

  it('drops oldest rows when exceeding queue cap', () => {
    let s = makeInitialState(CONTENT)
    const cid = s.party.chars[0]!.id
    const n = PORTRAIT_TOAST_QUEUE_CAP + 5
    for (let i = 0; i < n; i++) {
      s = pushPortraitToast(s, { characterId: cid, kind: 'statDelta', text: `m${i}` })
    }
    expect(s.ui.portraitToasts).toHaveLength(PORTRAIT_TOAST_QUEUE_CAP)
    expect(s.ui.portraitToasts?.[0]?.text).toBe(`m${5}`)
    expect(s.ui.portraitToasts?.at(-1)?.text).toBe(`m${n - 1}`)
  })
})
