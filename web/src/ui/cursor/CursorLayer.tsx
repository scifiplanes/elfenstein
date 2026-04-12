import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CursorContext } from './CursorContext'
import styles from './CursorLayer.module.css'
import type { GameState } from '../../game/types'
import type { ContentDB } from '../../game/content/contentDb'
import { shakeTransform } from '../feedback/shakeTransform'
import { CURSOR_HAND_ACTIVE_SELECTOR } from './cursorHandActiveAttr'
import { findRecipe, recipeKey } from '../../game/content/recipes'
import { currentTurn } from '../../game/state/combat'
import { resolveWeaponItemIdForPcTurn } from '../../game/state/equipment'
import { tradeStockRows } from '../../game/state/trade'
import { ItemEmoji } from '../item/ItemEmoji'
import { isBobrIntroActive } from '../../game/bobrIntroMs'
import { canItemBreakOpenDoor } from '../../game/state/openDoorDestroy'

export function CursorLayer(props: { state: GameState; content: ContentDB }) {
  const api = useContext(CursorContext)
  const bobrIntroActive = isBobrIntroActive(props.state)
  const clickShakeRef = useRef<{ startedAtMs: number; untilMs: number } | null>(null)
  const prevIsPointerDown = useRef(false)
  const isPointerDown = api?.state.isPointerDown ?? false
  const [animNowMs, setAnimNowMs] = useState(() => performance.now())

  useEffect(() => {
    if (!api) return
    const prev = document.body.style.cursor
    // Bobr cutscene: `CursorLayer` stacks above the portaled intro — show the OS cursor and hide the hand.
    document.body.style.cursor = bobrIntroActive ? '' : 'none'
    return () => {
      document.body.style.cursor = prev
    }
  }, [api, bobrIntroActive])

  useEffect(() => {
    if (!api || bobrIntroActive) return
    let raf = 0
    let mounted = true
    const tick = () => {
      if (!mounted) return
      setAnimNowMs(performance.now())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      mounted = false
      cancelAnimationFrame(raf)
    }
  }, [api, bobrIntroActive])

  useEffect(() => {
    if (!api || bobrIntroActive) return
    // Preload cursor sprites so state changes don’t hitch on image decode.
    const srcs = [
      '/content/Hand_Point.png',
      '/content/Hand_Hold.png',
      '/content/Hand_Active.png',
      '/content/hand_attack_01.png',
      '/content/hand_attack_02.png',
      '/content/Hand_trade_01.png',
      '/content/Hand_trade_02.png',
    ]
    const imgs = srcs.map((src) => {
      const img = new Image()
      img.decoding = 'async'
      img.src = src
      return img
    })
    return () => {
      // Keep GC-able references only; no listeners attached.
      void imgs
    }
  }, [api, bobrIntroActive])

  useEffect(() => {
    const prev = prevIsPointerDown.current
    prevIsPointerDown.current = isPointerDown
    if (prev || !isPointerDown) return

    const t = props.state.render
    if (!(t.cursorClickShakeEnabled > 0)) return
    const now = props.state.nowMs
    const untilMs = now + Math.max(0, t.cursorClickShakeLengthMs) + Math.max(0, t.cursorClickShakeDecayMs)
    clickShakeRef.current = { startedAtMs: now, untilMs }
  }, [isPointerDown, props.state.nowMs, props.state.render])

  const pointer = api?.state.pointer ?? { x: 0, y: 0 }
  const dragging = api?.state.dragging ?? null
  const affordance = api?.state.affordance ?? null
  const hoverRect = api?.state.hoverRect ?? null
  const hoverTarget = api?.state.hoverTarget ?? null

  const x = pointer.x
  const y = pointer.y

  const craftReady = (() => {
    if (!dragging?.started) return null
    if (dragging.payload.source.kind !== 'inventorySlot') return null
    if (hoverTarget?.kind !== 'inventorySlot') return null
    const srcSlot = dragging.payload.source.slotIndex
    const dstSlot = hoverTarget.slotIndex
    if (srcSlot === dstSlot) return null
    const srcItemId = props.state.party.inventory.slots[srcSlot]
    const dstItemId = props.state.party.inventory.slots[dstSlot]
    if (!srcItemId || !dstItemId) return null
    const srcItem = props.state.party.items[srcItemId]
    const dstItem = props.state.party.items[dstItemId]
    if (!srcItem || !dstItem) return null
    const recipe = findRecipe(srcItem.defId, dstItem.defId)
    if (!recipe) return null
    return { recipe }
  })()

  const isHold = Boolean(dragging?.started || isPointerDown)
  const handActiveChrome =
    typeof document !== 'undefined' && document.elementFromPoint(x, y)?.closest?.(CURSOR_HAND_ACTIVE_SELECTOR)
  const isActive =
    !isHold &&
    ((Boolean(hoverTarget) && hoverTarget?.kind !== 'floorDrop') || Boolean(handActiveChrome))

  const ghost =
    dragging?.started && dragging.payload
      ? { itemId: dragging.payload.itemId }
      : null

  const crafting = props.state.ui.crafting ?? null
  const craftProgress =
    crafting ? Math.max(0, Math.min(1, (props.state.nowMs - crafting.startedAtMs) / Math.max(1, crafting.endsAtMs - crafting.startedAtMs))) : 0

  const craftingAnchorRect = (() => {
    if (!crafting) return null
    const idx = crafting.dstSlotIndex
    if (idx == null) return null
    const el = document.querySelector(`[data-drop-kind="inventorySlot"][data-drop-slot-index="${idx}"]`) as HTMLElement | null
    return el ? el.getBoundingClientRect() : null
  })()

  const craftPreviewGlyph = (() => {
    if (!craftReady) return null
    const k = recipeKey(craftReady.recipe.a, craftReady.recipe.b)
    const known = Boolean(props.state.ui.knownRecipes?.[k])
    if (!known) return null
    const def = props.content.item(craftReady.recipe.result)
    if (def.icon.kind === 'emoji') return def.icon
    return null
  })()

  const contextualAffordance =
    dragging?.started
      ? (() => {
          const item = props.state.party.items[dragging.payload.itemId]
          if (!item) return null
          const def = props.content.item(item.defId)

          if (craftReady) {
            if (props.state.combat) return { icon: '…', label: 'Blocked' }
            return { icon: '⚗', label: 'Craft' }
          }

          if (hoverTarget?.kind === 'npc') {
            const isWeapon = def.tags.includes('weapon')
            if (props.state.combat) {
              const turn = currentTurn(props.state)
              if (!turn || turn.kind !== 'pc') return { icon: '…', label: 'Wait' }
            }
            return isWeapon ? { icon: '⚔', label: 'Attack' } : { icon: '🎁', label: 'Give' }
          }

          if (hoverTarget?.kind === 'poi') {
            const poi = props.state.floor.pois.find((p) => p.id === hoverTarget.poiId)
            if (!poi) return { icon: '✦', label: 'Use' }
            const hook = def.useOnPoi?.[poi.kind]
            if (hook?.transformTo) return { icon: '✦', label: 'Apply' }
            return { icon: '✦', label: 'Use' }
          }

          if (hoverTarget?.kind === 'openDoor') {
            if (props.state.combat) return { icon: '…', label: 'Blocked' }
            return canItemBreakOpenDoor(props.content, def.id)
              ? { icon: '⚒', label: 'Break' }
              : { icon: '…', label: 'Blocked' }
          }

          if (hoverTarget?.kind === 'portrait') {
            if (hoverTarget.target === 'eyes') return { icon: '👁', label: 'Inspect' }
            if (hoverTarget.target === 'mouth') return def.feed ? { icon: '👄', label: 'Feed' } : { icon: '👄', label: 'Offer' }
            if (hoverTarget.target === 'body')
              return def.id === 'BandageStrip' ? { icon: '🩹', label: 'Apply' } : { icon: '…', label: 'Blocked' }
            if (hoverTarget.target === 'hat') return { icon: '🎩', label: 'Equip hat' }
            if (hoverTarget.target === 'hands') return { icon: '🤲', label: 'Equip hands' }
            return { icon: '👁', label: 'Inspect' }
          }

          return null
        })()
      : null

  const combatAttackHover =
    props.state.combat &&
    hoverTarget?.kind === 'npc' &&
    (() => {
      const turn = currentTurn(props.state)
      if (!turn || turn.kind !== 'pc') return false
      const npc = props.state.floor.npcs.find((n) => n.id === hoverTarget.npcId)
      if (!npc || npc.hp <= 0) return false
      if (!props.state.combat!.participants.npcs.includes(npc.id)) return false
      return Boolean(resolveWeaponItemIdForPcTurn(props.state, turn.id, props.content))
    })()

  const useAttackHand =
    contextualAffordance?.label === 'Attack' || Boolean(combatAttackHover && !dragging?.started)

  const hubTradeHover =
    props.state.ui.screen === 'hub' &&
    props.state.ui.hubScene === 'tavern' &&
    hoverTarget?.kind === 'hubInnkeeperTrade' &&
    !dragging?.started

  const useTradeHand = Boolean(hubTradeHover)

  const isHoveringValidTarget = Boolean(dragging?.started && (contextualAffordance ?? affordance))
  const ghostContent = (() => {
    if (!ghost) return null
    const item = props.state.party.items[ghost.itemId]
    const def = item ? props.content.item(item.defId) : null
    if (!def) return ghost.itemId
    if (def.icon.kind === 'emoji') return <ItemEmoji icon={def.icon} />
    return def.name
  })()

  // HUD inventory DOM is opacity-0 (capture hit layer); name labels render here like affordance.
  const itemNameTooltipHover = (() => {
    if (dragging?.started) return null
    if (!hoverRect || !hoverTarget) return null
    if (hoverTarget.kind === 'inventorySlot') {
      const itemId = props.state.party.inventory.slots[hoverTarget.slotIndex]
      if (!itemId) return null
      const item = props.state.party.items[itemId]
      if (!item) return null
      const def = props.content.item(item.defId)
      return def?.name ?? null
    }
    if (hoverTarget.kind === 'tradeStockSlot') {
      const ts = props.state.ui.tradeSession
      if (!ts) return null
      const rows = tradeStockRows(props.state, ts)
      const row = rows[hoverTarget.stockIndex]
      if (!row || row.qty < 1) return null
      const def = props.content.item(row.defId)
      return def?.name ?? null
    }
    if (hoverTarget.kind === 'tradeOfferSlot') {
      const ts = props.state.ui.tradeSession
      const offerId = ts?.offerItemId
      if (!offerId) return null
      const item = props.state.party.items[offerId]
      if (!item) return null
      const def = props.content.item(item.defId)
      return def?.name ?? null
    }
    return null
  })()

  const handShakeTransform = useMemo(() => {
    if (!api) return undefined
    const clickShake = clickShakeRef.current
    if (!clickShake) return undefined
    const t = props.state.render
    if (!(t.cursorClickShakeEnabled > 0)) return undefined
    if (props.state.nowMs > clickShake.untilMs) return undefined
    return shakeTransform(
      props.state.nowMs,
      clickShake.startedAtMs,
      clickShake.untilMs,
      t.cursorClickShakeMagnitude,
      t.cursorClickShakeLengthMs,
      t.cursorClickShakeDecayMs,
      t.cursorClickShakeHz,
    )
  }, [api, props.state.nowMs, props.state.render])

  const craftFlickerIsHold = Boolean(craftReady) && (Math.floor(animNowMs / 400) % 2 === 0)
  const attackHandClass = Math.floor(animNowMs / 280) % 2 === 0 ? styles.attack1 : styles.attack2
  const tradeHandClass = Math.floor(animNowMs / 280) % 2 === 0 ? styles.trade1 : styles.trade2
  const handStateClass = useTradeHand
    ? tradeHandClass
    : useAttackHand
      ? attackHandClass
      : craftReady && isHold
      ? craftFlickerIsHold ? styles.hold : styles.active
      : isHold ? styles.hold
      : isActive ? styles.active
      : styles.point

  return (
    api && !bobrIntroActive ? (
      <div className={styles.layer}>
        <div className={styles.handWrap} style={{ left: x, top: y, transform: handShakeTransform }}>
          <div className={`${styles.hand} ${handStateClass}`} />
        </div>
        {ghost ? (
          <div className={`${styles.ghost} ${isHoveringValidTarget ? styles.ghostShake : ''}`} style={{ left: x, top: y }}>
            {ghostContent}
          </div>
        ) : null}
        {craftPreviewGlyph ? (
          <div className={styles.craftPreview} style={{ left: x, top: y }}>
            <ItemEmoji icon={craftPreviewGlyph} />
          </div>
        ) : craftReady ? (
          <div className={styles.craftPreview} style={{ left: x, top: y }}>
            ?
          </div>
        ) : null}
        {crafting ? (
          <div
            className={styles.craft}
            style={{
              left: craftingAnchorRect ? craftingAnchorRect.right : x,
              top: craftingAnchorRect ? (craftingAnchorRect.top + craftingAnchorRect.bottom) / 2 : y,
            }}
          >
            <div className={styles.craftFill} style={{ width: `${Math.round(craftProgress * 100)}%` }} />
          </div>
        ) : null}
        {dragging?.started && (contextualAffordance ?? affordance) && hoverRect ? (
          <div
            className={styles.affordance}
            style={{
              left: (hoverRect.left + hoverRect.right) / 2,
              top: hoverRect.top,
            }}
          >
            <span aria-hidden="true">{(contextualAffordance ?? affordance)!.icon}</span>
            <span>{(contextualAffordance ?? affordance)!.label}</span>
          </div>
        ) : null}
        {itemNameTooltipHover && hoverRect ? (
          <div
            className={styles.itemNameTooltip}
            style={{
              left: (hoverRect.left + hoverRect.right) / 2,
              top: hoverRect.top,
            }}
          >
            {itemNameTooltipHover}
          </div>
        ) : null}
      </div>
    ) : null
  )
}


