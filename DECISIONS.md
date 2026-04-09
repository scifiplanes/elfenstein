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

## ADR-0050 — Disable fog by default; debug toggle to re-enable
Date: 2026-04-07

### Decision
Disable scene fog entirely by default (no `scene.fog`), and add an F2 debug toggle to enable/disable fog while keeping `FogExp2 density` available for tuning when enabled.

### Rationale
Fog strongly affects readability and lighting feel; making it opt-in gives a clearer baseline for iterating on emissive + lantern/beam + torches without an always-on atmospheric layer.

### Consequences
- Default visuals are “no fog” unless debug tuning enables it.
- Fog density tuning only applies when fog is enabled (otherwise the scene fog is `null`).

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

## ADR-0023 — Bandpass munch noise (thump bypass)
Date: 2026-04-06

### Decision
The munch SFX **noise** component runs through **highpass + lowpass** (effective bandpass). The **thump** oscillator mixes in **after** that chain so low-frequency “jaw” energy is not removed by the highpass.

### Rationale
A lowpass-only crunch lets sub-bass and very low noise mud through; bandpassing the noise tightens the bite while keeping the existing sweep and debug tunables meaningful.

### Consequences
Munch timbre shifts slightly vs pure lowpass; saved `munchCutoffHz` / `munchCutoffEndHz` still drive the lowpass sweep, with a derived highpass corner from the lower sweep bound.

### Update (same ADR)
`munchHighpassHz`, `munchHighpassQ`, and `munchLowpassQ` are exposed in F2 audio tuning (and persisted like other audio keys); the engine still clamps HP below the lowpass sweep minimum so the band stays valid.

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
Add `ui.portraitShake` (`characterId`, `startedAtMs`, `untilMs`, `magnitude`) cleared on `time/tick`, set from `inspectCharacter` and `feedCharacter`. Apply the same transform math as the feedback overlay shake to the **portrait container** in `PortraitPanel` when `characterId` matches.

### Rationale
Global `ui.shake` drives the 3D camera but does not visibly move HUD portraits; inspect had no motion feedback. Scoping shake to the interacted character keeps multi-portrait layouts readable.

### Consequences
- Portrait interaction code must set `portraitShake` when adding haptics; tick must expire it like `portraitMouth`.
- Shared helper: `web/src/ui/feedback/shakeTransform.ts`.

---

## ADR-0025 — Grid movement polish: regen camera sync, input gate, step/bump SFX
Date: 2026-04-06

### Decision
- On **`floor/regen`**, snap **`view`** (`camPos`, `camYaw`, clear `anim`) to the new spawn cell and facing so the minimap and 3D view stay aligned.
- While **`view.anim`** is active (move/turn lerp), ignore new **`player/step`** and **`player/turn`** actions (one grid resolution at a time).
- Add dedicated **`step`** and **`bump`** UI SFX kinds; play **step** on successful forward/back cell move, **bump** on blocked step (walls/out of bounds), keeping **reject** for other refusals.
- Document movement in **DESIGN §6.4**; replace the obsolete open question about “strafe”; navigation panel shows real controls plus on-screen buttons.

### Rationale
Regen without view reset left the camera wrong until the next move. Chaining steps during the lerp felt mushy for a grid crawler. Distinct footstep vs wall feedback reads better than reusing generic reject for bumps.

### Consequences
- Door clicks and keyboard step/turn respect the same animation gate.
- `SfxEngine` and `UiState.sfxQueue` kinds must stay in sync when adding movement audio variants.

---

## ADR-0026 — Separate shake length and decay (F2 sliders + shared envelope)
Date: 2026-04-06

### Decision
Add **`camShakeLengthMs`** (hold at full envelope) and keep **`camShakeDecayMs`** (fade tail). Implement **`shakeEnvelopeFactor`** in `web/src/game/shakeEnvelope.ts` and use it for 3D camera shake, `FeedbackLayer`, and `PortraitPanel`. When length is 0, decay alone preserves the prior `min(1, remaining/decay)` behavior. Add **`startedAtMs`** on `ui.shake` and `ui.portraitShake` so the envelope is keyed to real event start time.

### Rationale
A single “decay” knob conflated total feel with tail shape; separating hold vs fade gives tunable control without rewriting every interaction’s authored `untilMs`.

### Consequences
- Every code path that sets `ui.shake` or `ui.portraitShake` must include `startedAtMs`.
- `clampRenderTuning` must default missing `camShakeLengthMs` from older JSON to 0.

---

## ADR-0027 — No 3D (or global `ui.shake`) for portrait inspect/feed
Date: 2026-04-06

### Decision
`inspectCharacter` and `feedCharacter` must **not** set `ui.shake`. Portrait resolutions use **`ui.portraitShake`** (and mouth/toast/SFX as before) only.

### Rationale
Shaking the first-person view on HUD-only portrait drops felt disconnected; keeping haptics on the portrait keeps feedback local and readable.

### Consequences
- Re-add `ui.shake` from portrait flows only if a future design explicitly wants world-linked impact (e.g. “party-wide stagger”).

---

## ADR-0028 — WASD + Q/E grid navigation (strafe on A/D)
Date: 2026-04-06

### Decision
Keyboard layout: **W/S** (and arrow up/down) forward/back along facing; **A/D** **strafe** one cell left/right relative to facing (no turn); **Q/E** turn left/right. Remove **←/→** as turn keys so **A/D** are unambiguous. **`player/strafe`** reuses the same grid resolution path as **`player/step`** (doors, POIs, NPCs, step SFX, bump).

### Rationale
Matches a familiar FPS-style layout on letter keys while staying on a discrete grid; lateral motion without spinning makes corridor navigation faster.

### Consequences
- Navigation on-screen pad gains strafe buttons; DESIGN §6.4 documents strafe.
- Door click remains **forward** step only.

---

## ADR-0029 — Igor portrait idle sprite flash (low frequency)
Date: 2026-04-06

### Decision
For **Igor** layered portraits, add **`Content/boblin_idle.png`** as a **topmost stack layer** that becomes visible **briefly** on a **slower random schedule** than blinking (~8–18s between flashes, ~120–350ms on), implemented in `web/src/ui/portraits/PortraitPanel.tsx`. Serve the asset from `web/public/content/boblin_idle.png` like other portrait art.

### Rationale
Adds occasional “fidget” / life to the portrait without replacing the layered base/eyes/mouth setup; lower frequency than blinks keeps it subtle.

### Consequences
- `PortraitSprites` may include optional `idleSrc`; species without it skip the effect.
- DESIGN §7.1 documents the idle overlay alongside Boblin sources.

---

## ADR-0030 — Debug-tunable Igor portrait idle flash timing
Date: 2026-04-06

### Decision
Expose **portrait idle** timing in **F2 Debug** as `RenderTuning`: `portraitIdleGapMinMs`, `portraitIdleGapMaxMs`, `portraitIdleFlashMinMs`, `portraitIdleFlashMaxMs` (uniform random in each range). `PortraitPanel` reads `state.render` for the idle timer; values clamp in `clampRenderTuning` and persist via `debug-settings.json` like other render sliders.

### Rationale
Lets designers tune how often the idle pose reads without code changes.

### Consequences
- `DEFAULT_RENDER` and partial JSON loads must stay compatible (missing keys keep defaults after merge + clamp).

---

## ADR-0031 — Add file-based background music (looping)
Date: 2026-04-07

### Decision
Add a `MusicPlayer` class and `MusicLayer` React component that load an audio file via `fetch` + `decodeAudioData`, play it as a continuously looping `AudioBufferSourceNode`, and expose volume through a new `masterMusic` field in `AudioTuning`. Mount `MusicLayer` in `GameApp` alongside the existing audio layers. Start with `Assets/sounds/theme.mp3` (copied to `public/sounds/theme.mp3` so Vite can serve it). Add a **Master Music** slider to the F2 Debug panel.

### Rationale
The game had only procedural SFX and synthesized spatial audio — no background music. File-based playback is needed for composed music tracks. The Web Audio API (`AudioBufferSourceNode.loop = true`) avoids gaps inherent in HTML `<audio>` element looping.

### Consequences
- `AudioTuning` gains `masterMusic: number` (default `0.4`); old persisted `debug-settings.json` without the key falls back to the default via the existing spread-merge in `debug/loadTuning`.
- Additional music tracks can be swapped by changing the `src` prop on `MusicLayer` or mounting multiple instances.
- Browser autoplay policy applies; audio starts after first user interaction (same pattern as `SpatialAudio.ensure()`).

---

## ADR-0034 — Portrait eyes “inspect hover” sprite + Frosh split-eye blink
Date: 2026-04-07

### Decision
Add a new **eyes inspect-hover** portrait state: while the player is **dragging** an item and hovers the portrait **eyes** target, the eyes layer swaps to a species-specific **inspect** sprite (`*_eyes_inspect.png` / `frosh_eye_inspect.png`) when available. For **Frosch**, represent “eyes open” as **two separate eye sprites** (left + right) that blink together; inspect-hover **overrides** blink hiding.

Serve portrait art from `web/public/content/` so it’s reachable at runtime via the Vite public path `/content/*`.

### Rationale
The inspect-hover swap makes the eyes target feel interactive (parallel to the mouth affordance), and Frosh’s art is authored as separate eyes so the portrait renderer must support multi-sprite eyes while keeping a consistent blink + hover rule.

### Consequences
- `PortraitPanel` supports a Frosh-specific eyes layout (L/R) and an optional `eyesInspectSrc`.
- `Content/*.png` portrait assets must be present in `web/public/content/` for dev/build (including cursor hand sprites already referenced via `/content/*`).
## ADR-0035 — Present the frame via compositor + HUD capture
Date: 2026-04-07

### Decision
Move final frame presentation to an explicit **presentation pipeline**:
- Render the 3D world into an offscreen **render target** sized to the HUD “game viewport” rect.
- Capture a non-interactive, offscreen copy of the HUD to a texture and **composite** it with the scene via a fullscreen shader.
- Apply ordered dithering as the final pass over the composite so the UI and 3D share the same post-process.

### Rationale
The renderer needs the dither/pixelation to apply uniformly to UI + 3D, while keeping the HUD fully interactive (DOM/pointer events) and avoiding layout-dependent stretching artifacts during resize.

### Consequences
- The HUD is rendered twice (interactive + capture) and the capture path must be resilient to resize bursts.
- Picking/projection in the 3D world uses the **game viewport rect** as its coordinate space (not the full window).

---

## ADR-0036 — Separate portrait shake tuning (envelope + amplitude)
Date: 2026-04-07

### Decision
Add portrait-scoped shake tuning fields to `RenderTuning` and expose them in F2 Debug:
- `portraitShakeLengthMs` / `portraitShakeDecayMs` (envelope)
- `portraitShakeMagnitudeScale` (amplitude multiplier applied to `ui.portraitShake.magnitude`)

Wire `PortraitPanel` to use the portrait-specific envelope and amplitude so portrait interactions can be tuned independently from 3D camera shake.

### Rationale
Portrait inspect/feed shakes are short and HUD-local; they need independent tuning from the world camera shake to avoid coupling “3D feel” to “HUD readability”.

### Consequences
- `clampRenderTuning` must clamp these new portrait tuning values and provide sensible fallbacks for older `debug-settings.json`.
- `web/public/debug-settings.json` now persists portrait shake tuning keys alongside other render tuning.

---

## ADR-0037 — Navigation HUD pad uses Content/ui art + timed pressed state
Date: 2026-04-07

### Decision
Replace the text/unicode on-screen movement pad with a **3×2** grid of image buttons built from `Content/ui/navigation/`:
- Shared bezel: **default** vs **pushed** background; **pushed** is shown for **0.5 seconds** after each successful click, then reverts.
- Direction overlays: separate PNGs per action (forward/back/strafe/turn).
- Grid: `[turn left][forward][turn right]` / `[strafe left][back][strafe right]`.
- Copy these assets into `web/public/content/ui/navigation/` so Vite serves them at `/content/ui/navigation/…`.

### Rationale
Diegetic, art-directed controls match the project’s texture-first HUD; timed pressed feedback reads clearly in the dithered composite.

### Consequences
- Keyboard help text no longer lives inside the navigation panel; shortcuts remain in `title` tooltips and this doc (§6.4).
- New UI art must be kept in sync between `Content/` and `web/public/content/` until a single-source asset pipeline exists.
- **Pushed** navigation art must not be local to a single `NavigationPanel` instance: the visible UI is rasterized from the **capture** `HudLayout`, while clicks hit the **interactive** `HudLayout` (`web/src/ui/frame/DitheredFrameRoot.module.css`). `navPadPressedId` + `onNavPadVisualPress` in `DitheredFrameRoot` keep both trees in sync; `renderOnce` re-runs when `navPadPressedId` changes so the compositor texture updates.

---

## ADR-0038 — Add portrait shake frequency tuning (Hz)
Date: 2026-04-07

### Decision
Add `portraitShakeHz` to `RenderTuning`, expose it in F2 Debug, and pass it to the portrait shake transform so portrait shake frequency can be tuned independently.

### Rationale
Portrait shake feel depends heavily on oscillation speed; a dedicated Hz slider makes it easy to go from “soft wiggle” to “snappy rattle” without changing authored shake magnitudes.

### Consequences
`shakeTransform` accepts an optional Hz parameter; existing UI shake continues to use the legacy behavior when Hz is not provided.

---

## ADR-0039 — Portrait shake duration follows tuned envelope
Date: 2026-04-07

### Decision
When creating `ui.portraitShake` events (inspect/feed), set `untilMs` to at least the authored base duration, but extend it to cover `portraitShakeLengthMs + portraitShakeDecayMs` when that tuned envelope is longer.

### Rationale
Without extending the event window, long hold/decay values (and higher Hz) compress into ~130–200ms and read like a single bump instead of multiple oscillations.

### Consequences
Portrait shakes can last longer when tuned; `time/tick` expiry will clear them normally when `untilMs` passes.

---

## ADR-0040 — Make feed “chomp” a flicker burst (tunable)
Date: 2026-04-07

### Decision
Replace the single mouth reveal on feed with a **show/hide flicker burst**, tunable in F2 Debug via `RenderTuning`:
- `portraitMouthFlickerHz` (frequency)
- `portraitMouthFlickerAmount` (toggle count)

Feeding sets `ui.portraitMouth.untilMs` based on these parameters so the cue duration matches the burst.

### Rationale
A short flicker reads as a more satisfying “chomp” than a single static reveal and is easy to dial in (subtle nibble → exaggerated goblin chew) without new art.

### Consequences
- `debug-settings.json` persists the new keys; older files fall back to defaults via merge + clamp.
- Mouth visibility during the cue is time-driven (deterministic from `nowMs`), not CSS-opacity-driven.

---

## ADR-0041 — Fix HUD scaling by sizing from viewport (not canvas rect)
Date: 2026-04-07

### Decision
Derive presenter/HUD-capture sizing from the **viewport CSS size** (prefer `window.visualViewport.width/height`, else `document.documentElement.clientWidth/clientHeight`) rather than measuring the presenter canvas element.

### Rationale
`THREE.WebGLRenderer.setSize(w, h, true)` writes inline CSS width/height onto the canvas. If we then compute \(w,h\) from `canvas.getBoundingClientRect()`, resizes can stop affecting the measured size due to a feedback loop, causing the HUD capture/composite to appear “stuck” at the old scale.

### Consequences
- Resizing the browser reliably updates the presenter and the captured HUD texture sizes again (desktop and mobile viewport chrome changes).\n- Viewport measurement is now the single source of truth for frame sizing; the canvas element is treated as an output surface, not the sizing reference.

---

## ADR-0042 — Portraits scale to fit (no crop) while filling slot
Date: 2026-04-07

### Decision
Change portrait rendering so the portrait frame scales to fill as much of its HUD slot as possible while **preserving the portrait asset aspect ratio**, and the portrait sprite layers use **no-crop scaling** (fit/contain) so the full art remains visible.

### Rationale
The prior layout keyed the frame size to the image aspect ratio, which could leave unused space inside the character panel. Prioritizing fit/contain maximizes readable character art without losing important features to cropping.

### Consequences
- Portraits may show small letterboxing if the sprite aspect ratio doesn’t match the frame, but they will occupy more of the available panel slot overall.
- Interactive target regions (eyes/mouth overlays) remain defined in portrait-relative percentages and continue to align with the portrait frame.

---

## ADR-0043 — Compact portrait stats overlay
Date: 2026-04-07

### Decision
Move portrait vitals + status text into a **compact bottom overlay inside the portrait frame** and keep status text **single-line truncated** when long.

### Rationale
The portrait art is the primary information in the character panel; dedicating a separate panel row to stats reduced portrait size and made the HUD feel cramped.

### Consequences
- Portraits get more vertical space across all party slots.
- Status detail is de-emphasized (ellipsis truncation) but remains accessible via tooltip/title on hover.

---

## ADR-0044 — Full-viewport HUD background plate (`ui_hud_background.png`)
Date: 2026-04-07

### Decision
Add **`Content/ui/hud/ui_hud_background.png`** (transparent PNG) as the primary HUD chrome: `HudLayout` paints it via a **`::before`** layer (`background-size: contain`, centered) behind the existing grid. **Panel** cards lose blur/border/fill so widgets read on top of the art; section titles gain a light **text-shadow** for contrast. Mirror the file to **`web/public/content/ui/hud/`** for the dev server.

### Rationale
Art-directed layout replaces ad-hoc “glass” rectangles; one plate establishes the frame while we keep the current grid until widgets are positioned deliberately against the artwork.

### Consequences
- Transparent areas in the plate reveal the composited scene (and any bleed outside the game viewport rect).
- `html2canvas` must include the pseudo-element (supported); if capture regressions appear, switch to a real backdrop `<div>`.
- Slot alignment vs the PNG may need iterative CSS tuning (`grid-template-*`, padding, or future absolute placement).

---

## ADR-0045 — World items are draggable + interaction outcomes are content/seed driven
Date: 2026-04-07

### Decision
- Allow **press+hold drag** directly from **world floor items** in the 3D view (not only from inventory).
- Route key interaction checks (weapon/food/POI transforms) through **`ContentDB`** (tags + `feed` + `useOnPoi`) rather than hardcoded item id lists.
- Replace time-based “randomness” in interaction outcomes (loot/skill checks/crafting) with **seeded, stable hashes** derived from `floor.seed` + stable ids.
- Drop placement in the 3D view lands **ahead of the player** by a tunable distance so the item is immediately visible.
- Add debug-tunable **camera forward/back offset** and **drop length** sliders.

### Rationale
This makes the 3D view a first-class interaction surface while keeping logic modular and extensible. Stable, seed-based outcomes are also a prerequisite for future host-authoritative multiplayer sync and reproducible debugging.

### Consequences
- Drag/drop flows must handle items whose source is the floor (detach/move/stow semantics) without duplicating or losing items.
- Content expansion happens primarily by editing `ContentDB` definitions instead of adding new conditionals in reducers.
- Interaction outcomes become reproducible per seed and object ids; “true randomness” should be introduced later via explicit RNG streams/events if needed.
- Drops are biased to appear in front of the camera; blocked/out-of-bounds cases fall back to the player cell.

---

## ADR-0046 — Remove RT/UI debug overlays; keep F2 debug panel
Date: 2026-04-07

### Decision
Remove the always-on on-screen **RT debug** and **UI debug** overlay readouts from the main frame (`DitheredFrameRoot`). Keep the existing **F2** debug panel for tuning.

### Rationale
The overlay text is visually noisy in normal play and doesn’t match the “low-clutter HUD” goal. The F2 panel remains the right place for tuning/debug controls.

### Consequences
- Runtime rendering diagnostics are no longer visible by default during gameplay.
- If deeper renderer inspection is needed, it should be exposed explicitly (e.g., via query params or dev-only tooling), not as an always-present overlay.

---

## ADR-0047 — HUD bottom row height 400px (map, inventory, navigation)
Date: 2026-04-07

### Decision
Set `HudLayout` **`grid-template-rows`** third track to **400px** so **minimap**, **inventory**, and **navigation** share the same **400px**-tall bottom row (was briefly **560px** during layout iteration).

### Rationale
User-directed layout: consistent height across the three bottom widgets at a mid size between the original **260px** and the **560px** trial.

### Consequences
- On short viewports the fixed **400px** row still competes with the two **`1fr`** portrait/game rows; very small windows may clip or compress the upper rows.
- Art alignment (`ui_hud_background`) may need follow-up to match the bottom band.

---

## ADR-0048 — HUD outer columns 518px (portraits, map, nav); center band unchanged
Date: 2026-04-07

### Decision
Set `HudLayout` **`grid-template-columns`** to **`518px 120px 1fr 120px 518px`**: left column (**CHAR2/CHAR1 + minimap**) and right column (**CHAR4/CHAR3 + navigation**) are each **518 px** wide; center remains **statue + viewport + statue** with **inventory** spanning the three center tracks (**120 + 1fr + 120**).

### Rationale
User request: match map and navigation widget width to portrait column width; **518 px** is the current outer width (iterations from **420** / **470** / **510**).

### Consequences
- On typical desktop widths the **1fr** viewport/inventory center is narrower than the original **220 + ~271.5** layout (**518 + 518** consumes more horizontal space).
- Navigation pad art stays the same pixel size; extra column width is **empty margin** unless new chrome is added.
- `ui_hud_background` alignment likely needs a future pass.

---

## ADR-0051 — Render NPCs as sprite billboards + show in dialog
Date: 2026-04-07

### Decision
Replace the generic in-world NPC glyph (☻) with **per-NPC sprite billboards** (textured `THREE.Sprite` materials), and show the same sprite in the **NPC dialog** header.

