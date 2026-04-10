import type { ItemDefId, SkillId } from '../types'

export type RecipeDef = {
  /** Ordered ingredient A (order-sensitive recipes are allowed). */
  a: ItemDefId
  /** Ordered ingredient B (order-sensitive recipes are allowed). */
  b: ItemDefId
  result: ItemDefId
  craftMs: number
  failDestroyChancePct: number
  /** Skill used for the craft check (party-best). */
  skill: SkillId
  /** Difficulty class for d20 + skill >= dc. */
  dc: number
}

export function recipeKey(a: ItemDefId, b: ItemDefId) {
  return `${a}+${b}`
}

export const ALL_RECIPES: RecipeDef[] = [
  { a: 'Stick', b: 'Stone', result: 'Spear', craftMs: 1800, failDestroyChancePct: 25, skill: 'chipping', dc: 10 },
  { a: 'Ash', b: 'Sulfur', result: 'Firebolt', craftMs: 1200, failDestroyChancePct: 20, skill: 'foraging', dc: 11 },
  { a: 'Sulfur', b: 'Ash', result: 'Fireshield', craftMs: 1200, failDestroyChancePct: 20, skill: 'weaving', dc: 11 },

  // Weapon/tool assembly.
  { a: 'Stone', b: 'Chisel', result: 'StoneShard', craftMs: 1100, failDestroyChancePct: 15, skill: 'chipping', dc: 9 },
  { a: 'Stick', b: 'StoneShard', result: 'Spear', craftMs: 1500, failDestroyChancePct: 18, skill: 'chipping', dc: 10 },
  { a: 'Stick', b: 'Twine', result: 'Bow', craftMs: 1700, failDestroyChancePct: 22, skill: 'weaving', dc: 12 },
  { a: 'Twine', b: 'Stick', result: 'Sling', craftMs: 1300, failDestroyChancePct: 16, skill: 'weaving', dc: 10 },
  { a: 'Stone', b: 'Twine', result: 'Bolas', craftMs: 1400, failDestroyChancePct: 18, skill: 'weaving', dc: 11 },

  // Remedies & cooking (edible so feed interactions work; some have extra cure logic).
  { a: 'ClothScrap', b: 'ClothScrap', result: 'BandageStrip', craftMs: 900, failDestroyChancePct: 10, skill: 'weaving', dc: 9 },
  { a: 'HerbLeaf', b: 'ClothScrap', result: 'HerbPoultice', craftMs: 1200, failDestroyChancePct: 14, skill: 'foraging', dc: 11 },
  { a: 'BitterHerb', b: 'GlassVial', result: 'AntitoxinVial', craftMs: 1300, failDestroyChancePct: 16, skill: 'foraging', dc: 12 },
  { a: 'Foodroot', b: 'Stone', result: 'MortarMeal', craftMs: 1000, failDestroyChancePct: 12, skill: 'cooking', dc: 10 },
  { a: 'MortarMeal', b: 'WaterbagFull', result: 'Flourball', craftMs: 1600, failDestroyChancePct: 18, skill: 'cooking', dc: 12 },
  { a: 'HerbLeaf', b: 'WaterbagFull', result: 'HerbTea', craftMs: 1100, failDestroyChancePct: 12, skill: 'cooking', dc: 10 },

  // Headwear (hat slot).
  { a: 'ClothScrap', b: 'Twine', result: 'WoolCap', craftMs: 1100, failDestroyChancePct: 12, skill: 'weaving', dc: 10 },
  { a: 'HerbLeaf', b: 'Twine', result: 'HerbCirclet', craftMs: 1000, failDestroyChancePct: 11, skill: 'weaving', dc: 9 },
  { a: 'Mushrooms', b: 'ClothScrap', result: 'SporeCap', craftMs: 1150, failDestroyChancePct: 12, skill: 'foraging', dc: 10 },

  // A few extra “breadth” combos (directional flavor, order-sensitive by design).
  { a: 'Mushrooms', b: 'Ash', result: 'BitterHerb', craftMs: 900, failDestroyChancePct: 10, skill: 'foraging', dc: 10 },
  { a: 'Ash', b: 'Mushrooms', result: 'HerbLeaf', craftMs: 900, failDestroyChancePct: 10, skill: 'foraging', dc: 10 },
  { a: 'StoneShard', b: 'Twine', result: 'Chisel', craftMs: 1600, failDestroyChancePct: 25, skill: 'chipping', dc: 14 },
  { a: 'Twine', b: 'StoneShard', result: 'GlassVial', craftMs: 1600, failDestroyChancePct: 25, skill: 'weaving', dc: 14 },

  // Content expansion: light, bio, food, tools.
  { a: 'Stick', b: 'Moss', result: 'Torch', craftMs: 1000, failDestroyChancePct: 12, skill: 'foraging', dc: 9 },
  { a: 'Glowbug', b: 'Twine', result: 'Headlamp', craftMs: 1400, failDestroyChancePct: 14, skill: 'weaving', dc: 11 },
  { a: 'Torch', b: 'BobrJuice', result: 'Lantern', craftMs: 1500, failDestroyChancePct: 16, skill: 'cooking', dc: 11 },
  { a: 'Sweetroot', b: 'Stone', result: 'MushedRoot', craftMs: 1000, failDestroyChancePct: 11, skill: 'cooking', dc: 9 },
  { a: 'MushedRoot', b: 'Fungus', result: 'Shroomcake', craftMs: 1400, failDestroyChancePct: 14, skill: 'cooking', dc: 10 },
  { a: 'Shroomcake', b: 'Sweetroot', result: 'Shroompie', craftMs: 1600, failDestroyChancePct: 15, skill: 'cooking', dc: 11 },
  { a: 'MushedRoot', b: 'WaterbagFull', result: 'Rootsoup', craftMs: 1500, failDestroyChancePct: 14, skill: 'cooking', dc: 10 },
  { a: 'Rootsoup', b: 'Salt', result: 'RootsoupSalted', craftMs: 1200, failDestroyChancePct: 10, skill: 'cooking', dc: 10 },
  { a: 'Grubling', b: 'Salt', result: 'PreservedGrub', craftMs: 1300, failDestroyChancePct: 12, skill: 'cooking', dc: 10 },
  { a: 'Slime', b: 'Moss', result: 'Fungus', craftMs: 1100, failDestroyChancePct: 12, skill: 'foraging', dc: 10 },
  { a: 'Mucus', b: 'Fungus', result: 'Mold', craftMs: 1000, failDestroyChancePct: 18, skill: 'foraging', dc: 11 },
  { a: 'Fungus', b: 'Mucus', result: 'Slime', craftMs: 900, failDestroyChancePct: 15, skill: 'foraging', dc: 10 },
  { a: 'Bone', b: 'StoneShard', result: 'BoneSpike', craftMs: 1300, failDestroyChancePct: 16, skill: 'chipping', dc: 11 },
  { a: 'Stick', b: 'Gem', result: 'Staff', craftMs: 1700, failDestroyChancePct: 18, skill: 'chipping', dc: 12 },
  { a: 'Staff', b: 'Figurine', result: 'AttunedStaff', craftMs: 2000, failDestroyChancePct: 20, skill: 'weaving', dc: 13 },
]

export function findRecipe(defA: ItemDefId, defB: ItemDefId): RecipeDef | null {
  for (const r of ALL_RECIPES) {
    if (r.a === defA && r.b === defB) return r
  }
  return null
}

