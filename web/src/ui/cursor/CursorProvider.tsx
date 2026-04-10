import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragPayload, DragTarget } from '../../game/types'
import { CursorContext, type CursorApi, type CursorState } from './CursorContext'
import { MODAL_CHROME_HIT_ATTR } from './modalChromeActivate'
import { hubTavernTradeHoverRectRef } from '../hub/hubTavernTradeCursorRect'

function parseTargetFromEl(el: Element | null): DragTarget | null {
  const node = el?.closest?.('[data-drop-kind]') as HTMLElement | null
  if (!node) return null
  const kind = node.dataset.dropKind
  if (!kind) return null

  if (kind === 'inventorySlot') return { kind: 'inventorySlot', slotIndex: Number(node.dataset.dropSlotIndex ?? '-1') }
  if (kind === 'floorDrop') return { kind: 'floorDrop' }
  if (kind === 'floorItem') return { kind: 'floorItem', itemId: String(node.dataset.dropItemId ?? '') }
  if (kind === 'poi') return { kind: 'poi', poiId: String(node.dataset.dropPoiId ?? '') }
  if (kind === 'npc') return { kind: 'npc', npcId: String(node.dataset.dropNpcId ?? '') }
  if (kind === 'portrait') {
    const raw = String(node.dataset.dropPortraitTarget ?? 'eyes')
    const target =
      raw === 'eyes' || raw === 'mouth' || raw === 'hat' || raw === 'hands' ? raw : 'eyes'
    return { kind: 'portrait', characterId: String(node.dataset.dropCharacterId ?? ''), target }
  }
  if (kind === 'equipmentSlot') return { kind: 'equipmentSlot', characterId: String(node.dataset.dropCharacterId ?? ''), slot: String(node.dataset.dropEquipSlot ?? '') as any }
  if (kind === 'tradeOfferSlot') return { kind: 'tradeOfferSlot' }
  if (kind === 'tradeStockSlot')
    return { kind: 'tradeStockSlot', stockIndex: Number(node.dataset.tradeStockIndex ?? '-1') }
  if (kind === 'hubInnkeeperTrade') return { kind: 'hubInnkeeperTrade' }
  return null
}

/** Walk top-to-bottom so opacity-0 portaled modals still resolve drop targets / etc. */
function hitTestDropTargetAtPoint(
  x: number,
  y: number,
): { target: DragTarget; rect: { left: number; top: number; right: number; bottom: number } } | null {
  if (typeof document === 'undefined' || !document.elementsFromPoint) return null
  for (const raw of document.elementsFromPoint(x, y)) {
    const node = raw instanceof Element ? (raw.closest('[data-drop-kind]') as HTMLElement | null) : null
    if (!node) continue
    const target = parseTargetFromEl(node)
    if (!target) continue
    const r = node.getBoundingClientRect()
    return { target, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }
  }
  return null
}

function affordanceForTarget(target: DragTarget | null): CursorState['affordance'] {
  if (!target) return null
  switch (target.kind) {
    case 'inventorySlot':
      return { icon: '↔', label: 'Stow' }
    case 'floorDrop':
      return { icon: '⬇', label: 'Drop' }
    case 'floorItem':
      return { icon: '✋', label: 'Pick up' }
    case 'portrait':
      if (target.target === 'eyes') return { icon: '👁', label: 'Inspect' }
      if (target.target === 'mouth') return { icon: '👄', label: 'Feed' }
      if (target.target === 'hat') return { icon: '🎩', label: 'Equip hat' }
      if (target.target === 'hands') return { icon: '🤲', label: 'Equip hands' }
      return { icon: '👁', label: 'Inspect' }
    case 'poi':
      return { icon: '✦', label: 'Use' }
    case 'npc':
      return { icon: '⚔', label: 'Use' }
    case 'equipmentSlot':
      return { icon: '⛭', label: 'Equip' }
    case 'stowEquipped':
      return { icon: '↔', label: 'Stow' }
    case 'tradeOfferSlot':
      return { icon: '🤝', label: 'Offer' }
    case 'tradeStockSlot':
      return null
    case 'hubInnkeeperTrade':
      return null
    default:
      return null
  }
}

