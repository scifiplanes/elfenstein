# Elfenstein — Design Document (living)

Last updated: 2026-04-09

## 1) High concept
**Elfenstein** is a web-based, grid-based dungeon crawler with a first-person **2.5D** view. Visuals combine **3D dungeon geometry** with **2D sprites** for characters/items, prioritizing a crunchy dithered/print look and a highly contextual, low-clutter UX.

## 2) Product goals
- **Modular + extensible**: content and stats are compartmentalized and easy to expand (items, NPCs, species, classes, floor types, etc.).
- **Multiplayer-ready later**: generation and state should be compatible with a future model where the **host player** runs the authoritative database and **1–3 clients** connect.
- **Contextual UX over menus**: few actions are available at any moment; actions branch into contextual interactions/modals.

## 3) Target platform & constraints
- **Platform**: Web (desktop first).
- **Layout**: HUD and compositor are authored at **1920×1080** CSS px inside **`FixedStageViewport`** (`stageDesign.ts`). The **`.clip`** is exactly the scaled **1920×1080** content box (**`STAGE_CSS_*`** in **`stageDesign.ts`**). A **3px** white frame uses **`outline`** on **`.clip`** with negative **`outline-offset`** so it sits just inside that rectangle without changing layout size. The stage **uniformly scales** by **`s = min(1, viewportW/1920, viewportH/1080)`** (using **`visualViewport`** when present): on viewports **larger than 1080p** the box stays **1920×1080 CSS px** centered with black margins; smaller viewports **shrink** so everything remains visible. **All stage-internal layers (presenter canvas, interactive HUD hit layer, capture HUD) are stage-relative (positioned against the 1920×1080 stage), not browser-viewport fixed**, so letterboxing/margins can’t offset the 3D viewport vs HUD. **`FramePresenter`** / WebGL canvas and **HUD `html2canvas` capture use the same 1920×1080 CSS size**—not the browser viewport. **`getBoundingClientRect()` includes that outer scale**, so the compositor’s **`gameRectPx`** and the **3D render target** use **layout** sizes (divide by **`s`** where needed, and **`clientWidth` / `clientHeight`** for the game viewport) so the scene + UI map correctly inside the stage. In-game CSS uses **`--stage-w` / `--stage-h`** instead of **`100vw` / `100vh`** for max widths/heights where needed.
- **Camera**: first-person, grid movement; no looking up/down; pits can exist but player can’t fall in. **Game yaw** (from `playerDir` / `view.camYaw`) uses forward \((\sin y,\,-\cos y)\) on the XZ plane; **Three.js** `camera.rotation.y` is set to **`-y`** so the rendered view matches that forward (Three’s Y rotation would otherwise flip the X component of view direction).
- **Renderer**: Three.js/WebGL for dungeon geometry.
- **Debug (F2)**: sliders for render/audio tuning, including **camera** (eye height, field of view, optional pitch for development) and **lighting** (lantern/beam/torch intensity + distance, base emissive lift, **shadow** toggles for point/beam, shadow map size and filter, max **nearest** POI torch lights). Includes quick procgen tools: **Regen**, **Descend (debug)**, **set `floorIndex`** (apply and apply+regen), and **floor property toggles** (`Infested` / `Cursed` / `Destroyed` / `Overgrown`) which take effect on Regen/Descend. Includes **Spawn (1 cell ahead)** for **NPC**, **POI**, and **item** (pick any seeded `ItemDefId`; item requires the cell ahead to be **floor**). **UI**: separate checkboxes to show the **NPC dialog** modal (uses the **first NPC** on the current floor; no encounter state) and the **death** modal (current run stats; does **not** set `ui.death` or block gameplay). Includes a small **Pose** readout (playerDir and camera yaw values) for diagnosing orientation issues and a **Cell** readout showing the **player cell** with tile + procgen room tags (district/roomFunction/etc). **Portrait**: portrait shake envelope (**hold/decay**) + amplitude, mouth flicker (**Hz** + **amount**), and min/max gap (ms) between Igor **idle** flashes and min/max **flash** duration (ms). **Audio** includes **master music** volume, spatial emitter mix, and **munch** SFX (volume, noise **LP sweep** endpoints, **HP** corner and **HP/LP Q**, duration, thump Hz, tremolo). Values load from `web/public/debug-settings.json`. Slider edits auto-save **locally**; persisting into the repo requires an explicit **Save to project** action (dev server only). There are **no always-on on-screen debug overlays** during play; debug UI is accessed via **F2** (and renderer-only debugging uses explicit query params when needed). Pitch is a debug aid only; core UX remains yaw-on-grid.

## 4) Core player experience (pillars)
- **Touch what you see**: the hand cursor is the primary verb (click, drag, drop).
- **Party as a single organism**: shared inventory and pooled capacity (via party endurance).
- **Discovery through interaction**: crafting by experimentation; NPC language as a memorization puzzle.
- **Atmosphere via light + sound**: darkness is default; proximity audio supports exploration.

## 5) Core loop
Explore → find POIs/NPCs/items → manage inventory/craft → resolve encounters → recover at POIs → push deeper (keys/doors) → repeat.

**On party wipe** (all party HP ≤ 0): gameplay input is blocked and a **death screen** is shown with a short **run summary** and actions:
- **New run**
- **Reload checkpoint** (if a checkpoint exists)
- **Title**

## 6) Controls & interaction model
### 6.1 Cursor (hand) states
- **OS cursor**: hidden globally (`cursor: none` on `document.body`); interactive HUD widgets also set **`cursor: none`** so controls (e.g. navigation buttons) never revert to the system pointer—only the **`CursorLayer`** hand sprite is visible. **`CursorLayer`** is a **sibling** of **`FixedStageViewport`** (not inside the scaled **`.stage`**): **`position: fixed`** with **`clientX`/`clientY`** must use the **viewport** containing block; a transformed ancestor would offset the hand from the real pointer. **`CursorLayer`** uses **`z-index: 9999`** above most UI; **all descendants use `pointer-events: none`** so the hand/ghost/affordance never **capture** clicks meant for DOM below. The **NPC dialog** portaled hit layer uses **`z-index: 10100`** (**above** the cursor layer) so **Close** / drag targets stay reliable; it stays **visually empty** (**`opacity: 0`**) so the hand remains visible through it.
- **Default**: `Hand_Point`
- **Holding/dragging**: `Hand_Hold` (held item sprite follows pointer)
- **Hover active**: `Hand_Active` when pointing at an interactable
- **Craft-ready hover**: while dragging an inventory item over another inventory item that can be crafted with it, the hand cursor flickers between `Hand_Hold` and `Hand_Active` and the affordance pill shows **⚗ Craft**; an icon badge shows `?` for unknown recipes or the result icon for discovered recipes.
- **Click micro-feedback**: on **pointer down**, the hand cursor can perform a **tiny shake** (purely cosmetic; debug-tunable in F2 under **Cursor**). This is a *micro* cue meant to add tactility without implying a successful action (success/failure feedback still comes from SFX/log/shake events).
- **Deadzone behavior**: hovering non-interactive UI areas should clear any previous “active” hover so the cursor returns to `Hand_Point`; pointer move/up are tracked globally across the HUD so cursor state can’t get stuck when moving over panels.
- **3D viewport hover override**: the WebGL viewport may inject a **virtual hover target** (e.g. `floorDrop`) on pointer-move to compensate for `elementFromPoint` seeing the compositor canvas rather than a DOM hit target. This override is **ephemeral (one move event)** so normal DOM-derived hover targets (inventory slots, portraits, etc.) take over immediately when the pointer leaves the viewport.