### Rationale
NPCs should be visually identifiable at a glance in the 3D view, and the dialog should reinforce identity without adding extra UI chrome.

### Consequences
- NPC state carries an explicit `kind` used to choose sprite sources.
- NPC sprites are served from `web/public/content/` via `/content/*` paths until an automated asset pipeline exists.

---

## ADR-0052 — Preserve NPC sprite aspect ratio + per-kind size tuning (F2)
Date: 2026-04-07

### Decision
- NPC billboards in the Three.js world renderer must **preserve their sprite PNG aspect ratio** (no forced square scaling).
- Add F2 Debug tuning for **per-NPC-kind size (height in world units)** and deterministic **±% size variation**, persisted in `web/public/debug-settings.json`.

### Rationale
NPC art was being distorted by uniform X/Y scaling, which hurts readability and makes sprite iteration harder. Per-kind size plus stable per-instance variation lets us tune silhouettes quickly without touching art or code.

### Consequences
- `RenderTuning` gains new keys: `npcSize_*` and `npcSizeRand_*` for each `NpcKind`.
- `WorldRenderer` scales sprites as \(width = height * aspect\) and applies a deterministic variation derived from `floor.seed` + `npc.id`.
- `web/public/debug-settings.json` schema expands to include the new fields.

---

## ADR-0053 — Ground NPC sprites to the floor plane
Date: 2026-04-07

### Decision
Position NPC billboards so the **bottom edge** of each sprite aligns with the **floor surface** (with a tiny vertical lift).

### Rationale
Centered sprites “float” or sink when their height changes (per-kind tuning and randomization). Grounding by height makes NPCs feel physically present and keeps silhouettes consistent across sizes.

### Consequences
- NPC sprite `position.y` is derived from its computed height and a tunable ground pivot: \(y = floorTop + npcFootLift + height*(0.5 - npcGroundY_kind)\).
- `npcFootLift` and per-kind `npcGroundY_*` are exposed in F2 Debug and persisted via `web/public/debug-settings.json`.
- Changing NPC size/variation (or lift/groundY) updates both sprite scale and vertical placement.

---

## ADR-0054 — HUD outer rails fluid (map/nav/portraits scale with viewport)
Date: 2026-04-07

### Decision
Replace fixed **518px** outer `grid-template-columns` tracks with **`minmax(0, 1fr) 120px minmax(0, 1.12fr) 120px minmax(0, 1fr)`** so left and right rails (portraits + minimap / portraits + navigation) **grow and shrink** with the window while keeping roughly the same **side : game-column** proportion as before (~**518** : ~**580** at a typical width).

### Rationale
User request: map and navigation (and their columns) should not be locked to a fixed pixel width; they should **always occupy** the bottom corner **areas** at any resolution, aligned like the reference layout.

### Consequences
- **Minimap** and **navigation** panel elements still use **fixed pixel** inner content (tile size, button art); the **grid cells** widen/narrow so panels **fill** the rail; extra space shows as centered margin inside the cell.
- **`ui_hud_background.png`** alignment is resolution-dependent; may need a future pass if the plate assumed fixed outer widths.
- Supersedes the fixed-width aspect of **ADR-0048** for column sizing; center band structure (**120 + flex + 120**) is unchanged aside from **1fr → 1.12fr** on the viewport track to preserve the old ratio.

---

## ADR-0055 — Centered 1920×1080 stage, black margin, no upscale
Date: 2026-04-07

### Decision
Wrap play-mode UI in **`FixedStageViewport`**: inner layout **1920×1080** CSS px, uniform **`transform: scale(s)`** with **`s = min(1, innerWidth/1920, innerHeight/1080)`**, centered on a **#000** shell. Page chrome (**`:root` / `body`**) is **solid black** (replacing the prior radial gradient).

### Rationale
User mockup: on a **3840×2160** canvas, **1920×1080** “content” sits **centered** with **black** on all sides — i.e. **do not** scale the UI up to fill a larger window. An earlier attempt used **`s = min(w/1920, h/1080)`** without a **`1`** cap, which **upscales** on large viewports and removes the margin; that did not match the reference.

### Consequences
- **`position: fixed`** layers stay inside the transformed stage so hit-testing and overlays align with the scaled HUD.
- **High-DPI / OS scaling**: margins appear when the **CSS layout viewport** exceeds **1920×1080**; if the OS reports a smaller CSS viewport at “4K”, behavior follows that viewport.
- Smaller windows still **shrink** the whole stage so nothing clips.

---

## ADR-0155 — Treat portrait idle pulse as a HUD-capture burst trigger
Date: 2026-04-08

### Decision
When `ui.portraitIdlePulse` is active (portrait-frame tap), treat it like a **high-FPS UI moment** for the HUD capture pipeline so the next `html2canvas` capture runs **immediately**.

### Rationale
The idle overlay itself is drawn as a compositor-time overlay, but the underlying eyes layer lives in the captured HUD texture. Without an immediate capture, the compositor can show a **stale** HUD frame for one capture interval, making eyes appear to “close” late under the idle overlay.

### Consequences
- Slightly higher capture cost during the short idle pulse window (same burst behavior as shake/mouth moments).
- Portrait idle pulses read as **instant** in the composited output even when normal HUD capture is throttled/backed off.

---

## ADR-0056 — Viewport-fit stage scale + stage-sized max dimensions
Date: 2026-04-07

### Decision
Change **`FixedStageViewport`** scale to **`s = min(viewportW/1920, viewportH/1080)`** with **no `1` cap**, preferring **`window.visualViewport`** width/height (plus **`resize`/`scroll`** listeners) so the **full** design rectangle **always fits** the visible viewport. Expose **`--stage-w` / `--stage-h`** (**1920px / 1080px**) on the stage and replace in-game uses of **`100vw` / `100vh`** for max sizing (**F2** panel, NPC/paperdoll modals, HUD toast) with **`var(--stage-*)`** so layout does not spill past the **1920×1080** box.

### Rationale
User request: content must **fit** the **1920×1080** design and **scale down** (and generally **scale to fit**) so **everything stays visible**; **`vh`/`vw`** were tied to the **browser** viewport and could exceed the stage when the window was taller/wider than the scaled island.

### Consequences
- **Supersedes** the “no upscale” aspect of **ADR-0055**; large CSS viewports **scale the stage up** to fill (black bars only when aspect ≠ **16:9**).
- Offscreen HUD capture must **not** be clipped by **`overflow: hidden`** on the stage (keeps **`left: -10000px`** capture path valid).

---

## ADR-0057 — Frame presenter + UI capture sized to stage, not browser viewport
Date: 2026-04-07

### Decision
Drive **`FramePresenter.syncSize`** and **`html2canvas`** width/height using **`STAGE_CSS_WIDTH` / `STAGE_CSS_HEIGHT`** from **`web/src/app/stageDesign.ts`** instead of **`visualViewport` / `documentElement`** dimensions. **`FixedStageViewport`** imports the same constants for layout size.

### Rationale
Sizing the WebGL presenter and UI capture to the **full window** while the HUD lives in a **1920×1080** scaled stage made the composite layer **larger than the stage**—a mask effect where content appeared huge inside the layout box.

### Consequences
- Compositor resolution tracks the **authoring** stage; browser size only affects **`FixedStageViewport`**’s outer uniform scale.
- If the authoring size changes, update **`stageDesign.ts`** (and **`--stage-*`** in CSS) together.

---

## ADR-0058 — Compensate FixedStage outer `scale` in compositor + 3D viewport
Date: 2026-04-07

### Decision
Expose **`FixedStageViewport`**’s uniform scale via **`FixedStageOuterScaleContext`**. In **`DitheredFrameRoot.renderOnce`**, pass **`gameEl.clientWidth` / `clientHeight`** into **`WorldRenderer.syncViewportRect`** (layout CSS px). Build **`gameRectPx`** from **`getBoundingClientRect()`** deltas and sizes **divided by** that scale so **`CompositeShader`** receives **stage-local** 1920×1080 coordinates.

### Rationale
**`getBoundingClientRect()`** returns **post-transform** (on-screen) pixels. The stage applies **`transform: scale(s)`**, so rects were **`s`× too large** and the 3D target was sized for **screen** pixels—wrong vs the **1920×1080** layout box—making the composite look **zoomed / masked**.

### Consequences
- **`DitheredFrameRoot`** must stay under **`FixedStageOuterScaleContext`** (default **`1`** if the provider is absent).
- Pointer code that should stay in **screen** space must keep using **unscaled** DOM APIs for events; only **internal** compositor sizing changes here.

---

## ADR-0059 — White frame on the fixed stage
Date: 2026-04-07

### Decision
**`.clip`** size is **`1920 × scale` × `1080 × scale`**. **`computeScale`** uses **1920×1080** only. The **`.stage`** is **`1920×1080`** at **`left/top: 0`** with **`transform: scale`**. The white frame is **`outline`** on **`.clip`** with negative **`outline-offset`** (inset stroke), not a larger clip / stage inset.

### Rationale
User request: the **content box** must be **1920×1080** CSS px while keeping a visible frame; expanded clip + outline outside the stage was removed.

### Consequences
Purely visual chrome; compositor and capture unchanged (**1920×1080**).

---

## ADR-0060 — Cap stage scale at 1 (1080p-sized box on large monitors)
Date: 2026-04-07

### Decision
**`FixedStageViewport.computeScale`** uses **`s = min(1, viewportW/1920, viewportH/1080)`** again (with **`visualViewport`** when present).

### Rationale
Without the **`1`** cap, **`s`** exceeds **1** on large windows and the **1920×1080** layout is **upscaled** to fill the browser—users on **high-resolution** desktops expect a **fixed 1920×1080 CSS px** game+HUD island and **black** surround (per earlier mockup intent).

### Consequences
- **Supersedes** the “large viewports scale the stage up to fill” outcome described under **ADR-0056**; **downscale-only** past **1:1** on small windows is unchanged.
- If OS / browser **CSS viewport** is still **≤ 1920×1080** at “4K” (display scaling), **`s`** stays **1** and margins may not appear—that is driven by **reported layout pixels**, not physical panel resolution.

---

## ADR-0061 — `CursorLayer` outside `FixedStageViewport`
Date: 2026-04-07

### Decision
Render **`CursorLayer`** as a **sibling** of **`FixedStageViewport`** in **`GameApp`** (still under **`CursorProvider`**), not inside the scaled stage.

### Rationale
The stage uses **`transform: scale`**, which makes **`position: fixed`** descendants use that ancestor as the containing block. **`CursorLayer`** positions the hand with **`clientX`/`clientY`** (viewport space), so it appeared **offset** / “double cursor” vs the system pointer.

### Consequences
- **`FeedbackLayer`** / **`DebugPanel`** remain inside the stage; if similar misalignment is noticed, apply the same pattern or convert coordinates.

---

## ADR-0062 — HUD bottom row 300px (map, inventory, navigation)
Date: 2026-04-07

### Decision
Change **`HudLayout`** **`grid-template-rows`** third track from **400px** to **300px** (**25%** shorter). Row order unchanged (**`1fr` `1fr` fixed**), so the band stays **bottom-aligned**; upper rows absorb the extra space.

### Rationale
User request: shorter minimap, inventory, and navigation band while keeping bottom alignment.

### Consequences
- **Supersedes** the **400px** value in **ADR-0047** for the third row; **`ui_hud_background`** alignment may need a pass if the plate assumed the old band height.

---

## ADR-0063 — HUD bottom row 285px (further −5%)
Date: 2026-04-07

### Decision
Change **`HudLayout`** **`grid-template-rows`** third track from **300px** to **285px** (**95%** of **300px**).

### Rationale
User request: additional **−5%** height on the minimap + inventory + navigation row; bottom alignment unchanged.

### Consequences
- **Supersedes** the third-row height in **ADR-0062**; background plate may need another alignment pass.

---

## ADR-0064 — Map + navigation rail width −25%, outer-aligned
Date: 2026-04-07

### Decision
In **`HudLayout.module.css`**, **`.map`** and **`.navigation`** use **`width: 75%`**, **`justify-self: start`** and **`end`** respectively (**`max-width: 100%`**, **`min-width: 0`**).

### Rationale
User request: **−25%** width on minimap and navigation widgets; map **left-aligned**, navigation **right-aligned** in their **1fr** bottom-row cells.

### Consequences
- **`ui_hud_background`** may need adjustment if it assumed full-width map/nav cells.

---

## ADR-0065 — Wider inventory band + portraits 75% like map/nav
Date: 2026-04-07

### Decision
Wrap map, inventory, and navigation in **`HudLayout`**’s **`.bottomRow`** (**`grid-area`** spanning the third row). Inside, **`grid-template-columns: minmax(0, 0.75fr) 120px minmax(0, 1.62fr) 120px minmax(0, 0.75fr)`** (fr total **3.12**, matching **`1 + 1.12 + 1`** above) so the **inventory** middle grows vs **ADR-0064**’s layout. **Portrait** `<section>`s (**`.char1`–`.char4`**) use **75%** width and **`justify-self: start`** / **`end`** to match map/nav alignment.

### Rationale
User request: inventory should **fill more space between** map and navigation; character widgets should be the **same width** relationship as map and nav (**75%** of rail, outer-pinned).

### Consequences
- **`ui_hud_background`** may need a pass for the wider bottom **inventory** column.

---

## ADR-0066 — Map/nav width match portraits without shrinking inventory
Date: 2026-04-07

### Decision
Keep **`bottomRow`** **`0.75fr 120px 1.62fr 120px 0.75fr`**. Set **`.map`** and **`.navigation`** to **`width: 100%`** (full **0.75fr** tracks) instead of **75%**.

### Rationale
Portraits are **75% × 1fr = 0.75fr** wide; bottom side tracks are **0.75fr**, so **100%** fill matches portrait width while the **1.62fr** inventory band is unchanged vs **ADR-0065**.

### Consequences
- Map/nav cells span the full bottom outer column; inner minimap/nav art remains centered where applicable.

---

## ADR-0067 — No map/nav titles; flex-center content
Date: 2026-04-07

### Decision
Remove **`MAP`** / **`NAVIGATION`** **`<h3>`** from **`HudLayout`**. Style **`.map`** / **`.navigation`** with **`display: flex`**, **`align-items`/`justify-content: center`**, and **`> * { flex: 0 1 auto; max-width/height: 100% }`**. **`MinimapPanel`** / **`NavigationPanel`** roots drop **`height: 100%`** in favor of **`max-height: 100%`** + intrinsic sizing so centering reads correctly.

### Rationale
User request: no titles; center minimap and nav pad in their cells.

### Consequences
- **`INVENTORY`** title unchanged.

---

## ADR-0068 — Make HUD + presenter stage-relative (avoid fixed-offset drift)
Date: 2026-04-07

### Decision
Inside the 1920×1080 `FixedStageViewport` stage, position the compositor and HUD layers **relative to the stage** (use stage-relative absolute positioning), not browser-viewport fixed positioning:
- `DitheredFrameRoot` presenter canvas and HUD wrappers are stage-relative.
- `HudLayout` root is stage-relative (capture HUD stays stage-relative as well).

Portrait sprite layers inside the portrait frame use **fit/contain** sizing (`object-fit: contain`) so sprites remain horizontally centered within their frame.

### Rationale
With a centered, downscale-only stage (black margins on large screens), `position: fixed` elements inside the stage pin to the **browser viewport** rather than the **centered stage**, causing visible drift: the 3D viewport rectangle offsets relative to the HUD chrome, and portrait sprite layers can appear shifted.

### Consequences
- Stage-internal layers align consistently regardless of letterboxing/margins.
- The only intentionally viewport-fixed UI is `CursorLayer` (rendered outside the stage) so `clientX/clientY` pointer tracking remains correct.

---

## ADR-0069 — Portrait sprites preserve aspect without `object-fit` (html2canvas-safe)
Date: 2026-04-07

### Decision
In the party HUD portrait renderer (`web/src/ui/portraits/PortraitPanel`), stop relying on `object-fit: contain` for the layered `<img>` sprites. Instead, center each sprite and preserve aspect ratio using intrinsic sizing (`height: 100%`, `width: auto`, `max-width/max-height: 100%`).

### Rationale
The visible HUD is composited from an offscreen capture DOM via `html2canvas`. After the latest pull, party portraits appeared horizontally stretched in the final composite even though the live DOM CSS was correct. This is consistent with `html2canvas` rendering limitations around `object-fit` for absolutely positioned, full-bleed `<img>` layers.

### Consequences
- Party portraits respect the original PNG aspect ratio in the captured HUD texture (and therefore in the final WebGL-presented frame) across browsers.
- Portrait layering remains unchanged (same assets, z-order, blink/idle logic); only the sizing primitive differs.

---

## ADR-0070 — Upgrade dungeon corridor stitching + connectivity repair
Date: 2026-04-07

### Decision
Update the `Dungeon` floor generator (`web/src/procgen/generateDungeon.ts`) to:
- stitch corridors between **sibling BSP subtrees** (instead of chaining rooms in array order)
- run a deterministic **connectivity repair** pass if any walkable components remain disconnected
- select the **exit** as the **farthest reachable** floor cell from the entrance by BFS distance
- store the canonical generator output bundle on `state.floor.gen` (phase-stable, seed-derived meta)

### Rationale
The prior corridor “chain” produced long snaking layouts and could leave disconnected components, forcing downstream systems to defend against broken floors. Farthest-exit selection creates more consistent pacing and makes regeneration results easier to reason about and debug.

### Consequences
- Floor regeneration produces more coherent, reliably connected layouts.
- Later phases (locks/keys, room tagging, population) can build on a stable, validated layout without adding ad-hoc fixups.

---

## ADR-0071 — Add minimal lock/key pass to procgen output
Date: 2026-04-07

### Decision
Extend dungeon generation to include a minimal lock/key slice:
- place one `lockedDoor` on the entrance→exit shortest path (lock id `A`)
- spawn an `IronKey` on the reachable side as a deterministic floor item
- thread spawned floor items through `floor/regen` so the world hydrates them from `floor.gen`

### Rationale
Keys/doors are a core pacing tool in the design. Implementing the smallest solvable lock early establishes the data flow (gen → state → world rendering) and provides a foundation for future mission graphs and multi-lock correctness validation.

### Consequences
- Regenerated floors include at least one locked gate and a corresponding key placement.
- Later work will expand from a single hardcoded `IronKey` to typed keys/locks and validation (no key behind its own lock, shortcut relief, etc.).

---

## ADR-0072 — Add room tagging + tag-driven POI placement (M4-lite)
Date: 2026-04-07

### Decision
Add lightweight room tags to procgen output (`floor.gen.rooms[*].tags`) and switch POI placement from “random floor cells” to a deterministic, tag-aware heuristic:
- `Well` placed at/near the entrance
- `Bed` placed roughly mid-distance (by BFS distance field)
- `Chest` biased toward `Storage` (small) rooms, else farthest-unused floor cell

### Rationale
This creates the first real bridge between the design taxonomy (room roles/properties) and actual generated content placement, without committing to a full constraint solver yet. It also makes regen results more legible and testable.

### Consequences
- POI layouts become more consistent (and less “three random dots”).
- Room tagging remains a first-pass heuristic and will be replaced by quota/adjacency-based tagging later.

---

## ADR-0073 — Add carve-only CA smoothing pass to dungeon layout
Date: 2026-04-07

### Decision
Add a small, deterministic cellular-automata-style smoothing pass in dungeon generation that **only** converts some `wall` tiles into `floor` tiles based on local 8-neighbor floor density (1 pass initially).

### Rationale
We want the “softened alcove” feel from the design spec without risking corridor collapse/soft-locks. A carve-only pass improves visual/structural variety while preserving guaranteed connectivity.

### Consequences
- Layouts gain small alcoves and fewer jagged wall artifacts.
- The pass is intentionally conservative; future work may add a second pass or a separate “close-only” pass gated by validations.

---

## ADR-0074 — Procgen spawns NPCs and extra floor items (tag-driven)
Date: 2026-04-07

### Decision
Extend `floor.gen` to include generated `npcs[]` and spawn a small set of NPCs + extra floor items during the population phase based on basic room tags (function/properties). Wire `floor/regen` to hydrate `state.floor.npcs` from `floor.gen.npcs` instead of keeping the fixed demo list.

### Rationale
Dungeon generation needs to drive encounter and discovery pacing. Spawning NPCs/items from tags establishes the core “taxonomy → content tables” loop early, while keeping determinism and phase separation intact.

### Consequences
- Regenerated floors have varied NPC placement and loot-like floor items without manual seeding.

### Update (superseded by ADR-0078)
Startup now uses procgen for the first floor; the fixed demo map and hand-placed NPC list were removed from `makeInitialState`.

---

## ADR-0078 — Bootstrap first floor from procgen (same path as regen)
Date: 2026-04-07

### Decision
Replace the hand-built 13×13 demo corridor in `makeInitialState` with a call to `generateDungeon` using the same default seed/dimensions as before, hydrate spawned floor items into `party.items` + `floor.itemsOnFloor`, set `floor.npcs` from `gen.npcs`, and spawn the player at `gen.entrance`. Extract `hydrateGenFloorItems` and `snapViewToGrid` into `web/src/game/state/procgenHydrate.ts` for reuse by `reducer` and `makeInitialState`. Align `floor/regen` player spawn with `gen.entrance` (was bottom-center).

### Rationale
Players and production builds should see the procedural dungeon immediately; requiring F2 Regen hid the real system. Sharing hydration helpers avoids drift between startup and regen.

