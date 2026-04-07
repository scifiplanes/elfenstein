import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragPayload, DragTarget } from '../../game/types'
import { CursorContext, type CursorApi, type CursorState } from './CursorContext'

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
  if (kind === 'portrait') return { kind: 'portrait', characterId: String(node.dataset.dropCharacterId ?? ''), target: (node.dataset.dropPortraitTarget as any) ?? 'eyes' }
  if (kind === 'equipmentSlot') return { kind: 'equipmentSlot', characterId: String(node.dataset.dropCharacterId ?? ''), slot: String(node.dataset.dropEquipSlot ?? '') as any }
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
      return target.target === 'eyes' ? { icon: '👁', label: 'Inspect' } : { icon: '👄', label: 'Feed' }
    case 'poi':
      return { icon: '✦', label: 'Use' }
    case 'npc':
      return { icon: '⚔', label: 'Use' }
    case 'equipmentSlot':
      return { icon: '⛭', label: 'Equip' }
    default:
      return null
  }
}

export function CursorProvider(props: PropsWithChildren) {
  const holdTimer = useRef<number | null>(null)
  const pendingPayload = useRef<DragPayload | null>(null)
  const virtualHover = useRef<{ target: DragTarget | null; rect: CursorState['hoverRect'] } | null>(null)
  const capture = useRef<{ el: Element; pointerId: number } | null>(null)

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
    pendingPayload.current = payload
    const { clientX: x, clientY: y } = e
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
      setState((s) => (s.dragging ? { ...s, dragging: { ...s.dragging, started: true } } : s))
    }, 140)
  }, [clearHoldTimer])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const { clientX: x, clientY: y } = e
    const el = document.elementFromPoint(x, y)
    const node = (el?.closest?.('[data-drop-kind]') as HTMLElement | null) ?? null
    const domTarget = parseTargetFromEl(node)
    const domRect = node ? node.getBoundingClientRect() : null
    const v = virtualHover.current
    // Treat virtual hover as a one-move override. This prevents the viewport's
    // `floorDrop` hover from "leaking" into UI hover when the pointer leaves the WebGL canvas.
    if (v) virtualHover.current = null
    const target = v?.target ?? domTarget
    const rect = v?.rect ?? (domRect ? { left: domRect.left, top: domRect.top, right: domRect.right, bottom: domRect.bottom } : null)
    setState((s) => ({
      ...s,
      pointer: { x, y },
      hoverTarget: target,
      hoverRect: rect,
      affordance: s.dragging?.started ? affordanceForTarget(target) : null,
    }))
  }, [])

  const cancelDrag = useCallback(() => {
    clearHoldTimer()
    pendingPayload.current = null
    virtualHover.current = null
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

  const endPointerUp = useCallback((e: React.PointerEvent): { payload: DragPayload; target: DragTarget } | null => {
    clearHoldTimer()
    const { clientX: x, clientY: y } = e
    const v = virtualHover.current
    const el = document.elementFromPoint(x, y)
    const target = v?.target ?? parseTargetFromEl(el)
    virtualHover.current = null
    const payload = pendingPayload.current
    pendingPayload.current = null
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

    const result =
      payload && state.dragging?.started && target
        ? { payload, target }
        : null

    setState((s) => ({ ...s, isPointerDown: false, dragging: null, affordance: null, hoverTarget: target, pointer: { x, y } }))
    return result
  }, [clearHoldTimer, state.dragging?.started])

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

