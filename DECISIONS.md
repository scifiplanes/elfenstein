# Elfenstein — Decisions (ADR-style, living)

This log records **design decisions and changes** over time so `DESIGN.md` can stay clean and current.

How to add an entry:
- Use the next sequential ID (`ADR-000X`)
- Include date (YYYY-MM-DD)
- Keep it short; link to files/sections when relevant

---

## ADR-0001 — Establish living design docs
Date: 2026-04-06

### Decision
Maintain two living documents:
- `DESIGN.md`: current spec (what the game is)
- `DECISIONS.md`: why/when we changed things (this file)

### Rationale
Keeps the spec readable while preserving history and intent.

### Consequences
Any meaningful change to gameplay/UX/systems/rendering/gen/content should update `DESIGN.md` and add an ADR entry here.

---

## ADR-0002 — Interaction model is cursor-first (drag/drop)
Date: 2026-04-06

### Decision
Primary interaction uses a **hand cursor** with click + drag/drop:
- drag item→item: crafting attempt
- drag item→NPC: use/attack
- drag item→portrait eye/mouth: inspect/feed
- drag item→world: drop

### Rationale
Supports contextual UX with minimal persistent buttons/menus.

### Consequences
UI must provide clear drop previews (context icons) and consistent cursor state transitions.

---

## ADR-0003 — Dungeon generation must be deterministic and multiplayer-sane
Date: 2026-04-06

### Decision
Dungeon generation is **seeded/deterministic**, and should be structured into phases so edits don’t cause unpredictable ripples (host-synced multiplayer readiness).

### Rationale
Enables replayability, debugging, and eventual host-authoritative multiplayer sync.

### Consequences
Prefer phase-separated RNG streams and validation passes; keep gen outputs serializable.

---

## ADR-0004 — Rendering style prioritizes sharp+dithered look
Date: 2026-04-06

### Decision
Three.js dungeon geometry + ordered-dither post-process; AA off; capped pixel ratio; darkness-forward lighting.

### Rationale
Maintains a consistent stylized look; supports readability via controlled lighting and palette.

### Consequences
Graphics/debug tooling must expose live-tunable lighting/dither parameters.

---

## ADR-0005 — Main web build: debug camera + wider lighting ranges
Date: 2026-04-06

### Decision
The Vite/React client (`web/`) stores **camera eye height**, **FOV**, and **debug pitch** in `GameState.render`, applies them in `WorldRenderer`, and extends the F2 **DebugPanel** sliders for lantern/torch **intensity and distance** plus wider ambient/fog caps. Changing **eye height** updates the live camera Y (including during move animation).

### Rationale
Keeps tuning in the shipping codebase (not only the standalone HTML prototype) and matches the need to iterate on first-person height and light falloff without rebuilding.

### Consequences
`player/step` uses `render.camEyeHeight` for camera Y; `render/set` with `camEyeHeight` also rewrites `view.camPos`/`anim` Y so sliders do not desync.

---

## ADR-0006 — Persist F2 debug tuning in project JSON (dev)
Date: 2026-04-06

### Decision
Ship **`web/public/debug-settings.json`** as the canonical snapshot of **render** and **audio** tuning. The app **loads** it at startup; under **`vite dev`**, changes from the debug panel are **debounced** and written back via a small dev-server middleware (`POST /__debug_settings/save`). Production/static preview has no write endpoint; tuning still **loads** from the copied JSON in `dist/`.

### Rationale
Lets lighting/camera/audio distance tweaks survive reloads and be **versioned** with the project without manual copy-paste.

### Consequences
Defaults remain in `web/src/game/tuningDefaults.ts` for fallback; `clampRenderTuning` keeps dither matrix/palette in range when merging JSON.

---

## ADR-0007 — Make the lantern meaningfully affect visibility
Date: 2026-04-06

### Decision
Adjust baseline lighting so the camera lantern is a **primary visibility driver** by default:
- increase lantern reach (distance) and reduce falloff (decay)
- reduce the always-on “visibility floor” (ambient hemisphere + mild directional)
- lower material emissive lift so lantern changes are noticeable
- align `web/public/debug-settings.json` with the intended baseline (not extreme values)

### Rationale
The previous baseline made the lantern feel like it had almost no effect in typical play, undermining the intended darkness-forward look.

### Consequences
Tuning via F2 remains available, but the default experience is more contrasty: turning lantern up/down should visibly change exploration readability.

---

## ADR-0008 — Add a camera-aligned lantern beam (SpotLight)
Date: 2026-04-06

### Decision
Add a small forward-facing **SpotLight** aligned to the camera direction in addition to the lantern point light.

### Rationale
In fog + PBR materials, an omnidirectional point light can feel underwhelming; a beam ensures the player gets a clear “where I’m looking is readable” effect.

