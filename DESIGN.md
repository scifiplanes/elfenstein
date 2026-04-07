# Elfenstein — Design Document (living)

Last updated: 2026-04-07

## 1) High concept
**Elfenstein** is a web-based, grid-based dungeon crawler with a first-person **2.5D** view. Visuals combine **3D dungeon geometry** with **2D sprites** for characters/items, prioritizing a crunchy dithered/print look and a highly contextual, low-clutter UX.

## 2) Product goals
- **Modular + extensible**: content and stats are compartmentalized and easy to expand (items, NPCs, species, classes, floor types, etc.).
- **Multiplayer-ready later**: generation and state should be compatible with a future model where the **host player** runs the authoritative database and **1–3 clients** connect.
- **Contextual UX over menus**: few actions are available at any moment; actions branch into contextual interactions/modals.

## 3) Target platform & constraints
- **Platform**: Web (desktop first).
- **Layout**: HUD and compositor are authored at **1920×1080** CSS px inside **`FixedStageViewport`** (`stageDesign.ts`). The **`.clip`** is exactly the scaled **1920×1080** content box (**`STAGE_CSS_*`** in **`stageDesign.ts`**). A **3px** white frame uses **`outline`** on **`.clip`** with negative **`outline-offset`** so it sits just inside that rectangle without changing layout size. The stage **uniformly scales** by **`s = min(1, viewportW/1920, viewportH/1080)`** (using **`visualViewport`** when present): on viewports **larger than 1080p** the box stays **1920×1080 CSS px** centered with black margins; smaller viewports **shrink** so everything remains visible. **`FramePresenter`** / WebGL canvas and **HUD `html2canvas` capture use the same 1920×1080 CSS size**—not the browser viewport. **`getBoundingClientRect()` includes that outer scale**, so the compositor’s **`gameRectPx`** and the **3D render target** use **layout** sizes (divide by **`s`** where needed, and **`clientWidth` / `clientHeight`** for the game viewport) so the scene + UI map correctly inside the stage. In-game CSS uses **`--stage-w` / `--stage-h`** instead of **`100vw` / `100vh`** for max widths/heights where needed.
- **Camera**: first-person, grid movement; no looking up/down; pits can exist but player can’t fall in.
- **Renderer**: Three.js/WebGL for dungeon geometry.
- **Debug (F2)**: sliders for render/audio tuning, including **camera** (eye height, field of view, optional pitch for development) and **lighting** (lantern/beam/torch intensity + distance, base emissive lift). **Portrait**: portrait shake envelope (**hold/decay**) + amplitude, mouth flicker (**Hz** + **amount**), and min/max gap (ms) between Igor **idle** flashes and min/max **flash** duration (ms). **Audio** includes **master music** volume, spatial emitter mix, and **munch** SFX (volume, noise **LP sweep** endpoints, **HP** corner and **HP/LP Q**, duration, thump Hz, tremolo). Values load from `web/public/debug-settings.json` and, during **Vite dev**, edits are debounced back into that file so tuning persists in the repo. There are **no always-on on-screen debug overlays** during play; debug UI is accessed via **F2** (and renderer-only debugging uses explicit query params when needed). Pitch is a debug aid only; core UX remains yaw-on-grid.

## 4) Core player experience (pillars)
- **Touch what you see**: the hand cursor is the primary verb (click, drag, drop).
- **Party as a single organism**: shared inventory and pooled capacity (via party endurance).
- **Discovery through interaction**: crafting by experimentation; NPC language as a memorization puzzle.
- **Atmosphere via light + sound**: darkness is default; proximity audio supports exploration.

## 5) Core loop
Explore → find POIs/NPCs/items → manage inventory/craft → resolve encounters → recover at POIs → push deeper (keys/doors) → repeat.

