import type { ContentDB } from '../content/contentDb'
import type { GameState, InventoryGrid, ItemId, Tile } from '../types'
import { DEFAULT_AUDIO, DEFAULT_RENDER } from '../tuningDefaults'

function mkInventory(cols: number, rows: number): InventoryGrid {
  return { cols, rows, slots: Array.from({ length: cols * rows }, () => null) }
}

function place(inv: InventoryGrid, itemId: ItemId, idx: number) {
  if (idx < 0 || idx >= inv.slots.length) throw new Error('Bad inventory index')
  inv.slots[idx] = itemId
}

export function makeInitialState(_content: ContentDB): GameState {
  const nowMs = performance.now()
  const defaultCamEyeHeight = DEFAULT_RENDER.camEyeHeight

  const partyEndurance = 6 + 7 + 5 + 6
  const cols = 10
  const baseCells = 20
  const cells = baseCells + partyEndurance * 2
  const rows = Math.max(3, Math.ceil(cells / cols))
  const inv = mkInventory(cols, rows)
  const items: GameState['party']['items'] = {
    i_mush: { id: 'i_mush', defId: 'Mushrooms', qty: 1 },
    i_root: { id: 'i_root', defId: 'Foodroot', qty: 1 },
    i_wbe: { id: 'i_wbe', defId: 'WaterbagEmpty', qty: 1 },
    i_stone: { id: 'i_stone', defId: 'Stone', qty: 1 },
    i_stick: { id: 'i_stick', defId: 'Stick', qty: 1 },
    i_club: { id: 'i_club', defId: 'Club', qty: 1 },
    i_key: { id: 'i_key', defId: 'IronKey', qty: 1 },
    i_band: { id: 'i_band', defId: 'BandageStrip', qty: 1 },
    i_anti: { id: 'i_anti', defId: 'AntitoxinVial', qty: 1 },
    i_poul: { id: 'i_poul', defId: 'HerbPoultice', qty: 1 },
    i_chisel: { id: 'i_chisel', defId: 'Chisel', qty: 1 },
  }
  place(inv, 'i_mush', 0)
  place(inv, 'i_root', 1)
  place(inv, 'i_wbe', 2)
  place(inv, 'i_key', 3)
  place(inv, 'i_stone', 10)
  place(inv, 'i_stick', 11)
  place(inv, 'i_club', 12)
  place(inv, 'i_band', 4)
  place(inv, 'i_anti', 5)
  place(inv, 'i_poul', 6)
  place(inv, 'i_chisel', 7)

  const w = 13
  const h = 13
  const tiles: Tile[] = Array.from({ length: w * h }, (_, i) => {
    const x = i % w
    const y = Math.floor(i / w)
    const border = x === 0 || y === 0 || x === w - 1 || y === h - 1
    const corridor = x === 6 || y === 6
    return border || !corridor ? 'wall' : 'floor'
  })

  // One locked door blocking the corridor for key testing.
  tiles[6 + 5 * w] = 'lockedDoor'
  // One cracked wall in the corridor for tool testing.
  tiles[4 + 6 * w] = 'wall'

  return {
    nowMs,
    ui: { debugOpen: false, sfxQueue: [] },
    render: { ...DEFAULT_RENDER },
    audio: { ...DEFAULT_AUDIO },
    view: {
      camPos: { x: 6 - w / 2, y: defaultCamEyeHeight, z: 10 - h / 2 },
      camYaw: 0,
    },
    floor: {
      seed: 1337,
      w,
      h,
      tiles,
      playerPos: { x: 6, y: 10 },
      playerDir: 0,
      gen: undefined,
      pois: [
        { id: 'poi_well', kind: 'Well', pos: { x: 6, y: 2 } },
        { id: 'poi_chest', kind: 'Chest', pos: { x: 10, y: 6 }, opened: false },
        { id: 'poi_bed', kind: 'Bed', pos: { x: 2, y: 6 } },
        { id: 'poi_shrine', kind: 'Shrine', pos: { x: 6, y: 9 } },
        { id: 'poi_crack', kind: 'CrackedWall', pos: { x: 4, y: 6 } },
      ],
      itemsOnFloor: [],
      npcs: [
        {
          id: 'npc_1',
          kind: 'Wurglepup',
          name: 'Wurglepup',
          pos: { x: 6, y: 6 },
          status: 'neutral',
          hp: 20,
          language: 'DeepGnome',
          quest: { wants: 'Mushrooms', hated: ['Stone'] },
        },
        {
          id: 'npc_skel',
          kind: 'Skeleton',
          name: 'Skeleton',
          pos: { x: 8, y: 6 },
          status: 'hostile',
          hp: 18,
          language: 'Zalgo',
          quest: { wants: 'Ash', hated: ['Mushrooms'] },
        },
        {
          id: 'npc_bobr',
          kind: 'Bobr',
          name: 'Bobr',
          pos: { x: 4, y: 6 },
          status: 'neutral',
          hp: 24,
          language: 'Mojibake',
          quest: { wants: 'Foodroot', hated: ['Stick'] },
        },
        {
          id: 'npc_cato',
          kind: 'Catoctopus',
          name: 'Catoctopus',
          pos: { x: 6, y: 4 },
          status: 'neutral',
          hp: 22,
          language: 'Mojibake',
          quest: { wants: 'Mushrooms', hated: ['Stone'] },
        },
      ],
    },
    party: {
      chars: [
        { id: 'c1', name: 'Char1', species: 'Igor', endurance: 6, hunger: 60, thirst: 60, hp: 40, stamina: 30, statuses: [{ id: 'Cursed' }], equipment: {} },
        { id: 'c2', name: 'Char2', species: 'Mycyclops', endurance: 7, hunger: 60, thirst: 60, hp: 42, stamina: 30, statuses: [], equipment: {} },
        { id: 'c3', name: 'Char3', species: 'Frosch', endurance: 5, hunger: 60, thirst: 60, hp: 38, stamina: 30, statuses: [], equipment: {} },
        { id: 'c4', name: 'Char4', species: 'Igor', endurance: 6, hunger: 60, thirst: 60, hp: 40, stamina: 30, statuses: [], equipment: {} },
      ],
      inventory: inv,
      items,
    },
  }
}