### Consequences
Lantern tuning now affects both lights (beam intensity/distance are derived from the lantern sliders), so raising lantern values increases both local glow and forward readability.

---

## ADR-0009 — Expose baseline lighting + lantern shape in F2 tuning
Date: 2026-04-06

### Decision
Expose additional render tuning controls in the F2 Debug panel and persist them in `web/public/debug-settings.json`:
- baseline directional “sun” intensity (`sunIntensity`)
- base emissive lift for dungeon materials (`baseEmissive`)
- lantern positional offsets (`lanternForwardOffset`, `lanternVerticalOffset`)
- lantern flicker (`lanternFlickerAmp`, `lanternFlickerHz`)
- lantern beam shaping (`lanternBeam*` controls)

Update default render tuning so the lantern is **visibly impactful** at baseline (reasonable lantern reach, small but nonzero fog, low visibility floor).

### Rationale
With a non-tunable visibility floor and fixed emissive lift, the lantern could feel like it had little effect even at extreme values. Making the visibility floor and lantern shape tunable restores iterative control and makes “lantern affects exploration readability” true by default.

### Consequences
Lighting balance is now driven by a small set of explicit tuning parameters. The project’s `debug-settings.json` should stay near a playable baseline rather than extreme debugging values.

---

## ADR-0010 — Enable shadowed lantern for readability
Date: 2026-04-06

### Decision
Enable renderer shadow mapping in the main client (`web/`) and make the lantern lights **cast shadows**, with dungeon geometry configured to **cast/receive** shadows.

### Rationale
The prototype’s lantern felt much stronger largely because shadows create clear contrast cues. Matching that in `web/` makes lantern intensity/distance changes (especially at max) feel immediately impactful.

### Consequences
- Slight perf cost (shadow map rendering); start with small shadow maps (256×256) and adjust if needed.
- Lighting balance is more dramatic by default; baseline emissive must stay low so shadows read.

---

## ADR-0011 — Remove sun+hemisphere baseline lights; widen debug camera minima
Date: 2026-04-06

### Decision
Remove the baseline **hemisphere ambient** and **directional “sun”** lights from the main renderer (`web/`). Widen F2 debug camera slider minimums so **eye height** and **FOV** can be tuned lower.

### Rationale
The lantern/beam + emissive lift should be the sole visibility model for iteration; fixed global lights reduce contrast and make darkness tuning harder. Lower camera minima are needed to test crouch-like viewpoints and narrow-FOV readability.

### Consequences
- `render.ambientIntensity` / `render.sunIntensity` are removed from tuning, debug UI, and persisted debug settings.
- Scene visibility now depends entirely on emissive lift + lantern/beam + torches + fog.

---

## ADR-0012 — Cursor works through modals; add Hand_Active state
Date: 2026-04-06

### Decision
- Modal overlays that should support drag/drop must participate in cursor pointer tracking and expose explicit drop targets via `data-drop-kind`.
- The NPC dialog modal surface acts as a drop target for that NPC (`data-drop-kind="npc"` + `data-drop-npc-id`).
- Add cursor visual state `Hand_Active` when hovering any interactable target while not holding/dragging.

### Rationale
The hand cursor is the primary verb. Modals previously intercepted pointer events without updating cursor state, breaking drag/drop flows (especially “drag an item onto the NPC” while the dialog is open). `Hand_Active` provides immediate hover feedback consistent with the design spec.

### Consequences
- Any future modal that expects drag/drop must wire `onPointerMove`/`onPointerUp` into the cursor system or use an equivalent capture strategy.
- Cursor art assets are served from `web/public/content/` (Vite public path), including `Hand_Active.png`.

---

## ADR-0013 — Track cursor pointer events at HUD root (fix UI deadzones)
Date: 2026-04-06

### Decision
Handle `pointermove` and `pointerup` for the custom hand cursor at the `HudLayout` root so cursor hover/drag state updates even when the pointer is over non-interactive UI panel areas.

### Rationale
Some HUD regions didn’t forward pointer events into the cursor system, which could leave stale `hoverTarget` (cursor stuck as `Hand_Active`) and, in some cases, prevent drag cleanup on release. Root-level handlers ensure state is recomputed consistently via `elementFromPoint` and that pointer-up always terminates a drag.

### Consequences
- All UI areas participate in cursor tracking by default, preventing “deadzone” hover/drag stuck states.
- Individual panels can still provide explicit drop targets via `data-drop-kind`; root handling is a safety net rather than a replacement.

---

## ADR-0014 — Use Boblin sprites for Igor portrait (prototype)
Date: 2026-04-06

### Decision
Use the existing **Boblin** sprite set in `Content/` as the **Igor** species portrait art source:
- `Content/boblin_base.png`
- `Content/boblin_eyes_open.png`
- `Content/boblin_mouth_open.png`