### 6.2 Interaction rules (mouse-first)
- **Click**: attempt to use/interact with target (object/NPC/POI/UI element).
- **3D viewport ray pick**: when several pickables lie on the same camera ray, **floor items take priority** over POIs (and over NPCs/doors on that ray) so loot is not blocked by large POI billboards (e.g. a chest in front of a dropped item).
- **Drag (items)**: dragging starts when you **press and move** beyond a small threshold (to avoid accidental drags on click). **Press + hold** is also supported as a fallback to begin dragging items from **inventory** and from **world floor items** in the 3D view.
- **Drop**:
  - Onto **inventory**: store item
  - Onto **empty 3D view**: drop item **a short distance ahead of the player** (tunable) so it is immediately visible; if blocked/out of bounds, it falls back to the player’s cell
  - Onto **another item**: attempt crafting / recipe discovery (see §7.3)
  - Onto **NPC**: use item on NPC (may be rejected/consumed/apply status/attack)
  - Onto **portrait eye**: inspect interaction
  - Onto **portrait mouth**: feed interaction
  - Onto **portrait hat zone** (top band): equip a **hat** item into **`head`** (see §7.4)
  - Onto **portrait hands zone** (bottom band): equip **one-handed** or **two-handed** items into **`handLeft` / `handRight`** (see §7.4)
- **Timing**: drop resolution uses the pointer-up timestamp (same `performance.now()` clock as `time/tick`) so short-lived UI cues (e.g. portrait mouth “chomp” burst) can’t expire immediately due to a stale tick time.
- **Preview affordance**: contextual icon appears near relevant elements indicating what releasing will do.

### 6.3 UX feedback
Interactions should resolve with:
- short relevant animation (e.g. eyes/mouth)
- sound
- **Activity log** (**`ui.activityLog`**, rendered as **`ActivityLog`** in the **bottom-right of the game viewport** in **`HudLayout`**): each line of feedback (POI outcomes, crafting, combat hits, door messages, inventory pickup/full, inspect/feed text, debug **`ui/toast`** dispatches, etc.) is **appended** (newest last); the list is **capped** in memory (**`ACTIVITY_LOG_MAX_ENTRIES`**), each line **expires** after **10 seconds** of game time (**`ACTIVITY_LOG_ENTRY_TTL_MS`**, pruned on **`time/tick`**; pruning is **paused** while the **death** modal is up so the recap stays stable), and the widget **shows at most the four newest** entries. It uses **no** filled panel background (text sits over the scene, using **`--buttonTitle*`** color and shadow for contrast). Lines are **right-aligned** in the viewport corner. Typography reuses **`--buttonTitleFontFamily`** / spacing / color / shadow from **`index.css`** at **`font-size: calc(var(--buttonTitleFontSize) - 5px)`**, with **regular (400)** weight (unlike **`--buttonTitleFontWeight`** on modal buttons). There is **no** separate centered transient **`ui.toast`** overlay; the **`ui/toast`** action remains as a convenience and **only** pushes a log line.
- subtle camera shake for key interactions (driven by `ui.shake` and tunable in Debug/F2). **Shake length / hold (ms)** and **shake decay / fade (ms)** control the envelope for the **3D camera**, **HUD overlay shake**, and **portrait frame shake** (shared `shakeEnvelopeFactor` in `web/src/game/shakeEnvelope.ts`). With length 0, decay uses the legacy ramp `min(1, remaining/decay)`; with length above 0, full strength holds for the scaled hold segment, then linearly fades over the scaled decay segment within each event’s `startedAtMs`→`untilMs` window.
- subtle camera shake for key interactions (driven by `ui.shake` and tunable in Debug/F2). **Shake length / hold (ms)** and **shake decay / fade (ms)** control the envelope for the **3D camera** and **HUD overlay shake** (shared `shakeEnvelopeFactor` in `web/src/game/shakeEnvelope.ts`). With length 0, decay uses the legacy ramp `min(1, remaining/decay)`; with length above 0, full strength holds for the scaled hold segment, then linearly fades over the scaled decay segment within each event’s `startedAtMs`→`untilMs` window.
- **Portrait frame shake** on portrait interaction resolution (inspect and feed), driven by `ui.portraitShake` on the matching character slot