## 6) Controls & interaction model
### 6.1 Cursor (hand) states
- **OS cursor**: hidden globally (`cursor: none` on `document.body`); interactive HUD widgets also set **`cursor: none`** so controls (e.g. navigation buttons) never revert to the system pointer—only the **`CursorLayer`** hand sprite is visible. **`CursorLayer`** is a **sibling** of **`FixedStageViewport`** (not inside the scaled **`.stage`**): **`position: fixed`** with **`clientX`/`clientY`** must use the **viewport** containing block; a transformed ancestor would offset the hand from the real pointer.
- **Default**: `Hand_Point`
- **Holding/dragging**: `Hand_Hold` (held item sprite follows pointer)
- **Hover active**: `Hand_Active` when pointing at an interactable
- **Deadzone behavior**: hovering non-interactive UI areas should clear any previous “active” hover so the cursor returns to `Hand_Point`; pointer move/up are tracked globally across the HUD so cursor state can’t get stuck when moving over panels.

### 6.2 Interaction rules (mouse-first)
- **Click**: attempt to use/interact with target (object/NPC/POI/UI element).
- **Press + hold**: pick up/drag items from **inventory** and from **world floor items** in the 3D view.
- **Drop**:
  - Onto **inventory**: store item
  - Onto **empty 3D view**: drop item **a short distance ahead of the player** (tunable) so it is immediately visible; if blocked/out of bounds, it falls back to the player’s cell
  - Onto **another item**: attempt crafting / recipe discovery (see §7.3)
  - Onto **NPC**: use item on NPC (may be rejected/consumed/apply status/attack)
  - Onto **portrait eye**: inspect interaction
  - Onto **portrait mouth**: feed interaction
- **Preview affordance**: contextual icon appears near relevant elements indicating what releasing will do.

### 6.3 UX feedback
Interactions should resolve with:
- short relevant animation (e.g. eyes/mouth)
- sound
- subtle camera shake for key interactions (driven by `ui.shake` and tunable in Debug/F2). **Shake length / hold (ms)** and **shake decay / fade (ms)** control the envelope for the **3D camera**, **HUD overlay shake**, and **portrait frame shake** (shared `shakeEnvelopeFactor` in `web/src/game/shakeEnvelope.ts`). With length 0, decay uses the legacy ramp `min(1, remaining/decay)`; with length above 0, full strength holds for the scaled hold segment, then linearly fades over the scaled decay segment within each event’s `startedAtMs`→`untilMs` window.
- subtle camera shake for key interactions (driven by `ui.shake` and tunable in Debug/F2). **Shake length / hold (ms)** and **shake decay / fade (ms)** control the envelope for the **3D camera** and **HUD overlay shake** (shared `shakeEnvelopeFactor` in `web/src/game/shakeEnvelope.ts`). With length 0, decay uses the legacy ramp `min(1, remaining/decay)`; with length above 0, full strength holds for the scaled hold segment, then linearly fades over the scaled decay segment within each event’s `startedAtMs`→`untilMs` window.
- **Portrait frame shake** on portrait interaction resolution (inspect and feed), driven by `ui.portraitShake` on the matching character slot

