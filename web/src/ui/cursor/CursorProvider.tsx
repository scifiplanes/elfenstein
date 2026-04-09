import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragPayload, DragTarget } from '../../game/types'
import { CursorContext, type CursorApi, type CursorState } from './CursorContext'
import { MODAL_CHROME_HIT_ATTR } from './modalChromeActivate'

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
  if (kind === 'tradeAskSlot') return { kind: 'tradeAskSlot' }
  return null
}

/** Walk top-to-bottom so opacity-0 portaled modals still resolve `tradeAskSlot` / etc. */
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
    case 'tradeAskSlot':
      return { icon: '☑', label: 'Request' }
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

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const { clientX: x, clientY: y } = e

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
    const hadPointerSession = payload != null
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

    // `setPointerCapture` on drag sources sends `pointerup` to the captured node, not the element
    // under the cursor — modal chrome may never see `pointerup`. If the release point hits a
    // marked chrome button and the event target is not that button, synthesize a click next tick.
    const origTarget = e.target
    queueMicrotask(() => {
      if (typeof document === 'undefined') return
      if (!hadPointerSession) return
      const raw = document.elementFromPoint(x, y)
      const sel = `[${MODAL_CHROME_HIT_ATTR}]`
      const hit = raw?.closest?.(sel)
      if (!hit || !(hit instanceof HTMLButtonElement)) return
      if (origTarget instanceof Node && (hit === origTarget || hit.contains(origTarget))) return
      if (hit.getAttribute('aria-disabled') === 'true') return
      if (hit.disabled) return
      // #region agent log
      fetch('http://127.0.0.1:7778/ingest/894c4eea-1ecd-42c9-95f9-1525a8a4b392', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9e1d47' },
        body: JSON.stringify({
          sessionId: '9e1d47',
          runId: 'post-fix3',
          hypothesisId: 'V4',
          location: 'CursorProvider.tsx:endPointerUp',
          message: 'retarget modal chrome click after capture-target pointerup',
          data: { origTag: origTarget instanceof Element ? origTarget.tagName : String(origTarget) },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      hit.click()
    })

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

