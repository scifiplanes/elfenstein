# Crafting recipes graph

Emoji icons match [`web/src/game/content/items.ts`](web/src/game/content/items.ts). Drag source **A** onto target **B** (see [`web/src/game/content/recipes.ts`](web/src/game/content/recipes.ts)). Each link is labeled with **B**.

Regenerate after editing recipes or item icons:

```bash
node web/scripts/genCraftingRecipesGraph.mjs
```

```mermaid
flowchart LR
  subgraph sec_base_recipes["Base recipes"]
    Stick["🪵"] -->|"+ 🪨"| Spear["🗡️"]
    Ash["⚫️"] -->|"+ 🟡"| Firebolt["🔥"]
    Sulfur["🟡"] -->|"+ ⚫️"| Fireshield["🛡️"]
  end
  subgraph sec_weapon_tool_assembly["Weapon / tool assembly"]
    Stone["🪨"] -->|"+ 🪓"| StoneShard["🪨"]
    Stick["🪵"] -->|"+ 🪨"| Spear["🗡️"]
    Stick["🪵"] -->|"+ 🪢"| Bow["🏹"]
    Twine["🪢"] -->|"+ 🪵"| Sling["🪃"]
    Stone["🪨"] -->|"+ 🪢"| Bolas["🪢"]
  end
  subgraph sec_remedies_cooking["Remedies & cooking"]
    ClothScrap["🧵"] -->|"+ 🧵"| BandageStrip["🩹"]
    HerbLeaf["🍃"] -->|"+ 🧵"| HerbPoultice["🌿"]
    BitterHerb["🌱"] -->|"+ 🧴"| AntitoxinVial["🧪"]
    Foodroot["🥕"] -->|"+ 🪨"| MortarMeal["🥣"]
    MortarMeal["🥣"] -->|"+ 💧"| Flourball["🍞"]
    HerbLeaf["🍃"] -->|"+ 💧"| HerbTea["🫖"]
  end
  subgraph sec_headwear["Headwear"]
    ClothScrap["🧵"] -->|"+ 🪢"| WoolCap["🧢"]
    HerbLeaf["🍃"] -->|"+ 🪢"| HerbCirclet["🌼"]
    Mushrooms["🍄"] -->|"+ 🧵"| SporeCap["🍄"]
  end
  subgraph sec_breadth_combos["Breadth combos"]
    Mushrooms["🍄"] -->|"+ ⚫️"| BitterHerb["🌱"]
    Ash["⚫️"] -->|"+ 🍄"| HerbLeaf["🍃"]
    StoneShard["🪨"] -->|"+ 🪢"| Chisel["🪓"]
    Twine["🪢"] -->|"+ 🪨"| GlassVial["🧴"]
  end
  subgraph sec_light_bio_food_tools["Light, bio, food, tools"]
    Stick["🪵"] -->|"+ 🌿"| Torch["🔥"]
    Glowbug["✨"] -->|"+ 🪢"| Headlamp["🔦"]
    Torch["🔥"] -->|"+ 🧃"| Lantern["🏮"]
    Sweetroot["🍠"] -->|"+ 🪨"| MushedRoot["🥣"]
    MushedRoot["🥣"] -->|"+ 🍄"| Shroomcake["🎂"]
    Shroomcake["🎂"] -->|"+ 🍠"| Shroompie["🥧"]
    MushedRoot["🥣"] -->|"+ 💧"| Rootsoup["🍲"]
    Rootsoup["🍲"] -->|"+ 🧂"| RootsoupSalted["🍲"]
    Grubling["🐛"] -->|"+ 🧂"| PreservedGrub["🥫"]
    Slime["🫧"] -->|"+ 🌿"| Fungus["🍄"]
    Mucus["💧"] -->|"+ 🍄"| Mold["🦠"]
    Fungus["🍄"] -->|"+ 💧"| Slime["🫧"]
    Mold["🦠"] -->|"+ 🍃"| SporePaste["🫗"]
    Mushrooms["🍄"] -->|"+ 🦠"| SporePaste["🫗"]
    SporePaste["🫗"] -->|"+ 💧"| SporeStew["🍜"]
    Gem["💎"] -->|"+ 🪢"| GemCharm["📿"]
    ClothScrap["🧵"] -->|"+ 🌿"| MossWrap["🧣"]
    Moss["🌿"] -->|"+ 🪢"| MossSandals["🩴"]
    SporePaste["🫗"] -->|"+ 🧂"| BrinedSpore["🥫"]
    Ash["⚫️"] -->|"+ 🪢"| SmolderBundle["🔥"]
    BobrJuice["🧃"] -->|"+ 🌱"| RiverTonic["🍶"]
    HerbLeaf["🍃"] -->|"+ 🌿"| CoolingPoultice["🧊"]
    Salt["🧂"] -->|"+ 🧵"| DryWrap["🧻"]
    Bone["🦴"] -->|"+ 🪨"| BoneSpike["🦴"]
    Stick["🪵"] -->|"+ 💎"| Staff["🪄"]
    Staff["🪄"] -->|"+ 🗿"| AttunedStaff["✴️"]
  end
  subgraph sec_alternates["Alternates"]
    Stone["🪨"] -->|"+ 🏏"| StoneShard["🪨"]
    Stick["🪵"] -->|"+ 🦞"| Spear["🗡️"]
    Twine["🪢"] -->|"+ 🦴"| Bolas["🪢"]
    Twine["🪢"] -->|"+ 🦞"| Sling["🪃"]
    Tooth["🦷"] -->|"+ 🪨"| BoneSpike["🦴"]
    Bone["🦴"] -->|"+ 🧵"| BandageStrip["🩹"]
    BandageStrip["🩹"] -->|"+ 🍃"| HerbPoultice["🌿"]
    BandageStrip["🩹"] -->|"+ 🌱"| AntitoxinVial["🧪"]
    Ash["⚫️"] -->|"+ 🪵"| Torch["🔥"]
    Foodroot["🥕"] -->|"+ 🌿"| MortarMeal["🥣"]
    MortarMeal["🥣"] -->|"+ 🍄"| Shroomcake["🎂"]
    Flourball["🍞"] -->|"+ 🍄"| Shroomcake["🎂"]
    Grubling["🐛"] -->|"+ 🌿"| PreservedGrub["🥫"]
    StoneShard["🪨"] -->|"+ 🦴"| Chisel["🪓"]
    Bone["🦴"] -->|"+ 💎"| Staff["🪄"]
  end
  subgraph sec_order_sensitive_pairs["Order-sensitive pairs"]
    Bone["🦴"] -->|"+ 🪵"| Club["🏏"]
    Stick["🪵"] -->|"+ 🦴"| Spear["🗡️"]
    Foodroot["🥕"] -->|"+ 💧"| Flourball["🍞"]
    WaterbagFull["💧"] -->|"+ 🥕"| MortarMeal["🥣"]
    Salt["🧂"] -->|"+ 🍲"| Mold["🦠"]
    Sweetroot["🍠"] -->|"+ 🎂"| MushedRoot["🥣"]
    ClothScrap["🧵"] -->|"+ 🍄"| HerbLeaf["🍃"]
    Lantern["🏮"] -->|"+ 🧃"| Torch["🔥"]
    Slime["🫧"] -->|"+ 🍄"| Mold["🦠"]
    Fungus["🍄"] -->|"+ 🫧"| Mucus["💧"]
    WaterbagFull["💧"] -->|"+ 🫗"| SporeStew["🍜"]
    ClothScrap["🧵"] -->|"+ 🧂"| DryWrap["🧻"]
  end
  subgraph sec_swarm_tools["Swarm tools"]
    Twine["🪢"] -->|"+ 🪺"| SwarmBasket["🧺"]
    Hive["🪺"] -->|"+ 🐛"| CapturedSwarm["🫧"]
    Hive["🪺"] -->|"+ 🍄"| CapturedSwarm["🫧"]
  end
```