### Consequences
- Shrine/CrackedWall demo POIs on the old map are no longer present unless procgen adds equivalent content later.
- First-floor layout is deterministic for the default seed (same as before for seed-only expectations, but layout content is procgen output).

---

## ADR-0075 — Add deterministic validation and bounded rerolls to procgen
Date: 2026-04-07

### Decision
Add a bounded, deterministic **validation + reroll loop** inside dungeon generation:
- retry generation (using derived attempt seeds) if key/lock solvability constraints fail
- validate that the key is reachable without passing locked doors and that the exit is unreachable-before / reachable-after unlocking

### Rationale
As generation gains more phases (population, locks, tagging), occasional invalid configurations are inevitable. A bounded deterministic retry strategy preserves reproducibility while preventing soft-lock floors from leaking into gameplay.

### Consequences
- Same input seed still produces the same final floor, even with retries.
- Debugging should surface the final chosen attempt/seed if we later add overlays/logging.

---

## ADR-0076 — Record accepted reroll attempt in procgen meta
Date: 2026-04-07

### Decision
Include `inputSeed`, `attemptSeed`, `attempt`, and `w/h` in `floor.gen.meta` so the final accepted reroll is explicit and reproducible.

### Rationale
Once generation includes validation and rerolls, the “seed” alone is no longer sufficient for debugging: we need to know which derived attempt was accepted. Recording this metadata keeps determinism while making issues reproducible.

### Consequences
- Debug tooling can display and export the exact accepted attempt without guessing.
- Future multiplayer/host-sync work can log and transmit the meta as part of the floor snapshot.

---

## ADR-0077 — Add “Dump floor.gen JSON” debug action
Date: 2026-04-07

### Decision
Add a button in the F2 Debug panel to download the current `state.floor.gen` as a JSON file named by seed + attempt.

### Rationale
Procgen iteration is dramatically faster when we can capture and share a complete reproducible snapshot (layout, tags, locks, POIs, NPCs, items, meta) without adding temporary console logs.

### Consequences
- Designers/devs can attach a `floor.gen` JSON to bug reports or use it for future replay tooling.

---

## ADR-0074 — Show player facing on minimap (north-up + arrow)
Date: 2026-04-07

### Decision
Keep the minimap **north-up** and show the player’s facing as a small **arrow** on the player tile (4-way, derived from `floor.playerDir`).

### Rationale
Players need a quick orientation cue while navigating; an arrow marker adds clarity without rotating the minimap or changing layout.

### Consequences
- The facing indicator is discrete (N/E/S/W), matching grid yaw (no pitch / no free-look).
- Minimap rendering remains DOM/CSS-based (no canvas) for simplicity and performance.

---

## ADR-0075 — Timestamp drag/drop actions to prevent immediate UI cue expiry
Date: 2026-04-07

### Decision
Include an optional `nowMs` timestamp on `drag/drop` actions (set from `performance.now()` at pointer-up) and have the reducer apply that timestamp as the effective `state.nowMs` for resolving the drop (feed/inspect/crafting/drop).

### Rationale
Some UI cues (notably the portrait mouth “chomp” flicker burst) are time-gated and cleared in `time/tick` when `untilMs <= nowMs`. If a drop resolves using a stale `state.nowMs` value, the next tick can immediately clear the cue, making the burst appear to “not play”.

### Consequences
- Drop resolution is anchored to the pointer-up timestamp rather than “last tick time”, improving perceived responsiveness for time-based UI feedback.
- Existing systems that rely on `state.nowMs` during drop resolution become consistent with the tick clock (both are `performance.now()`-based).

---

## ADR-0076 — Cache portrait image loads to prevent revalidation storms
Date: 2026-04-07

### Decision
Prevent repeated runtime image requests by:
- tightening `PortraitPanel` effects to depend on **stable URL strings** (not whole character objects that can change identity every `time/tick`)
- introducing a small shared in-app image cache (`web/src/ui/assets/imageCache.ts`) to dedupe in-flight loads and reuse decoded `HTMLImageElement`s for imperative loads and prefetching

### Rationale
During play, state updates frequently (`time/tick`). When a portrait effect depends on an object whose identity churns, it can re-run each tick and re-assign image `src`/create new `Image()` instances, which in dev (and sometimes in prod) can lead to constant network revalidation and unnecessary decode work.

### Consequences
- Portrait sprite layers are prefetched once per portrait URL-set change, reducing hitches and network chatter.
- Any future imperative image loads should use `loadImage()` / `prefetchImages()` rather than `new Image()` directly.

---

## ADR-0079 — Fix procgen empty rooms: separating locks + keep last layout on failed validation
Date: 2026-04-07

### Decision
- Place `lockedDoor` only on a shortest-path tile where closing the lock makes the exit **unreachable** from the entrance (true gate); otherwise try another path index or omit lock/key for that attempt.
- After bounded rerolls, return the **last full `generateDungeonOnce` result** (always includes BSP rooms) when validation still fails, instead of falling through to a stub with `rooms: []`.
- If catastrophic failure still requires a fallback, carve a **minimal single-room** layout rather than all-walls empty metadata.

### Rationale
Validation required “exit not reachable before unlock” while a single lock on one corridor tile could leave alternate routes in looped layouts, causing every attempt to fail and the outer loop to pick `generateDungeonFallback`, which returned empty `rooms`.

### Consequences
- Lock placement is slightly more selective; some seeds get no lock/key when no separating cell exists on the chosen path.
- Players always see a real procgen room list unless the fallback path runs (should be rare).

---

## ADR-0080 — Increase default floor size to 31×31 (multi-room BSP)
Date: 2026-04-07

### Decision
Change the default first-floor dimensions in `makeInitialState` from **13×13** to **31×31** (regen keeps current `floor.w/h`).

### Rationale
The BSP generator’s current minimum leaf size and depth limits don’t meaningfully split a 13×13 inner rect, so most seeds look like a single “big room.” 31×31 consistently yields multiple rooms + corridors without changing procgen logic.

### Consequences
- First load and subsequent regen runs on that save/session will use larger floors.
- UI/minimap must remain readable at this scale; adjust later if needed.

---

## ADR-0081 — Reduce room fill + increase BSP splits (avoid “single big room” feel)
Date: 2026-04-07

### Decision
Adjust procgen BSP parameters to produce more, smaller rooms with more wall separation:
- min leaf: ~7→~6
- max BSP depth: 5→6
- room carve ratio: ~60–80% → ~45–70% of leaf

### Rationale
Even at 31×31, large leaf rooms + high room-fill can read like one large open space in first-person. Smaller rooms and thicker inter-room walls improve spatial readability.

### Consequences
- Slightly more corridors/walls; floor coverage decreases.
- Existing lock/key and POI placement continues to work (still uses floor tiles + room centers).

---

## ADR-0082 — Turn animation uses shortest-path yaw (unwrap across 0/2π)
Date: 2026-04-07

### Decision
When animating `player/turn`, compute the target yaw as the **equivalent angle closest to the current yaw** (unwrapping by integer multiples of \(2\pi\)), so the camera always rotates the **shortest** 90° path across the \(0 \leftrightarrow 2\pi\) boundary. On turn completion, snap `view.camYaw` back to the canonical \(dir \cdot \pi/2\) wrapped into \([0,2\pi)\).

### Rationale
Interpolating yaw directly between canonical angles (e.g. `0` and `3π/2`) can accidentally take a **270°** path, which can present as the first-person view facing “backwards” relative to minimap/movement even though `playerDir` is correct.

### Consequences
- Grid movement and minimap remain driven by canonical `floor.playerDir` (0..3).
- The animated camera yaw may be temporarily outside \([0,2\pi)\) during the turn tween; it is canonicalized when the animation ends.

---

## ADR-0083 — Add F2 debug pose readout for yaw diagnostics
Date: 2026-04-07

### Decision
Add a small **Pose** readout to the F2 debug panel showing `playerDir`, `view.camYaw`, the canonical yaw for `playerDir`, and the yaw value the renderer applies.

### Rationale
Camera-facing bugs can stem from state desyncs vs renderer angle wrapping/convention. A live readout makes the failure mode obvious without adding always-on overlays or temporary console logging.

### Consequences
When the camera appears reversed, we can immediately tell whether `playerDir`, `view.camYaw`, or the renderer-applied yaw is inconsistent.

---

## ADR-0084 — Negate Three.js `rotation.y` vs game yaw (forward XZ convention)
Date: 2026-04-07

### Decision
Keep **`view.camYaw` / `playerDir`** as the **game-space** yaw whose forward on the XZ plane is \((\sin y,\,-\cos y)\). In `WorldRenderer`, set the camera Euler **Y** to **`-yawGame`** (after wrap), not `+yawGame`. Camera shake’s lateral world conversion uses the same **`yawThree`** as `rotation.y` so shake stays aligned with the view.

### Rationale
Three.js `Object3D.rotation.y` rotates the camera’s local \(-Z\) toward \((-\sin y,\,0,\,-\cos y)\), which has the **opposite sign on X** versus our grid/minimap forward convention \((\sin y,\,0,\,-\cos y)\). Using `+yawGame` directly made facing agree with state numbers while the view could look **180° wrong** (especially noticeable after many turns / wrap). Negating matches game forward, movement, and minimap.

### Consequences
- F2 Pose readout distinguishes **yawGame (logic)** vs **rotation.y (Three.js)**.
- Any future code that derives world directions from the camera must use the same sign convention (or read from the camera matrix).

---

## ADR-0085 — Portrait frame click: paperdoll + forced idle flash
Date: 2026-04-07

### Decision
(original) Clicking the **portrait frame** should open the **paperdoll** and show a short **idle overlay** burst using **`portraitIdleFlashMinMs`…`portraitIdleFlashMaxMs`**.

### Rationale
Immediate character feedback when opening equipment; reuse idle art + tuning.

### Consequences
Superseded in practice by **ADR-0086**: portrait-local **`click` / `pointerup` listeners were unreliable** with the compositor HUD + chained **`endPointerUp`**. The shipped approach is **`HudLayout` capture** + **`ui/portraitFrameTap`** + **`ui.portraitIdlePulse`**.

---

## ADR-0086 — Portrait frame tap via HudLayout capture + `portraitIdlePulse` state
Date: 2026-04-07

### Decision
Detect portrait-frame taps at **`HudLayout`** using **`onPointerDownCapture` / `onPointerUpCapture`** on **`[data-portrait-character-id]`**, and handle them with **`ui/portraitFrameTap`**, which opens the paperdoll and sets **`ui.portraitIdlePulse`** until **`time/tick`** passes **`untilMs`**. **`PortraitPanel`** only **renders** idle visibility from **`portraitIdlePulse`** (plus ambient idle flashes).

### Rationale
Portrait-local React listeners still failed in practice (opaque compositor + chained **`pointerup`** / event delegation). Ancestor capture runs first and matches the same DOM markers the player actually hits.

### Consequences
- **`ui/openPaperdoll`** remains for flows that open equipment without a pulse (if any); the **name/species** button uses **`portraitFrameTap`** for parity with the frame.
- One more short-lived field on **`UiState`** (`portraitIdlePulse`).
- **Paperdoll backdrop** ignores outside clicks for ~450ms after open so a trailing **`click`** does not call **`ui/closePaperdoll`** while **`portraitIdlePulse`** (unchanged by close) still makes the idle overlay look “successful.”

---

## ADR-0087 — Modals only in `stageModalLayer` (not in capture HUD)
Date: 2026-04-07

### Decision
**`PaperdollModal`** and **`NpcDialogModal`** render **only** in **`DitheredFrameRoot`’s `stageModalLayer`**. Neither **`HudLayout`** (interactive nor capture) mounts them.

### Rationale
The final image is **WebGL presenter canvas** (3D + HUD **`html2canvas` texture**) with **DOM** allowed above the canvas. If modals exist in **both** the capture tree **and** **`stageModalLayer`**, the texture contains one modal and the DOM draws another → **two** visible modals. Omitting modals from capture leaves **one** DOM modal above the canvas; it is visible and interactive and not multiplied by **`opacity: 0`**.

### Consequences
- While a modal is open, the **HUD texture** does not include it (only the base HUD); the modal is entirely the **DOM** overlay.
- **`HudLayout`** no longer imports modal components.
- **`stageModalLayer`** must use **`pointer-events: auto`** and mount **only when** a modal is open; a **`pointer-events: none`** wrapper let events fall through to **`.interactiveHud`**, so **Close** and other controls never received clicks.

**Superseded (behavior):** **ADR-0205** — capture HUD now includes modal pixels; visible modal is the **dithered** bitmap; **DOM** modals **portal** invisibly for hits.

---

## ADR-0088 — Minimap local viewport (~12×12, player-centered)
Date: 2026-04-07

### Decision
**`MinimapPanel`** renders a **fixed-size tile viewport** (currently **12×12**, capped by floor `w`/`h`) **centered on `playerPos`**, with the origin **clamped** so the window stays inside the floor. It no longer draws every tile of large procgen floors.

### Rationale
Full-floor minimaps become unreadable and waste HUD space as dungeon size grows; a local window keeps scale consistent.

### Consequences
**POIs** and distant terrain **off the window** are hidden until the player moves closer. Constants live beside **`MinimapPanel`**; CSS grid track counts are set **inline** from the viewport size.

---

## ADR-0089 — Random first-load floor seed
Date: 2026-04-07

### Decision
`makeInitialState` picks **`floor.seed`** with **`crypto.getRandomValues`** (32-bit), with a **`Math.random` + `performance.now` XOR** fallback when `getRandomValues` is unavailable. The previous fixed seed (**1337**) is removed.

### Rationale
Cold starts should see varied layouts without manual regen; runs remain reproducible from **`floor.gen`** / debug dump and the stored **`floor.seed`**.

### Consequences
First load no longer matches the old single fixed dungeon. **`floor/regen`** without an explicit seed still uses time-based mixing (unchanged).

---

## ADR-0090 — Placeholder NPC/POI sprites from `Placeholders/`
Date: 2026-04-07

### Decision
Use **`Placeholders/Placeholder_NPC.png`** as the canonical missing-art stand-in. Copy it into **`web/public/content/`** as **`npc_wurglepup.png`** (so `NPC_SPRITE_SRC` resolves) and **`poi_placeholder.png`**. Map POI kinds in **`POI_SPRITE_SRC`**: **Well** → **`/content/npc_well.png`**, other **`PoiKind`** values → **`/content/poi_placeholder.png`**. **`WorldRenderer`** draws POI billboards with the same texture/material path as NPC sprites (aspect-aware scale) instead of the prior shared glyph sprite.

### Rationale
Avoids broken URLs for Wurglepup and gives POIs visible, consistent placeholder art until per-kind PNGs exist, without scattering different ad-hoc fallbacks.

### Consequences
Replacing placeholder art updates **`Placeholders/Placeholder_NPC.png`** and re-copies (or replaces) the derived files under **`web/public/content/`**. POI billboard **height** stays fixed at ~**0.55** world units until dedicated POI size tuning exists.

---

## ADR-0091 — Ground POI billboards like NPCs
Date: 2026-04-07

### Decision
POI sprite **Y** uses the same **center-pivot floor formula** as NPCs: **`floorTopY + npcFootLift + height * (0.5 - groundY)`**, with **`height === 0.55`** for POIs. **Well** reads **`poiGroundY_Well`**; other POI kinds use **`npcGroundY_Wurglepup`** because they share the Wurglepup/placeholder texture.

### Rationale
A fixed **`y = 0.72`** was left over from the old compact glyph POI marker; with full-height PNG billboards the sprite center sat far above the floor, so POIs appeared to float.

### Consequences
F2 exposes **`poiGroundY_Well`** next to NPC ground pivots. **`debug-settings.json`** may persist it.

---

## ADR-0092 — Ship new Content NPC/Well art (slime Wurglepup, idles, well VFX)
Date: 2026-04-07

### Decision
- Mirror **`Content/`** → **`web/public/content/`** (rsync) so Vite-served assets match the canonical art folder.
- Point **`NPC_SPRITE_SRC.Wurglepup`** at **`/content/npc_slime.png`**. Add **`NPC_SPRITE_IDLE_SRC`** for **Catoctopus** and **Wurglepup**; **`WorldRenderer`** swaps **`SpriteMaterial.map`** between base and idle on a timer (shared per kind).
- For **Well** POIs only, draw **`npc_well_glow.png`** and a small billboard that cycles **`npc_well_sparkle_1..3.png`** (not raycast pick targets). Paths live beside **`POI_SPRITE_SRC`** in **`poiDefs.ts`**.

### Rationale
New PNGs in **`Content/`** were not fully wired: Wurglepup still pointed at a duplicate **`npc_wurglepup.png`**, idle frames and well overlay art were unused, and runtime needed the updated files under **`public/`**.

### Consequences
**`npc_wurglepup.png`** in **`web/public/content/`** is no longer referenced by code (safe to delete later). Tuning **`npcGroundY_*` / sizes** may need a pass once slime/catoctopus idle framing is final. POIs other than Well remain on **`poi_placeholder.png`** until art exists.

---

## ADR-0093 — Expanded procgen: realizers, districts, multi-lock, mission graph, scoring
Date: 2026-04-07

### Decision
- **`GameState.floor`** carries **`floorIndex`**, **`floorType`**, and **`floorProperties`**; **`generateDungeon`** receives them ( **`floorIndex`** mixed into the procgen seed via **`splitSeed`**; **`inputSeed`** in meta stays the user-facing floor seed).
- **Geometry**: **`Dungeon`** keeps BSP + sibling corridors; add **`Cave`** (worm + widen + bbox room) and **`Ruins`** (macro 5×5 stamps + doorways), then shared repair + carve-only CA.
- **Districts + tags**: Voronoi **`district`** on **`GenRoom`**; quota-style **`tagRoomsWithQuotas`** plus **`floorProperties`** rolls.
- **Locks**: ordered **A/B** gates on the shortest path when path length allows, with **`IronKey` / `BrassKey`**, **`forLockId`** on floor items, **`keyDefId` + `orderOnPath`** on **`GenDoor`**; **`validateGen`** checks ordered reachability. Door use in **`tryOpenDoor`** resolves the required **`keyDefId`** from **`floor.gen.doors`**.
- **Output**: **`floor.gen.genVersion` 2**, extra RNG streams (**`districts`**, **`score`**), optional **`layoutScore`**, embedded **`missionGraph`**. **`generateDungeon`** collects **valid** rerolls and returns the **highest-scoring** layout.
- **Debug**: F2 **Procgen** section + **Cycle type** action (**Dungeon → Cave → Ruins**) for the next regen; dump JSON unchanged in spirit but richer payload.

### Rationale
Implements the documented roadmap toward taxonomy-driven floors, formal lock correctness, and debuggable progression graphs without breaking deterministic multiplayer prep.

### Consequences
- **`BrassKey`** added to **`ContentDB`** for the second lock tier.
- Procgen split across **`layoutPasses`**, **`locks`**, **`districtsTags`**, **`population`**, **`missionGraph`**, **`scoreLayout`**, **`realizeDungeonBsp` / `realizeCave` / `realizeRuins`**, and a thin **`generateDungeon`** orchestrator.
- Older **`floor.gen`** snapshots without new fields still parse as partial; gameplay assumes **`gen`** from current builds when opening doors.

---

## ADR-0094 — Well drained POI state + layered VFX rules
Date: 2026-04-07

### Decision
- Add optional **`FloorPoi.drained`** (meaningful for **Well**). Default is filled (falsy).
- When **`applyItemOnPoi`** applies a **`useOnPoi.Well`** **`transformTo`** (e.g. Waterbag empty → full), set **`drained: true`** on that POI.
- **`WorldRenderer`** includes **`drained`** in the geometry rebuild key. Filled wells keep **`npc_well.png`** + **`npc_well_glow.png`** + cycling **`npc_well_sparkle_*`**; drained wells use **`npc_well_drained.png`** only (no glow/sparkle). **`poiDefs`** exports **`POI_WELL_FILLED_SRC`**, **`POI_WELL_DRAINED_SRC`**, plus existing glow/sparkle paths.

### Rationale
Separates “magic water” presentation from a dry well, ties the transition to the existing waterbag interaction, and avoids per-frame scene surgery by rebuilding when the flag flips.

### Consequences
Ship **`npc_well_drained.png`** under **`Content/`** and **`web/public/content/`** (placeholder may match filled art until final dry well sprite exists). Save-at-well behavior is unchanged when drained.

---

## ADR-0095 — 3D lighting perf: gated beam shadows, tunable shadows, fog reuse, nearest torches
Date: 2026-04-07

### Decision
- **Beam / spot:** When effective beam intensity is zero (e.g. `lanternBeamIntensityScale` = 0), the **SpotLight** is **`visible = false`**, **`castShadow = false`**, and global shadow mapping can turn off if the point light also has shadows off — avoiding a shadow prepass for an invisible beam.
- **Point lantern:** **`shadowLanternPoint`** (F2, default **off**) controls whether the lantern **PointLight** casts shadows (cube map; costly). **`shadowLanternBeam`** gates beam shadows when the beam is actually lit.
- **Shadow quality:** F2 exposes **`shadowMapSize`** (128 / 256 / 512) and **`shadowFilter`** (basic / PCF / PCF soft), applied to lantern shadow lights.
- **Torches:** POI torch count is **`torchPoiLightMax`** (default **3**), selecting the **nearest** POIs to the player by **Manhattan** distance (replacing “first N in list”).
- **Fog:** Reuse a single **`FogExp2`** and update density instead of `new` every frame when fog is on.