### 6.4 Grid movement (first-person)
- **Model**: discrete cells; facing is one of four compass directions; the 3D camera **yaw** matches facing. **Strafe** moves one cell **left or right relative to facing** without rotating (**A** / **D**). **W** / **S** move **forward** / **backward** along facing.
- **Keyboard** (see `GameApp.tsx`): **W** / **S** (and **↑** / **↓**) forward/back; **A** / **D** strafe left/right; **Q** / **E** turn left/right. **F2** toggles the debug panel.
- **HUD**: the bottom grid row (minimap + inventory + navigation) has a shared row height of **285 px** (**−5%** vs the prior **300 px** row, after the earlier **−25%** step from **400 px**); it stays the **third** grid row so widgets remain **bottom-aligned** with **`1fr` / `1fr`** rows above taking the freed space. **Left and right** portrait **rails** (rows **1–2**) use **`minmax(0, 1fr) 120px minmax(0, 1.12fr) 120px minmax(0, 1fr)`**. **CHAR1/CHAR2** (left) and **CHAR3/CHAR4** (right) `<section>`s use **75%** rail width with **`justify-self: start`** / **`end`** so they line up with the **map** / **navigation** blocks below. Row **3** is a **`bottomRow`** wrapper: nested **`grid-template-columns: 0.75fr 120px 1.62fr 120px 0.75fr`** (same **3.12fr** sum as **`1 + 1.12 + 1`**) shifts width into the **center** so **inventory** (spans the **120 + 1.62fr + 120** band) stays wide. **Map** and **navigation** `<section>`s use **100%** of their **0.75fr** tracks (**0.75fr** total), matching portrait strips’ **75%** of the **1fr** rails above (**0.75fr**); they have **no** MAP/NAVIGATION title headers, and **`HudLayout`** **`display: flex`** + **`align-items`/`justify-content: center`** centers each widget in its cell. Rows **1–2** still use **1.12fr** for the **game** viewport. At a reference desktop width this yields roughly the former **~518 px** outer / **~580 px** game-column proportion. The **navigation** panel is a **3×2** image pad (sources under `Content/ui/navigation/`, mirrored to `web/public/content/ui/navigation/` for the dev server): each **cell is drawn at 50% of the bezel PNG native size** (**88.5×88.5 px** from 177×177 sources), **square** corners (no radius on the cells); on press it shows **ui_navigationbutton_pushed** for **0.5 seconds**, then returns to default. Direction glyphs are separate overlays (**arrow up/down/left/right**, **turn left/right** icons). Layout row 1: turn left, forward, turn right; row 2: strafe left, back, strafe right. The pad’s intrinsic width is **~271.5 px** (three cells + gaps); it stays **centered** inside the **navigation** panel. Tooltips still echo keyboard shortcuts (§6.4). **Note**: the on-screen HUD is composited from an offscreen **capture** DOM (`HudLayout` with `captureForPostprocess`); the **interactive** HUD is pointer-transparent (`opacity: 0`). Navigation “pushed” bezel state therefore lives in `DitheredFrameRoot` and is passed into **both** trees so `html2canvas` sees **`ui_navigationbutton_pushed.png`** on the cell you pressed.
- **Viewport**: clicking a **door** attempts a **forward** step into that cell (open normal door or try key on locked door).
- **While a move/turn animation is playing**, new step, strafe, and turn input is ignored so the player resolves one grid action at a time.
- **Audio**: a successful step or strafe plays a short **step** SFX; walking into a solid tile uses a distinct **bump** SFX (with existing toast + shake).

## 7) Systems
### 7.1 Party & characters
The party has **up to 4** character portrait slots.

**Character composition (portrait)**:
- Base sprite + Eyes sprite + Mouth sprite (selected from species libraries)
- **Portrait sprite sources (current)**:
  - **Igor**:
    - Base: `Content/boblin_base.png`
    - Eyes (open): `Content/boblin_eyes_open.png`
    - Eyes (inspect hover): `Content/boblin_eyes_inspect.png`
    - Mouth: `Content/boblin_mouth_open.png`
    - Idle overlay: `Content/boblin_idle.png` (briefly shown on top at a **lower frequency** than blinking)
  - **Mycyclops**:
    - Base: `Content/myclops_base.png`
    - Eyes (open): `Content/myclops_eyes_open.png`
    - Eyes (inspect hover): `Content/myclops_eyes_inspect.png`
    - Mouth: `Content/myclops_mouth_open.png`
    - Idle overlay: `Content/myclops_idle.png`
  - **Frosch**:
    - Base: `Content/frosh_base.png`
    - Eyes (open): `Content/frosh_eye_L.png` + `Content/frosh_eye_R.png` (two sprites)
    - Eyes (inspect hover): `Content/frosh_eye_inspect.png`
    - Mouth: `Content/frosh_mouth_open.png`
    - Idle overlay: `Content/frosh_idle.png`