### 6.4 Grid movement (first-person)
- **Model**: discrete cells; facing is one of four compass directions (**`playerDir`** is canonical 0=N,1=E,2=S,3=W); the 3D camera **yaw** matches facing when idle. **Strafe** moves one cell **left or right relative to facing** without rotating (**A** / **D**). **W** / **S** move **forward** / **backward** along facing.
- **Turning**: left/right turns always animate the **shortest** 90° rotation. Internally, the animated camera yaw may be temporarily **unwrapped** across the \(0 \leftrightarrow 2\pi\) boundary so the interpolation never takes a 270° path; when the turn completes the camera yaw snaps back to the canonical \(dir \cdot \pi/2\) in \([0,2\pi)\).
- **Keyboard** (see `GameApp.tsx`): **W** / **S** (and **↑** / **↓**) forward/back; **A** / **D** strafe left/right; **Q** / **E** turn left/right. **F2** toggles the debug panel.
- **HUD**: the bottom grid row (minimap + inventory + navigation) has a shared row height of **285 px** (**−5%** vs the prior **300 px** row, after the earlier **−25%** step from **400 px**); it stays the **third** grid row so widgets remain **bottom-aligned** with **`1fr` / `1fr`** rows above taking the freed space. The **minimap is north-up** and shows a **local “pixel-circle”** around the player: it **only draws** dungeon tiles that satisfy **dx² + dy² ≤ 9** (**radius 3**, Euclidean on the square grid) **and** lie **inside the current floor rectangle**—**no** placeholder squares for out-of-disk or **out-of-bounds** cells (those spots are simply empty; **HUD/game chrome** shows through). Tile positions use a **7×7** logical grid with **absolute** placement so on-map cells stay **north-up aligned**. The widget is **clipped to a circle** with **no** filled circular backdrop. Each cell is drawn at **~22.5×22.5 CSS px** (**+25%** vs the prior **18 px** cell) with a **~2.5 px** gap (**`MINIMAP_CELL_PX`** / **`MINIMAP_GAP_PX`** in **`MinimapPanel.tsx`**, **`--minimap-cell`** on the map); cells are **square** (**`border-radius: 0`**) for a chunky look. The player tile includes a **facing arrow** (4-way) so orientation is readable at a glance; tile fills use **opaque** colours with **moderate** wall/floor separation and softened feature accents so the map stays legible through HUD capture and dither without looking harsh. **Left and right** portrait **rails** (rows **1–2**) use **`minmax(0, 1fr) 120px minmax(0, 1.12fr) 120px minmax(0, 1fr)`**. **CHAR1/CHAR2** (left) and **CHAR3/CHAR4** (right) `<section>`s use **75%** rail width with **`justify-self: start`** / **`end`** so they line up with the **map** / **navigation** blocks below. Row **3** is a **`bottomRow`** wrapper: nested **`grid-template-columns: 0.75fr 120px 1.62fr 120px 0.75fr`** (same **3.12fr** sum as **`1 + 1.12 + 1`**) shifts width into the **center** so **inventory** (spans the **120 + 1.62fr + 120** band) stays wide. **Map** and **navigation** `<section>`s use **100%** of their **0.75fr** tracks (**0.75fr** total), matching portrait strips’ **75%** of the **1fr** rails above (**0.75fr**); they have **no** MAP/NAVIGATION title headers; the **inventory** panel likewise has **no** section title, and **inventory** grid item icons (emoji) render at **~44 CSS px**; **statueL** / **statueR** (**`StatuePanel`**) have **no** section titles and **no** in-panel placeholder labels (the rail cells are reserved empty for future statue art). **`HudLayout`** **`display: flex`** + **`align-items`/`justify-content: center`** centers each widget in its cell. Rows **1–2** still use **1.12fr** for the **game** viewport. At a reference desktop width this yields roughly the former **~518 px** outer / **~580 px** game-column proportion. The **navigation** panel is a **3×2** image pad (sources under `Content/ui/navigation/`, mirrored to `web/public/content/ui/navigation/` for the dev server): each **cell is drawn at 50% of the bezel PNG native size** (**88.5×88.5 px** from 177×177 sources), **square** corners (no radius on the cells); on press it shows **ui_navigationbutton_pushed** for **0.5 seconds**, then returns to default. Direction glyphs are separate overlays (**arrow up/down/left/right**, **turn left/right** icons). Layout row 1: turn left, forward, turn right; row 2: strafe left, back, strafe right. The pad’s intrinsic width is **~271.5 px** (three cells + gaps); it stays **centered** inside the **navigation** panel. Tooltips still echo keyboard shortcuts (§6.4). **Note**: the on-screen HUD is composited from an offscreen **capture** DOM (`HudLayout` with `captureForPostprocess`); the **interactive** HUD is pointer-transparent (`opacity: 0`). Navigation “pushed” bezel state therefore lives in `DitheredFrameRoot` and is passed into **both** trees so `html2canvas` sees **`ui_navigationbutton_pushed.png`** on the cell you pressed.
- **Viewport**: clicking a **door** attempts a **forward** step into that cell (open normal door or try key on locked door).
- **While a move/turn animation is playing**, new step, strafe, and turn input is ignored so the player resolves one grid action at a time.
- **Audio**: a successful step or strafe plays a short **step** SFX; walking into a solid tile uses a distinct **bump** SFX (with **activity log** line + shake).

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
  - **Afonso**:
    - Base: `Content/Afonso_base.png`
    - Eyes (open): `Content/Afonso_eyes.png`
    - Eyes (inspect hover): `Content/Afonso_eyes_inspect.png`
    - Mouth: `Content/Afonso_mouth_open.png`
    - Idle overlay: `Content/Afonso_base_idle.png`
- **Portrait press (frame)**: a **primary-button press** (`pointerdown`) on the **portrait frame** triggers a short **`ui.portraitIdlePulse`** window so the **idle sprite** shows for one burst (same **min/max ms** tuning as ambient idle flashes: `portraitIdleFlashMinMs` / `portraitIdleFlashMaxMs` in F2). **`HudLayout`** handles this at the HUD root capture on `[data-portrait-character-id]` so it remains responsive even when a release would be delayed/lost; if the press becomes a drag or exceeds movement slop, the pulse is cancelled (`ui/portraitIdleCancel`).
- **Portrait scaling**: the portrait frame scales up to fill as much of its HUD slot as possible while **preserving the portrait asset aspect ratio**; portrait art is rendered using **no-crop fit** (scaled as large as possible while fully visible within the frame). Layered portrait sprites are offset **30px upward** from the geometric center of the frame for composition; mouth “chomp” animations preserve that offset.
- **Portrait stats presentation**: character vitals + status use a **compact bottom overlay inside the portrait frame** (gradient dark at the bottom, fading upward). The overlay is painted **in front of** portrait sprites and equipped-item icons (**higher `z-index`**) so bars stay readable; it uses **`pointer-events: none`** so drag/hit targets (eyes, mouth, hat, hands) still work underneath. Vitals sit in a **2×2 grid**: **row 1** = **Health** | **Stamina**, **row 2** = **Hunger** | **Thirst** (left-to-right). Each cell is a small panel (**black** **`#000`**, **`2px solid`** border matching **inventory slots** **`rgba(171, 136, 107, 0.75)`**, **`border-radius: 0`**, inner **padding**) containing **only** a **horizontal bar** (**no** emoji): bar **track** **black**, **~9px** tall, **square** corners (**`border-radius: 0`** on track and fill), **fill** colors: **HP** **`#ff2400`**, **STA** **`#d6bdb5`**, **HUN** **`#547d39`**, **THR** **`#3d75dd`** (see **`VITAL_BAR_FILL`** in **`PortraitPanel.tsx`**). Grid and overlay use tight **`3px`** gaps; status line **`~3px`** below the grid. Overlay padding **`6px 70px 20px`**. **Interim:** each bar’s fill is **always full** until **max** + **current** exist in state. No numeric readout. A **status** line below (**`Status: …`**) stays **single-line truncated** when long.
- **Portrait blinking**: the eyes layer is **occasionally hidden briefly** to simulate blinking.
- **Portrait idle overlay**: while the **idle overlay** sprite is visible (ambient flash or `ui.portraitIdlePulse`), the base **eyes sprites are hidden** so they can’t show through under the overlay (inspect hover still overrides).
- **Portrait inspect hover**: while **dragging** an item and hovering the **eyes** target area, the portrait swaps to an **inspect eyes** sprite (if available). Inspect hover **overrides blink hiding**.
- **Portrait mouth visibility**: mouth layer is **hidden by default**; it becomes visible during **feeding interactions** (dragging over mouth target and briefly after a feed attempt).
- **Portrait mouth feedback (feed)**: after releasing an item on the mouth target, play a short “chomp” (mouth flicker + tiny wiggle), a short **portrait frame shake**, and a brief **munch** SFX on successful feeding. **No** `ui.shake` (3D view or empty HUD overlay) for portrait inspect/feed—only `ui.portraitShake` on the relevant slot.
- **Portrait inspect**: resolving an eye drop plays a short **portrait frame shake** (gentler than feed), likewise without 3D shake.
- **Portrait reaction rendering**: the HUD base is captured to a texture for postprocess, but **mouth flicker** and **idle pulses** are rendered as **compositor-time overlays** in the WebGL presenter (using the live HUD layout rects). This keeps reactions **snappy** and **full-FPS** without waiting for async HUD recapture. During a portrait press / `portraitIdlePulse`, HUD capture temporarily runs in a **burst** cadence and includes the **pressed-portrait key** so the eyes-hidden layer is captured immediately (avoids a one-capture lag where eyes remain visible under the idle overlay).
- **Portrait shake tuning**: portrait frame shake has its own envelope and amplitude tuning via `RenderTuning`:
  - `portraitShakeLengthMs` / `portraitShakeDecayMs` (envelope)
  - `portraitShakeMagnitudeScale` (amplitude multiplier applied to `ui.portraitShake.magnitude`)
  - `portraitShakeHz` (oscillation speed for the portrait shake transform)
  - Portrait shake duration is at least the authored base duration, but increases to match the tuned envelope window so “hold/decay” can produce multi-oscillation shakes.