### Rationale
In practice the beam is often off; previously the spot could still cast shadows and burn a shadow pass for no visible light. Point-light cube shadows dominate cost when enabled; defaults favor **performance** while preserving **quality** via F2. Nearest torches better match player-local lighting and cap work when many POIs exist.

### Consequences
Baseline look may lose **dynamic shadows** until the player enables **`shadowLanternPoint`** and/or a visible beam with **`shadowLanternBeam`**. **`DESIGN.md`** §11 and F2 copy reflect the new knobs. [ADR-0008](DECISIONS.md) / [ADR-0010](DECISIONS.md) remain historical; shadows are no longer “always both lantern lights.”

---

## ADR-0096 — Dungeon environment uses authored cave PNG albedos
Date: 2026-04-08

### Decision
Replace procedural canvas **floor / wall / ceiling** maps in `WorldRenderer` with **`TextureLoader`** images: **`cave_floor.png`**, **`cave_wall.png`**, **`cave_ceiling.png`** at stable **`/content/…`** URLs (mirrored from **`Content/`** into **`web/public/content/`**). Textures are cached on the renderer, **`SRGBColorSpace`**, **`RepeatWrapping`**, **`repeat (1,1)`** per ~1 world-unit tile face.

### Rationale
Art-ready environment tiles ship in **`Content/`**; the web runtime only serves static files under **`public/`**, so we copy the PNGs and point code at those URLs. Caching avoids reloading on every dungeon geometry rebuild.

### Consequences
**`web/src/world/procTextures.ts`** is unused by the main renderer (kept in tree for now). Swap **`texture_wall_cave_01.png`** or other variants by changing **`dungeonEnvTextures.ts`** and copying into **`web/public/content/`**. **`DESIGN.md`** §11 and §13 list the three filenames.

---

## ADR-0097 — Dungeon mesh shading: Lambert instead of PBR Standard
Date: 2026-04-08

### Decision
Use **`MeshLambertMaterial`** for dungeon **floor, wall, ceiling, and door** meshes in **`WorldRenderer`** instead of **`MeshStandardMaterial`**. Keep **`map`** + **`emissive`** / **`emissiveIntensity`** for the baseline lift; drop **`roughness`** and **`metalness`**.

### Rationale
The scene does not need physically based BRDF complexity; Lambert diffuse is cheaper and easier to reason about while still responding to point/spot lights and shadow maps.

### Consequences
No specular lobes or PBR environment response on voxels (previously near-fully rough anyway). **`DESIGN.md`** §11 updated. Sprites remain **`SpriteMaterial`** (unchanged).

---

## ADR-0098 — Procgen: pacing validation, mission graph fidelity, spawn tables, tag constraints, theme
Date: 2026-04-08

### Decision
- **Validation**: After lock checks, reject layouts where **Well** is farther than **3** BFS steps from **`entrance`** or **Bed** farther than **48** (see **`locks.ts`**; matches mid-path bed heuristic on large floors).
- **Scoring**: Extend **`scoreLayout`** with reachable **junction** cells (floor with ≥3 walkable neighbors) and a bonus when the entrance→exit **shortest-path lattice** is wider than a single spine (**`shortestPathLatticeStats`** in **`validate.ts`**).
- **Mission graph**: Chain **Well/Bed/Chest** edges by increasing BFS distance from entrance; add **`kind: 'shortcut'`** entrance→exit when alternate shortest routes exist; set **`hasAlternateEntranceExitRoute`** on **`MissionGraph`**.
- **Spawn data**: Move NPC/item pick logic into **`spawnTables.ts`**; **`NPC_DEFAULT_WEIGHTS_BY_FLOOR`** keeps single-entry defaults so RNG consumption matches the prior **`population.ts`** path unless designers add weights.
- **Tags**: **`applyTagConstraints`** after quotas (**`districtsTags.ts`**) for Storage/dead-end preference and **Flooded** clustering on **Cursed** floors.
- **Theme**: New RNG stream **`theme`**, **`pickFloorTheme`** (**`floorTheme.ts`**), **`floor.gen.theme`**; **`WorldRenderer`** applies **`material.color`** tints on floor/wall/ceiling Lambert meshes; geometry rebuild key includes theme.
- **Schema**: Bump **`floor.gen.meta.genVersion`** to **3** (adds **`streams.theme`**, **`theme`**, richer **`missionGraph`**).
- **Mission-first**: Stub module **`web/src/procgen/missionFirst.ts`** documents the deferred geometry-last flip; no change to **`generateDungeon`** order yet.

### Rationale
Closes gaps called out in the dungeon procgen roadmap: safer POI pacing, better layout selection for loops, clearer debug graphs, data-shaped spawns, stronger room tags, and visible floor-type differentiation without new textures.

### Consequences
Old **`floor.gen`** JSON without **`theme`** / **`streams.theme`** still loads; renderer falls back to white **tint**. Dump consumers should tolerate **`genVersion` 3**. **`DESIGN.md`** §8 is the updated source of truth.

---

## ADR-0099 — Dither: blend warm palette snap vs quantised-only
Date: 2026-04-08

### Decision
Add **`ditherPalette0Mix`** (0..1) on **`RenderTuning`**, wired into **`DitherShader`** as **`palette0Mix`**. When the dither **palette index** is **0** (warm dungeon), the post-process mixes between **Bayer-quantised colour** (no five-colour snap) and **full snap to warm palette**; other palette indices behave as before. Default **1** preserves prior warm-dungeon appearance.

### Rationale
Lets art direction slide between a softer quantised look and the hard woodcut palette without switching to palette **4** (no snap globally).

### Consequences
F2 exposes **Warm palette mix**; **`clampRenderTuning`** clamps the value. **`DESIGN.md`** §11 lists the control.

---

## ADR-0100 — Procgen v4: spawn context, lock+loop validation, mission stream, debug overlay, mission-first schema
Date: 2026-04-08

### Decision
- **Spawn tables**: Extend **`NpcSpawnContext`** / **`ItemSpawnContext`** with **`floorProperties`**, **`isOnEntranceExitShortestPath`** (pre-lock BFS shortest path through room center), and use **`roomStatus`** in **`pickNpcKindFromTable`** / **`pickFloorItemDefFromTable`**; **`population.ts`** passes **`floorProperties`** from **`generateDungeon`** and builds the path set via **`shortestPathIndices`** (**`locks.ts`**).
- **Validation**: When **`doors`** include any procgen lock, **`validateGen`** rejects layouts unless **`shortestPathLatticeStats`** reports a wide entrance→exit shortest-path lattice (same threshold as **`hasAlternateEntranceExitRoute`**).
- **Scoring**: **`scoreLayout`** adds **`lockLoopBonus`** when locked doors exist and the lattice bonus is nonzero.
- **Mission stream**: Add **`streams.mission`**; call **`planMissionBeforeGeometry`** (still returns **`null`**) so the RNG phase is reserved; document **`PlannedMission`** types and embedding contract in **`missionFirst.ts`**.
- **Schema**: Bump **`genVersion`** to **4**.
- **Debug**: F2 **Proc overlay** cycles tints in **`WorldRenderer`** (**districts** / **room function** / **mission** nodes); **`ui.procgenDebugOverlay`** + **`ui/setProcgenDebugOverlay`**; Procgen readout shows **`streams.mission`**.

### Rationale
Implements the roadmap items for taxonomy-driven spawns, backtrack relief when locks exist, explicit mission-first data hooks without flipping pipeline order yet, and in-world procgen visualization for iteration.

### Consequences
Dump JSON and deterministic outputs change vs **`genVersion` 3** (new stream, spawn RNG sequence, validation stricter for locked floors). Older **`floor.gen`** objects without **`streams.mission`** are outside the current type contract if rehydrated manually.

---

## ADR-0101 — Higher-contrast minimap tile palette
Date: 2026-04-08

### Decision
Replace low-alpha **`MinimapPanel.module.css`** fills with **opaque RGB** colours: darker **walls**, lighter **floors**, slightly punchier **player** / **POI** / **door** / **locked door**, and a solid **facing-arrow** fill.

### Rationale
Semi-transparent minimap tiles washed out against the HUD plate and post-process; opaque, separated luminance improves readability at small tile size.

### Consequences
**`DESIGN.md`** §6.4 notes the high-contrast minimap palette; tweak colours in **`web/src/ui/minimap/MinimapPanel.module.css`** only.

---

## ADR-0102 — Soften minimap palette slightly
Date: 2026-04-08

### Decision
Lighten **walls**, dim **floors** slightly, and soften **player** / **POI** / **door** / **locked door** (and the facing arrow) versus **ADR-0101**, keeping **opaque** fills.

### Rationale
**ADR-0101** read a bit harsh on the HUD; a small step back preserves legibility without the same visual punch.

### Consequences
**`DESIGN.md`** §6.4 wording updated to “moderate separation” / softened accents; palette remains in **`MinimapPanel.module.css`** only.

---

## ADR-0103 — Minimap local viewport 10×10 tiles
Date: 2026-04-08

### Decision
Set **`MinimapPanel`** **`MINIMAP_VIEW_W` / `MINIMAP_VIEW_H`** to **10** (was **12**).

### Rationale
Slightly smaller HUD footprint while keeping a north-up, player-centered window.

### Consequences
**`DESIGN.md`** §6.4 updated; behaviour still capped by floor **`w`/`h`** when smaller than **10**.

---

## ADR-0104 — Larger minimap on-screen (14px cells)
Date: 2026-04-08

### Decision
Increase **`MinimapPanel`** tile **CSS size** from **10×10 px** to **14×14 px** (**`MINIMAP_CELL_PX`**), **3 px** grid gap (was **2 px**), slightly larger **corner radius** and **facing-arrow** triangle; drive **`.cell`** size with **`--minimap-cell`** set inline so tracks and cells stay matched.

### Rationale
After narrowing the tile **count** to **10×10**, the map read small; larger pixels restore legibility without widening the logical viewport.

### Consequences
**`DESIGN.md`** §6.4 notes cell size + CSS variable; tune **`MINIMAP_CELL_PX`** and **`MinimapPanel.module.css`** gap/radius/arrow together.

---

## ADR-0105 — Procgen difficulty input, genVersion 5, Track A1 + mission-first design note
Date: 2026-04-08

### Decision
- **Track choice (roadmap)**: Implement **Track A1** — optional **`FloorGenInput.difficulty`** (`0` easy | `1` normal | `2` hard; default via **`normalizeFloorGenDifficulty`**), stored on **`GameState.floor.difficulty`**, passed through **`makeInitialState`**, **`floor/regen`**, and echoed in **`floor.gen.meta.difficulty`**.
- **Consumers**: **`generateDungeon`** reroll attempt count (**8** / **6** / **5**); **`placeLocksOnPath`** min path length and two-lock eligibility (easy: no two-lock, higher min path for any lock; hard: lower thresholds); **`scoreLayout`** scales lock+loop bonus (**0.65** / **1** / **1.2**). Bump **`genVersion`** to **5**.
- **Debug**: F2 **Cycle difficulty** + Procgen readout row.
- **Track B (not implemented)**: Expand **`web/src/procgen/missionFirst.ts`** with an in-source specification: **`PlannedMission`** (abstract, pre-geometry) vs **`MissionGraph`** (realized positions), plan validation rules, per-**`floorType`** embedding outline, downstream wiring to locks/`buildMissionGraph`, and a note that a future embedding feature should add e.g. **`meta.plannedMission`** and bump **`genVersion`** again.

### Rationale
Delivers the roadmap’s first tunable pacing knob without flipping to geometry-last generation; documents mission-first work so Track B can start from a single canonical file.

### Consequences
Dump JSON and **`layoutScore`** selection change vs **`genVersion` 4** for the same seed when **`difficulty` ≠ 1**. Consumers of **`floor.gen`** should tolerate **`meta.difficulty`** and **`genVersion` 5**.

---

## ADR-0142 — Add Barrel/Crate POIs, sprite doors, and canonical POI placeholder
Date: 2026-04-08

### Decision
- Add **Barrel** and **Crate** as new `PoiKind` values with **open/closed sprites** and deterministic “open to drop loot” behavior (like Chest).
- Render **doors** in the 3D view as **sprite billboards** using **`door_closed.png`**, with a short-lived **`door_open.png`** visual FX when a door is opened (the tile still becomes `floor` immediately for movement/pathing).
- Make **`Content/poi_placeholder.png`** the canonical POI placeholder image (a copy of `Placeholders/Placeholder_NPC.png`) and mirror it into `web/public/content/poi_placeholder.png` so the `/content/poi_placeholder.png` URL is always satisfied.

### Rationale
New/updated art landed in `Content/` and needed to be usable in-game via the existing stable `/content/...` URL convention. Doors switching to sprites keeps visuals consistent with the rest of the billboarded interactables and makes the new door art visible immediately.

### Consequences
- Procgen now places additional container POIs (Barrel/Crate), and the POI sprite registry includes open-frame overrides.
- `web/public/content/` must remain a mirror of `Content/` for runtime asset URLs; placeholder copies are now kept canonical under `Content/`.
- Door opening adds a small temporary renderer-only FX cue (does not affect gameplay state).

---

## ADR-0106 — Chest POI uses closed/open PNG billboards
Date: 2026-04-08

### Decision
Wire **Chest** POIs to **`Content/chest_closed.png`** (default) and **`Content/chest_open.png`** when **`opened`**, mirroring **`Content/`** → **`web/public/content/`** and the same Well drained-style alternate material path in **`WorldRenderer`**.

### Rationale
Dedicated chest art exists; the game already tracks **`opened`** and rebuilds POI geometry when POI state changes.

### Consequences
**`poiDefs`** exports stable **`/content/…`** URLs; **`DESIGN.md`** §9 reflects chest art vs placeholders for Bed/Shrine/CrackedWall.

---

## ADR-0107 — POI Chest billboard `poiGroundY_Chest`
Date: 2026-04-08

### Decision
Stop reusing **`npcGroundY_Wurglepup`** for **Chest** POIs; add **`poiGroundY_Chest`** to **`RenderTuning`** (default **0.04**, F2 **POI Chest groundY**), persisted like other render sliders.

### Rationale
**`chest_closed.png` / `chest_open.png`** place opaque pixels within **~3%** of the texture bottom, while Wurglepup tuning (**0.15** in saved debug settings) treated the floor contact **15%** up—too high—so the chest sank into the floor visually.

### Consequences
**`WorldRenderer.getPoiGroundYForKind`** maps **Chest** → **`poiGroundY_Chest`**; Bed/Shrine/CrackedWall remain on **`npcGroundY_Wurglepup`**.

---

## ADR-0108 — 3D pick: floor items over POIs on the same ray
Date: 2026-04-08

### Decision
**`WorldRenderer.resolvePickHit`**: after **`Raycaster.intersectObjects`**, if any hit is a **`floorItem`**, use the **nearest** such hit (first in distance-sorted results); otherwise use the first **`poi` / `npc` / `door`** hit as before. Applied in **`pickTarget`** and **`pickObject`** so click, hover, and drag-start stay aligned.

### Rationale
POI sprites (especially chests) are large billboards; strict “closest mesh wins” left floor loot **behind** the billboard unreachable by pointer.

### Consequences
Click/hover/drag on a stack along one ray favors the **floor item**; NPCs and doors only win when **no** floor item is intersected on that ray. Grid **step-into-tile** resolution (**`attemptMoveTo`**) is unchanged (POI use still runs before NPC dialogue when walking onto a POI cell).

---
## ADR-0109 — Inventory HUD: no title, larger slot icons
Date: 2026-04-08

### Decision
Remove the **INVENTORY** heading from **`HudLayout`**; double **inventory** slot item **font-size** in **`InventoryPanel.module.css`** (**22 → 44 CSS px**) so emoji icons read larger in the grid.

### Rationale
Frees vertical space in the bottom HUD row and improves icon legibility without changing grid layout or interaction.

### Consequences
Drag **ghost** follows **`CursorLayer`** sizing (unchanged); only in-panel slot rendering is larger.

---

## ADR-0110 — Statue HUD slots: no placeholder titles
Date: 2026-04-08

### Decision
Remove the **“Area for statue”** **`<h3>`** headings from **`statueL`** and **`statueR`** in **`HudLayout`**; **`StatuePanel`** is the sole content in those `<section>`s.

### Rationale
Placeholder labels clutter the shell art; map/nav/inventory/statue panels stay consistent without section titles.

### Consequences
**`StatuePanel`** layout receives the full slot height previously consumed by the title + margin.

---

## ADR-0111 — Vite dev: strictPort + polling watch
Date: 2026-04-08

### Decision
Configure **`web/vite.config.ts`** **`server`**: fixed **`host: '127.0.0.1'`**, **`port: 5173`**, **`strictPort: true`**, and **`watch.usePolling: true`** (300 ms interval).

### Rationale
Native file watchers sometimes **skip change events** for this workspace layout (e.g. repo under **Desktop** with **iCloud**, editor **atomic** saves), so HMR appeared “stuck” until a manual dev-server restart. **`strictPort`** avoids a **second** **`npm run dev`** silently binding **5174+**, which made the browser keep talking to a **stale** first server.

### Consequences
Slightly higher idle CPU from polling; **`npm run dev`** fails if **5173** is busy (intentional). Documented in **`web/README.md`**.

---

## ADR-0112 — Portrait HUD: hide party display name in label
Date: 2026-04-08

### Decision
**`PortraitPanel`**: the header **`button`** shows **`species`** only; party **`name`** (**Char1**, etc.) is omitted from visible text. Expose **`aria-label={`${c.name}, ${c.species}`}`** on that **`button`** for accessibility.

### Rationale
Reduces redundant chrome next to portrait art; species remains a quick readout.

### Consequences
**`DESIGN.md`** §7.4 updated. Paperdoll and other UI unchanged.

---

## ADR-0113 — Portrait HUD: remove name/species label row entirely
Date: 2026-04-08

### Decision
Remove the portrait **header `button`** (species text). **`PortraitPanel`** grid is a single row; the **portrait** frame **`role="button"`** carries **`aria-label={`${c.name}, ${c.species}`}`**; paperdoll open remains **frame tap** / keyboard / **`HudLayout`** capture as before.

### Rationale
User request: no visible **name** or **species** chrome—portrait art + vitals overlay only.

### Consequences
**`.btn`** styles removed from **`PortraitPanel.module.css`**. **`DESIGN.md`** §7.4 updated.

---

## ADR-0114 — Portrait vitals: four icon/name/value rows
Date: 2026-04-08

### Decision
**`PortraitPanel`** bottom overlay: replace the single **HP · STA · …** line with **four rows** (**HP**, **STA**, **HUN**, **THR**), each **`statRow`** = **emoji icon** + **short label** + **rounded stat**; **status** line remains underneath, truncated as before.

### Rationale
Clearer scanning and room for distinct affordances per attribute; matches requested structure.

### Consequences
Slightly taller overlay; **`PortraitPanel.module.css`** uses **`statRow` / `statIcon` / `statName` / `statValue`**. **`DESIGN.md`** §7.1 portrait stats bullet updated.

---

## ADR-0115 — Inventory grid slot border (#342a22, 2 px)
Date: 2026-04-08

### Decision
**`InventoryPanel.module.css`**: **`.slot`** border is **2 px solid `#342a22`** (replaces **1 px** light **`rgba`** rim).

### Rationale
User request: stronger, palette-aligned slot framing on the HUD inventory grid.

### Consequences
Hover still uses **`outline`** on **`.slot[data-hover='true']`**; tune border vs outline together if drop feedback feels busy. **`DESIGN.md`** §7.2 notes the slot border spec.

---

## ADR-0116 — Inventory slots: square corners (no border-radius)
Date: 2026-04-08

### Decision
**`InventoryPanel.module.css`**: **`.slot`** uses **`border-radius: 0`** (was **10 px**).

### Rationale
User request: sharp slot corners instead of rounded cells.

### Consequences
Grid reads more “tile-like” and matches a crisp HUD frame; **`DESIGN.md`** §7.2 updated.

---

## ADR-0117 — Inventory slot border color `#ab886b`
Date: 2026-04-08

### Decision
**`InventoryPanel.module.css`**: **`.slot`** border color **`#ab886b`** (was **`#342a22`** per **ADR-0115**).

### Rationale
User request: warmer, lighter rim on inventory cells.

### Consequences
**`DESIGN.md`** §7.2 hex updated.

---

## ADR-0118 — Inventory slot border: `#ab886b` at 50% alpha
Date: 2026-04-08

### Decision
**`InventoryPanel.module.css`**: **`.slot`** border uses **`rgba(171, 136, 107, 0.5)`** (same hue as **`#ab886b`**, **ADR-0117**).

### Rationale
User request: softer rim via **0.5** border opacity.

### Consequences
**`DESIGN.md`** §7.2 notes opacity; stack behind the slot shows through the border color.

---

## ADR-0119 — Inventory slot border alpha 0.75 (was 0.5)
Date: 2026-04-08

### Decision
**`InventoryPanel.module.css`**: **`.slot`** border **`rgba(171, 136, 107, 0.75)`** (was **0.5**, **ADR-0118**).

### Rationale
User request: stronger rim while keeping partial transparency.

### Consequences
**`DESIGN.md`** §7.2 opacity value updated.

---

## ADR-0120 — HUD inventory panel padding 20 px
Date: 2026-04-08

### Decision
**`HudLayout.module.css`**: **`.inventory`** **`padding: 20px`** on all sides (was **10 px**).

### Rationale
User request: more inset around the inventory grid in the bottom HUD row.

### Consequences
Slightly smaller grid footprint inside the **285 px** bottom row; **`DESIGN.md`** §7.2 notes the inset.

---

## ADR-0121 — Inventory slot icon font +25% (44 → 55 CSS px)
Date: 2026-04-08