- **Portrait scaling**: the portrait frame scales up to fill as much of its HUD slot as possible while **preserving the portrait asset aspect ratio**; portrait art is rendered using **no-crop fit** (scaled as large as possible while fully visible within the frame).
- **Portrait stats presentation**: character vitals + status are shown as a **compact bottom overlay inside the portrait frame** (two-line readout). Long status lists are **single-line truncated** to preserve portrait space.
- **Portrait blinking**: the eyes layer is **occasionally hidden briefly** to simulate blinking.
- **Portrait inspect hover**: while **dragging** an item and hovering the **eyes** target area, the portrait swaps to an **inspect eyes** sprite (if available). Inspect hover **overrides blink hiding**.
- **Portrait mouth visibility**: mouth layer is **hidden by default**; it becomes visible during **feeding interactions** (dragging over mouth target and briefly after a feed attempt).
- **Portrait mouth feedback (feed)**: after releasing an item on the mouth target, play a short “chomp” (mouth flicker + tiny wiggle), a short **portrait frame shake**, and a brief **munch** SFX on successful feeding. **No** `ui.shake` (3D view or empty HUD overlay) for portrait inspect/feed—only `ui.portraitShake` on the relevant slot.
- **Portrait inspect**: resolving an eye drop plays a short **portrait frame shake** (gentler than feed), likewise without 3D shake.
- **Portrait shake tuning**: portrait frame shake has its own envelope and amplitude tuning via `RenderTuning`:
  - `portraitShakeLengthMs` / `portraitShakeDecayMs` (envelope)
  - `portraitShakeMagnitudeScale` (amplitude multiplier applied to `ui.portraitShake.magnitude`)
  - `portraitShakeHz` (oscillation speed for the portrait shake transform)
  - Portrait shake duration is at least the authored base duration, but increases to match the tuned envelope window so “hold/decay” can produce multi-oscillation shakes.
- Portrait interactive middle third is split into:
  - **Eyes area (top)** → inspect drop target
  - **Mouth area (bottom)** → feed drop target

**Properties**
- **Identity axes (initial sets, extendable)**:
  - Species: `Igor` (goatmen), `Mycyclops` (one-eyed mushroom person), `Frosch` (frog person)
  - Class: `Warrior`, `Wizard`, `Cleric`
  - Culture: `Barbarian`, `Villager`, `Nomad`
  - Ideology: `Animist`, `Ancients`, `The One`
  - Sign: `Arrow`, `Circle`, `Flame`
- **Progression**: Experience, Level
- **Vitals**: HP, Stamina, Armor, Hunger, Thirst
- **Resistances**: Blunt, Pierce, Cut, Fire, Water, Thunder, Earth
- **Stats (extendable)**: Strength, Agility, Speed, Perception, Endurance, Intelligence, Wisdom, Luck
- **Skills (initial, extendable)**: weaving, chipping, cooking, foraging

### 7.2 Inventory
- **Shared inventory** across party (one pool).
- Inventory is a **large grid panel** for management.
- **Capacity**: number of grid cells is informed by **total party Endurance**.
- Inventory UI is **scrollable in sections** (paged), not continuous.
- Dragging inventory item into empty 3D space drops it onto the floor (cell).

### 7.3 Items & crafting
- Items are found on dungeon floor and via POIs/NPC drops.
- **Crafting trigger**: drag one item onto another.
- **If recipe exists**:
  - show a visible timer
  - perform a skill check
  - on success: crafted result
  - on failure: notify; chance to destroy one involved item

**Initial item list (extendable)**
- Hive: click spawns Swarm (small chance Swarm Queen); high destruction chance on click
- Swarm Queen: Swarms become neutral
- Swarm Basket: drag onto Swarm to capture → consumes both, produces Captured Swarm
- Captured Swarm: drag onto enemy to release → heavy damage
- Mushrooms: feed → Hunger + small Stamina + small HP; tiny chance Blessed for Mycyclops, Sick for others
- Foodroot: feed → Hunger + small Stamina + some HP
- Flourball: feed → Hunger + some Stamina + small HP
- Waterbag (Empty): use on Well → Waterbag (Full)
- Waterbag (Full): feed → Thirst
- Club: equip → Blunt damage; bonus from Strength
- Bow: equip → Pierce damage; bonus from Agility
- Spear: equip → Pierce damage; bonus from Strength
- Stone: equip → small Blunt; bonus from Strength; also crafting component
- Stick: equip → small Blunt; bonus from Agility; also crafting component
- Ash + Sulfur: two-way combo spell results (Firebolt / Fireshield)

### 7.4 Equipment & paperdoll
- Clicking a character portrait opens a **paperdoll modal** positioned to keep inventory accessible.
- Drag/drop equipment between inventory and paperdoll slots.
- Slots vary by species; initial slot set:
  - Head, Left hand, Right hand, Feet, Clothing, Accessories

### 7.5 NPCs
- Spawned from loot tables informed by:
  - floor type, floor properties, room function, room properties