### Rationale
We already have a coherent base/eyes/mouth set available, so we can standardize Igor portraits immediately without blocking on new art.

### Consequences
Igor portrait rendering should load these files by default until the Igor-specific art set replaces them.

---

## ADR-0017 — Hide portrait mouth by default; reveal on feeding
Date: 2026-04-06

### Decision
The portrait **mouth layer is hidden by default** and is only revealed during **feeding interactions** (while dragging an item over the mouth target and briefly after a feed attempt).

### Rationale
Reduces visual noise in the HUD while keeping the mouth as a clear contextual affordance when “Feed” is relevant.

### Consequences
UI needs a small, short-lived “mouth visible” cue tied to the feed action/hover state.

---

## ADR-0018 — Add “chomp” + shake feedback on feed drop
Date: 2026-04-06

### Decision
After the player releases an item onto the portrait mouth target, play a short **mouth chomp animation** (hide/reveal + wiggle) and a small **UI shake**.

### Rationale
Provides immediate tactile feedback for feeding, reinforcing the “mouth” affordance while keeping the portrait calm/clean at rest.

### Consequences
Feeding now triggers a brief UI-only animation state; it should stay short and non-blocking.

---

## ADR-0019 — Add “munch” sound on successful feed
Date: 2026-04-06

### Decision
Playing a short **munching** SFX is part of the feedback loop for **successful** feeding.

### Rationale
Matches the visual “chomp” and makes feeding feel tactile even without looking directly at the portrait.

### Consequences
Audio layer needs a dedicated SFX event (`munch`) distinct from generic UI clicks.

---

## ADR-0022 — Add square-LFO tremolo to munch SFX (tunable)
Date: 2026-04-06

### Decision
The munch SFX uses a **square LFO tremolo**, with **depth** and **speed (Hz)** exposed in the F2 debug audio tuning.

### Rationale
Square tremolo gives the munch a more “chattery/chewy” texture and makes it easy to stylize (from subtle crunch to exaggerated goblin chew) without changing the underlying synthesis.

### Consequences
Audio tuning now includes `munchTremDepth` and `munchTremHz`, which should be persisted in `debug-settings.json`.

---

## ADR-0020 — Dither post-process applies to HUD UI
Date: 2026-04-06

### Decision
Apply the ordered-dither post-process to the **entire** visible frame, including HUD UI panels, by **compositing the HUD into the render pipeline** before the post-process pass.

### Rationale
The HUD was previously HTML/CSS layered over WebGL, so the dither shader only affected the 3D view and the UI stayed “clean,” breaking the intended cohesive look.

### Consequences
- HUD is rendered into the same output as the 3D view, so pixelation/dithering is consistent across the whole screen.
- Non-HUD HTML overlays (e.g. debug) may still need migration if they must also be dithered.

---

## ADR-0021 — Add portrait blinking (eyes hide briefly)
Date: 2026-04-06

### Decision
Portraits occasionally **blink** by briefly hiding the **eyes sprite** layer.

### Rationale
Adds subtle life to character portraits without requiring new art states or extra UI.

### Consequences
The portrait renderer needs a lightweight timer to toggle eyes visibility, and should keep the behavior purely cosmetic (no gameplay coupling).

---

## ADR-0023 — Add 3D camera shake on interactions (tunable)
Date: 2026-04-06

### Decision
When `ui.shake` is triggered by interactions, apply a **subtle 3D camera shake** in the Three.js renderer in addition to the existing UI overlay shake. Expose camera-shake parameters in F2 Debug and persist them via `web/public/debug-settings.json`.

### Rationale
UI-only shake helps, but a small camera-space response makes interactions (especially feed drops) feel more tactile and grounded in the 3D view. Reusing `ui.shake` keeps interaction authorship centralized: any existing interaction that shakes the UI automatically shakes the camera too.

### Consequences
- New render tuning keys (`camShake*`) are part of `RenderTuning` and must remain clamped to safe ranges.\n- Interactions that should feel impactful should use `ui/shake` rather than bespoke camera hacks.

---

## ADR-0024 — Portrait-scoped shake on inspect/feed
Date: 2026-04-06

### Decision
Add `ui.portraitShake` (`characterId`, `untilMs`, `magnitude`) cleared on `time/tick`, set from `inspectCharacter` and `feedCharacter`. Apply the same transform math as the feedback overlay shake to the **portrait container** in `PortraitPanel` when `characterId` matches.

### Rationale
Global `ui.shake` drives the 3D camera but does not visibly move HUD portraits; inspect had no motion feedback. Scoping shake to the interacted character keeps multi-portrait layouts readable.

### Consequences
- Portrait interaction code must set `portraitShake` when adding haptics; tick must expire it like `portraitMouth`.
- Shared helper: `web/src/ui/feedback/shakeTransform.ts`.