### Decision
**`InventoryPanel.module.css`**: **`.item`** **`font`** size **55 px** (was **44 px**; **ADR-0109** had doubled **22 → 44**).

### Rationale
User request: **25%** larger item icons in the HUD inventory grid.

### Consequences
Emoji glyphs may clip slightly in the smallest cells if grid columns are narrow; **`DESIGN.md`** §7.2 notes **~55 px**. **`CursorLayer`** drag ghost sizing unchanged unless separately tuned.

---

## ADR-0122 — Inventory hover: item name tooltip in CursorLayer
Date: 2026-04-08

### Decision
When the cursor hovers an **occupied** inventory slot, show the item’s **`def.name`** in a compact label positioned **above** the slot using **`hoverRect`** from **`CursorProvider`**. Implementation lives in **`CursorLayer`** (new **`itemNameTooltip`** styles in **`CursorLayer.module.css`**). The tooltip is **hidden while a drag is active** (started hold-drag) so it does not stack on the ghost and affordance.

### Rationale
The HUD inventory grid under **`.interactiveHud`** is **`opacity: 0`** for compositor capture/hit testing, so a tooltip rendered only inside **`InventoryPanel`** would not be visible; **`CursorLayer`** already draws visible viewport-aligned overlays.

### Consequences
Inventory naming UX is coupled to cursor hover state; long names truncate with ellipsis (**`max-width`**). **`DESIGN.md`** §7.2 documents the behavior.

---

## ADR-0123 — Inventory tooltip uses Google Font Explora
Date: 2026-04-08