- Interaction:
  - drag weapon onto NPC → attack with that weapon
  - click or walk into NPC → contextual interaction based on status
- Rendering:
  - In-world NPCs are rendered as **2D sprite billboards** in the 3D scene (per NPC kind), and are still pickable/clickable/drag-targetable.
  - NPC billboards **preserve the sprite PNG aspect ratio** (no squashing); sprite **height** is set by per-kind tuning and width is derived from the texture aspect.
  - F2 Debug exposes per-kind **NPC size (height)** and deterministic **±% size variation**; values persist via `web/public/debug-settings.json`.
  - NPC sprite placement aligns the **feet/ground point** with the **floor surface** so NPCs appear grounded. F2 Debug exposes a small global lift (`npcFootLift`) plus per-kind ground pivot offsets (`npcGroundY_*`) to compensate for transparent padding differences across NPC art.
  - The NPC dialog shows a small matching sprite next to the NPC’s name.

**Statuses**: Aggressive, Neutral, Friendly

**On death**: may drop items from its loot table.

**Initial NPC list (extendable)**:
- Swarm (hostile unless player has Swarm Queen)
- Catoctopus
- Wurglepup
- Bobr

### 7.6 NPC quests & languages
- NPC may ask for an item in text using a **gibberish language** that is **consistent** (player can learn meanings).
- Languages: Deep Gnome, Zalgo, Mojibake
- Giving the correct item can change status:
  - Hostile → Neutral
  - Neutral → Friendly
- Each NPC type has **Hated** items; giving these makes them hostile.

### 7.7 Combat (baseline)
- Default “walk-in” attack resolves as turn order informed by **Speed** for all participants (party + NPCs).

### 7.8 Status effects
- Status effects apply to PCs and NPCs; positive/negative/neutral.
- Some decay over time; some persist until cured by an item.
- Initial set: **Poisoned, Blessed, Sick**

## 8) Dungeon & world generation
### 8.1 Taxonomy (tags drive content)
- **Floor types**: Ruins, Dungeon, Cave
- **Floor properties**: Infested, Cursed, Destroyed, Overgrown, None (not shown)
- **Room function**: Passage, Habitat, Workshop, Communal, Storage
- **Room properties**: Burning, Flooded, Infected (cause resistance check; fail can cause damage)
- **Room status**: Overgrown, Destroyed, Collapsed
- **Doors/keys**: passages can be blocked by door types requiring appropriate keys

### 8.2 Starting algorithm (prototype baseline)
Initial starting point to iterate:
1. BSP partition (min leaf ~7×7; depth ~5)
2. Room carve (60–80% of leaf, random offset)
3. Corridor stitch (L-bends connect sibling rooms; guarantees connectivity)
4. CA smoothing (1–2 wall passes for alcoves/softening)
5. Room tagging (tiny/medium/large; tag by depth)
6. Population pass (enemies/items/doors/torches per tags + loot tables; entrance/exit guaranteed)
7. Theme injection (tile variants + palette by theme)

### 8.3 Determinism requirement
Generation should be **seeded** and phase-stable (changes to one phase shouldn’t ripple unpredictably into others) to support future host-synced multiplayer.

### 8.4 Reference pipeline (expanded)
See `Dungeon_generation_plan_summary.md` for an expanded phased pipeline (mission graph → lock correctness → geometry → districts → tagging solve → population → validation → debug overlays).

## 9) Points of interest (POIs)
Static interactables, triggered by dragging items onto them, clicking, or walking into them.

Initial POIs:
- **Well**: save point (clear notification); used to fill Waterbag
- **Chest**: opens (sprite change) and drops random item
- **Bed**: restores full HP and Stamina

## 10) Audio
Three audio layers run simultaneously via the Web Audio API:

- **Background music** (`MusicPlayer` / `MusicLayer`): loads an audio file, loops it continuously, and applies a tunable master volume (`masterMusic`). Starts on first user interaction (browser autoplay policy). Currently plays `Assets/sounds/theme.mp3` (served from `public/sounds/`).
- **Spatial ambient** (`SpatialAudio` / `SpatialAudioLayer`): NPCs and POIs emit continuous synthesized tones audible from a configurable number of cells away. Attenuation uses both **lowpass** and **volume** with distance (tunable in F2).
- **Procedural SFX** (`SfxEngine` / `FeedbackLayer`): discrete one-shot sounds generated from scratch using oscillators, noise, envelopes, and filters. Triggered via `ui.sfxQueue`. Kinds: `ui`, `hit`, `reject`, `pickup`, `munch`, `step`, `bump`.