export function CursorProvider(props: PropsWithChildren) {
  const holdTimer = useRef<number | null>(null)
  const pendingPayload = useRef<DragPayload | null>(null)
  const virtualHover = useRef<{ target: DragTarget | null; rect: CursorState['hoverRect'] } | null>(null)
  const capture = useRef<{ el: Element; pointerId: number } | null>(null)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  /** Mirrors “drag promoted” synchronously so `pointerup` handlers don’t read a stale `state.dragging.started`. */
  const dragPromotedRef = useRef(false)

  // Drag should start on normal click-drag, not only after a hold delay.
  // Use a small movement threshold to avoid treating simple clicks as drags.
  const DRAG_START_PX = 8

  const [state, setState] = useState<CursorState>(() => ({
    pointer: { x: 0, y: 0 },
    isPointerDown: false,
    dragging: null,
    hoverTarget: null,
    hoverRect: null,
    affordance: null,
  }))

  const clearHoldTimer = useCallback(() => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const beginPointerDown = useCallback((payload: DragPayload, e: React.PointerEvent) => {
    // Prevent default browser behaviors (text selection, scroll/pan gestures, etc.)
    // from cancelling the pointer stream before our hold-to-drag timer fires.
    e.preventDefault()
    e.stopPropagation()
    clearHoldTimer()
    dragPromotedRef.current = false
    pendingPayload.current = payload
    const { clientX: x, clientY: y } = e
    dragStartPos.current = { x, y }
    try {
      // Ensure `pointerup` comes back to the drag origin even if we drag over other UI/canvas.
      if (e.currentTarget && 'setPointerCapture' in e.currentTarget) {
        ;(e.currentTarget as Element as any).setPointerCapture?.(e.pointerId)
        capture.current = { el: e.currentTarget as unknown as Element, pointerId: e.pointerId }
      }
    } catch {
      // Best-effort only; we also handle pointer cancel / focus loss elsewhere.
      capture.current = null
    }
    setState((s) => ({ ...s, pointer: { x, y }, isPointerDown: true, dragging: { payload, started: false } }))
    holdTimer.current = window.setTimeout(() => {
      dragPromotedRef.current = true
      setState((s) => (s.dragging ? { ...s, dragging: { ...s.dragging, started: true } } : s))
    }, 140)
  }, [clearHoldTimer])

  const applyPointerMove = useCallback((clientX: number, clientY: number) => {
    const x = clientX
    const y = clientY

    const tr = hubTavernTradeHoverRectRef.current
    if (tr && x >= tr.left && x <= tr.right && y >= tr.top && y <= tr.bottom) {
      virtualHover.current = {
        target: { kind: 'hubInnkeeperTrade' },
        rect: { left: tr.left, top: tr.top, right: tr.right, bottom: tr.bottom },
      }
    }

    // Promote drag on movement using refs + pending payload, not React state from the closure.
    // `beginPointerDown` sets those synchronously, but `dragging` in state may not have committed
    // yet on the first moves — reading `state.isPointerDown` here skipped the threshold and forced
    // the 140ms hold timer (felt laggy; trade/stock could fail after one interaction).
    const start = dragStartPos.current
    const pending = pendingPayload.current
    let promotedByMove = false
    if (pending && !dragPromotedRef.current && start) {
      const dx = x - start.x
      const dy = y - start.y
      if (dx * dx + dy * dy >= DRAG_START_PX * DRAG_START_PX) {
        clearHoldTimer()
        dragPromotedRef.current = true
        promotedByMove = true
      }
    }

    const hit = hitTestDropTargetAtPoint(x, y)
    const domTarget = hit?.target ?? null
    const domRect = hit?.rect ?? null
    const v = virtualHover.current
    // Treat virtual hover as a one-move override. This prevents the viewport's
    // `floorDrop` hover from "leaking" into UI hover when the pointer leaves the WebGL canvas.
    if (v) virtualHover.current = null
    const target = v?.target ?? domTarget
    const rect = v?.rect ?? domRect
    setState((s) => {
      let next = s
      if (promotedByMove) {
        const p = pendingPayload.current
        if (s.dragging && !s.dragging.started) {
          next = { ...s, dragging: { ...s.dragging, started: true } }
        } else if (!s.dragging && p) {
          next = { ...s, isPointerDown: true, dragging: { payload: p, started: true } }
        }
      }
      return {
        ...next,
        pointer: { x, y },
        hoverTarget: target,
        hoverRect: rect,
        affordance: next.dragging?.started ? affordanceForTarget(target) : null,
      }
    })
  }, [clearHoldTimer])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      applyPointerMove(e.clientX, e.clientY)
    },
    [applyPointerMove],
  )

  useEffect(() => {
    const onWinMove = (e: PointerEvent) => {
      applyPointerMove(e.clientX, e.clientY)
    }
    window.addEventListener('pointermove', onWinMove, { passive: true })
    return () => window.removeEventListener('pointermove', onWinMove)
  }, [applyPointerMove])

  const cancelDrag = useCallback(() => {
    clearHoldTimer()
    dragPromotedRef.current = false
    pendingPayload.current = null
    virtualHover.current = null
    dragStartPos.current = null
    try {
      const c = capture.current
      if (c?.el && 'releasePointerCapture' in c.el) {
        ;(c.el as any).releasePointerCapture?.(c.pointerId)
      }
    } catch {
      // ignore
    } finally {
      capture.current = null
    }
    setState((s) => ({ ...s, isPointerDown: false, dragging: null, affordance: null, hoverTarget: null, hoverRect: null }))
  }, [clearHoldTimer])

  const setVirtualHover = useCallback((target: DragTarget | null, rect: CursorState['hoverRect']) => {
    virtualHover.current = { target, rect }
    setState((s) => ({
      ...s,
      hoverTarget: target,
      hoverRect: rect,
      affordance: s.dragging?.started ? affordanceForTarget(target) : null,
    }))
  }, [])

  const endPointerUp = useCallback((e: React.PointerEvent) => {
    clearHoldTimer()
    const promotedToDrag = dragPromotedRef.current
    dragPromotedRef.current = false
    const { clientX: x, clientY: y } = e
    const v = virtualHover.current
    const hit = hitTestDropTargetAtPoint(x, y)
    let target = v?.target ?? hit?.target ?? null
    virtualHover.current = null
    const payload = pendingPayload.current
    pendingPayload.current = null
    dragStartPos.current = null
    try {
      const c = capture.current
      if (c?.el && 'releasePointerCapture' in c.el) {
        ;(c.el as any).releasePointerCapture?.(c.pointerId)
      }
    } catch {
      // ignore
    } finally {
      capture.current = null
    }

    if (
      !target &&
      payload &&
      promotedToDrag &&
      payload.source.kind === 'equipmentSlot' &&
      payload.source.fromPortrait
    ) {
      target = { kind: 'stowEquipped' }
    }

    const drop =
      payload && promotedToDrag && target
        ? { payload, target }
        : null

    setState((s) => ({ ...s, isPointerDown: false, dragging: null, affordance: null, hoverTarget: target, pointer: { x, y } }))

    return { drop, promotedToDrag }
  }, [clearHoldTimer])

  useEffect(() => {
    const onBlur = () => cancelDrag()
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') cancelDrag()
    }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [cancelDrag])

  /**
   * After the full `pointerup` dispatch (capture → target → bubble), if the release coordinates sit
   * on a `[data-modal-chrome-hit]` button but the event target was not that control (pointer capture
   * on a drag source, hit-testing oddities, etc.), synthesize `click()` so Trade/Close and other
   * chrome still run. Skip when the native target is already inside that button so we do not double
   * fire after a normal press on chrome.
   */
  useEffect(() => {
    const sel = `[${MODAL_CHROME_HIT_ATTR}]`
    const onPointerUpCapture = (e: PointerEvent) => {
      if (e.button !== 0) return
      const x = e.clientX
      const y = e.clientY
      const origTarget = e.target
      queueMicrotask(() => {
        if (typeof document === 'undefined') return
        const raw = document.elementFromPoint(x, y)
        const chromeBtn = raw?.closest?.(sel)
        if (!chromeBtn || !(chromeBtn instanceof HTMLButtonElement)) return
        if (chromeBtn.getAttribute('aria-disabled') === 'true') return
        if (chromeBtn.disabled) return
        if (origTarget instanceof Node && chromeBtn.contains(origTarget)) return
        chromeBtn.click()
      })
    }
    window.addEventListener('pointerup', onPointerUpCapture, true)
    return () => window.removeEventListener('pointerup', onPointerUpCapture, true)
  }, [])

  useEffect(() => {
    // Keep the custom cursor responsive for *any* click/tap (even when not starting a drag),
    // so `isPointerDown` can drive micro-interactions like click shake.
    const onAnyPointerDown = (e: PointerEvent) => {
      const { clientX: x, clientY: y } = e
      const el = document.elementFromPoint(x, y)
      const node = (el?.closest?.('[data-drop-kind]') as HTMLElement | null) ?? null
      const domTarget = parseTargetFromEl(node)
      const domRect = node ? node.getBoundingClientRect() : null
      setState((s) => ({
        ...s,
        pointer: { x, y },
        isPointerDown: true,
        hoverTarget: domTarget,
        hoverRect: domRect ? { left: domRect.left, top: domRect.top, right: domRect.right, bottom: domRect.bottom } : null,
        affordance: s.dragging?.started ? affordanceForTarget(domTarget) : null,
      }))
    }
    const onAnyPointerUp = (e: PointerEvent) => {
      const { clientX: x, clientY: y } = e
      setState((s) => ({
        ...s,
        pointer: { x, y },
        isPointerDown: false,
      }))
    }
    const onAnyPointerCancel = () => {
      setState((s) => ({ ...s, isPointerDown: false }))
    }

    window.addEventListener('pointerdown', onAnyPointerDown, true)
    window.addEventListener('pointerup', onAnyPointerUp, true)
    window.addEventListener('pointercancel', onAnyPointerCancel, true)
    return () => {
      window.removeEventListener('pointerdown', onAnyPointerDown, true)
      window.removeEventListener('pointerup', onAnyPointerUp, true)
      window.removeEventListener('pointercancel', onAnyPointerCancel, true)
    }
  }, [])

  const api: CursorApi = useMemo(
    () => ({
      state,
      beginPointerDown,
      onPointerMove,
      setVirtualHover,
      endPointerUp,
      cancelDrag,
    }),
    [state, beginPointerDown, onPointerMove, setVirtualHover, endPointerUp, cancelDrag],
  )

  return <CursorContext.Provider value={api}>{props.children}</CursorContext.Provider>
}