### Decision
Load **[Explora](https://fonts.google.com/specimen/Explora)** via **`web/index.html`** (preconnect + **`fonts.googleapis.com`** CSS2 **`family=Explora`**). Expose **`--fontInventoryTooltip: 'Explora', cursive`** in **`web/src/index.css`**; **`CursorLayer.module.css`** **`.itemNameTooltip`** uses that stack with a larger **~37 px** size so the thin stroke stays legible.

### Rationale
User request for a sophisticated display face on inventory name tooltips.

### Consequences
First paint may show fallback until the webfont loads (**`display=swap`**); offline dev needs network (or a future self-hosted **`@font-face`** if we want zero external requests).

---

## ADR-0124 — Inventory tooltip font: Imperial Script (replaces Explora)
Date: 2026-04-08

### Decision
Load **[Imperial Script](https://fonts.google.com/specimen/Imperial+Script)** via **`web/index.html`** (**`family=Imperial+Script`**). Set **`--fontInventoryTooltip: 'Imperial Script', cursive`** in **`web/src/index.css`** (replaces **ADR-0123** **Explora**). **`CursorLayer`** **`.itemNameTooltip`** is unchanged aside from inheriting the new stack (**~37 px**, **700** weight, **text-shadow** per prior tweaks).

### Rationale
User request to try Imperial Script for the same sophisticated script look on inventory name labels.

### Consequences
Same single-weight (**400** hosted) constraints as Explora; **`font-weight: 700`** remains synthetic bold if kept. **`DESIGN.md`** §7.2 references Imperial Script.

---

## ADR-0125 — Inventory tooltip font: Jim Nightshade (replaces Imperial Script)
Date: 2026-04-08

### Decision
Load **[Jim Nightshade](https://fonts.google.com/specimen/Jim+Nightshade)** via **`web/index.html`** (**`family=Jim+Nightshade`**). Set **`--fontInventoryTooltip: 'Jim Nightshade', cursive`** in **`web/src/index.css`** (replaces **ADR-0124** Imperial Script).

### Rationale
User request to use Jim Nightshade for inventory name tooltip labels.

### Consequences
Same **Google Fonts** / **`display=swap`** / optional synthetic **700** behavior as prior tooltip fonts. **`DESIGN.md`** §7.2 references Jim Nightshade.

---

## ADR-0126 — POI sprite brightness tuning (`poiSpriteBoost`)
Date: 2026-04-08

### Decision
Add `render.poiSpriteBoost` (default **1.2**) to multiply POI `THREE.SpriteMaterial.color` so POI billboards can be brightened independently of NPC sprites.

### Rationale
POI sprites were reading consistently darker than other billboard sprites in the 3D viewport. A material color multiplier is asset-agnostic, cheap, and easy to tune live without changing texture encoding or post-process settings.

### Consequences
- F2 Debug exposes **POI sprite boost** and the value persists via `web/public/debug-settings.json`.
- Glow/sparkle overlays remain authored brightness; only the main POI billboard materials are boosted.

---

## ADR-0127 — Post-dither gain debug slider
Date: 2026-04-08

### Decision
Add `render.postDitherLevels` (default **1.0**) to apply a simple **post-dither gain/levels** adjustment **after** the ordered-dither pass, exposed as an F2 debug slider and persisted via `web/public/debug-settings.json` and local storage.

### Rationale
We need a fast “overall brightness/levels” knob that affects **both** the 3D scene and the captured HUD uniformly, without retuning lighting or palette settings.

### Consequences
- `RenderTuning` gains a new persisted field (`postDitherLevels`) clamped to **[0, 3]**.
- The dither shader has a new uniform and applies the adjustment at the end of the post-process.

---

## ADR-0128 — Expand post-dither tuning to lift/gain/gamma (F2)
Date: 2026-04-08

### Decision
Expand post-dither tuning from a single gain knob to a classic **lift/gain/gamma** set, applied after ordered dithering:
- `render.postDitherLift` (default **0.0**)
- `render.postDitherLevels` (interpreted as **gain**, default **1.0**)
- `render.postDitherGamma` (default **1.0**)

Expose all three as F2 debug sliders and persist them via `web/public/debug-settings.json` and local storage.

### Rationale
Gain alone is useful but not enough to tune readability and mood across different palettes and lighting baselines. Lift and gamma provide more control while still being a tiny, cheap post-process that affects HUD + 3D uniformly.

### Consequences
- `RenderTuning` schema grows by two fields; values are clamped to safe ranges.
- The dither shader applies lift/gain and then gamma as the final post-dither step.

---

## ADR-0129 — Debug settings: auto-save local, explicit save-to-project
Date: 2026-04-08

### Decision
Stop auto-writing F2 debug tuning into `web/public/debug-settings.json`. Debug tuning now persists in two tiers:
- **Local auto-save**: render/audio tuning is debounced into browser storage for convenience.
- **Project save**: under `vite dev`, the Debug (F2) panel provides an explicit **Save to project** button that writes `web/public/debug-settings.json` via the existing dev-server endpoint.

On startup, the app loads `web/public/debug-settings.json` as a baseline and then applies locally saved overrides (when present).

### Rationale
Auto-writing into a git-tracked file created accidental churn and made it too easy to commit “random slider fiddling”. We still want quick iteration (local persistence) while keeping the repo snapshot intentional.

### Consequences
- Tuning changes survive reloads by default (local), but **won’t** modify the repo unless you click **Save to project**.
- `web/public/debug-settings.json` remains the shareable baseline for the team/repo; local overrides can diverge per machine.
- Production/static preview continues to load the JSON but has no write endpoint.

---

## ADR-0130 — Minimap: radius-3 pixel circle
Date: 2026-04-08

### Decision
Replace the **10×10** edge-clamped minimap with a **local circular radar**: only tiles with **dx² + dy² ≤ 3²** relative to the player (integer grid), on a **7×7** carrier grid with **out-of-disk** slots hidden; **circular clip + bezel** on **`MinimapPanel`**, **square** cells and **2 px** gaps for a **pixelated** read. **Out-of-bounds** floor coordinates inside the disk use **`void`** styling.

### Rationale
Player request: see **at most ~3 grid units** around the character in a **round, pixelated** minimap rather than a large square window.

### Consequences
**POIs** off-disk no longer appear until the player moves closer. **`DESIGN.md`** §6.4 and **`MinimapPanel` / `.module.css`** document the new layout.

---

## ADR-0131 — Minimap: omit off-map cells (no void placeholders)
Date: 2026-04-08

### Decision
**Do not render** minimap tiles for coordinates **outside the floor `w × h` bounds**, and **do not** allocate **placeholder** squares for the Euclidean disk mask or for OOB cells. Use **absolute positioning** on a fixed **7×7**-sized canvas so drawn tiles stay grid-aligned while empty disk/outside-map areas show only the **circular bezel** background.

### Rationale
Avoid “black” **void** / phantom grid squares; show **only** cells that exist on the current map.

### Consequences
Near floor edges the minimap looks **gapped** or asymmetric inside the circle. **`DESIGN.md`** §6.4 updated accordingly.

---

## ADR-0132 — Centralize “button title” Jim Nightshade typography
Date: 2026-04-08

### Decision
Define shared **CSS custom properties** in **`web/src/index.css`** (`--buttonTitleFontFamily` … `--buttonTitleTextShadow`) for the **Jim Nightshade** headline stack used on **button primary labels** at **25 CSS px**, matching weight, spacing, color, and shadow. **`NpcDialogModal`** uses these tokens for dialog copy and **Close** (see **`DESIGN.md`**).

### Rationale
Keeps modal/button label styling consistent and makes the project’s chosen “button title” face and metrics easy to reuse without copy-pasting declarations.

### Consequences
New UI that needs the same look should prefer **`--buttonTitle*`** over ad hoc rules; changing the style updates all consumers. **`DESIGN.md`** §7.2 documents the tokens.

---

## ADR-0133 — Viewport activity log replaces centered toast
Date: 2026-04-08

### Decision
**Player-facing text feedback** (formerly a single timed **`ui.toast`** banner centered on the game panel) now **appends** to **`ui.activityLog`** and renders in a **bottom-right** panel inside the **game viewport** (at most **four** newest lines visible), using the **button-title** face (**`--buttonTitle*`** tokens except weight) at **`calc(--buttonTitleFontSize - 5px)`** and **regular** weight. The **`ui/toast`** action **only** appends a line (optional **`ms`** ignored). Initial log is **empty** (no bootstrap line).

### Rationale
A **persistent, readable** feed of actions matches the “what the player did” goal better than one ephemeral centered message.

### Consequences
**No timed toast UI**; history is capped (**`ACTIVITY_LOG_MAX_ENTRIES`**). All prior toast producers were migrated through **`pushActivityLog`**. **`DESIGN.md`** §6.3 / §7.5 updated.

---

## ADR-0134 — Show current-cell properties in F2 Debug
Date: 2026-04-08

### Decision
Add an F2 Debug **Cell** readout that shows properties of the **current grid cell**:
- Use the **player** cell as the sole source

The readout includes basic values (`x,y`, in-bounds, tile, Manhattan distance to player) plus procgen room tags (room id, district, roomFunction/roomProperties/roomStatus/size) when `floor.gen` is present.

### Rationale
Cell-level procgen context is useful for debugging and tuning, but always-on overlays are visually noisy. The F2 panel is the designated debug surface and already hosts procgen-related readouts.

### Consequences
- F2 Debug gains a stable place to inspect cell/room tagging without enabling a full-screen overlay.
- No additional pointer/click tracking is required; the panel reads directly from `floor.playerPos`.

---

## ADR-0135 — Remove clicked/hovered cell inspection (F2)
Date: 2026-04-08

### Decision
Remove the F2 “inspect cell” functionality (hover/click-to-inspect). The F2 **Cell** readout now shows **player cell only**.

### Rationale
Keeping the debug panel responsive required extra pointer/click plumbing and proved brittle under the compositor + invisible HUD hit-layer setup. Player-cell readout covers the primary debugging need with minimal overhead.

### Consequences
- Less debug power (can’t inspect arbitrary cells) but more reliability and lower event churn.
- Debug UI state and viewport event handlers are simpler.

---

## ADR-0136 — Remove “walk into POI” interaction (non-blocking POIs)
Date: 2026-04-08

### Decision
Remove the implicit “walk into a POI tile to interact” behavior. POIs are **non-blocking**: stepping onto a POI tile behaves like normal floor. POI interactions occur via **explicit click** (3D viewport pick) or **dragging an item onto the POI**.

### Rationale
POIs can spawn in narrow passages. Treating them as walk-in triggers caused accidental hard blocks where the player could not traverse a corridor without stopping to interact.

### Consequences
- Players can occupy the same grid cell as a POI marker.
- Any tutorial/tooltips (if added later) should not imply walk-in interaction for POIs.
- Door behavior is unchanged: doors still use “walk into” semantics to attempt open.

---

## ADR-0137 — Meta progression: Exit POI + new floor seed per floor
Date: 2026-04-08

### Decision
- Add an **Exit** POI that advances to the next floor when clicked/used.
- On descend, increment `floorIndex`, cycle `floorType` (Dungeon→Cave→Ruins), and generate a **new random `floor.seed`** for the next floor.
- Allow `floor.gen.theme.id` to influence the renderer via **render-only multipliers** (fog/torch/emissive), applied multiplicatively on top of debug tuning.

### Rationale
An explicit Exit POI makes progression legible and consistent with the “click what you see” interaction model. New seeds per floor maximize variety for short runs while keeping generation deterministic *within* a floor. Theme multipliers make floors feel distinct without turning themes into hard overrides that fight F2 tuning.

### Consequences
- Procgen places an Exit POI at/near `gen.exit`.
- `poi/use` on Exit triggers the same generation path as regen, but updates `floorIndex`/`floorType` and replaces `floor.seed`.
- Theme influence is renderer-only: it should not mutate saved debug tuning or game state.

---

## ADR-0138 — Frosch idle overlay hides both eyes
Date: 2026-04-08

### Decision
When the portrait **idle overlay** is visible for **Frosch**, hide **both** of its eye sprites (`frosh_eye_L.png` and `frosh_eye_R.png`) for the duration of the idle overlay.

Inspect hover (`frosh_eye_inspect.png`) still overrides and remains visible when active.

### Rationale
Frosch’s idle overlay is authored as a full-face expression layer; leaving the independent eye sprites visible on top created an unintended “double eyes” / muddier read during idle flashes.

### Consequences
- During idle flashes/pulses, Frosch eyes are not visible unless inspect hover is active.
- Other species’ portraits are unchanged.

---

## ADR-0139 — Add floor debug progression + property toggles
Date: 2026-04-08

### Decision
- Extend the F2 Debug panel with explicit **floor progression controls**: a **Descend (debug)** button and a **set `floorIndex`** control (apply and apply+regen).
- Add F2 Debug **floor property toggles** (`Infested`, `Cursed`, `Destroyed`, `Overgrown`) that update `floor.floorProperties` and take effect on Regen/Descend.

### Rationale
Procgen iteration often needs quickly jumping to different floor indices and forcing different floor property combinations without having to “naturally” play to the desired state. Making these controls first-class reduces friction when tuning tagging, theme, and population behavior across the floor taxonomy.

### Consequences
- Debug-only actions can put the runtime floor state in configurations that do not match natural progression, but the effects remain gated behind Regen/Descend (no silent mid-floor mutation).
- `GameState.floor.floorIndex` and `GameState.floor.floorProperties` can be adjusted via debug actions without touching file-based debug tuning (`web/public/debug-settings.json` remains render/audio only).

---

## ADR-0140 — Cursor click micro-shake (debug-tunable)
Date: 2026-04-08

### Decision
Add a **tiny cosmetic shake** to the custom hand cursor on **pointer down**, with parameters exposed in the **F2 Debug** panel under **Cursor** (enable, amplitude, Hz, hold, decay).

### Rationale
The project’s interaction model is cursor-first; a subtle click micro-feedback makes the cursor feel more tactile without implying that an interaction succeeded (success/failure still uses SFX + activity log + gameplay-driven shake).

### Consequences
- Cursor feel can be tuned quickly during iteration via debug sliders and persisted in `web/public/debug-settings.json` (render tuning).
- The shake should remain subtle by default to avoid visual noise during frequent clicking/dragging.

---

## ADR-0141 — Enforce one POI per cell (deterministic dedupe)
Date: 2026-04-08

### Decision
- Enforce the invariant: **at most one POI per grid cell**.
- If procgen yields multiple POIs in the same cell, resolve deterministically:
  - **Canonical POI IDs win** (`poi_exit`, `poi_well`, `poi_bed`, `poi_chest`, `poi_barrel`, `poi_crate`).
  - Otherwise, keep the POI with higher gameplay priority: `Exit > Well > Bed > Chest > Barrel > Crate > Shrine > CrackedWall`.
  - Remaining ties break by stable `id` ordering.

### Rationale
As the POI set grows (more kinds and more placement passes), cell collisions become an easy failure mode that creates ambiguous interactions and can break deterministic placement assumptions. Dedupe keeps runs stable and ensures click/drag targets remain unambiguous.

### Consequences
- Some POIs may be dropped if they collide with a higher-priority POI.
- Procgen’s `occupied` set and downstream systems (NPC/item placement, mission graph, rendering/picking) operate on a position-unique POI list.
- In DEV builds we surface collisions via a warning so conflicts are noticed during iteration.

---

## ADR-0142 — Portrait vitals: **2×2** cells, bars only (no emoji)
Date: 2026-04-08

### Decision
Remove **emoji** from **`PortraitPanel`** vital tiles: each **`.statCell`** contains only **`.statBarTrack`** / **`.statBarFill`**; slot order remains **hp → sta → hun → thr** in the **`2×2`** **`.vitalGrid`**. Drop **`.statIcon`** and the **`icon`** field from vital definitions (**`PORTRAIT_VITAL_CELL_KEYS`** tuple).

### Rationale
Player request: keep only colored bars; **HP/STA/HUN/THR** read by **grid position** and **fill color**.

### Consequences
Less immediate affordance for new players; **`DESIGN.md`** §7.1 updated.

---

## ADR-0143 — Portrait vital bar palette (authoritative hex)
Date: 2026-04-08

### Decision
Set **`PortraitPanel`** **`VITAL_BAR_FILL`** to player-specified hexes: **HP** **`#ff2400`**, **STA** **`#d6bdb5`**, **HUN** **`#564c26`**, **THR** **`#324363`**.

### Rationale
Player request: replace generic red/white/green/blue fills with this palette.

### Consequences
**`DESIGN.md`** §7.1 lists the same literals; stamina read on a **black** track uses a muted warm tone for contrast vs pure white.

---

## ADR-0144 — Portrait thirst bar: **`#3d75dd`**
Date: 2026-04-08

### Decision
Set **`VITAL_BAR_FILL.thr`** to **`#3d75dd`** (was **`#324363`**).

### Rationale
Player request: brighter thirst read on the portrait HUD.

### Consequences
**`DESIGN.md`** §7.1 updated.

---

## ADR-0145 — Portrait hunger bar: **`#547d39`**
Date: 2026-04-08

### Decision
Set **`VITAL_BAR_FILL.hun`** to **`#547d39`** (was **`#564c26`**).

### Rationale
Player request: greener hunger read on the portrait HUD.

### Consequences
**`DESIGN.md`** §7.1 updated.

---
## ADR-0146 — Compositor-time portrait mouth/idle overlays (snappy reactions)
Date: 2026-04-08

### Decision
Render portrait **mouth flicker** (`ui.portraitMouth`) and **idle pulse** (`ui.portraitIdlePulse`) as **compositor-time overlays** in the WebGL presenter, instead of relying on async HUD capture (`html2canvas`) cadence.

### Rationale
The main HUD is captured to a texture for postprocess, which can add perceptible latency for short-lived portrait reactions. Rendering these two reactions directly in the compositor keeps them **immediate** and **full-FPS** while preserving the existing captured-HUD pipeline.

### Consequences
- Portrait mouth/idle reactions remain visually responsive even if the UI capture texture is stale or capturing infrequently.
- `feedCharacter` no longer needs a long minimum mouth burst window to “wait for capture to land”; burst duration can match authored/tuned timing more closely.

---

## ADR-0147 — Procgen: add Dungeon door-frame throats, prefer locks on frames, and derive connector/macro rooms
Date: 2026-04-08

### Decision
- **Dungeon** floors add a guarded **door-frame throat** pass that narrows a small number of straight corridor segments into 1-tile chokepoints (visual “doorways” between spaces).
- The procgen **lock placement** pass prefers these door-frame cells when selecting separating `lockedDoor` locations on the entrance→exit shortest path.
- Procgen derives a bounded set of **junction/connector rooms** (treated as `Passage`) so corridor junction spaces become semantic anchors for districts/tags/spawns.
- **Ruins** stamped chambers are deterministically **clustered into macro rooms** (bounded count) for more coherent tagging/districts/population.

### Rationale
Locks and progression gates read more naturally when they live on explicit chokepoints rather than arbitrary corridor tiles. Derived connector rooms and macro clustering improve tag coherence and spawn bias stability without changing core geometry representation or determinism requirements.

### Consequences
- Deterministic `floor.gen` output changes for the same seed (new topology and room lists); validation and scoring still operate on the same principles.
- Derived rooms are fixed to `Passage` and should be treated as ineligible for major POIs like Bed/Chest to keep placement semantics clear.

---

## ADR-0148 — Cursor craft-ready telegraph + discovered recipe icons
Date: 2026-04-08

### Decision
- Add a **craft-ready cursor telegraph** when dragging an inventory item over another inventory item that has a valid recipe:
  - affordance pill shows **⚗ Craft**
  - hand cursor flickers between **hold** and **point**
  - a small badge shows `?` until the recipe is discovered, then shows the result icon
- Track discovered recipes in game state and mark a recipe as discovered on **successful craft completion**.

### Rationale
Crafting is an experiment-driven loop; the cursor needs to clearly signal when releasing will craft (vs stow/swap) and provide a lightweight “unknown vs known result” preview without adding modal UI or extra clicks.

### Consequences
- `ui` state stores a set of discovered recipe keys.
- Cursor UI can render `?` vs result icon based on discovery state.

---

## ADR-0149 — Crafting: move toward a broader recipe pack in content
Date: 2026-04-08

### Decision
- Expand crafting from the MVP set to a **broader recipe pack** (weapons/tools, remedies, cooking) authored in **content** (`web/src/game/content/recipes.ts`).
- Ensure each recipe includes an explicit **skill** and **DC** (d20 + party-best skill vs DC) and retains **order-sensitive** inputs (`a+b` distinct from `b+a`).
- Expand the default item set in the content DB to include the new recipe inputs/outputs (with icons, tags, and any minimal interaction hooks needed to make them usable).

### Rationale
Crafting is intended to be discovery-driven; with only a few recipes the loop quickly runs out of experimentation value. Keeping recipes in the content layer preserves modularity, and explicit skill/DC parameters let balancing iterate without code changes.

### Consequences
- The initial content pack increases the number of `ItemDef`s and `ALL_RECIPES` entries and should be kept consistent (every recipe input/output must exist in the content DB).
- Future balancing work can tune `craftMs`, failure destroy chance, and skill/DC values without touching crafting state logic.

---

## ADR-0150 — Hive/Swarm ecosystem (Hive item, Swarm NPC, capture/release loop)
Date: 2026-04-08

### Decision
- Implement the **Hive/Swarm** ecosystem described in `Elfenstein_notes.md`:
  - **Hive** is an **item**; drag-drop onto the 3D view “cracks” it.
  - Cracking a Hive usually destroys it and spawns a **Swarm**; a small chance yields a **Swarm Queen** item.
  - While the party holds **Swarm Queen**, **Swarms are neutral**.
  - **Swarm Basket** captures a Swarm into a **Captured swarm** item.
  - **Captured swarm** can be released onto an enemy NPC to deal heavy damage and is consumed.
- Keep outcomes deterministic via stable hashing from `floor.seed` + ids/timestamps, consistent with multiplayer-sane direction.

### Rationale
This creates a self-contained, discovery-friendly “content ecosystem”: a source (Hive), a faction modifier (Queen), and a manipulation loop (capture/release) that yields meaningful combat utility without requiring new UI surfaces.

### Consequences
- Adds a new `NpcKind` (`Swarm`) and several new `ItemDef`s; placeholder art is acceptable until dedicated sprites ship.
- Procgen can bias Swarms on **Infested** floors to reinforce floor property identity.

---

## ADR-0151 — Death screen + Well checkpoints
Date: 2026-04-08

### Decision
- Replace immediate auto-restart on party wipe with a blocking **death screen** (`ui.death`) that offers:
  - **New run**
  - **Reload checkpoint** (if saved)
  - **Title**
- Treat **Wells** as explicit checkpoint saves by snapshotting run/floor/party/view plus persistent UI bits into `run.checkpoint`.

### Rationale
Instantly wiping to a new run makes death feel abrupt and prevents “run recap” UX. Wells already serve as a natural safe interactable, so promoting them to save points creates a clear, learnable retry loop without adding a full save/load system.

### Consequences
- The reducer must block gameplay actions while `ui.death` is present (and while on the title screen).
- Reloading restores a snapshot but preserves tuning (`render`, `audio`) for consistent session feel.

---

## ADR-0152 — Telegraph room properties with compositor vignette+tint
Date: 2026-04-08

### Decision
When the player is standing in a procgen room tagged with a **room property** (`Burning` / `Flooded` / `Infected`), apply a **subtle vignette + tint** as a **compositor-time post-process** over the **3D scene region only**.

### Rationale
Room properties should be readable as a *felt environmental condition* without introducing new HUD elements or requiring per-tile materials. A compositor effect is cheap, consistent across floor types, and stays scoped to the viewport’s 3D content.

### Consequences
- Adds telegraph uniforms and logic to the WebGL compositor (`CompositeShader`) and wires values from `DitheredFrameRoot` via `FramePresenter`.
- The mapping is keyed by the room tag under `floor.playerPos` (fallback to nearest-room-center when not inside a room rect), so derived connector rooms still get a stable telegraph signal.
- Debug tooling can force a telegraph mode/strength for tuning without changing procgen.

---

## ADR-0153 — Inventory drag starts on movement threshold (crafting reliability)
Date: 2026-04-08

### Decision
Start item drags when the pointer **presses and moves** beyond a small pixel threshold (with **press+hold** remaining as a fallback) so quick click-drags reliably dispatch `drag/drop` and trigger crafting/swaps.

### Rationale
Hold-only drag start can miss fast click-drag gestures, resulting in no drop dispatch and making crafting appear “broken”. A movement threshold is the standard desktop interaction pattern and avoids accidental drags on simple clicks.

### Consequences
- Cursor drag state transitions now start either via movement threshold or the existing hold timer.
- `DESIGN.md` §6.2 reflects the updated gesture truth (drag starts on movement; hold is fallback).

---

## ADR-0154 — Add Afonso as a party species (portrait art hookup)
Date: 2026-04-08

### Decision
Add a new playable party **species** `Afonso` and hook it into the existing portrait pipeline (DOM portrait stack + capture-mode compositor overlays), served via stable `/content/...` URLs.

### Rationale
We have a complete Afonso portrait art set (base/eyes/inspect/mouth/idle). Wiring it as a first-class species expands the roster while keeping the existing layered-portrait UX and rendering architecture unchanged.

### Consequences
- `Species` union expands; any code that switches on species must handle `Afonso`.
- The Afonso PNGs must be mirrored to `web/public/content/` so `/content/Afonso_*.png` loads reliably at runtime.

---

## ADR-0155 — Activity log lines expire after 10 seconds
Date: 2026-04-08

### Decision
**`ui.activityLog`** entries are **removed** when **`state.nowMs - entry.atMs` ≥ `ACTIVITY_LOG_ENTRY_TTL_MS` (10s)** during **`time/tick`**. While **`ui.death`** is set, **pruning is skipped** so the death screen recap does not drain. **Checkpoint restore** **refreshes** each restored line’s **`atMs`** to **`state.nowMs`** so lines saved long ago are not all cleared on the first tick.

### Rationale
A short TTL keeps the viewport corner readable without a permanent backlog; tying expiry to **`time/tick`** matches existing simulation time. Death and checkpoint cases need explicit handling so UX stays coherent.

### Consequences
**`DESIGN.md`** activity-log bullet documents TTL, cap, and death pause; **`activityLog.ts`** exports **`ACTIVITY_LOG_ENTRY_TTL_MS`** and **`pruneExpiredActivityLog`**.

---

## ADR-0156 — Anchor NPC dialog to the game viewport top
Date: 2026-04-08

### Decision
**`NpcDialogModal`** receives **`gameViewportRef`** from **`DitheredFrameRoot`**, measures **`getBoundingClientRect()`** on that element while the dialog is open, and positions the modal with **`position: fixed`** at the **top of the 3D viewport** (centered horizontally, width clamped). **`ResizeObserver`** plus window **resize** and **scroll** (capture) keep the box aligned.

### Rationale
The previous layout used a **percentage of the full modal backdrop**, which did not track the **HUD center game cell**; anchoring to the same DOM node used for viewport picking keeps the dialog visually tied to the 3D play area.

### Consequences
- Fallback CSS remains for cases without a ref or before measure (e.g. tests).
- **`DESIGN.md`** §7.5 documents viewport anchoring.

---

## ADR-0157 — NPC dialog: scaled upward offset + square panel
Date: 2026-04-08

### Decision
**`NpcDialogModal`** vertical position subtracts **`viewportHeight * (100 / STAGE_CSS_HEIGHT)`** from the previous top anchor (plus small inset), so the shift matches **100 CSS px** when the game viewport height equals **1080**. The **fallback** (no measure) uses **`top: calc(18% - 9.259vh)`**. The main modal **panel** uses **`border-radius: 0`** (square corners); **Close** kept its own radius at the time (**Pet** was later removed—**ADR-0189**).

### Rationale
Keeps the dialog **horizontally centered** on the game viewport while nudging it **up** in a resolution-aware way. Square outer chrome matches the requested look for the popup background.

### Consequences
- **`DESIGN.md`** §7.5 documents the offset rule and square panel.

---

## ADR-0158 — Portal NPC dialog to `document.body` (fixed + scaled stage)
Date: 2026-04-08

### Decision
**`NpcDialogModal`** renders its backdrop + panel with **`createPortal(..., document.body)`** in the browser (falls back to inline tree if **`document.body`** is missing, e.g. some tests).

### Rationale
**`FixedStageViewport`** applies **`transform: scale`** on **`.stage`**. Descendants with **`position: fixed`** then use that transformed element as their **containing block**, so **`left`/`top`** in **viewport** pixels from **`getBoundingClientRect()`** do not match layout—the panel’s **left edge** could sit on the visual **center** of the game viewport instead of the box being centered.

### Consequences
- **`DESIGN.md`** §11 frame-presentation bullet distinguishes **Paperdoll** (stays in **`stageModalLayer`**) vs **NPC dialog** (portaled).

---

## ADR-0159 — NPC dialog: +30px-down nudge scaled like upward offset
Date: 2026-04-08

### Decision
After the existing **`100 / STAGE_CSS_HEIGHT`** upward shift, **`NpcDialogModal`** adds **`viewportHeight * (30 / STAGE_CSS_HEIGHT)`** to **`top`** (and the no-measure fallback uses **`+ 2.778vh`** alongside **`− 9.259vh`**).

### Rationale
Keeps the **~30 CSS px** move **resolution-aware**, matching the **100px** rule’s scaling.

### Consequences
**`DESIGN.md`** §7.5 documents both offsets.

---

## ADR-0160 — Trigger portrait idle pulse on press (no paperdoll)
Date: 2026-04-08

### Decision
Trigger the portrait idle overlay pulse (`ui.portraitIdlePulse`) on **portrait frame press** (`pointerdown`), and **do not** open a paperdoll from portrait clicks.

### Rationale
Release-based (`pointerup`) portrait activation adds perceptible latency and can be delayed or lost during drag interactions. Press-triggered pulses match the compositor-time responsiveness of other portrait interactions.

### Consequences
- Portrait idle visuals appear immediately on press.
- If the press becomes a drag or exceeds movement slop, the pulse is cancelled (`ui/portraitIdleCancel`) to avoid a stuck overlay.

---

## ADR-0161 — Sync portrait idle press across compositor + captured HUD
Date: 2026-04-08

### Decision
Derive a shared **pressed portrait character** signal from cursor pointer state and use it consistently to:
- Drive compositor-time portrait idle overlays immediately on press.
- Hide portrait eye layers immediately on press (so eyes can’t lag under the idle overlay).
- Mark the capture HUD dirty via the capture `hudKey` so `html2canvas` refreshes promptly during the press interaction.

### Rationale
Portrait idle is rendered in two places (captured HUD + compositor overlays). If the compositor reacts to press immediately but the captured HUD doesn’t, layered portrait elements (notably eyes) can appear to “disappear late.” A single pressed-portrait signal keeps the two paths visually consistent while preserving instant feedback.

### Consequences
- Adds a shared helper to compute `pressedPortraitCharacterId` from cursor state.
- Capture HUD scheduling treats portrait press as an interaction burst (ASAP capture) and includes a `press=` key component so the capture texture updates on press transitions.

---

## ADR-0162 — Make hazard rooms apply a strong color telegraph
Date: 2026-04-08

### Decision
When standing in a room tagged with a hazard room property (`Burning` / `Flooded` / `Infected`), apply a **strong, full-viewport color theme** over the 3D viewport region (compositor tint), instead of a subtle vignette-only cue.

### Rationale
Hazard “grids” need to be readable instantly while moving; a subtle tint is easy to miss under dither, dark lighting, and capture/postprocess.

### Consequences
- The compositor telegraph defaults to higher strength and more saturated multipliers per hazard type.
- Debug telegraph override continues to work (force mode + strength) for tuning.

---

## ADR-0163 — Hazard telegraph is multiply tint only (no opaque colorize)
Date: 2026-04-08

### Decision
Room-property hazard feedback in the compositor must use **RGB multiply** (`scene * tint`, blended by telegraph strength + vignette), not **blend toward a solid target color**, so the effect reads as **color grading** that overrides the floor theme without washing the scene flat.

### Rationale
Blending toward a fixed RGB reads as an **opaque overlay** and hides detail; multiply preserves luminance relationships while still allowing strong per-channel bias to dominate the main theme.

### Consequences
- `CompositeShader` drops the separate “override/colorize” telegraph path; `telegraphColor` is always a multiplier (clamped for safety).

---

## ADR-0164 — Fix hazard telegraph flicker (room lookup + uniform tint)
Date: 2026-04-08

### Decision
- Resolve `roomProperties` for telegraph using the **same containment rule** as gameplay hazards (`roomForCell`): **first room whose rect contains the player cell**, otherwise **no** room (no nearest-room fallback).
- For hazard telegraph, apply tint at **uniform strength across the 3D viewport** (compositor: `telegraphVignette.x < 0` disables radial weighting). Radial vignette previously went to **zero at corners** (outer clamped to 1), which read as the effect “disappearing.”
- Treat debug **telegraph strength** override as “missing” only when `undefined`/`null` (not when `0`).
- Keep the presenter **RAF** loop rendering while `roomPropertyUnderPlayer` is non-null so telegraph stays painted even if React effect scheduling glitches.

### Rationale
Nearest-room fallback could attribute the wrong room in corridors; radial vignette made tint invisible at viewport edges; `??` on strength mishandled explicit `0`; continuous RAF avoids a one-frame-only cue.

### Consequences
- `roomTelemetry` exports `roomContainingPlayer` and drops nearest-room fallback for `roomPropertyUnderPlayer`.

---

## ADR-0165 — Hazard telegraph: luma tint override, no vignette
Date: 2026-04-08

### Decision
Hazard room feedback uses compositor **`telegraphTintMode = 1`**: blend the 3D scene toward **`tintRgb * f(luma)`** (Rec.709 luma from the source pixel), with **no radial vignette** and **no multiply-only grade** (multiply remains available as mode `0` for debug/legacy).

### Rationale
Multiply grading stayed too subtle on dark or strongly themed scenes; solid RGB blends read as opaque overlays. Luma-scaled tint preserves readability and reads as a deliberate **color cast override**.

### Consequences
- `CompositeShader` drops `telegraphVignette`; adds `telegraphTintMode`.

---

## ADR-0166 — Burning hazard telegraph: ember vs ruins_umber
Date: 2026-04-08

### Decision
Shift **`Burning`** compositor tint toward **ember/amber** (higher green, yellower) so it does not read like **`ruins_umber`** floor theme intent (`#ff2f00` red-orange).

### Rationale
Players could not distinguish hazard rooms from umber-themed floors when both skewed to the same red-orange family.

### Consequences
- `DitheredFrameRoot` hazard RGB for `Burning` is tuned yellower; `DESIGN.md` notes the separation intent.
- **Superseded** for separation strategy and `Burning` hue by **ADR-0167** (brown `ruins_umber` + red `Burning` + pulse).

---

## ADR-0167 — Hazard telegraph pulse; Burning red; ruins_umber brown
Date: 2026-04-08

### Decision
- Modulate hazard telegraph with a **slow sine pulse** while `Burning` / `Flooded` / `Infected` is active (implementation: see **ADR-0168** — scale graded tint, not blend weight).
- Restore **`Burning`** hazard tint to a **red** read (high R, low G/B).
- Retune **`ruins_umber`** **light intent** to **brown umber** (`#9a6240` class) with slightly relaxed mix/torch/lantern multipliers so it no longer matches hazard fire.

### Rationale
Umber floors should read as **earth pigment**, not **flame**; pulsing makes hazards noticeable and “breathing” without matching camera shake cadence.

### Consequences
- `themeTuning.ts` `ruins_umber` preset changes; `DitheredFrameRoot` telegraph math gains pulse factor.
- **Pulse mechanics** revised in **ADR-0168** (scale graded tint, not `telegraphStrength`).

---

## ADR-0168 — Hazard pulse: single-hue (scale graded tint, not blend weight)
Date: 2026-04-08

### Decision
Replace pulsing **`telegraphStrength`** with a new compositor uniform **`telegraphTintPulse`** that **only scales** the luma-matched graded tint (`tc * L * pulse`). **`telegraphStrength`** stays fixed per hazard.

### Rationale
Varying blend weight mixes more/less with the underlying scene, which shifts **perceived hue** across unrelated colors. Scaling along a fixed `telegraphColor` vector preserves chromaticity.

### Consequences
- `CompositeShader` adds `telegraphTintPulse`; `FramePresenter` / `DitheredFrameRoot` pass it for tint mode hazards.

---

## ADR-0181 — NPC dialog in HUD capture + invisible hit layer (dither parity)
Date: 2026-04-08

### Decision
Render **`NpcDialogModal`** in the **offscreen `html2canvas`** subtree (capture variant) so the popup is part of the **UI texture** and receives **ordered dither**. Keep a **second** interactive instance **portaled** to **`document.body`** with **`opacity: 0`** for **pointer hit-testing** and drag/drop, matching the **HUD** split (visible bitmap from capture + invisible interactive layer).

### Rationale
DOM modals above the presenter stayed **undithered**; players saw a clean vector UI on a dithered game+Hud.

### Consequences
- `html2canvas` targets the **`data-capture-root`** wrapper that includes **`HudLayout`** plus capture **`NpcDialogModal`**.
- Capture **`HudLayout`** receives **`gameViewportRef`** so the NPC panel can anchor to the capture **game** cell.
- **`ADR-0087`** remains true for **Paperdoll**; NPC is the exception documented in **`DESIGN.md`**.

---

## ADR-0182 — NPC dialog: stage width + no full-screen dimmer
Date: 2026-04-08

### Decision
NPC dialog **panel width** follows **`min(620px, var(--stage-w) − 24px)`** (CSS), centered on the **game viewport**; do **not** clamp width to the game cell. Remove the **full-bleed semi-transparent backdrop** so the HUD and 3D region stay undimmed; keep an invisible full-screen hit layer for outside-click close and drag routing.

### Rationale
Measuring width from the game cell had shrunk the panel vs the long-standing stage-based cap; the dim layer read as washing out the whole framed game/HUD behind the popup.

### Consequences
- **`NpcDialogModal`**: inline layout sets **position** (viewport center + **`translate(-50%, -50%)`**), not **width**.
- **`.backdrop`**: no dimming fill; panel chrome unchanged.

---

## ADR-0183 — NPC dialog centered in game viewport
Date: 2026-04-08

### Decision
Position the NPC dialog panel at the **2D center** of the **`GameViewport`** rect (interactive: **`fixed`** + **`translate(-50%, -50%)`**; capture: **absolute** in capture HUD space with the same math). Remove the prior **top-of-viewport** offsets (**`100 / STAGE_CSS_HEIGHT`**, **`30 / STAGE_CSS_HEIGHT`**, and the **`18%` / `vh` CSS fallback**).

### Rationale
The popup should read as **centered over the 3D view**, not hugging the top band.

### Consequences
- **`NpcDialogModal.module.css`**: no-measure fallback is **`left/top: 50%`** with **`translate(-50%, -50%)`**.
- Older ADR bullets that describe **top-anchored** NPC placement are **superseded** for layout (behavior in **`DESIGN.md`** is authoritative).

---

## ADR-0184 — Capture HUD: game cell shell for `gameViewportRef`
Date: 2026-04-08

### Decision
When **`captureForPostprocess`**, render an **empty absolutely positioned shell** in the **game** panel (same **`inset: 0`** fill as **`GameViewport`’s** root) and attach **`gameViewportRef`** to it instead of mounting **`GameViewport`**.

### Rationale
Capture HUD intentionally omits **`GameViewport`**, so **`captureGameViewportRef`** never pointed at a node; **`NpcDialogModal`** capture variant had **`viewportRect === null`**, **`modalCapture`** had no **`left`/`top`/`transform`**, and the dithered dialog stuck to the **top-left**.

### Consequences
- **`HudLayout`**: conditional **`gameViewportCaptureShell`**; **`DESIGN.md`** notes the capture behavior.

---

## ADR-0185 — NPC dialog capture: mount inside game cell (flex center)
Date: 2026-04-08

### Decision
Render the capture (**`html2canvas`**) **`NpcDialogModal`** **inside** the capture **`HudLayout`** **game** panel via **`captureNpcOverlay`** and a **`npcCaptureLayer`** (**`position: absolute; inset: 0; display: flex`**, top + horizontal center — see **ADR-0186**). Remove capture-only **`getBoundingClientRect`** / **`captureHudRootRef`** positioning and the prior sibling-of-**`HudLayout`** mount.

### Rationale
Offscreen capture coordinates and **`html2canvas`** cloning remained unreliable; **`viewportRect`** could stay empty or wrong so the panel rendered at **(0,0)** in the bitmap (top-left of the frame). Flex layout inside the **same DOM box** as the 3D viewport cell matches the intended **game-widget-aligned** layout without fragile global rect math.

### Consequences
- **`HudLayout`** gains **`captureNpcOverlay`**; **`DitheredFrameRoot`** passes the capture **`NpcDialogModal`** there instead of beside **`HudLayout`**.
- **`NpcDialogModal`**: capture variant is a small wrapper + **`modalCapture`** only; **`backdropCapture`** unused/removed.

---

## ADR-0186 — NPC dialog: top of game viewport (horizontal center)
Date: 2026-04-08

### Decision
Place the NPC dialog at the **top** of the **3D game viewport** with **10 CSS px** inset: interactive uses **`top: rect.top + 10`** and **`translateX(-50%)`**; capture uses **`npcCaptureLayer`** with **`align-items: flex-start`**, **`padding-top: 10px`**, and **`justify-content: center`**. No-measure CSS fallback: **`top: 10%`** with **`translateX(-50%)`**.

### Rationale
Vertical centering was correct mechanically but the panel reads better **anchored under the top** of the dungeon view while staying **horizontally centered**.

### Consequences
- **`ADR-0183`** (full viewport center) is **superseded** for vertical placement; **`DESIGN.md`** is authoritative.

---

## ADR-0187 — CursorLayer: no pointer capture on descendants
Date: 2026-04-08

### Decision
Set **`pointer-events: none`** on **all** **`CursorLayer`** descendants (CSS **`.layer *`**) so the hand sprite and overlays never become the **topmost hit target** under the cursor.

### Rationale
The layer root already had **`pointer-events: none`**, but children defaulted to **`auto`**, so the **~56×56 hand** at **`(clientX, clientY)`** sat above modals with lower **`z-index`** (e.g. NPC dialog at **2200**) and **ate clicks**—**Close** and similar controls never received **`click`**.

### Consequences
- **`CursorLayer.module.css`**: **`.layer * { pointer-events: none }`**; cursor remains visual-only for hit-testing.

---

## ADR-0188 — NPC dialog hit layer above `CursorLayer`
Date: 2026-04-08

### Decision
Raise **`NpcDialogModal`** **`.backdrop`** from **`z-index: 2200`** to **`10100`** (above **`CursorLayer`’s** **`9999`**).

### Rationale
**`pointer-events: none`** on cursor descendants should prevent hit stealing, but any future child override or engine quirk could regress **Close**. Stacking the **invisible** NPC portal **above** the cursor layer makes hits **unambiguous**; **`opacity: 0`** keeps the overlay visually transparent so the hand still reads correctly through compositing.

### Consequences
- **`NpcDialogModal`**: **`.backdrop`** **`z-index: 10100`**.

---

## ADR-0189 — Remove Pet control from NPC dialog
Date: 2026-04-08

### Decision
Remove the **Pet** button and footer from **`NpcDialogModal`**. Keep the **`npc/pet`** reducer case for now (no UI dispatch from the modal).

### Rationale
Scope reduction for the dialog chrome; petting is not required as a first-class modal action.

### Consequences
- **`NpcDialogModal.module.css`**: drop **`.footer`** / **`.pet`**.
- **`DESIGN.md`** §7.5: dialog no longer exposes **Pet**; **`ADR-0133`** historical note about dialog **Pet** is obsolete for current UI.

---

## ADR-0190 — NPC dialog: no title portrait sprite
Date: 2026-04-08

### Decision
Remove the **base NPC sprite** (`<img>` / **`NPC_SPRITE_SRC`**) beside the dialog title; header is **text-only** (**`{name} · {status}`**).

### Rationale
Simpler chrome; iconography is redundant with the **3D billboard** and busy at large title sizes.

### Consequences
- **`NpcDialogModal.tsx`**: no **`npcDefs`** sprite import for the modal.
- **`NpcDialogModal.module.css`**: remove **`.portrait`**; **`DESIGN.md`** §7.5 updated.

---

## ADR-0191 — Procgen content audit + allowlist for non-spawn items
Date: 2026-04-08

### Decision
- Add a **repeatable audit** (`npm run audit:procgen-content` in `web/`) that compares **`DEFAULT_ITEMS`** to the union of **procgen floor spawns** (`PROCgen_FLOOR_SPAWN_TABLE_ITEM_DEF_IDS` + lock keys), **POI chest/barrel/crate loot** (`poiLootTables.ts`), and **NPC quest** item refs (`population.ts`). Exit **non-zero** on gaps or orphan ids.
- Maintain **`ITEM_DEF_IDS_INTENTIONALLY_NON_PROCGEN`** for craft-only, transform-only, and quest items so the report stays actionable.
- Document coverage policy in **`DESIGN.md` §13.2**.

### Rationale
Seeded content had drifted from what generation and POI loot actually used; without an automated check, new item defs could be added but never appear in runs.

### Consequences
- Adding an item requires either updating spawn/loot/quest tables or the allowlist.
- Wider **NPC default pools** and **floor spawn** variety live in `spawnTables.ts`; **POI loot** tables are shared data in `poiLootTables.ts`.

---

## ADR-0192 — 3D floor items use the same icons as HUD inventory
Date: 2026-04-08

### Decision
Render **dropped / spawned floor items** in `WorldRenderer` using each item def’s **`ContentDB` `icon`** (emoji via canvas billboard text using the HUD-aligned sans + emoji font stack, or **`sprite` path** via `TextureLoader`), instead of a single shared placeholder glyph. Pass **`ContentDB`** into **`WorldRenderer.renderFrame`**. When **`floorGeomRevision`** rebuilds dungeon geometry, **dispose** shared box geometries, shared Lambert materials for that build, and **per-floor-item** sprite materials—**dispose `CanvasTexture` maps** for emoji icons; **do not** dispose **cached `TextureLoader`** maps shared across instances.

### Rationale
Players should recognize loot at a glance; the HUD already shows the authoritative icon per def.

### Consequences
- `DitheredFrameRoot` passes `latestContentRef.current` into `world.renderFrame`.
- `DESIGN.md` §7.2 notes parity between HUD and world floor-item billboards.

---

## ADR-0193 — Portrait hat + hands equipment drop zones
Date: 2026-04-08

### Decision
- Add **portrait UI hit bands** for **hat** (top) and **hands** (bottom); drops resolve through **`drag/drop`** with `PortraitDropTarget` **`hat`** / **`hands`**.
- Extend **`ItemDef.tags`** with **`hat`**, **`oneHand`**, and **`twoHand`**. Hat items use **`equipSlots`** including **`head`** when `equipSlots` is set.
- **Two-handed** items store the **same `itemId` in `handLeft` and `handRight`**; **`unequipItem`** on either hand clears both and stows **once**. **One-handed** portrait drops fill **left → right → replace left** when both hands are full.

### Rationale
Keeps equip discoverable on the portrait without enabling the full paperdoll modal; tags stay data-driven and match the prior “content in ContentDB” approach.

### Consequences
- `equipItem` takes **`ContentDB`** to branch **hand** slots on **`oneHand` / `twoHand`**.
- New sample content (**`WoolCap`**) and allowlist entry for procgen content audit; **Spear** / **Bow** are **`twoHand`** for testing.

---

## ADR-0194 — F2 debug: spawn floor item one cell ahead
Date: 2026-04-08

### Decision
Add **`debug/spawnItem`** (`ItemDefId`) next to existing **NPC** / **POI** spawn in the F2 panel: mints the item in **`party.items`**, places it on **`itemsOnFloor`** one grid cell in the facing direction, with normal drop jitter, and bumps **`floorGeomRevision`**. If the target cell is not **`floor`**, append an activity-log line instead of spawning.

### Rationale
Content authors need the same quick placement loop for items as for NPCs and POIs when testing interactions, loot, and equipment.

### Consequences
- `DESIGN.md` §3 notes the item spawn row and the floor-tile constraint.

---

## ADR-0195 — Portrait unequip via drag (inventory, floor, void)
Date: 2026-04-08

### Decision
- **Portrait** equipped **hat** / **hands** icons are **draggable** (`equipmentSlot` source with optional **`fromPortrait`**). They sit above the transparent hat/hands drop bands and carry the same **`portrait`** drop metadata so incoming equips still work.
- **`drag/drop`** resolves **`equipmentSlot` → `inventorySlot`** and **→ `floorDrop`** by **clearing equipment** before moving the item (fixes equipped items not living in the grid).
- **`stowEquipped`** target: pointer-up with **no DOM drop target** after a **portrait** equipment drag calls **`unequipItem`** (first free slot), without applying that shortcut to paperdoll drags.
- **`moveItemToInventorySlot`** places items **not currently in the grid** into a slot by **displacing** an occupant to the first free slot when needed.

### Rationale
Unequip should match the “drag out of the portrait” mental model; equipment and inventory must stay consistent when moving items that are only equipped.

### Consequences
- `PortraitPanel`, `CursorProvider`, `types` (`DragSource` / `DragTarget`), `equipment.ts` helpers, `inventory.ts`, and `reducer` `drag/drop` updated accordingly.

---

## ADR-0196 — Portrait equip drag hit: transparent button chrome
Date: 2026-04-08

### Decision
Define **`PortraitPanel.module.css`** classes **`equipDragHit`** / **`equipHandDragHit`** (and **`equipHatDraggable`** / **`equipHandsBandDraggable`** **`pointer-events`**) so draggable equipped icons use **`appearance: none`**, **`background: transparent`**, **`border`/`padding`/`margin: 0`**.

### Rationale
**`<button>`** default UA styling paints an **opaque** plate behind children; **`styles.equipDragHit`** was referenced in **`PortraitPanel.tsx`** but **missing** from the CSS module, so PNG item art **lost visible transparency**.

### Consequences
`DESIGN.md` portrait unequip bullet notes transparent hit chrome.

---

## ADR-0175 — Dungeon env tiles + Exit/Shrine POI art from Content
Date: 2026-04-09

### Decision
- **`getDungeonEnvTextureSrcs`**: **`FloorType` `Dungeon`** uses **`/content/dungeon_floor.png`**, **`/content/dungon_wall.png`**, **`/content/dungon_ceiling.png`** (filenames match **`Content/`** as shipped, including the **`dungon_*`** spelling). **`Cave`** keeps **`cave_*`**; **`Ruins`** keeps **`ruins_*`**.
- **`POI_SPRITE_SRC`**: **`Exit`** → **`stairs_down.png`**; **`Shrine`** → **`shrine_gnome.png`**. **`POI_OPENED_SPRITE_SRC.Shrine`** → **`shrine_gnome_off.png`**.
- **`applyPoiUse` (Shrine)**: set **`opened: true`** on the shrine POI and bump **`floorGeomRevision`** so **`WorldRenderer`** rebuilds and shows the off-frame after the first interaction.

### Rationale
New PNGs in **`Content/`** were unused; wiring them matches the existing env-texture and POI billboard patterns without adding a duplicate asset pipeline step (Vite already exposes repo **`Content/`** at **`/content/*`**).

### Consequences
- Shrine interactions always transition to the “off” sprite after the first use (including when the log line is “The shrine is silent.”).
- **`DESIGN.md`** §9 / §11 / §13.1 asset lists updated for the new paths.

---

## ADR-0176 — Headwear recipes, new hats, and procgen/POI drops
Date: 2026-04-08

### Decision
- Add **`HerbCirclet`** and **`SporeCap`** item defs (`hat` tag, `head` slot); recipes: **`ClothScrap` + `Twine` → WoolCap** (weaving), **`HerbLeaf` + `Twine` → HerbCirclet** (weaving), **`Mushrooms` + `ClothScrap` → SporeCap** (foraging).
- Extend **`CHEST_LOOT_DEF_IDS`** and **`CONTAINER_LOOT_DEF_IDS`** with all three ids; extend **`pickFloorItemDefFromTable`** with low-probability headwear nudges for **Passage**, **Communal**, and **Habitat** room functions; extend **`PROCgen_FLOOR_SPAWN_TABLE_ITEM_DEF_IDS`** accordingly.
- Remove **`WoolCap`** from **`ITEM_DEF_IDS_INTENTIONALLY_NON_PROCGEN`** now that it is covered by loot/spawn pipelines.

### Rationale
Head slot content was previously sample-only for **`WoolCap`** without a gameplay path; weaving/foraging recipes and dungeon drops make hats obtainable without debug spawn.

### Consequences
**`npm run audit:procgen-content`** must stay green; **`DESIGN.md`** §7.3 / §13.2 note headwear crafting and drops.

---

## ADR-0177 — Room-hazard floor decals in the 3D view
Date: 2026-04-09

### Decision
Render **sparse deterministic** ground decals for procgen **room properties** **`Burning` / `Flooded` / `Infected`**: billboard sprites **`hazard_fire.png`**, **`hazard_water.png`**, **`hazard_poison.png`** from repo **`Content/`** (served as **`/content/*`**), only on **`floor`** tiles inside the matching **`GenRoom.rect`**, skipping cells with a **POI**, **NPC**, or **floor item**. Hash-based ~**40%** cell coverage; materials cached in **`WorldRenderer`**; tint follows the lantern/theme sprite color like floor items.

### Rationale
Compositor hazard telegraph alone does not show *where* the hazard room is in the dungeon; sparse floor art reinforces room identity without carpeting every tile or obscuring interactables.

### Consequences
- **Renderer-only** (no new **`GameState`** fields); rebuilds with **`floorGeomRevision`**.
- **`DESIGN.md`** §11 documents the mapping and rules; implementation uses **`web/src/game/world/hazardDefs.ts`** and **`WorldRenderer.buildGeometry`**.

---

## ADR-0179 — Exit POI billboard at 2× scale
Date: 2026-04-09

### Decision
**`WorldRenderer.syncPoiSpriteScales`**: **`PoiKind.Exit`** applies a **2×** multiplier to the shared POI billboard height (and width via aspect), and uses the same multiplier in the bottom-pivot **Y** placement so **`stairs_down.png`** stays grounded.

### Rationale
The exit staircase should read clearly as the primary progression landmark at a glance.

### Consequences
Only **`Exit`** differs; other POIs unchanged. No new **`GameState`** fields.

---

## ADR-0178 — POI billboards: bottom pivot, foot lift slider, brighter default boost
Date: 2026-04-09

### Decision
- **`WorldRenderer`**: POI (and Well glow/sparkle) sprites set **`center`** to **`(0.5, 0)`** so the anchor is the **bottom** of the billboard; **Y** placement uses **`floorTop + poiFootLift − poiGroundY × height`** (height **0.55**), decoupled from **`npcFootLift`**.
- **`GameState.render`**: add **`poiFootLift`** (clamped like other foot offsets); raise default **`poiSpriteBoost`** to **1.5**; F2 **POI sprite boost** slider max **3.0** (matches reducer).
- **F2**: new slider **POI above ground** → **`poiFootLift`**.

### Rationale
Center-pivot POIs with **`npcFootLift`** were hard to tune independently from NPCs; a bottom pivot matches “sits on the floor” mentally. A dedicated lift avoids coupling; higher default boost improves POI visibility against the scene tint.

### Consequences
**`debug-settings.json`** may persist **`poiFootLift`**; old saves without it get **`clampRenderTuning`** defaults. **`DESIGN.md`** §9 documents bottom pivot + **`poiFootLift`**.

---

## ADR-0197 — Shared modal chrome (`GamePopup.module.css`)
Date: 2026-04-09

### Decision
Centralize **panel**, **typography**, **Close / footer action** button, optional **`backdropDim`**, and **`panelWidthMd`** in **`web/src/ui/shared/GamePopup.module.css`**, composed by **`NpcDialogModal`**, **`PaperdollModal`**, **`DeathModal`**, and **`TitleScreen`**. **`DeathModal`** / **`TitleScreen`** drop rounded, blurred “glass” panels in favor of the **inventory-aligned** **`2px`** warm border and **square** corners; **NPC** keeps capture/portal/hit-layer behavior local.

### Rationale
Modal styling had drifted (mono paperdoll title, thin white borders, rounded death/title panels); one module keeps HUD look consistent and matches **`DESIGN.md`** inventory slot border language.

### Consequences
New modal-like UI should prefer **`GamePopup`** classes; positioning, **z-index**, and NPC-only rules stay in feature CSS/TSX.

---

## ADR-0198 — F2 preview toggles for NPC dialog and death modals
Date: 2026-04-09

### Decision
Add **`UiState.debugShowNpcDialogPopup`** and **`UiState.debugShowDeathPopup`**, driven from the **F2** **UI** section. **NPC**: when set (and no real `npcDialogFor`), show the dialog for the **first NPC** on the floor. **Death**: show the death modal using **current run** stats **without** setting **`ui.death`** (no gameplay lock). **`DitheredFrameRoot`** mounts the **stage modal layer** during **game** when these flags are set; real party death clears **`debugShowDeathPopup`**. Closing the NPC dialog clears **`debugShowNpcDialogPopup`**.

### Rationale
Modal layout and **html2canvas** capture need repeatable ways to inspect popups without spawning deaths or formal dialog opens.

### Consequences
Reducer accepts **`debug/setShowNpcDialogPopupPreview`** and **`debug/setShowDeathPopupPreview`** alongside other F2-safe actions on title/death screens. **New run**, **go to title**, **reload checkpoint**, and **real death** reset the death preview flag; **go to title** / **new run** / **reload checkpoint** / **close NPC dialog** reset the NPC preview flag as appropriate.

---

## ADR-0199 — NPC dialog: bottom speech strip
Date: 2026-04-09

### Decision
Split **gibberish** dialog body out of the main **`GamePopup`**-styled NPC panel into a **second** UI element: a **speech strip** with **`#000`** background, **square** corners, **no** border, **no** box shadow, **10 CSS px** above the **bottom** of the 3D game viewport (**interactive**: `position: fixed` + `getBoundingClientRect` math; **capture**: full-cell **`captureRoot`** with absolute **`bottom: 10px`**). The **top** panel keeps **title**, **hint**, and **Close**. **Both** elements carry **`data-drop-kind="npc"`** so drag-drop works on either. **`npcCaptureLayer`** uses **`align-items: stretch`** so the capture subtree fills the game cell height.

### Rationale
Separates chrome from subtitle text and matches the requested **flat black** caption bar aesthetic without changing shared modal styling for other screens.

### Consequences
**`NpcDialogModal`** renders **two** positioned nodes in both variants; **`DESIGN.md`** §7.5 / frame pipeline describe the split. Brief interactive fallback **`bottom: 10%`** when the viewport ref has not measured yet.

---

## ADR-0200 — NPC speech strip: centered copy, fit-content width
Date: 2026-04-09

### Decision
The NPC **speech strip** uses **`width: fit-content`**, **`text-align: center`**, and **`max-width: min(620px, stage − 24px, 100%)`** instead of full **`panelWidthMd`** width so the **black** box shrinks to the gibberish text while long lines still cap and wrap like the top panel.

### Rationale
Clearer caption read and less empty bar when the line is short.

### Consequences
**`NpcDialogModal`** no longer applies **`panelWidthMd`** to the speech wrapper; sizing lives in **`NpcDialogModal.module.css`** **`.speechStrip`**.

---

## ADR-0201 — NPC speech strip: 25px inset, percentage `bottom`
Date: 2026-04-09

### Decision
Raise the speech strip by **15 CSS px** ( **`25 CSS px`** gap from the game viewport’s bottom edge, was **10**). **`bottom`** is a **percentage**: **interactive** uses **`((innerHeight − gameBottom + 25) / innerHeight) × 100%`** on the portaled hit layer; **capture** uses **`(25 / captureRootHeight) × 100%`** measured with **`ResizeObserver`**.

### Rationale
Keeps alignment tied to the **game rect** while satisfying a **%-based** stack; capture matches via **local** `%` of the **game cell**.

### Consequences
**`captureRoot`** gets a **ref** + observer only for this metric; **`DESIGN.md`** §7.5 documents the formula.

---

## ADR-0202 — NPC dialog closes on player movement
Date: 2026-04-09

### Decision
Before handling **`player/turn`**, **`player/step`**, or **`player/strafe`**, **`reduce`** clears **`ui.npcDialogFor`** and **`ui.debugShowNpcDialogPopup`** when either is set (`dismissNpcDialogOnMovement`), matching **`ui/closeNpcDialog`**, then proceeds with the move (so a forward step into a **non-hostile** NPC can reopen the dialog in the same dispatch chain).

### Rationale
Players expect map control to exit contextual UI; leaving the dialog up while walking felt sticky.

### Consequences
Pure reducer change in **`web/src/game/reducer.ts`**; **`DESIGN.md`** §7.5 notes the rule.

---

## ADR-0203 — Remove HUD statue rails; widen game column
Date: 2026-04-09

### Decision
Drop the **`statueL`** / **`statueR`** grid tracks and **`StatuePanel`** from **`HudLayout`**. The root grid is **three** columns **`minmax(0, 1fr) minmax(0, 1.12fr) minmax(0, 1fr)`**; **`bottomRow`** uses **`0.75fr 1.62fr 0.75fr`** with **`map | inventory | navigation`**. Delete **`web/src/ui/statue/StatuePanel.tsx`**.

### Rationale
The **120px** statue columns were empty (**`StatuePanel`** returned **`null`**) but still reserved space, producing black side strips beside the 3D view. Removing them gives the **game** cell that width.

### Consequences
**`DESIGN.md`** §6.4 updated. **ADR-0110** (statue slot titles) applied only to removed UI; no statue placeholders remain in the shell.

---

## ADR-0204 — HUD: restore outer rail tracks; game spans center three columns
Date: 2026-04-09

### Decision
Revert **`HudLayout`** root and **`bottomRow`** column templates to the **pre–ADR-0203** **`1fr 120px 1.12fr 120px 1fr`** and **`0.75fr 120px 1.62fr 120px 0.75fr`** definitions. Give the **game** `<section>` a **`grid-area`** that covers the **three** middle columns (same names in **`grid-template-areas`**) so the **3D view** fills the band formerly split between statue rails and the center track—**no** black strips, **no** separate statue UI.

### Rationale
A flat **three-column** root widened the **1fr** portrait and **0.75fr** map/nav tracks compared to the original five-column math. Restoring the **120px** tracks preserves prior rail sizes while merging them into the **game** panel keeps the wide viewport.

### Consequences
**`DESIGN.md`** §6.4 describes merged **game** span + original track list. **ADR-0203** column summary is superseded for layout structure; statue **components** remain removed.

---

## ADR-0205 — Title, death, paperdoll: HUD capture + body hit layer (dither parity)
Date: 2026-04-09

### Decision
Extend the **NPC dialog** pattern to **`TitleScreen`**, **`DeathModal`**, and **`PaperdollModal`**: each has **`capture`** vs **`interactive`** variants; **capture** renders inside the offscreen **`html2canvas`** tree; **interactive** **`createPortal`**s the same DOM (wrapped in **`GamePopup.module.css`** **`modalPortalHitRoot`**) to **`document.body`**. **`HudLayout`** gains **`captureFullHudOverlay`** (**`fullHudCaptureLayer`**, full-bleed over the HUD grid). **`DitheredFrameRoot`** composes capture overlays with priority **title → death / debug death preview → paperdoll** alongside the existing **`captureNpcOverlay`** game-cell path. Expand **`hudKey`** with **`screen`**, **`paperdollFor`**, **`debugShowDeathPopup`**, **`debugShowNpcDialogPopup`**, and a **checkpoint** flag so previews and title actions refresh captures.

### Rationale
Ordinary modals in **`stageModalLayer`** sat **above** the presenter as **clean** vector UI; only the **NPC** path was in the rasterized HUD, so **death / title / paperdoll** broke the unified **dithered** look.

### Consequences
Three modals double-render while open; **`PaperdollModal`** **capture** omits drag/drop handlers (display-only). Slightly larger **`hudKey`** string; shared **`modalPortalHitRoot`** for stacking consistency with **NPC**.

**Revision:** **ADR-0206** moves **death** capture from **`fullHudCaptureLayer`** into the **game-cell** overlay.

---

## ADR-0206 — Death modal centered in game viewport (capture + interactive)
Date: 2026-04-09

### Decision
**`DeathModal`** **capture** mounts in **`npcCaptureLayer`** (**`captureNpcOverlay`**), **before** the **NPC** dialog branch, so death (or **debug death preview**) replaces the NPC capture slot. **`captureFullHudOverlay`** carries **title** and **paperdoll** only. **Interactive** **`DeathModal`** accepts **`gameViewportRef`**; a **`position: fixed`** shell matches the **live** viewport **`getBoundingClientRect()`** ( **`ResizeObserver`**, **resize** / **`visualViewport`** / **scroll**), with **dim + panel** **flex-centered** inside the shell ( **`inset: 0`** fallback until measured).

### Rationale
The death screen should sit **on the 3D game widget**, not over the **entire HUD grid**, consistent with **NPC** anchoring and player attention.

### Consequences
**Death** and **NPC** **capture** previews are **mutually exclusive** when death is active; **`DESIGN.md`** § frame pipeline updated accordingly.

---

## ADR-0207 — Overgrown rooms: selective env texture swap
Date: 2026-04-09

### Decision
- Add a second dungeon environment texture triple served from repo `Content/` as stable URLs:
  - **`/content/overgrown_floor.png`**
  - **`/content/overgrown_wall.png`**
  - **`/content/overgrown_ceiling.png`**
- In **`WorldRenderer.buildGeometry`**, apply those textures **selectively**:
  - **Floor + ceiling**: for walkable tiles inside procgen rooms tagged **`roomStatus: Overgrown`** (rect intersection with walkable tiles).
  - **Walls**: for wall tiles that are **4-neighbor adjacent** to any overgrown walkable tile (so room boundaries read clearly).

### Rationale
The `Overgrown` floor property should have a strong local visual identity without requiring a full meshing rewrite or globally replacing a floor type’s environment textures.

### Consequences
- Slightly more materials/texture loads; no new `GameState` fields.
- Overgrown boundaries on walls are adjacency-based (not a separate wall-tagging pass).
- **`DESIGN.md`** §11 and §13 updated to reflect selective overgrown env textures and Content-only `/content/*` serving.

---

## ADR-0208 — Inventory: fixed two rows (20 slots)
Date: 2026-04-09

### Decision
Initialize party inventory as **10** columns × **2** rows (**20** slots). Remove endurance-derived cell count and the previous minimum of three rows.

### Rationale
A **compact HUD** inventory reads faster and matches a deliberate **small-bag** feel for the jam scope.

### Consequences
Lower carry capacity than the old endurance-scaled grid; **`makeInitialState`** item placements must stay within **20** indices. **`DESIGN.md`** §7.2 updated (fixed capacity; removed paging/scroll copy tied to the old large grid).

---

## ADR-0209 — HUD inventory: 20 px downward offset
Date: 2026-04-09

### Decision
Add **`margin-top: 20px`** to the **`HudLayout`** **`.inventory`** panel so the widget sits **20 CSS px** lower in the bottom HUD row.

### Rationale
Nudges the inventory grid to align better with the chrome / neighboring widgets without changing slot layout or padding.

### Consequences
**`DESIGN.md`** §7.2 notes the offset; slightly less vertical room inside the **285 px** bottom row before clip (**`overflow: hidden`** on **`panel`**).

---

## ADR-0210 — HUD inventory grid: 5% smaller
Date: 2026-04-09

### Decision
Make the **`InventoryPanel`** root grid **95%** of the inventory panel’s inner width (**`.inventory`** **`display: flex`** + **`justify-content` / `align-items: center`** and **`.inventory > *`** **`width` / `max-width: 95%`** in **`HudLayout.module.css`**).

### Rationale
Slightly reduces slot size so the block reads lighter on the bar while keeping hit targets and aspect-ratio cells aligned (no **`transform: scale`**).

### Consequences
**`DESIGN.md`** §7.2 updated. Slot **emoji** size in CSS stays **~55 px** but renders smaller because cells are narrower.

---

## ADR-0211 — Fix 3D drag/drop hover and cursor-aimed floor drops
Date: 2026-04-09

### Decision
- Move **3D hover picking** (POI/NPC/floor item) to the **HUD root pointer-move** handler so it works even when the pointer stream is **captured** by the drag origin element.
- Make **empty 3D view drops** default to **cursor-aimed** placement (raycast to floor → grid cell), clamped by `render.dropRangeCells` with a nearest-valid-floor snap fallback.

### Rationale
Pointer capture is required to reliably receive `pointerup` for drags, but it also means `GameViewport` often stops receiving `pointermove` during a drag. Root-level picking keeps cursor hover state and affordances correct regardless of where the browser delivers pointer events.

### Consequences
- `HudLayout` becomes the single reliable place to compute in-viewport hover targets and aimed `floorDrop.dropPos`.
- `GameViewport` no longer dispatches `drag/drop` on `pointerup`; it focuses on click interactions and drag-start from world floor items.
- **`DESIGN.md`** §6.2 updated to reflect cursor-aimed world drops.

---

## ADR-0212 — Encounter-mode combat with real Speed stat
Date: 2026-04-09

### Decision
- Implement combat as an explicit **encounter mode** (`state.combat`) entered when the player attempts to step into a **hostile** NPC cell.
- Add the full **character stat block** (including real **Speed**) into runtime state and drive initiative primarily from **Speed** with a small deterministic tie-break.

### Rationale
Blocking movement on hostile NPCs prevented the core loop from delivering “resolve encounters” without additional UI. Encounter mode lets us use existing cursor-first interactions (drag weapon → NPC) while still making turn order and pacing real and debuggable.

### Consequences
- New `CombatState` and initiative logic (`web/src/game/state/combat.ts`), plus reducer integration in `web/src/game/reducer.ts`.
- Weapons become data-shaped by adding `ItemDef.weapon` (replacing reducer hardcoding).
- `DESIGN.md` §7.7 updated to describe encounter-mode combat and Speed-driven turn order.

---

## ADR-0213 — Feed refusal: idle pulse instead of mouth cue
Date: 2026-04-09

### Decision
When a portrait **feed** attempt is refused (the item has no `feed` effect), do **not** trigger the feeding **mouth** cue/animation. Instead show a brief **idle sprite pulse** (`ui.portraitIdlePulse`) and play a **reject** SFX (while keeping portrait frame shake).

### Rationale
The mouth cue reads as “eating happened” even when the game refuses the item. An idle pulse is a short, neutral acknowledgement that preserves responsiveness without conveying the wrong outcome.

### Consequences
- Refusal feedback now uses `ui.portraitIdlePulse` + `reject` SFX; the mouth cue is reserved for actual feeding success.
- `DESIGN.md` updated to reflect refusal vs success feedback.

---

## ADR-0214 — Inspect: Perception roll + tiered reveals
Date: 2026-04-09

### Decision
- **Portrait inspect** (drag item → portrait **eyes**) resolves a **deterministic** check: **d20 + Perception** (stat of the **inspected character**) vs a **DC** from **item tags** (take the **highest** among: food/material **10**, container **11**, weapon/tool/hat **12**, quest **14**, default **12**).
- **Tiered activity log output**:
  - Always: inspect line + explicit `d20 + Perception = total vs DC`.
  - **Fail**: one short line that nothing more stands out.
  - **Success** (`total ≥ DC`): one line with a **brief classification** plus **character-relevant** hints (remedy fit vs current statuses, or species-tied feed affinity when defined).
  - **Great success** (`total ≥ DC + 5`): additional lines with **full mechanical detail** (feed numbers, status chances, weapon/equip/POI fields) when present on the item def.
- Roll seed: `floor.seed` + `characterId` + `itemId` + `defId` (stable across repeated inspects of the same item instance).

### Rationale
Inspect should reward **Perception** and the chosen character without adding UI chrome; the activity log already carries interaction feedback. Deterministic rolls match crafting and multiplayer-sane direction.

### Consequences
- `inspectCharacter` in `web/src/game/state/interactions.ts` owns DC mapping + messaging; item copy changes require revisiting tag→DC rules.
- `DESIGN.md` §7.1 documents the inspect check and tiers.

---

## ADR-0215 — Defend buff expires at next PC turn
Date: 2026-04-09

### Decision
- **Defend** grants **+armor** and **+resist** only until that PC’s **next** initiative slot: when the turn queue advances **into** that character’s turn again, their prior `pcDefense` entry is **cleared** before they act.
- Remove unused `untilTurnIndex` storage and the unused `CombatState.phase` field (nothing read it).

### Rationale
The previous `untilTurnIndex` value was never enforced in `defenseForPc`, so defend bonuses **never expired**. Tying expiry to the **next** time that PC’s turn comes around matches readable UX (“holds until your next go”).

### Consequences
- `advanceTurnIndex` in `web/src/game/state/combat.ts` drops `pcDefense` for the PC whose turn is starting.
- `DESIGN.md` §7.7 documents defend duration.

---

## ADR-0216 — Multi-hostile encounter roster + XP scaling
Date: 2026-04-09

### Decision
- On encounter start, collect **hostile** NPCs: same **`roomForCell`** as the stepped-on NPC (shared helper in `web/src/game/state/roomGeometry.ts`), else **Chebyshev ≤ 1** from **player** if no room.
- **`enterCombat`** takes an **array** of NPC ids; initiative queue unchanged in shape.
- **Victory XP** = **10 ×** encounter roster size (`combat.participants.npcs.length`).

### Rationale
`participants.npcs` was already an array but only one id was ever added. Room-based pulls match “room fight” expectations; corridor fallback avoids empty multi-pull when `gen.rooms` misses. XP scales with threat without a new table.

### Consequences
- `collectEncounterNpcIds` + `roomForCell` export; `reducer.ts` imports `roomForCell` from `roomGeometry.ts`.
- `DESIGN.md` §7.7 documents roster rules and XP.

---

## ADR-0217 — Diegetic combat HUD (CombatIndicator actions)
Date: 2026-04-09

### Decision
- **CombatIndicator** exposes **Flee** and **Defend** buttons (styled like other HUD chrome); **capture** HUD shows a static shortcut line only (`interactive={false}` / `noopDispatch`).
- **Keyboard R / F** remain accelerators; §6.4 documents encounter-only keys.
- **§15** combat UI question: **resolved** toward **diegetic** primary; **no** encounter modal for now.

### Rationale
Avoids a second modal stack and capture-portal complexity while making flee/defend discoverable beyond keyboard.

### Consequences
- `HudLayout` passes `dispatch` and `interactive` into `CombatIndicator`.
- `DESIGN.md` §7.7 and §15 updated.

---

## ADR-0218 — Click encounter enemy to attack (combat)
Date: 2026-04-09

### Decision
- While an encounter is active, a **viewport click** on an NPC that is **alive** and in **`combat.participants.npcs`** dispatches **`combat/clickAttack`** instead of opening the NPC dialog.
- The reducer resolves a weapon via **`resolveWeaponItemIdForPcTurn`** (equipped hands L→R, then first weapon in inventory slots) and delegates to the existing **`npc/attack`** path with **`actorId`** set to the current turn PC.
- Clicks on **non-roster** NPCs during combat still open the dialog; invalid targets and **no weapon** produce toast / activity log + reject SFX consistent with other combat mistakes.

### Rationale
Players expect click-to-strike during a fight; reusing **`npc/attack`** avoids duplicating stamina, hit/miss, turn advance, and death/loot logic.

### Consequences
- `web/src/game/state/equipment.ts`: `resolveWeaponItemIdForPcTurn`.
- `web/src/game/reducer.ts`: action **`combat/clickAttack`**.
- `web/src/ui/viewport/GameViewport.tsx`: combat-aware NPC click branch.
- `DESIGN.md` §7.7 documents click-to-attack.

---

## ADR-0219 — Activity log + combat corner stack (no overlap)
Date: 2026-04-09

### Decision
Anchor **`ActivityLog`** and **`CombatIndicator`** in one **`gameCornerStack`** on the game panel: **column** flex, **log above** encounter UI, shared **`max-width: min(42%, 420px)`**, **`pointer-events: none`** on the wrapper (combat buttons keep **`pointer-events: auto`**). Remove per-widget **`position: absolute`** from **`ActivityLog.module.css`** and **`CombatIndicator.module.css`**.

### Rationale
Both widgets used the same corner with overlapping **`bottom`/`z-index`**, so combat chrome hid log lines during encounters.

### Consequences
Slightly less vertical room for log lines when encounter chrome is visible; optional later tweak (e.g. lower log row cap in combat only) if needed.

---

## ADR-0220 — Non-hostile NPCs do not block grid movement
Date: 2026-04-09

### Decision
- **`attemptMoveTo`** still intercepts **hostile** NPCs: stepping into their cell dispatches **`combat/enter`** and the player does **not** move onto that tile (unchanged roster rules in **`collectEncounterNpcIds`** / **`enterCombat`**).
- If the target cell has a **non-hostile** NPC (neutral / friendly), movement proceeds like empty **`floor`** (player may **co-occupy** the cell with that NPC).
- Opening the NPC dialog is **not** tied to stepping onto non-hostiles; use **click** on the NPC in the 3D view (existing **`GameViewport`** path).

### Rationale
Neutral NPCs in doorways or narrow corridors should not hard-block navigation; hostiles remain a deliberate bump-to-encounter gate.

### Consequences
- `web/src/game/reducer.ts`: `attemptMoveTo` only short-circuits for **`npc.status === 'hostile'`**.
- `DESIGN.md` §7.5 / §7.7 updated for interaction and combat trigger wording.

---

## ADR-0221 — Combat parity: NPC debuffs, mitigation, stat scaling, flee turn, combat item blocks
Date: 2026-04-09

### Decision
- **NPC statuses**: floor NPCs carry a **`statuses`** array (same shape as PCs); **`applyStatusDecay`** prunes **`untilMs`** for NPCs too. **`weapon.statusOnHit`** rolls on successful PC weapon hits and applies timed effects via **`addStatusToNpc`** (deterministic seeds).
- **NPC mitigation vs PC hits**: per-**`NpcKind`** **`armor`** (subtract after damage % bonus, for Blunt/Pierce/Cut only) and **`resistances`** by **`DamageType`** (capped at **0.95**, same style as NPC→PC). To-hit defense stays **10 + NPC Speed** (armor does not add to AC).
- **Weapon stat scaling**: optional **`ItemDef.weapon.damageStat`** (**`strength`** | **`agility`**) adds **`floor(stat × 0.25)`** to base weapon damage before run **damageBonusPct**.
- **Flee failure**: after stamina is spent and the flee check fails (free enemy hit), **`combat/advanceTurn`** runs so the same initiative slot cannot spam flee attempts.
- **Combat item blocks**: during **`state.combat`**, **Hive** world drop, **Swarm Basket** capture, **Captured Swarm** release, and **Swarm Queen** calm-on-touch are rejected with a short log line.

### Rationale
Content already exposed **`statusOnHit`** and per-weapon fantasy (Str vs Agi) while code only modeled NPC→PC procs and flat PC damage. Flee-spam and “spawn/capture mid-fight” bypassed encounter pacing; aligning implementation with **`DESIGN.md` §7.7** reduces exploits and dead data.

### Consequences
- `web/src/game/types.ts`, `web/src/procgen/types.ts`, `web/src/procgen/population.ts`, `web/src/game/state/npcHydrate.ts`, `web/src/game/state/initialState.ts`, `web/src/game/state/floorProgression.ts`, `web/src/game/reducer.ts`: NPC **`statuses`** + hydration from procgen.
- `web/src/game/state/status.ts`: NPC decay + **`addStatusToNpc`**.
- `web/src/game/state/combat.ts`: **`npcCombatTuning`** armor/resist; **`computePcAttackDamage`** pipeline; **`applyWeaponStatusOnHitFromPc`**; **`attemptFlee`** returns **`{ state, advanceTurn }`**.
- `web/src/game/content/contentDb.ts`, `web/src/game/content/items.ts`: **`damageStat`** on weapons.
- `DESIGN.md` §7.7–§7.8 updated; this ADR.

---

## ADR-0222 — Pre-dungeon 2D hub (village / tavern) + tunable hotspots
Date: 2026-04-09

### Decision
- **`ui.screen`** gains **`hub`**: **New run** from the title screen starts in **`hub`** with **`hubScene: village`** (2D art in the **game** HUD cell, click regions as red-outlined placeholders). **Tavern** / **Cave** / **Exit** / **Innkeeper** actions are driven by **`hub/*`** reducer actions; **Cave** sets **`screen: 'game'`** to show the existing 3D dungeon. **Checkpoint reload** skips the hub.
- **Innkeeper** opens **`TavernTradeModal`**: stub copy **“Welcome, travellers…”** and **Close** only (real trade UI later).
- **Hotspot geometry** lives in **`GameState.hubHotspots`** (normalized **0–1** rects). F2 **Hub hotspots** sliders and **`hubHotspots`** in **`debug-settings.json`** (plus localStorage) mirror the render/audio persistence pattern.
- **Compositor**: **`HubViewport`** is mounted in the **capture** HUD for the hub (not an empty shell) so the final frame shows 2D art over the scene rect.

### Rationale
Bespoke starting locations need layout iteration without rebuilding art; normalized rects and shared debug persistence keep tuning workflow consistent with F2. Masking via the captured HUD matches the existing scene/UI composite contract.

### Consequences
- New modules: `web/src/ui/hub/HubViewport.tsx`, `TavernTradeModal.tsx`, `web/src/game/hubHotspotDefaults.ts`; `HudLayout` / `NavigationPanel` / `DitheredFrameRoot` / `reducer` / `types` / `debugSettingsPersistence` / `GameApp` / `DebugPanel` updated; `web/public/debug-settings.json` includes default **`hubHotspots`**.

---

## ADR-0223 — Tavern trade modal: capture overlay + cursor forwarding; tavern bartender art
Date: 2026-04-09

### Decision
- **`TavernTradeModal`**: add **`variant="capture"`** for **`captureFullHudOverlay`** (same dual-DOM pattern as **`TitleScreen`**) so the stub trade panel appears in the dithered frame; interactive portaled tree keeps **`modalPortalHitRoot`** opacity-0 for hits.
- Wrap portaled content in a full-screen **`hitShell`** that forwards **`cursor.onPointerMove`** / **`cancelDrag`** (same approach as **`DeathModal`**) so the custom cursor tracks the pointer while the modal sits above **`FixedStageViewport`**.
- **Tavern hub**: render **`bartender_base` / `bartender_idle` / `bartender_blink`** inside the innkeeper rect, plus **`tavern_foreground.png`** under hotspot z-order so clicks still reach exit/innkeeper.

### Rationale
Without capture overlay, the trade UI was invisible in the composite; without pointer forwarding, **`HudLayout`** no longer received moves when the pointer was over the body portaled layer, so cursor position stalled.

### Consequences
- `TavernTradeModal.tsx`, `TavernTradeModal.module.css`, `HubViewport.tsx`, `HubViewport.module.css`, `DitheredFrameRoot.tsx`, `DESIGN.md` §5.1.

---

## ADR-0224 — Debug: hub innkeeper sprite scale (visual-only)
Date: 2026-04-09

### Decision
Add **`hubInnkeeperSpriteScale`** to **`RenderTuning`** (default **1**, clamped **0.25–3**), exposed in F2 under the NPC/POI render sliders. The tavern **bartender** `<img>` uses **`transform: scale(...)`** with **`transformOrigin: bottom center`**. The **innkeeper hotspot** remains **`hubHotspots.tavern.innkeeper`** only.

### Rationale
Artists can tune sprite prominence independently of hit targets; coupling scale to the hotspot would force simultaneous retuning of trade click areas.

### Consequences
- `web/src/game/types.ts`, `tuningDefaults.ts`, `reducer.ts` (`clampRenderTuning`), `HubViewport.tsx`, `DebugPanel.tsx`; `DESIGN.md` F2 + §5.1.