Volume controls: `masterMusic` (music layer) and `masterSfx` (SFX + spatial) are both in `AudioTuning` and adjustable in F2.

## 11) Graphics & rendering spec
- Three.js WebGL with `MeshStandardMaterial` on dungeon geometry.
- Anti-aliasing **off**; pixel ratio capped at **1.5×** (sharp edges, dither-friendly).
- Lighting:
  - warm **PointLight** on camera (“lantern”)
  - subtle forward **SpotLight** “beam” aligned to camera direction (lantern readability in fog)
  - up to **six** wall torch PointLights within visible radius
  - torch flicker via per-torch sine intensity
  - shadow mapping enabled; lantern lights cast shadows; dungeon geometry receives them
  - low emissive lift on dungeon materials; the lantern is the primary visibility driver
  - `FogExp2` is **optional** for depth falloff; **disabled by default** (can be enabled in F2 debug)
- Post-process: ordered dithering as shader pass (EffectComposer), controls:
  - Strength
  - Colour preserve
  - Pixel size
  - Levels
  - Matrix (Bayer 2×2/4×4/8×8)
  - Palette (Dungeon warm, Cold crypt, Monochrome, Sepia print, No palette snap)
- **Frame presentation pipeline**:
  - The 3D world is rendered offscreen into a **render target** sized to match the on-screen **game viewport rect** (the HUD “game” panel), not necessarily the full window.
  - The HUD exists as HTML/CSS twice:
    - an **interactive HUD** (`opacity: 0` over the final canvas but above the WebGL presenter, handles pointer input)
    - a **capture HUD** (offscreen, non-interactive) that is rasterized into a canvas texture
  - **HUD shell art**: a single transparent **`ui_hud_background.png`** (`Content/ui/hud/`, mirrored to `web/public/content/ui/hud/`) is drawn full-bleed behind the HUD grid in `HudLayout` (CSS `::before`, `background-size: contain`, centered). Existing widgets stay in the current CSS grid; opaque “glass” panel styling is removed so content sits on the artwork (fine-tune slot positions vs the art next).
  - Presenter sizing is derived from the **viewport CSS size** (prefer `visualViewport.width/height`, else `documentElement.clientWidth/clientHeight`) rather than measuring the presenter canvas element, to avoid resize feedback loops caused by renderers writing inline canvas CSS sizes.
  - A presenter compositor shader places the scene render target into the frame **only inside** the game viewport rect and overlays the captured HUD everywhere else (and over the scene where UI alpha exists).
  - The final composite then runs through the ordered-dither post-process so the **same dithering/pixelation** applies to both 3D and HUD.

## 12) Debug menu
- Accessible from main settings; scrollable; sections + search (expected to grow).
- Initial controls:
  - Light slider
  - Distance lowpass filter settings
  - Distance volume settings

## 13) Content pipeline (placeholders-first)
Create placeholder sprites in `placeholders/` and replace over time.

Asset types:
- Item PNG (transparent)
- Tile texture
- NPC sprite PNG (transparent)
- Portrait
- Mouth PNG (transparent)
- Eyes PNG (transparent)
- HUD shell PNG (transparent): `Content/ui/hud/ui_hud_background.png`

## 14) “Not now” ideas (parked)
- **Left hand**: a persistent on-screen left-hand slot holding an item (e.g., torch).

## 15) Open questions (to resolve)
- **Inventory pickup rules**: can you pick up world items directly (click) or only via interaction UI? (Currently: click-pickup + press/hold drag from world items are supported.)
- **Combat UI**: fully diegetic in HUD vs modal encounter panel; how much player agency per turn?
- **Crafting UI**: where does recipe discovery feedback live (log, tooltip, modal)?
- **NPC language system**: how messages map to item concepts; how to keep learnable but not trivial?
- **Multiplayer architecture**: host DB technology + sync model (event log vs state sync) and what must be deterministic vs authoritative.

