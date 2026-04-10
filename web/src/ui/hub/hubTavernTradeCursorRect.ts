/** Viewport rect for the tavern innkeeper trade hotspot; `HubViewport` keeps this in sync for `CursorProvider`. */
export type HubTradeScreenRect = { left: number; top: number; right: number; bottom: number }

export const hubTavernTradeHoverRectRef: { current: HubTradeScreenRect | null } = { current: null }
