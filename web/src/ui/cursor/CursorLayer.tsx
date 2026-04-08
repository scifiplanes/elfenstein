import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CursorContext } from './CursorContext'
import styles from './CursorLayer.module.css'
import type { GameState } from '../../game/types'
import type { ContentDB } from '../../game/content/contentDb'
import { shakeTransform } from '../feedback/shakeTransform'
import { findRecipe, recipeKey } from '../../game/content/recipes'

export function CursorLayer(props: { state: GameState; content: ContentDB }) {
  const api = useContext(CursorContext)
  const clickShakeRef = useRef<{ startedAtMs: number; untilMs: number } | null>(null)
  const prevIsPointerDown = useRef(false)
  const isPointerDown = api?.state.isPointerDown ?? false
  const [animNowMs, setAnimNowMs] = useState(() => performance.now())

  useEffect(() => {
    if (!api) return
    // Always hide the system cursor for the intended “hand cursor” feel.
    const prev = document.body.style.cursor
    document.body.style.cursor = 'none'
    return () => {
      document.body.style.cursor = prev
    }
  }, [api])

  useEffect(() => {
    if (!api) return
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
  }, [api])

  useEffect(() => {
    if (!api) return
    // Preload cursor sprites so state changes don’t hitch on image decode.
    const srcs = ['/content/Hand_Point.png', '/content/Hand_Hold.png', '/content/Hand_Active.png']
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
  }, [api])

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
  const isActive = !isHold && Boolean(hoverTarget) && hoverTarget?.kind !== 'floorDrop'

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

  const craftPreviewText = (() => {
    if (!craftReady) return null
    const k = recipeKey(craftReady.recipe.a, craftReady.recipe.b)
    const known = Boolean(props.state.ui.knownRecipes?.[k])
    if (!known) return '?'
    const def = props.content.item(craftReady.recipe.result)
    if (def?.icon?.kind === 'emoji') return def.icon.value
    return '?'
  })()

  const contextualAffordance =
    dragging?.started
      ? (() => {
          const item = props.state.party.items[dragging.payload.itemId]
          if (!item) return null
          const def = props.content.item(item.defId)

          if (craftReady) return { icon: '⚗', label: 'Craft' }

          if (hoverTarget?.kind === 'npc') {
            const isWeapon = def.tags.includes('weapon')
            return isWeapon ? { icon: '⚔', label: 'Attack' } : { icon: '🎁', label: 'Give' }
          }

          if (hoverTarget?.kind === 'poi') {
            const poi = props.state.floor.pois.find((p) => p.id === hoverTarget.poiId)
            if (!poi) return { icon: '✦', label: 'Use' }
            const hook = def.useOnPoi?.[poi.kind]
            if (hook?.transformTo) return { icon: '✦', label: 'Apply' }
            return { icon: '✦', label: 'Use' }
          }

          if (hoverTarget?.kind === 'portrait') {
            if (hoverTarget.target === 'eyes') return { icon: '👁', label: 'Inspect' }
            if (hoverTarget.target === 'mouth') return def.feed ? { icon: '👄', label: 'Feed' } : { icon: '👄', label: 'Offer' }
            if (hoverTarget.target === 'hat') return { icon: '🎩', label: 'Equip hat' }
            if (hoverTarget.target === 'hands') return { icon: '🤲', label: 'Equip hands' }
            return { icon: '👁', label: 'Inspect' }
          }

          return null
        })()
      : null

  const isHoveringValidTarget = Boolean(dragging?.started && (contextualAffordance ?? affordance))
  const ghostText = (() => {
    if (!ghost) return ''
    const item = props.state.party.items[ghost.itemId]
    const def = item ? props.content.item(item.defId) : null
    if (!def) return ghost.itemId
    return def.icon.kind === 'emoji' ? def.icon.value : def.name
  })()

  // HUD inventory DOM is opacity-0 (capture hit layer); name labels render here like affordance.
  const inventoryHoverName = (() => {
    if (dragging?.started) return null
    if (hoverTarget?.kind !== 'inventorySlot' || !hoverRect) return null
    const itemId = props.state.party.inventory.slots[hoverTarget.slotIndex]
    if (!itemId) return null
    const item = props.state.party.items[itemId]
    if (!item) return null
    const def = props.content.item(item.defId)
    return def?.name ?? null
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
  const handStateClass =
    craftReady && isHold
      ? craftFlickerIsHold ? styles.hold : styles.active
      : isHold ? styles.hold
      : isActive ? styles.active
      : styles.point

  return (
    api ? (
      <div className={styles.layer}>
        <div className={styles.handWrap} style={{ left: x, top: y, transform: handShakeTransform }}>
          <div className={`${styles.hand} ${handStateClass}`} />
        </div>
        {ghost ? (
          <div className={`${styles.ghost} ${isHoveringValidTarget ? styles.ghostShake : ''}`} style={{ left: x, top: y }}>
            {ghostText}
          </div>
        ) : null}
        {craftPreviewText ? (
          <div className={styles.craftPreview} style={{ left: x, top: y }}>
            {craftPreviewText}
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
        {inventoryHoverName && hoverRect ? (
          <div
            className={styles.itemNameTooltip}
            style={{
              left: (hoverRect.left + hoverRect.right) / 2,
              top: hoverRect.top,
            }}
          >
            {inventoryHoverName}
          </div>
        ) : null}
      </div>
    ) : null
  )
}