- Portrait **drop targets** (stacked regions):
  - **Hat band (top of frame)** → equip into **`head`** (`PortraitPanel` `hatZone`; item must be tagged **`hat`** and list **`head`** in `equipSlots` when `equipSlots` is present)
  - **Eyes area** → inspect drop target
  - **Mouth area** → feed drop target
  - **Hands band (bottom of frame)** → equip hands (`PortraitPanel` `handsZone`; vitals overlay is **`pointer-events: none`** so it does not steal hits)
- **Handedness (content tags on `ItemDef`)**: **`oneHand`** items go to one hand—**left first**, then **right**; if both are occupied, the new item **replaces the left hand** (previous item is stowed to the first free inventory slot when possible). **`twoHand`** items occupy **both** hands at once; the same `itemId` is stored in **`handLeft`** and **`handRight`** so unequip/replace clears both without duplicating the item in inventory.

**Properties**
- **Identity axes (initial sets, extendable)**:
  - Species: `Igor` (goatmen), `Mycyclops` (one-eyed mushroom person), `Frosch` (frog person), `Afonso`
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
- On the HUD, the **inventory** panel has **20 px** padding on all sides around the grid.
- Inventory is a **large grid panel** for management; each cell has a **square** shape with a **2 px** border tinted **`#ab886b`** at **0.75** opacity (no corner rounding). **Emoji** item icons in slots use **~55 CSS px** font size (**+25%** vs the prior **44 px**).
- **Capacity**: number of grid cells is informed by **total party Endurance**.
- Inventory UI is **scrollable in sections** (paged), not continuous.
- Hovering an **occupied** slot shows the item’s **name** in a small overlay rendered with the **cursor layer** (the interactive HUD grid is hit-only; labels align to the hovered slot in viewport space), set in **[Jim Nightshade](https://fonts.google.com/specimen/Jim+Nightshade)** at **~33 CSS px** loaded as a **webfont** from Google Fonts.
- **Button title** typography (primary label on modal/HUD buttons that use the display face at a slightly smaller size than the inventory hover tooltip) is centralized in **`web/src/index.css`** as **`--buttonTitleFontFamily`** (same stack as **`--fontInventoryTooltip`**), **`--buttonTitleFontSize`** (**25 CSS px**), **`--buttonTitleFontWeight`**, **`--buttonTitleLetterSpacing`**, **`--buttonTitleLineHeight`**, **`--buttonTitleColor`**, and **`--buttonTitleTextShadow`**. New UI should reference these instead of duplicating literals.
- **Modal chrome (shared)**: **`TitleScreen`**, **`DeathModal`**, **`PaperdollModal`**, and the NPC dialog **panel** share presentation from **`web/src/ui/shared/GamePopup.module.css`**: **`rgba(18, 20, 28, 0.92)`** fill, **square** corners, **`2px`** border **`rgba(171, 136, 107, 0.75)`** (aligned with inventory slots), and **`--buttonTitle*`** typography for titles, body/hint text, **Close**, and footer **action** buttons (primary actions use the existing red-forward treatment). Modals that need a visible scrim compose **`backdropDim`** locally with their own positioning/stacking. **NPC dialog** remains special for **no dim** behind the interactive panel, **dual DOM** (capture + portaled hit layer), **viewport top anchor**, and **`z-index`** above **`CursorLayer`**—see §7.5.
- Dragging inventory item into empty 3D space drops it onto the floor (cell).
- **Floor item billboards** in the **3D view** use the **same `ContentDB` icon** as inventory and paperdoll (emoji drawn to a canvas texture, or `icon.kind === 'sprite'` loaded as a PNG); **theme tint** on those sprites follows the same convention as other world billboards.

### 7.3 Items & crafting
- Items are found on dungeon floor and via POIs/NPC drops.
- **Crafting trigger**: drag one item onto another.
- **If recipe exists**:
  - show a visible timer
  - perform a skill check (d20 + party-best skill vs recipe DC)
  - on success: crafted result
  - on failure: notify; chance to destroy one involved item
- **Recipe discovery (cursor telegraph)**: while hovering a valid craft combo in the inventory, the cursor shows **⚗ Craft** and a small result badge. Before the recipe is discovered it shows `?`; after a successful craft it shows the resulting item icon.

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

**Hive/Swarm ecosystem (implemented)**
- **Hive (item)**: drag-drop Hive onto the 3D view (floor) to crack it. Usually breaks; spawns a **Swarm** or, rarely, yields a **Swarm Queen** item.
- **Swarm Queen (item)**: while held by the party, **Swarms are neutral**.
- **Swarm Basket (item)**: drag onto a **Swarm** to capture it → produces **Captured swarm**.
- **Captured swarm (item)**: drag onto an enemy to release for **heavy damage**.

**Crafting breadth (current content pack)**
- **Weapons/tools**: craftable basics such as **Stone shard**, **Bow**, **Sling**, **Bolas**.
- **Remedies**: craftable **Bandage strip**, **Herb poultice**, **Antitoxin vial** (usable via feed to apply their cure effects).
- **Cooking**: craftable intermediate **Mortar meal** and food **Flourball**, plus simple drinks like **Herb tea**.
- **Headwear (hat slot)**: craftable **Wool cap** (`Cloth scrap` + `Twine`), **Herb circlet** (`Herb leaf` + `Twine`), **Spore cap** (`Mushrooms` + `Cloth scrap`); also appear rarely on dungeon floor (Passage / Communal / Habitat biases) and in **chest** / **barrel** / **crate** loot tables.

### 7.4 Equipment & paperdoll
- **Paperdoll**: currently disabled; equipment slots still exist in state and can be manipulated via **drag onto portrait hat/hands zones** (§6.2) and via the paperdoll modal code path if re-enabled.
- **Portrait equip**: drag from **inventory** (or other supported drag sources) onto the portrait **hat** or **hands** hit regions; invalid items log a short rejection line and play reject SFX. Equipped **head** and **hand** items are drawn on the portrait (**`ContentDB`** emoji or sprite icon), aligned to the same bands as the drop targets: **hat** in the **top** strip, **left hand** at the **bottom-left** of the hands strip, **right hand** or **two-handed** (same `itemId` on both hands) at the **bottom-right**.
- **Portrait unequip (drag out)**: drag starts from those equipped **icons** (same `drag/drop` payload as paperdoll **equipment** slots). Hit targets are **transparent** `<button>` chrome (**`appearance: none`**, no border/padding/background) so **PNG** icons keep **alpha** against the portrait. Release onto **inventory**, the **world floor**, or **anywhere without a drop target** to **stow** into the first free inventory slot (void-drop stow is **portrait-origin only**, so paperdoll drags do not auto-stow on empty release). Moving equipped items into inventory or onto the floor **clears equipment** first so items are not duplicated between equipment and grid.
- **Item tags for equip rules**: besides existing tags (`food`, `weapon`, `tool`, …), equipment logic uses **`hat`** (head slot via portrait hat zone), **`oneHand`**, and **`twoHand`** (hands zone and hand slots in `equipItem`). Hand-slot drops on the **paperdoll** grid use the same rules when the item is dragged to **`handLeft` / `handRight`**.
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
  - The NPC dialog header is **text-only** (**`{name} · {status}`**); there is **no** portrait/icon next to the title (in-world billboards remain unchanged). (the **language id** is **not** shown in the chrome—players infer it from **gibberish** copy). Dialog copy (**title**, **body**, **hint**, **Close**) uses the **`--buttonTitle*`** face (**Jim Nightshade** stack) while keeping the prior **pixel sizes** (**37 / 23 / 21 / 23** CSS px respectively for title / body / hint / Close). **Close** uses a **`2px`** border in **`--buttonTitleColor`** (same as its label) and **square** corners.
  - The NPC dialog panel is **anchored to the top of the 3D game viewport** (`GameViewport`), **horizontally centered** (**`translateX(-50%)`** on the viewport’s horizontal midpoint). **Top inset** is **10 CSS px** below the viewport’s top edge (interactive: inline **`top`** from **`getBoundingClientRect`**; capture: **`npcCaptureLayer`** uses **`align-items: flex-start`** and **`padding-top: 10px`** with **`justify-content: center`**). **Width** uses **`min(620px, stage width − 24px)`** via **`--stage-w`** (**`max-width: 100%`** in the game cell). If the game viewport ref is not ready (e.g. tests), the interactive panel falls back to **`left: 50%`**, **`top: 10%`**, **`translateX(-50%)`**. There is **no** full-screen dimming layer behind the panel (HUD/game stay fully visible around it). The dialog **panel** uses **square corners** (**no** outer **`border-radius`** on the main box). **Close** is **square** (**`border-radius: 0`**). The panel **border** matches **inventory grid slots** (**`2px solid rgba(171, 136, 107, 0.75)`**, same as **`InventoryPanel`** **`.slot`**). There is **no** **Pet** control in the dialog; the **`npc/pet`** reducer action remains for potential reuse but has **no** player-facing trigger in **`NpcDialogModal`**.
  - **Wurglepup** uses **`/content/npc_slime.png`** as its primary billboard (kind id stays `Wurglepup` in data). **Catoctopus** and **Wurglepup** alternate between base and **idle** PNGs (`npc_catoctopus_idle.png`, `npc_slime_idle.png`) on a short shared timer in `WorldRenderer` (one material per kind, so all instances share the same phase).
  - Until per-kind art exists for every `NpcKind`, any remaining missing URLs are still satisfied by **binary copies** of **`Placeholders/Placeholder_NPC.png`** under `web/public/content/` at the path expected by `NPC_SPRITE_SRC` / `POI_SPRITE_SRC`.

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
- **Doors/keys**: passages can be blocked by door types requiring appropriate keys; procgen records **`keyDefId`** per locked door in **`floor.gen.doors`** (gameplay opens a door only if the party holds a matching item, e.g. **IronKey** / **BrassKey**). In the 3D view, doors are rendered as **sprite billboards** (`door_closed.png` on the tile). When a door is opened, the tile becomes `floor` immediately and the renderer may show a **brief open flash** (`door_open.png`) as a short-lived FX cue.
- **Difficulty** (`0` = easy, `1` = normal default, `2` = hard): **`GameState.floor.difficulty`** and **`FloorGenInput.difficulty`**. Tunes how many **validation rerolls** run (**8** / **6** / **5**), minimum entrance→exit shortest-path length before placing locks (**10** / **6** / **5** for any lock; two-lock branch only when path length ≥ **14** at normal, ≥ **11** at hard, and **never** at easy), and scales the **`layoutScore`** lock+loop bonus when choosing among valid rerolls (easier prefers layouts with less lock+loop weight; harder the opposite). Echoed as **`floor.gen.meta.difficulty`**.

### 8.2 Starting algorithm (prototype baseline)
**Floor type** (`Dungeon` | `Cave` | `Ruins`) selects a **geometry realizer**, then shared post-passes and population:

1. **Layout (per `floorType`)**
   - **Dungeon**: BSP partition (min leaf ~6×6; depth ~6), room carve (~45–70% of leaf), sibling **L-corridor** stitch, then a guarded **door-frame** pass that introduces a small number of 1-tile **throats** in straight corridors so rooms read as connected by doorways (locks prefer these frames).
   - **Cave**: seeded worm carve + occasional widen, then a single **GenRoom** from the floor bounding box of carved cells (fallback box if empty).
   - **Ruins**: ~5×5 macro-cell stamps with random doorways between cells; stamped chambers are deterministically **clustered into macro rooms** (bounded count) for tagging/districts/population.
2. Connectivity repair (deterministic), then CA **carve-only** smoothing (one pass).
3. Exit selection (exit = **farthest** reachable floor cell from the entrance by BFS).
4. **Derived connector rooms**: a small number of **junction/connector** rooms are derived from corridor junction clusters (bounded) and treated as **Passage** anchors for tags/spawn bias.
5. **Districts**: seeded Voronoi on room centers → **`district`** tags (`NorthWing`, `SouthWing`, …) for spawn bias.
6. **Room tagging**: quota-aware function assignment (e.g. try to keep at least one **Storage** among tiny rooms) plus rolls from **`floorProperties`** (Infested/Cursed/Destroyed/Overgrown). Derived connector rooms keep their fixed `Passage` function.
6. **Tag constraints** (post-quota): **Storage** prefers a **dead-end** room center (swap with a tiny **Passage** room when needed); on **Cursed** floors, **Flooded** expands to **edge-adjacent** rooms with a fixed probability so hazards form a small cluster.
7. Population pass:
   - POIs (**Well** / **Bed** / **Chest** / **Barrel** / **Crate** / optional **Shrine** / optional **CrackedWall** / **Exit**) from entrance–exit heuristics + storage-room bias for chest/barrel/crate (Exit spawns at/near `gen.exit`)
   - NPCs and floor items from **`spawnTables.ts`** (room function, **`roomStatus`**, district, **`floorType`**, **`floorProperties`**, and whether the room center lies on a shortest entrance→exit path before locks) so balancing can stay data-shaped without touching placement loops
8. **Lock/key pass** on the entrance→exit **shortest path**: place **ordered** separating `lockedDoor` tiles when possible. Long paths may get **two** gates (**A** + **IronKey**, **B** + **BrassKey**); shorter paths use **one** (**A** + **IronKey**); otherwise skip locks. Keys carry **`forLockId`** in **`floor.gen.floorItems`** for validation/debug.
9. **`missionGraph`**: nodes (entrance, exit, POIs, locks, keys); **path** edges chain POIs by BFS distance from entrance, then the lock sequence, then exit; **`shortcut`** edge (entrance→exit) is present when multiple shortest-length routes exist; **`hasAlternateEntranceExitRoute`** mirrors that flag for tools.
10. **Theme**: **`floor.gen.theme`** (`id` + floor/wall/ceiling **color** multipliers) from a dedicated RNG stream; **`WorldRenderer`** tints **Lambert** dungeon materials (textures unchanged).

**First load**: `makeInitialState` runs the same `generateDungeon` pipeline as `floor/regen` (**31×31**), with **`floor.seed`** (random on cold start), **`floor.floorIndex`** (0 on first floor), **`floor.floorType`** (default **Dungeon**), **`floor.floorProperties`** (default empty), and **`floor.difficulty`** (default **1**). The canonical bundle is **`floor.gen`** (`genVersion` **5**); the party spawns at **`gen.entrance`**.

**Meta-progression**: floors are advanced by interacting with an **Exit POI** placed at/near `gen.exit`. Descending increments **`floorIndex`**, cycles **`floorType`** (Dungeon→Cave→Ruins), and generates a **new random `floor.seed`** for the next floor.
Default floor dimensions are **31×31**; `floor/regen` keeps the current **`floor.w` / `floor.h`** and reapplies **`floorType` / `floorProperties` / `floorIndex` / `difficulty`** from state unless you add UI to change them.

### 8.3 Determinism requirement
Generation should be **seeded** and phase-stable (changes to one phase shouldn’t ripple unpredictably into others) to support future host-synced multiplayer.

Validation is part of generation: the generator runs **bounded deterministic rerolls** (attempt count depends on **`difficulty`**; see §8.1) when **ordered** lock/key constraints fail, when **safety POIs** violate reachability caps (**Well** within **3** BFS steps of **`entrance`**, **Bed** within **48**), or when the floor has **any** procgen **locks** but the entrance→exit shortest-path **lattice** is not wider than a single spine (no meaningful alternate route of the same shortest length). Among attempts that pass validation, the run picks the one with the highest **soft `layoutScore`** (reachable floor mass, dead-end penalty, path length bonus, **junction** count for 3+ neighbor floor cells, bonus when that lattice is wide, extra bonus when locks are present and the lattice is wide — **lock+loop** term scaled by **`difficulty`**); if none validate, it returns the **last** attempt (still full geometry) like before. Output always has a non-empty **`rooms`** list except catastrophic fallback (single carved room).

**Meta** records **`inputSeed`**, **`attemptSeed`**, **`attempt`**, **`layoutScore`**, **`difficulty`**, and **phase streams** (`layout`, `tags`, `population`, `locks`, `districts`, `score`, **`theme`**, **`mission`** for future / reserved **`planMissionBeforeGeometry`**).

### 8.4 Reference pipeline (expanded)
See `Dungeon_generation_plan_summary.md` for an expanded phased pipeline (mission graph → lock correctness → geometry → districts → tagging solve → population → validation → debug overlays). The **geometry-first** pipeline is still what ships; **`web/src/procgen/missionFirst.ts`** defines **`PlannedMission`** / **`planMissionBeforeGeometry`** (returns `null` today), the **embedding contract**, and an in-file **Track B** specification (abstract plan vs realized **`missionGraph`**, per-**`floorType`** embed strategy, future **`genVersion`** when embedding ships).

**Debuggability**: the F2 Debug panel includes a **Procgen** readout (**difficulty**, **floorType**, **floorIndex**, **genVersion**, **`streams.mission`**, **attempt**, **layoutScore**, **theme** id, **missionGraph** size and alternate-route hint), **Cycle type** (Dungeon→Cave→Ruins for the next regen), **Cycle difficulty** (easy→normal→hard for the next regen), **Proc overlay** (cycles **off** / **districts** / **roomTags** / **mission** tints on the 3D floor from **`floor.gen`**), and **Dump `floor.gen`** to download the canonical JSON.

## 9) Points of interest (POIs)
Static interactables. POIs are **non-blocking** and do not trigger on movement; interact via **click** or by **dragging items onto them**.

- **Placement invariant**: there is **at most one POI per grid cell**. If procgen produces multiple POIs for the same cell, the game resolves it deterministically (canonical IDs win, then kind priority) so runs remain stable and interactions remain unambiguous.
- **3D view**: POIs render as **sprite billboards** (same texture pipeline as NPC billboards: nearest filtering, transparent PNG). **Well (filled)** uses **`npc_well.png`** plus extra **non-pickable** billboards: **`npc_well_glow.png`** (slightly larger halo) and a small **sparkle** layer cycling **`npc_well_sparkle_1..3.png`** (~280 ms per frame). **Well (drained)** uses **`npc_well_drained.png`** only (no glow/sparkle). **Chest**, **Barrel**, and **Crate** use closed/open PNG pairs (`chest_*`, `barrel_*`, `crate_*`). **Exit** uses **`stairs_down.png`** at **2×** the default POI billboard scale (other POIs use a uniform base height). **Shrine** uses **`shrine_gnome.png`** until the first interaction, then **`shrine_gnome_off.png`**. **Bed** and **CrackedWall** use **`/content/poi_placeholder.png`** (a copy of **`Placeholders/Placeholder_NPC.png`**) until dedicated POI art exists. Billboards use a **bottom-centered pivot** (`Sprite.center`) so the texture’s lower edge anchors to the floor; vertical placement is **`poiFootLift`** (F2: **POI above ground**, independent of **`npcFootLift`**). Per-art **`poiGroundY_Well`** / **`poiGroundY_Chest`** (and **`npcGroundY_Wurglepup`** for other kinds) still shift where the “ground contact” sits within the PNG. Brightness uses **`render.poiSpriteBoost`** (F2; default tuned brighter than 1.0).

Initial POIs:
- **Well**: **checkpoint save point** (clear notification); used to fill Waterbag; a successful **Waterbag (Empty)** use on this well sets the POI to **drained** (visual swap + VFX off); **checkpoint save still works when drained**. Checkpoints are reloadable from the **death screen** and the **title** screen.
- **Chest**: opens (sprite change) and drops random item
- **Barrel**: opens (sprite change) and drops random item
- **Crate**: opens (sprite change) and drops random item
- **Bed**: restores full HP and Stamina
- **Exit**: descends to the next floor (meta-progression)

## 10) Audio
Three audio layers run simultaneously via the Web Audio API:

- **Background music** (`MusicPlayer` / `MusicLayer`): loads an audio file, loops it continuously, and applies a tunable master volume (`masterMusic`). Starts on first user interaction (browser autoplay policy). Currently plays `Assets/sounds/theme.mp3` (served from `public/sounds/`).
- **Spatial ambient** (`SpatialAudio` / `SpatialAudioLayer`): NPCs and POIs emit continuous synthesized tones audible from a configurable number of cells away. Attenuation uses both **lowpass** and **volume** with distance (tunable in F2).
- **Procedural SFX** (`SfxEngine` / `FeedbackLayer`): discrete one-shot sounds generated from scratch using oscillators, noise, envelopes, and filters. Triggered via `ui.sfxQueue`. Kinds: `ui`, `hit`, `reject`, `pickup`, `munch`, `step`, `bump`.

Volume controls: `masterMusic` (music layer) and `masterSfx` (SFX + spatial) are both in `AudioTuning` and adjustable in F2.

## 11) Graphics & rendering spec
- Three.js WebGL with `MeshLambertMaterial` on dungeon geometry (diffuse + emissive; no PBR metalness/roughness).
- **Dungeon albedo**: floor / wall / ceiling voxels use tiled PNGs from `Content/` (stable **`/content/…`** URLs; Vite also serves the repo **`Content/`** tree in dev and copies it into **`dist/content/`** on build). **`FloorType` `Dungeon`** uses **`dungeon_floor.png`**, **`dungon_wall.png`**, and **`dungon_ceiling.png`**. **`Cave`** uses **`cave_floor.png`**, **`cave_wall.png`**, and **`cave_ceiling.png`**. **`Ruins`** uses **`ruins_floor.png`**, **`ruins_wall.png`**, and **`ruins_ceiling.png`**. Textures use **repeat wrapping** (~one repeat per 1×1 world-unit face).
- Anti-aliasing **off**; pixel ratio capped at **1.5×** (sharp edges, dither-friendly).
- Lighting:
  - warm **PointLight** on camera (“lantern”)
  - optional forward **SpotLight** “beam” aligned to camera direction (tunable; often off via intensity scale). When effective beam intensity is zero, the spot is **not visible** and does **not** cast shadows (no wasted shadow pass).
  - POI **torch** PointLights: up to **`torchPoiLightMax`** (F2), choosing the **nearest** POIs to the player by Manhattan grid distance (0 disables torches)
  - torch flicker via per-torch sine intensity
  - **Shadow mapping** is enabled only while at least one lantern light has shadows on: **point** shadows (expensive cube map) and **beam** shadows are separate F2 toggles (`shadowLanternPoint`, `shadowLanternBeam`). **Shadow map size** and **filter** (basic / PCF / PCF soft) are tunable in F2. Dungeon geometry casts/receives where applicable.
  - low emissive lift on dungeon materials; the lantern is the primary visibility driver
  - `FogExp2` is **optional** for depth falloff; **disabled by default** (can be enabled in F2 debug); the renderer reuses one fog instance instead of allocating every frame
- Post-process: ordered dithering as shader pass (EffectComposer), controls:
  - Strength
  - Colour preserve
  - Pixel size
  - Levels
  - Post-dither levels (classic lift/gain/gamma; affects HUD + 3D equally)
  - Matrix (Bayer 2×2/4×4/8×8)
  - Palette (Dungeon warm, Cold crypt, Monochrome, Sepia print, No palette snap)
  - **Warm palette mix** (F2): when palette is **Dungeon warm** (0), blends between **quantised dither only** (like no snap) and **full warm five-colour snap**; other palette indices ignore this control
- **Room-property telegraph (compositor)**: when the player is standing in a room tagged with a **room property** (`Burning` / `Flooded` / `Infected`), the compositor applies a **luma-preserving color tint override** (blend toward a hazard RGB at uniform strength over the full 3D viewport—**no vignette**) so the hazard read clearly **overrides** the floor theme cast while keeping local brightness structure. Hazard telegraph **intensity pulses slowly** (~**3.8 s** sine) by scaling the **graded tint only** (fixed hazard RGB ratios), not the blend weight—so the cast stays **one hue** and does not swing toward unrelated scene colors. **`Burning`** reads as **hot red**; **`ruins_umber`** floor theme lighting uses **brown umber** intent (not fire red) so the two do not collide. Room lookup matches **`roomForCell`** (containment only; no nearest-room fallback). Tuning/preview can be forced via the debug telegraph override.
- **Room-hazard floor decals (3D)**: `WorldRenderer` draws **non-interactive** sprite billboards on **`floor`** tiles inside procgen rooms whose **`tags.roomProperties`** matches the hazard: **`hazard_fire.png`** / **`hazard_water.png`** / **`hazard_poison.png`** (URLs under **`/content/`**). Placement is **sparse and deterministic** (~**40%** of eligible cells, keyed by **`floor.seed`** + room id + cell), and cells occupied by a **POI**, **NPC**, or **floor item** are skipped. Decals sit low on the floor (ground-stain height), use the same **theme tint** as other billboards, and rebuild with **`floorGeomRevision`**.
- **Frame presentation pipeline**:
  - The 3D world is rendered offscreen into a **render target** sized to match the on-screen **game viewport rect** (the HUD “game” panel), not necessarily the full window.
  - The HUD exists as HTML/CSS twice:
    - an **interactive HUD** (`opacity: 0` over the final canvas but above the WebGL presenter, handles pointer input)
    - a **capture HUD** (offscreen, non-interactive) that is rasterized into a canvas texture. The capture HUD does not mount **`GameViewport`** (the 3D view is not part of **`html2canvas`**); the **game** grid cell uses an **invisible same-sized shell** with the same **`gameViewportRef`** attachment pattern for compositor/game-rect parity. The **dithered NPC dialog** mounts inside that **game** cell (**`npcCaptureLayer`**: top + horizontal center) rather than as a sibling of the whole **`HudLayout`**.
  - **Paperdoll** mounts **only** in **`DitheredFrameRoot`’s `stageModalLayer`** (sibling of **`.interactiveHud`**, not under **`opacity: 0`**). The **NPC dialog** uses **two DOM copies**: an **offscreen capture** instance inside **`HudLayout`’s** **game** panel (**`captureNpcOverlay`** → **`npcCaptureLayer`**) so **`html2canvas`** picks it up **at the top of the game cell**, horizontally centered, with the same **ordered dither** as the rest of the HUD texture; and an **interactive** instance **`createPortal`**’d to **`document.body`** with **`opacity: 0`** (hit layer only) so **`position: fixed`** and viewport **`getBoundingClientRect()`** stay correct under **`FixedStageViewport`’s** **`transform: scale`**. The modal layer still mounts **only while** **`paperdollFor`** or **`npcDialogFor`** (or title/death) applies, uses **`pointer-events: auto`**, and sits **above** the presenter (`z-index`) where applicable. **Paperdoll** and other modals remain **outside** the capture tree unless migrated similarly.
  - Because the capture HUD is rasterized by **`html2canvas`**, prefer conservative CSS for critical visuals (avoid relying on `object-fit` for aspect-correct sprite presentation; use intrinsic sizing patterns instead).
  - **HUD shell art**: a single transparent **`ui_hud_background.png`** (`Content/ui/hud/`, mirrored to `web/public/content/ui/hud/`) is drawn full-bleed behind the HUD grid in `HudLayout` (CSS `::before`, `background-size: contain`, centered). Existing widgets stay in the current CSS grid; opaque “glass” panel styling is removed so content sits on the artwork (fine-tune slot positions vs the art next).
  - Presenter sizing is derived from the **viewport CSS size** (prefer `visualViewport.width/height`, else `documentElement.clientWidth/clientHeight`) rather than measuring the presenter canvas element, to avoid resize feedback loops caused by renderers writing inline canvas CSS sizes.
  - A presenter compositor shader places the scene render target into the frame **only inside** the game viewport rect and overlays the captured HUD everywhere else (and over the scene where UI alpha exists).
  - The final composite then runs through the ordered-dither post-process so the **same dithering/pixelation** applies to both 3D and HUD.

## 12) Debug menu
- The in-game **F2** panel is scrollable with **sections + search** (expected to grow). (A separate “main settings” menu may extend this later.)
- **UI** section: checkboxes to preview the **NPC dialog** and **death** modals for layout and capture tuning without affecting run state (death preview does not set `ui.death`).
- Also includes: light/render/audio sliders, distance audio, **telegraph preview** (force Burning/Flooded/Infected/off and strength), procgen tools, spawn helpers, and readouts (pose, cell, perf).

## 13) Content pipeline (placeholders-first)
Canonical placeholder NPC art lives at **`Placeholders/Placeholder_NPC.png`**. Ship **copies** into `web/public/content/` for any runtime URL the code expects (NPC or POI) until final assets replace them.

The **canonical** art folder is `Content/`. For the web client, PNGs are **mirrored** into `web/public/content/` so they can be loaded via stable `'/content/...'` URLs (no cache-busting query params). In particular, **`Content/poi_placeholder.png`** is the canonical copy of the POI placeholder and is mirrored to `web/public/content/poi_placeholder.png`.

Asset types:
- Item PNG (transparent)
- Tile texture (dungeon environment: per-`FloorType` triples — `Dungeon`: `dungeon_floor.png` / `dungon_wall.png` / `dungon_ceiling.png`; `Cave`: `cave_*`; `Ruins`: `ruins_*` → `/content/…`)
- NPC sprite PNG (transparent)
- Portrait
- Mouth PNG (transparent)
- Eyes PNG (transparent)
- HUD shell PNG (transparent): `Content/ui/hud/ui_hud_background.png`

### 13.1 Asset serving & caching (web)
- Runtime-served assets (portraits, NPC sprites, UI art, cursor sprites) live under `web/public/content/` and are referenced via **stable** `/content/...` URLs.
- The game relies on **browser HTTP caching** for these static URLs; avoid cache-busting query params for runtime art.
- Imperative image loads (e.g., measuring portrait aspect ratio or preloading sprite layers) go through a small shared **in-app image cache** (`web/src/ui/assets/imageCache.ts`) to dedupe concurrent loads and reduce repeated decodes/revalidation requests.

### 13.2 Procgen content coverage (data discipline)
- **Seeded item defs** live in `web/src/game/content/items.ts` (`DEFAULT_ITEMS`). **Not every item is meant to appear from dungeon generation**: some are **craft-only**, **Well transforms**, or **quest-chain** items. **Headwear** (`WoolCap`, `HerbCirclet`, `SporeCap`) is both **craftable** and can appear from **floor spawns** and **POI container** loot when wired in `spawnTables` / `poiLootTables`.
- **Procgen** places floor items via `web/src/procgen/spawnTables.ts` (`pickFloorItemDefFromTable`); **locks** add keys via `web/src/procgen/locks.ts`. **Chest / barrel / crate** opening uses deterministic tables in `web/src/game/content/poiLootTables.ts` (rolled in `web/src/game/state/poi.ts`). **Neutral NPC quests** reference a small want/hated item set from `web/src/procgen/population.ts`.
- **Policy**: when adding a new `ItemDefId`, either wire it into one of those pipelines or add it to **`ITEM_DEF_IDS_INTENTIONALLY_NON_PROCGEN`** in `web/src/tools/procgenContentNonSpawnAllowlist.ts` so the audit stays honest.
- **Audit CLI** (from `web/`): `npm run audit:procgen-content` — compares seeded items to the union of procgen + POI loot + quest references; exits non-zero if a seeded item is neither used nor allowlisted, or if listed ids are missing from `DEFAULT_ITEMS`. **Status effects** are not placed by procgen; they are applied in gameplay (combat, feed, hazards). Items may reference statuses via `feed.statusChances` (e.g. **Blessed** / **Sick** on mushrooms).

## 14) “Not now” ideas (parked)
- **Left hand**: a persistent on-screen left-hand slot holding an item (e.g., torch).

## 15) Open questions (to resolve)
- **Inventory pickup rules**: can you pick up world items directly (click) or only via interaction UI? (Currently: click-pickup + press/hold drag from world items are supported.)
- **Combat UI**: fully diegetic in HUD vs modal encounter panel; how much player agency per turn?
- **Crafting UI**: where does recipe discovery feedback live (log, tooltip, modal)?
- **NPC language system**: how messages map to item concepts; how to keep learnable but not trivial?
- **Multiplayer architecture**: host DB technology + sync model (event log vs state sync) and what must be deterministic vs authoritative.

