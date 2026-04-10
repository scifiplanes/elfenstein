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

## ADR-0211 — Character equipment strip beside portraits
Date: 2026-04-09

### Decision
Move **head** and **hand** equipment **display, drag, and `equipmentSlot` drops** off the **`PortraitPanel`** stack into a dedicated **`CharacterEquipStrip`** beside each portrait, using **`Content/ui/hud/ui_hud_charequip_background.png`** (**198×589**) as vertical chrome with three aligned hit regions (**head** → **handLeft** → **handRight**). **`HudLayout`** wraps **`PortraitPanel` + strip** in a flex rail: strip **right** of the portrait on **CHAR1/CHAR2**, strip **left** of the portrait on **CHAR3/CHAR4**. Remove **`portrait` `hat` / `hands`** drop zones from the portrait; **eyes** / **mouth** targets stay on the portrait. Preserve **`fromPortrait: true`** on strip-originated equipment drags for void-drop **stow**.

### Rationale
Equipment reads as **HUD chrome** (same **html2canvas** capture path as the rest of the HUD, so **dither** matches), slot hit areas can track **authored frame art**, and the portrait stays focused on **face interactions** + stats.

### Consequences
**`PortraitPanel`** no longer accepts a **`content`** prop (equipment resolution moved out). **`DESIGN.md`** §6.2 / §7.1 / §11 updated. Tuning: CSS **%** slot bands in **`CharacterEquipStrip.module.css`** may need nudges if the PNG frames shift.

---

## ADR-0212 — Symmetric portrait / equip rail (`charRailPushEnd`)
Date: 2026-04-09

### Decision
Lay out **`PortraitPanel`** + **`CharacterEquipStrip`** with **`charRail`**: **`[Portrait][Strip]`** on **CHAR1/CHAR2**, **`[Strip][Portrait]`** on **CHAR3/CHAR4**. Portrait sits in **`charRailPortraitGrow`** (**`flex: 1 1 0`**, **`min-width: 0`**). The **second** flex child always gets **`charRailPushEnd`** (**`margin-left: auto`**), so **all** remaining rail width is **between** portrait and strip. Remove **spacer** divs, **`gap: 6px`**, and **`translateX`** on the strip. **`CharacterEquipStrip`** takes optional **`className`** for **`charRailPushEnd`** when it is the second child.

### Rationale
**Mirrors** left and right rails with **one** spacing rule (flex **auto** margin), avoiding asymmetric **transform** / **margin** hacks that clipped or failed to move under **`overflow`** and **`gap`**.

### Consequences
**`DESIGN.md`** §6.4 / §7.1 updated. **`portraitHudRail`** removed from **`CharacterEquipStrip`**. (**ADR-0218** later removed **`portraitHudRail`** from **`PortraitPanel`** too.)

---

## ADR-0213 — Mirrored equip strip `translateX` from one constant
Date: 2026-04-09

### Decision
**`HudLayout`** defines **`EQUIP_STRIP_NUDGE_TOWARD_GAME_PX`** (**20**). **`CharacterEquipStrip`** accepts **`equipTranslateXPx`**; **CHAR1/CHAR2** pass **`+`** the constant, **CHAR3/CHAR4** pass **`-`** the same value so both rails nudge **toward the game** in mirror.

### Rationale
One number to tune; avoids drifting left/right adjustments separately.

### Consequences
**`DESIGN.md`** §7.1 notes the constant and sign convention.

---

## ADR-0214 — Equip strip shared upward nudge
Date: 2026-04-09

### Decision
Add **`EQUIP_STRIP_NUDGE_UP_PX`** (**20**) in **`HudLayout`**; pass **`equipNudgeUpPx`** to **every** **`CharacterEquipStrip`**. **`CharacterEquipStrip`** composes **`transform`** from optional **`translateX`** and **`translateY(-up)`**.

### Rationale
Move all equip chrome **up** together; vertical shift does not need left/right mirror.

### Consequences
**`DESIGN.md`** §7.1 updated.

---

## ADR-0215 — Character equip strip 15% larger
Date: 2026-04-09

### Decision
**`CharacterEquipStrip.module.css`**: set **`--equip-strip-scale: 1.15`** on **`.root`**; drive **strip width** (**`calc(78px * var(--equip-strip-scale))`**) and **emoji `clamp` / `vmin`** plus **icon drop-shadow** offsets from the same variable.

### Rationale
One multiplier keeps chrome, hit regions (percent-based), and icons visually consistent when enlarging the strip.

### Consequences
**`DESIGN.md`** §7.1 notes **`--equip-strip-scale`** and the **78px** baseline.

---

## ADR-0216 — Equip strip shared rightward `translateX` nudge
Date: 2026-04-09

### Decision
**`HudLayout`** adds **`EQUIP_STRIP_NUDGE_RIGHT_PX`** (**20**). **`equipTranslateXPx`** is **`±EQUIP_STRIP_NUDGE_TOWARD_GAME_PX + EQUIP_STRIP_NUDGE_RIGHT_PX`** (left rail **+**, right rail **−** on the first term only).

### Rationale
Move all strips **right** by the same screen delta while keeping the existing **toward-game** mirror (right rail still uses the negated toward-game term).

### Consequences
**`DESIGN.md`** §7.1 documents the three horizontal/up constants.

### Update (superseded)
**ADR-0217** removes the additive **`EQUIP_STRIP_NUDGE_RIGHT_PX`**; horizontal placement is **only** **`±EQUIP_STRIP_NUDGE_TOWARD_GAME_PX`** again.

---

## ADR-0217 — Equip strip horizontal: left +20px, mirrored −20px on right rail
Date: 2026-04-09

### Decision
Drop **`EQUIP_STRIP_NUDGE_RIGHT_PX`**. **`equipTranslateXPx`** is **`+EQUIP_STRIP_NUDGE_TOWARD_GAME_PX`** on **CHAR1/CHAR2** and **−** the same on **CHAR3/CHAR4** (pure mirror toward the game column).

### Rationale
Match the spec: **left** equipment **20px** to the **right**; **right** widgets use the **mirrored** offset (no extra global right shift on top).

### Consequences
**`DESIGN.md`** §7.1 and **`HudLayout`** comments updated.

---

## ADR-0218 — Portrait vitals overlay centered on frame (no rail `translateX`)
Date: 2026-04-09

### Decision
Remove **`PortraitPanel`** **`portraitHudRail`** and **`statsOverlayRailLeft` / `statsOverlayRailRight`** (**±40px** **`translateX`**). The stats overlay uses **`PortraitPanel.module.css`** **`.statsOverlay`** only (**`translateY(10px)`**).

### Rationale
The horizontal nudge moved the **attributes** box off the portrait’s horizontal center while sprites stayed centered in the frame; dropping **X** nudge realigns face and vitals.

### Consequences
**`HudLayout`** no longer passes **`portraitHudRail`**. **`DESIGN.md`** §7.1 updated.

---

## ADR-0219 — Portrait + vitals column mirrored `translateX` toward game
Date: 2026-04-09

### Decision
**`HudLayout`** defines **`PORTRAIT_AND_VITALS_NUDGE_TOWARD_GAME_PX`** (**35**; was **25** at introduction). **`PortraitPanel`** accepts **`portraitColumnTranslateXPx`** applied on **`.root`** (**`translateX`**): **+** on **CHAR1/CHAR2**, **−** on **CHAR3/CHAR4**.

### Rationale
Move **portrait and attributes** together **toward the game** with the same mirror convention as **`CharacterEquipStrip`**, without re-skewing overlay vs face (overlay stays centered on the portrait box).

### Consequences
**`DESIGN.md`** §7.1 updated.

### Update
**+10** px on the constant (same mirror on both rails).

---

## ADR-0220 — Equip strip horizontal nudge +20px (mirror): 40px toward game
Date: 2026-04-09

### Decision
Increase **`EQUIP_STRIP_NUDGE_TOWARD_GAME_PX`** from **20** to **40** (**+20** on **CHAR1/CHAR2**, **−20** more on **CHAR3/CHAR4** vs prior).

### Rationale
Left equipment **20px** further **right**; right equipment **mirrored** toward the game column.

### Consequences
**`DESIGN.md`** §7.1 updated.

### Update
**`EQUIP_STRIP_NUDGE_TOWARD_GAME_PX`** tuned to **48** (was **40**), then **55**.


*Merged history note: the following entries reuse ADR numbers **0211–0229** from another branch; titles disambiguate them from the equipment-strip **ADR-0211–ADR-0220** block above.*

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

---

## ADR-0225 — Combat gating: block POI, pickup, and crafting only
Date: 2026-04-09

### Decision
- While **`state.combat`** is set, reject **POI** use (`poi/use` and **`drag/drop`** onto **`poi`**), **floor pickup** (`floor/pickup` and **`drag/drop`** onto **`floorItem`**), **starting** a craft (inventory merge with a recipe), and **completing** crafting (`maybeFinishCrafting` no-ops until combat clears).
- **Do not** gate **equip**, **unequip**, portrait interactions, or non-recipe inventory moves.
- **Cursor**: when dragging a valid recipe pair over an inventory slot during combat, show a **Blocked** affordance instead of **Craft** (matches reducer rejection).

### Rationale
Encounter mode should stop **world** interactions and **free crafting** while movement is frozen, without disabling **party/loadout** UX (portraits, equipment) that players rely on mid-fight.

### Consequences
- `web/src/game/reducer.ts`: **`rejectNotWhileInCombat`** helper; guards on **`poi/use`**, **`floor/pickup`**, recipe **`startCrafting`**, **`floorItem`**, **`poi`** drag targets.
- `web/src/game/state/crafting.ts`: **`maybeFinishCrafting`** returns early when **`state.combat`**.
- `web/src/ui/cursor/CursorLayer.tsx`: combat + craft hover label.
- `DESIGN.md` §7.7: **World & crafting during combat**, **NPC hit vs party**, and this ADR.

---

## ADR-0226 — Portrait vital bars: proportional fill
Date: 2026-04-09

### Decision
**Portrait** HP and Stamina bar widths reflect **current / max** using the same run-level caps as gameplay (**`hpMax` / `staminaMax`**). Hunger and Thirst bars use a **100** cap aligned with feed clamping.

### Rationale
Encounter combat and hazards change party HP, but fills were always **100%**, so players could not read fight outcomes from the HUD.

### Consequences
- `web/src/ui/portraits/PortraitPanel.tsx`: **`vitalFillRatio`**, import **`runProgression`**.
- `DESIGN.md` §7.1: replace interim “always full” wording with proportional-fill rules.

---

## ADR-0227 — Activity log: combat to-hit detail
Date: 2026-04-09

### Decision
Append **one activity-log line per swing** that states the **d20-based check** and outcome, mirroring inspect-style transparency:
- **PC weapon (encounter):** `d20 + Perception + Agility` vs **`10 + defender NPC Speed`**; then damage / miss.
- **NPC hit vs party:** `d20 + NPC Speed` vs **`10 + target PC Speed`**; then damage / miss / crit note.

### Rationale
Players learn the combat model from the log; numeric checks reduce opaque “Miss.” / hit lines.

### Consequences
- `web/src/game/state/combat.ts`: **`computePcAttackDamage`** returns optional **`pcAttackRoll`**; **`npcTakeTurn`** log strings extended.
- `web/src/game/reducer.ts`: **`npc/attack`** uses **`pcAttackRoll`** for PC encounter logging.
- `DESIGN.md` §7.7: **Activity log (combat swings)** note.

---

## ADR-0228 — NPC death loot: per-kind deterministic tables
Date: 2026-04-09

### Decision
Replace the single global **`pickNpcLootDefId`** stub with **`pickNpcLootDefId(state, kind, npcId)`** driven by **`NpcKind` → weighted item def ids** in **`web/src/game/content/npcLoot.ts`**. Rolls stay **deterministic** from **`floor.seed`**, **`npcId`**, and a stable nonce (no **`nowMs`** in the drop pick).

### Rationale
**DESIGN.md** §7.5 calls for loot informed by tables; per-kind weights support faction flavor and balancing without touching reducer logic.

### Consequences
- New **`npcLoot.ts`**; **`reducer.ts`** death branch imports the helper.
- `DESIGN.md` §7.5: note data-driven per-kind drops + determinism.

---

## ADR-0229 — Debug settings: `debugUi` slice, honest save, clear local
Date: 2026-04-09

### Decision
- Extend **`web/public/debug-settings.json`** (and the matching **`localStorage`** blob) with a **`debugUi`** object that persists F2-only **UI** tuning: **`debugBgTrack`**, **`procgenDebugOverlay`**, **room telegraph** (**`roomTelegraphMode`** + **`roomTelegraphStrength`** on **`GameState.ui`**), and the **NPC dialog** / **death** **preview** flags. Room telegraph is driven from **`state.ui`** (no **`window.__elfensteinRoomTelegraph`** hook).
- **`saveDebugSettingsToProject`** returns **`Promise<boolean>`**; **Save to project** shows success only when the dev-server write returns OK.
- Add **Clear local overrides** (dev): removes **`elfenstein.debugSettings`** and reloads so the project file is not masked by storage.

### Rationale
Several F2 controls lived outside **`render` / `audio` / `hubHotspots`**, so **Save to project** silently dropped them; the success toast also fired when **`POST /__debug_settings/save`** failed. Persisting a small **`debugUi`** slice and fixing feedback aligns repo and production builds with designer intent; clearing storage addresses **local-after-project** load order.

### Consequences
- **`web/src/app/debugSettingsPersistence.ts`**, **`GameApp.tsx`**, **`DebugPanel.tsx`**, **`DitheredFrameRoot.tsx`**, **`types.ts`**, **`initialState.ts`**, **`reducer.ts`**; sample **`debugUi`** in **`web/public/debug-settings.json`**.
- `DESIGN.md` §3: documents **`debugUi`**, load order, save failure feedback, and **Clear local overrides**.

---

## ADR-0230 — POI tiles block player occupancy
Date: 2026-04-09

### Decision
**POI** grid cells are **not** valid **player** stand tiles: **`player/step`** and **`player/strafe`** reject moving onto any cell where **`floor.pois`** has a matching **`pos`**, using the same **bump** feedback as a blocked move with a distinct **activity-log** line. **Spawn** after **regen** / **descend** / **initial gen** uses **`pickPlayerSpawnCell`**: **`gen.entrance`** when it has no POI, else the first orthogonal **floor** cell without a POI (**N→E→S→W**). **`run/reloadCheckpoint`** nudges **`playerPos`** off a POI tile when restoring older checkpoints and re-snaps the camera.

### Rationale
Props read as **occupying** their cell; keeping the avatar off POI tiles avoids overlapping billboards with the player footprint and matches “object in the way” expectations.

### Consequences
- New **`web/src/game/state/playerFloorCell.ts`**: **`poiOccupiesCell`**, **`nearestFloorCellWithoutPoi`**, **`pickPlayerSpawnCell`**.
- **`web/src/game/reducer.ts`**: **`attemptMoveTo`**, **`bump(message?)`**, **`floor/regen`**, **`run/reloadCheckpoint`**.
- **`initialState.ts`**, **`floorProgression.ts`**: spawn uses **`pickPlayerSpawnCell`**.
- **`DESIGN.md`**: §6.4 **POI cells**, §9 intro (no longer “non-blocking” for occupancy).

---

## ADR-0231 — Data-driven NPC combat stats + runtime `hpMax`
Date: 2026-04-09

### Decision
Move encounter tuning (**Speed**, **base damage**, **damage type**, **armor**, **resists**, optional **statusOnHit**) and **`hpMax`** into **`web/src/game/content/npcCombat.ts`** as **`NPC_COMBAT_BY_KIND`**. **`npcCombatTuning`** in **`combat.ts`** reads that table. **`npcKindHpMax`** drives procgen **`hp`/`hpMax`** at spawn, debug **Hive** swarm spawn, and **`debug/spawnNpc`**. Runtime **`floor.npcs`** require **`hpMax`**; **`hydrateFloorNpcs`** / **`run/reloadCheckpoint`** back-fill from kind when missing.

### Rationale
Balancing and new **`NpcKind`** entries should not require editing the combat **`switch`**; **`hpMax`** must be canonical for **CombatIndicator** bars and stay consistent across spawns.

### Consequences
- New **`npcCombat.ts`**; **`combat.ts`**, **`population.ts`**, **`npcHydrate.ts`**, **`reducer.ts`**, **`types.ts`**, **`procgen/types.ts` (`GenNpc.hpMax?`)**; **`DESIGN.md`** §7.7.

---

## ADR-0232 — Fireshield: encounter consumable + `pcFireshield` turns
Date: 2026-04-09

### Decision
- Extend **`ItemDef`** with optional **`combatShield`** (Fire resist %, stamina cost, **`shieldTurns`**, **`consumesOnUse`**). **Fireshield** uses it.
- Extend **`CombatState`** with **`pcFireshield`**: per-PC **`fireResistBonusPct`** and **`turnsRemaining`**. Each time that PC’s initiative comes up, **`advanceTurnIndex`** decrements; at **0** the entry is removed.
- **`npcTakeTurn`** adds shield bonus into the resist term **only** for **Fire** damage (stacks with **Defend**’s global resist bump).
- During an encounter, drag **Fireshield** onto the **acting** PC’s portrait **hands**: pay stamina, log, consume item, **`combat/advanceTurn`**. Out of combat, normal equip rules still apply.

### Rationale
Matches the crafted **Ash+Sulfur** fantasy with minimal UI: reuses portrait **hands** and turn-gating; turn-based expiry aligns with **Defend** mental model.

### Consequences
- **`contentDb.ts`**, **`items.ts`**, **`types.ts`**, **`combat.ts`**, **`reducer.ts`**; **`DESIGN.md`** §7.3 / §7.7.

---

## ADR-0233 — CombatIndicator enemy HP bars
Date: 2026-04-09

### Decision
Replace the single comma-separated enemy name line with a **per-roster** list: name + thin **HP bar** (**current / `hpMax`**), **`aria-valuenow`/`max`** on the track.

### Rationale
Diegetic readability without an encounter modal; **`hpMax`** is now authoritative on each NPC (see **ADR-0231**).

### Consequences
- **`CombatIndicator.tsx`**, **`CombatIndicator.module.css`**; **`DESIGN.md`** §7.7.

---

## ADR-0234 — Weapon stamina on miss + NPC soft targeting
Date: 2026-04-09

### Decision
- In **`npc/attack`**, after resolving the encounter to-hit roll, apply **`weapon.staminaCost`** **before** branching on miss so **missed swings still cost stamina**.
- **`npcTakeTurn`** target selection: minimize **effective softness** = **`hp` + 8** if the PC has **Defend** active, plus a tiny **deterministic** tie jitter from **`tieBreak01`**.

### Rationale
Swings should tire the attacker even on a miss; NPCs should prefer fragile targets but slightly avoid **Defending** PCs without abandoning low-HP focus.

### Consequences
- **`reducer.ts`**, **`combat.ts`**; **`DESIGN.md`** §7.7 (**PC damage resolution**, **NPC actions**).

---

## ADR-0235 — Procgen PoI placement avoids progression chokepoints
Date: 2026-04-09

### Decision
- Add **`exitNeighborReachableWithPoiBlocking`** in **`web/src/procgen/validate.ts`**: BFS from **`nearestFloorCellAvoidingBlocked(entrance, …)`** (same N→E→S→W nudge as gameplay) over **`isWalkable`** tiles, skipping PoI keys and always skipping the **exit** cell; require reachability of **≥1** orthogonal **exit** neighbor.
- Extract **`nearestFloorCellAvoidingBlocked`** / **`cellKey`** in **`web/src/game/state/playerFloorCell.ts`**; **`nearestFloorCellWithoutPoi`** delegates to it.
- **`placePois`** in **`web/src/procgen/population.ts`** gates **Bed**, **Chest**, **Barrel**, **Crate**, optional **Shrine**, optional **CrackedWall** with that check; fallbacks may skip progression only as a last resort before **`validateGen`** rejects the layout.
- **`validateGen`** in **`web/src/procgen/locks.ts`** enforces the same invariant for **all** floors (including **no-lock** attempts), using final **`gen.pois`** positions.

### Rationale
PoI tiles **block occupancy**; a single PoI on a **1-wide articulation** between spawn and the stairs soft-locks the floor. Preferring “off one shortest path” does not detect all such cut vertices.

### Consequences
- Fewer container PoIs on unavoidable choke tiles; optional PoIs may be omitted slightly more often. **`DESIGN.md`** §8.2 / §8.3 / §9 updated.

## ADR-0236 — Equipment strip drag affordance borders
Date: 2026-04-09

### Decision
- Add **`--hud-inventory-slot-border`** and **`--hud-stamina-vital-fill`** on **`:root`** (`index.css`); use them for inventory slot borders, portrait vital cell borders, stamina bar fill, and **`CharacterEquipStrip`** slot frames.
- **`itemFitsCharacterEquipmentSlot`** in **`equipment.ts`** encodes strip-only fit (**`hat`** / **`oneHand`** / **`twoHand`** + **`equipSlots`**).
- **`CharacterEquipStrip`** applies **`slotAffordEquip`** while **`cursor.state.dragging?.started`** when the dragged item fits that slot’s role, switching the **`::after`** border to the stamina token; otherwise the inventory token.

### Rationale
Clear default chrome aligned with inventory; during drag, valid equip targets read as the same accent as the stamina vital.

### Consequences
- **`PortraitPanel.tsx`** stamina fill uses **`var(--hud-stamina-vital-fill)`**; **`DESIGN.md`** §6.2 / §6.4 / equipment strip spec updated.

---

## ADR-0237 — In-combat portrait feed is intentional triage (policy A)
Date: 2026-04-09

### Decision
**Keep** portrait **feed** (food, remedies, and other **feed**-path uses) **available during encounters** with **no initiative cost**. Document this as **deliberate party triage**, not an oversight.

### Rationale
Matches the **cursor-first** model and **party-as-one-organism** pillar (§4): players manage vitals and statuses without burning the acting PC’s turn. Alternatives—blocking feed in combat or making feed consume a turn—add friction or duplicate “item use” UX without clear payoff at this stage.

### Consequences
- Stronger **in-combat recovery**; balance via **item scarcity**, **stamina** on weapon swings, **flee/defend** costs, and **enemy pressure**. **`DESIGN.md`** §7.7 updated explicitly.

---

## ADR-0238 — Fire-damage Skeleton + minor NPC combat tuning
Date: 2026-04-09

### Decision
Set **Skeleton** **`damageType`** to **`Fire`** in **`NPC_COMBAT_BY_KIND`** so **`npcTakeTurn`** exercises **`pcFireshield`** Fire resist in normal play; lightly tune **Swarm** (**hpMax** 9→10, **baseDamage** 4→5) for clearer low-tier threat.

### Rationale
All other kinds were physical-only; **Fireshield** had no default roster counterexample. **Skeleton** as a cinder/ember striker is content-light (no new **`NpcKind`**). Small **Swarm** bump improves baseline encounter feel without overlapping the Skeleton role.

### Consequences
- **`web/src/game/content/npcCombat.ts`**; **`DESIGN.md`** §7.7 NPC resolution note if needed (implicit in kind table).

---

## ADR-0239 — Combat core unit tests
Date: 2026-04-09

### Decision
Add **Vitest** unit tests for **`collectEncounterNpcIds`**, **`advanceTurnIndex`** (defend expiry + **Fireshield** turn tick), and **`attemptFlee`** failed-flee **`advanceTurn`** contract.

### Rationale
Combat logic is concentrated in **`combat.ts`** but wired through a large **`reducer.ts`**; pure-function tests catch regressions in roster rules and turn advancement without E2E.

### Consequences
- **`web/src/game/state/combat.test.ts`** (or adjacent); **`web/package.json`** test script if missing.

---

## ADR-0240 — Encounter turn preview + combat miss SFX
Date: 2026-04-09

### Decision
- **`CombatIndicator`**: show **“Next:”** using the following **`turnQueue`** entry after the current turn.
- **SFX**: extend **`ui/sfx`** with **`swing`** (PC encounter miss) and reuse or distinguish NPC miss; wire **`SfxEngine`** playback.

### Rationale
Diegetic readability for initiative order; **miss** feedback should not reuse the same cue as **reject** (UI denial).

### Consequences
- **`CombatIndicator`**, **`reducer.ts`** (PC miss branch), **`SfxEngine`**, **`GameApp`/`FeedbackLayer`** dispatch typing; **`DESIGN.md`** §7.7 / §10.

---

## ADR-0241 — Quest text occasionally in combat activity log
Date: 2026-04-09

### Decision
On each **encounter** **`npcTakeTurn`**, if the NPC has **`quest.wants`**, roll a **deterministic** **`hashStr(floor.seed:encounterId:questShout:npcId:turnIndex) % 100 < 20`**; on success, **`pushActivityLog`** **`{name}: "…bring me {item}."`** in **plain English** (shared helper **`npcQuestEnglishLine`** with **`NpcDialogModal`**) **before** miss/hit lines. **`ContentDB.createDefault()`** in **`combat.ts`** resolves item display names (same data as the client **`CONTENT`**).

### Rationale
Gives a **diegetic hint** under pressure without opening dialog; stays **replayable/host-syncable** like other combat rolls. **English** in the log keeps the feed readable; the modal still uses **`toGibberish`** for speech flavor.

### Consequences
- **`web/src/game/npc/npcQuestSpeech.ts`**, **`web/src/game/state/combat.ts`** (**`QUEST_SHOUT_CHANCE_PCT`**, **`questShoutRollMod100`** for tests), **`NpcDialogModal`**, tests; **`DESIGN.md`** §7.7.

---

## ADR-0242 — NPC dialog gibberish: gnome tokens + procedural Mojibake/Zalgo
Date: 2026-04-09

### Decision
Replace English-derived **`toGibberish`** behavior with three **procedural** presentation modes: **Deep Gnome** = **4–8** tokens from a fixed **safe** list of **“gnome”** spellings (diacritics / **ñ** only); **Mojibake** = **2–4** longer fake words via **UTF-8 bytes → Latin-1-style** display; **Zalgo** = **2–5** shorter **a–z** words plus **combining marks**, using a **separate RNG lane** from Mojibake. **`toGibberish(lang, _english, seed, salt)`** folds **`salt`** ( **`npc.id`** from **`NpcDialogModal`**) into the seed so NPCs on the same floor differ. The **`english`** argument is reserved, unused.

### Rationale
Matches the intended **visual** identity of each language without encoding item names in the speech strip; keeps **determinism** for replay/sync; **combat / hint / log** paths still carry readable English where needed (**ADR-0241**).

### Consequences
- **`web/src/game/npc/gibberish.ts`**, **`NpcDialogModal.tsx`**, **`web/src/game/npc/gibberish.test.ts`**; **`DESIGN.md`** §7.6 / §15.

---

## ADR-0243 — Portrait equipment mirror (read-only icons)
Date: 2026-04-09

### Decision
Restore **non-interactive** equipped **head** / **hand** icons on **`PortraitPanel`** (same CSS bands and sizing as legacy on-portrait equip), driven by shared **`getCharacterEquipmentHudModel`** (**`equipment.ts`**) with **`CharacterEquipStrip`**. **HUD** equip drag/drop remains **strip-only**; portrait layers use **`pointer-events: none`**. Icons render whenever **`PortraitPanel`** mounts (including **`captureForPostprocess`**) so the **dither presenter**’s captured HUD bitmap includes them; the live **`interactiveHud`** layer stays **`opacity: 0`**, so players do not see that DOM tree.

### Rationale
Players see **at a glance** what a character is wearing without reading the side strip alone; avoids duplicating **two-hand** / left-right rules between UI surfaces.

### Consequences
- **`PortraitPanel`** takes **`content`** again; **`HudLayout`** passes **`CONTENT`**; **`PortraitPanel.module.css`** regains equip mirror rules; **`DESIGN.md`** §7.1 / §7.4 updated.

---

## ADR-0244 — Portrait equip mirror must appear in HUD capture
Date: 2026-04-09

### Decision
Stop gating portrait equip mirror layers on **`!captureForPostprocess`**. **`DitheredFrameRoot`** shows the **captured** HUD (`captureForPostprocess={true}`) on the presenter canvas while the interactive HUD (`opacity: 0`) is hit-only; omitting mirrors from capture made equipped icons **invisible**.

### Rationale
Mouth/idle reaction sprites are compositor overlays and are suppressed in capture by design; static equip icons have **no** WebGL overlay path and must be part of the captured DOM.

### Consequences
- **`PortraitPanel.tsx`** always paints equip mirror DOM when equipped; **`DESIGN.md`** portrait mirror bullet clarified.

---

## ADR-0245 — Fix equipment slot-to-slot drag duplicating items
Date: 2026-04-09

### Decision
On **`drag/drop`** with **`target.kind === 'equipmentSlot`**, when **`payload.source.kind === 'equipmentSlot`**, run **`clearEquippedSlotIfMatched`** on the **source** before **`equipItem`**.

### Rationale
**`equipItem`** begins with **`removeItemFromInventory`**, which only clears **`party.inventory.slots`**. Items worn in **`party.chars[].equipment`** are **not** in that grid, so a cross-character equip drop assigned the item to the target without removing it from the source.

### Consequences
- **`reducer.ts`**; **`DESIGN.md`** §7.4 **HUD equip** bullet.
## ADR-0246 — Reusable trade modal (tavern + friendly NPCs)
Date: 2026-04-09

### Decision
- Replace **`ui.tavernTradeOpen`** with **`ui.tradeSession`**: a discriminated union (**`hub_innkeeper`** carries **`stock`**, **`wants`**, **`offerItemId`**, **`askStockIndex`**; **`floor_npc`** carries **`npcId`** plus offer/ask indices, reading **`npc.trade.stock` / `wants`** from **`floor.npcs`**). **Innkeeper** catalog defaults live in **`web/src/game/content/trading.ts`**; **`run.hubInnkeeperTradeStock`** persists remaining hub stock for the run.
- **Barter rule**: **one** unit from the offered stack for **one** unit from the chosen stock row (**`consumeItem`** on the offer, decrement row **`qty`**, **`mintItemToInventoryOrFloor`** for the gain). **`trade/close`** and backdrop dismiss **restow** a staged offer via **`moveItemToInventorySlot`**.
- **Drag/drop**: new **`DragTarget`** **`tradeOfferSlot`**, **`tradeAskSlot`**; **`DragSource`** **`tradeOffer`**, **`tradeStockSlot`**. While a session is open, invalid **trade stock** drops **reject**; **trade offer** drops outside inventory **reject**.
- **Hub guard** in **`reducer.ts`**: allow **`drag/drop`**, **`ui/sfx`**, **`ui/shake`**, and **`ui/toast`** through the hub whitelist so tavern trade and nested feedback actions reach the main switch (same pattern as other hub-approved actions).
- **UI**: **`TradeModal`** (`web/src/ui/trade/`) — dual DOM + **`gameViewportRef`** anchoring; **`InventoryPanel`** highlights **want** slots; **`NpcDialogModal`** **Trade** button for **`friendly` + `npc.trade`**. **Debug spawn `Bobr`** seeds a **friendly** NPC with **`trade`** for manual testing.

### Rationale
The stub modal could not express stock, validation, or exchange logic; a single session model keeps tavern and floor merchants consistent under one cursor/drag pipeline and preserves the dithered **capture + portaled hits** contract.

### Consequences
- **`types.ts`**, **`reducer.ts`**, **`state/trade.ts`**, **`content/trading.ts`**, **`CursorProvider.tsx`**, **`CursorLayer.tsx`**, **`HudLayout.tsx`**, **`InventoryPanel.tsx`**, **`DitheredFrameRoot.tsx`**, **`NpcDialogModal.tsx`**, **`trade.test.ts`**; removed **`TavernTradeModal.tsx`**; **`DESIGN.md`** §5.1 / §6.2 / §7.5 / §11.

---

## ADR-0247 — `stageModalLayer` is non-interactive; trade panel forwards pointer chrome
Date: 2026-04-09

### Decision
- Set **`DitheredFrameRoot.module.css` `.stageModalLayer`** to **`pointer-events: none`**. Interactive modals already use **`createPortal(..., document.body)`** with **`modalPortalHitRoot`** (`pointer-events: auto`, high z-index) for real hits; the in-tree wrapper was an empty full-screen **`auto`** layer above **`.interactiveHud`**, so after the trade portal became pass-through for HUD inventory, events reached that wrapper first and **`HudLayout`’s `onPointerMove` never ran** (hand cursor / hover broke).
- On **`TradeModal`’s** outer **panel** shell (interactive), attach **`onPointerMove`**, **`onPointerCancel`**, and **`onPointerUp`** (same **`endPointerUp` → `drag/drop`** path as the viewport dismiss strip) so panel chrome and padding still drive the cursor and complete drags.

### Rationale
Preserves **ADR-0205** / **ADR-0087** intent (modals portaled for hits + dither parity) while matching the newer trade UX (HUD stays live under a selective portal).

### Consequences
- **`DitheredFrameRoot.module.css`**, **`TradeModal.tsx`**, **`DESIGN.md`** §11.

---

## ADR-0248 — `endPointerUp` returns `{ drop, promotedToDrag }` + sync ref
Date: 2026-04-09

### Decision
- Track drag promotion (**movement past threshold** or **140ms hold**) in **`dragPromotedRef`** updated synchronously alongside **`setState`**, and use that ref inside **`endPointerUp`** to decide **`drop`** (instead of **`state.dragging.started`**, which could still be **false** on **`pointerup` in the same frame** as **`pointerdown`**).
- Change **`CursorApi.endPointerUp`** to return **`PointerUpOutcome`**: **`{ drop, promotedToDrag }`**. **Trade** stock rows and **inventory** tap-to-stage use **`promotedToDrag`** plus a **release position vs `getBoundingClientRect()`** check (**ADR-0249**); stock **`pointerup`** uses **`stopPropagation`** so the **panel** shell does not call **`endPointerUp`** twice.

### Rationale
Fixes **trade/selectStock** and **trade/stageOfferFromInventory** feeling broken: **`preventDefault`** on **`pointerdown`** already removed **`click`**, and reading **`cursor.state.dragging.started`** before React flushed **`beginPointerDown`** made **`endPointerUp`** think the drag never promoted, while **`state.dragging.started`** inside **`endPointerUp`** could be stale the other way; the ref matches **`drop`** resolution exactly.

### Consequences
- **`CursorContext.ts`**, **`CursorProvider.tsx`**, **`TradeModal.tsx`**, **`InventoryPanel.tsx`**, **`HudLayout.tsx`**, **`NpcDialogModal.tsx`**, **`PaperdollModal.tsx`**, **`PortraitPanel.tsx`**.

---

## ADR-0249 — Trade merchant stock matches HUD inventory chrome
Date: 2026-04-09

### Decision
- **`TradeModal`** **their stock** reuses **`InventoryPanel.module.css`** (**`.grid`**, **`.slot`**, **`.item`**, **`.qty`**) with the same **`--inv-cols`** as **`party.inventory`**; **your offer** / **you request** are single **inventory-style** slots (**`exchangeInvSlot`** width clamp, dashed border when empty). Selected request row uses a light **outline** on the slot.
- **Tap-to-request / tap-to-offer** use **`getBoundingClientRect()`** on the **`.item`** button (see **ADR-0248** correction) instead of **`elementFromPoint`**.
- **`InventoryPanel.module.css`**: **`.item:disabled`** opacity for empty/disabled inventory-style buttons.

### Rationale
Keeps merchant stock visually and spatially consistent with the player grid; fixes unreliable **“still on control”** detection for trade taps.

### Consequences
- **`TradeModal.tsx`**, **`TradeModal.module.css`**, **`InventoryPanel.tsx`**, **`InventoryPanel.module.css`**, **`DESIGN.md`** §5.1.

---

## ADR-0250 — Trade portaled root: inline `pointer-events: none`, no inner pass-through shell
Date: 2026-04-09

### Decision
- On **`TradeModal`’s** **`createPortal`** wrapper (still using **`modalPortalHitRoot`** for **`z-index`** + **`opacity: 0`**), set **`style={{ pointerEvents: 'none' }}`** so **`pointer-events: none`** reliably overrides **`GamePopup`’s** **`modalPortalHitRoot { pointer-events: auto }`** regardless of CSS module bundle order.
- Drop the full-screen **`backdropPassThrough`** wrapper around the **panel**; render **`viewportDismiss`** + **`panel`** as **siblings** under the portaled root. Keep **`pointer-events: auto`** on the **panel** via merged **`panelStyle`** (and existing **`tradePanelInteractive`**) so **Close**, **Trade**, stock rows, and **Clear request** receive hits.

### Rationale
Users saw **dead** trade controls: when **`auto`** on the invisible full-screen root won, or when a **`pointer-events: none`** ancestor sat between root and panel, hit testing could fail in practice; **inline** **`none`** on the root plus **no** intermediate pass-through shell matches the intended “HUD stays live outside the panel” contract (**ADR-0247**) without starving the modal’s own buttons.

### Consequences
- **`TradeModal.tsx`**, **`TradeModal.module.css`**, **`DESIGN.md`** §11.

---

## ADR-0251 — Cursor move-drag promotion uses refs; trade/inventory dedupe `pointermove`
Date: 2026-04-09

### Decision
- In **`CursorProvider`’s** **`onPointerMove`**, detect **movement past the drag threshold** using **`pendingPayload.current`**, **`dragStartPos.current`**, and **`dragPromotedRef`** (not **`state.isPointerDown` / `state.dragging`** from the hook closure). Merge promotion into the same **`setState`** pass as hover updates; if React has not yet applied **`beginPointerDown`’s** **`dragging: { started: false }`**, synthesize **`dragging: { payload, started: true }`** from the pending ref.
- **`TradeModal`**: remove redundant **`onPointerMove` / `onPointerUp` / `onPointerCancel`** from the **offer/ask** slot shells and from the **staged-offer** button’s **`pointerup`** path—**one** **`endPointerUp`** on the **panel** handles drops onto **`tradeOfferSlot`**. Stock and staged-offer **`.item`** buttons call **`cursor.onPointerMove` then `stopPropagation`** so the **panel** does not handle the same move twice.
- **`InventoryPanel`**: same **`stopPropagation` after `onPointerMove`** on item buttons vs the grid wrapper.

### Rationale
Stale closure reads meant the **8px** movement gate often never fired until the **140ms** timer, which felt slow and unreliable after the first drag; nested handlers multiplied **`document.elementsFromPoint`** and **`setState`** work per move.

### Consequences
- **`CursorProvider.tsx`**, **`TradeModal.tsx`**, **`InventoryPanel.tsx`**, **`InventoryPanel.module.css`** (**.qty** **`pointer-events: none`**), **`DESIGN.md`** §6.2.

---

## ADR-0252 — Trade portal: no `modalPortalHitRoot` / no root `opacity: 0`
Date: 2026-04-09

### Decision
- Replace the interactive **`TradeModal`** **`createPortal`** wrapper (**`modalPortalHitRoot` + `tradePortalRoot` + inline `pointerEvents`**) with **`TradeModal.module.css` `.tradeInteractivePortalRoot`**: **`position: fixed; inset: 0; z-index: 10100; pointer-events: none; isolation: isolate`**, **without** **`opacity: 0`** on that node.
- Raise **`.tradePanelInteractive`** **`z-index`** (**`10`**) vs **`.viewportDismiss`** (**`1`**) so overlap always hits the panel.

### Rationale
With **`opacity: 0`** and **`pointer-events: none`** on the **same** full-screen root (as **`modalPortalHitRoot` + inline none** produced), some engines effectively **fail to hit-test descendants**, so **no** trade control (including **Close**) received **click**/**pointer** events.

### Consequences
- **`TradeModal.tsx`**, **`TradeModal.module.css`**, **`DESIGN.md`** §5.1 / §11.

---

## ADR-0253 — Trade invisible hit layers (`opacity: 0` + `auto`) under pass-through root
Date: 2026-04-09

### Decision
- Keep **`tradeInteractivePortalRoot`** as **`pointer-events: none`** without root **`opacity: 0`** (**ADR-0252**).
- Add **`opacity: 0`** to **`.viewportDismiss`** and to a new **`.tradePanelHitLayer`** wrapper around the interactive **panel**; both retain **`pointer-events: auto`** so the portaled trade UI stays **invisible** (dither + **`CursorLayer`** show through) while remaining clickable.

### Rationale
Removing root **`opacity: 0`** fixed hit-testing but made the trade **panel** render as normal opaque DOM above the hand cursor and undithered vs the presenter pipeline.

### Consequences
- **`TradeModal.tsx`**, **`TradeModal.module.css`**, **`DESIGN.md`** §5.1 / §11.

---

## ADR-0254 — Trade invisibility on `.tradePanelInteractive`, not a wrapper
Date: 2026-04-09

### Decision
- Remove **`tradePanelHitLayer`**. Apply **`opacity: 0`** (and **`z-index: 10`**) on **`.tradePanelInteractive`** (the same **`position: fixed`** root as the modal chrome).

### Rationale
A wrapper around a **`position: fixed`** panel does not expand to the panel’s box; it collapses (~**0×0**), so pointer hits fell through to **`.viewportDismiss`** and **`onClick`** with **`target === currentTarget`** closed the session on almost every click.

### Consequences
- **`TradeModal.tsx`**, **`TradeModal.module.css`**, **`DESIGN.md`** §5.1 / §11; revises the panel portion of **ADR-0253**.

---

## ADR-0255 — Trade: `tradePanelPositionShell` + in-flow panel (not `opacity` on fixed card)
Date: 2026-04-09

### Decision
- Replace **`.tradePanelInteractive`’s** **`opacity: 0`** on the **`position: fixed`** **`popup.panel`** root with **`tradePanelPositionShell`**: outer **`fixed`** + **`opacity: 0`** + viewport **`left`/`top`/`transform`**; inner **`panelChrome`** stays **in-flow** (no **`.modal`** **`position: fixed`**) so the shell sizes from content and hit-tests like **NpcDialog**’s subtree.

### Rationale
**ADR-0254**’s approach (opacity on the fixed panel) regressed to **dead** controls in some environments; **`opacity: 0`** on the same element as the fixed card is unreliable. A **fixed** invisible shell plus an **in-flow** panel avoids both the **0×0** wrapper pitfall and the flaky fixed+opacity node.

### Consequences
- **`TradeModal.tsx`**, **`TradeModal.module.css`**, **`DESIGN.md`** §5.1 / §11.

---

## ADR-0256 — Align portaled modal hits with capture layout (trade = full HUD; death/NPC = `npcCaptureLayer` padding)
Date: 2026-04-09

### Decision
- **Trade (`TradeModal`, interactive)**: measure **`interactiveHudRef`** (**`HudLayout` root**) for **`position: fixed`** panel anchoring and the invisible dismiss rect, matching **`captureFullHudOverlay` / `.fullHudCaptureLayer`** (not the 3D/hub cell ref alone).
- **Death + NPC dialog (interactive)**: derive the portaled shell rect from the **`.panel.game`** bounds minus the same padding as **`HudLayout.module.css` `.npcCaptureLayer`** (**`npcCaptureInteractiveRectFromGameViewportEl`**), matching **`captureNpcOverlay`** placement.

### Rationale
Runtime logs showed almost all **`pointerdown`** targets inside modal portals were **`DIV`** chrome (epitaph, stock grid, etc.), not **`BUTTON`**, while **`elementFromPoint`** matched the event target—so stacking was fine but **geometry** was wrong: users clicked where the **dithered** UI drew controls, while invisible DOM controls were offset. **Trade** visibility is rasterized from the **full HUD** overlay but interactive hits were anchored to the **center cell** only; **death/NPC** capture lives in **`npcCaptureLayer`** with **padding**, but interactive hits used the **full** viewport cell.

### Consequences
- New **`web/src/ui/hud/npcCaptureInteractiveRect.ts`**; **`DeathModal.tsx`**, **`NpcDialogModal.tsx`**, **`TradeModal.tsx`**, **`DitheredFrameRoot.tsx`**, **`DESIGN.md`**, **`TradeModal.module.css`** comment.

---

## ADR-0257 — No native `disabled` on invisible dual-DOM modal buttons (hit-test pass-through)
Date: 2026-04-09

### Decision
- On portaled **invisible** modal hit layers (**death**, **trade** stock + **Trade** action), avoid HTML **`disabled`** on **`button`** where the player still aims at the **dithered** bitmap of a control. Use **`aria-disabled`**, **`tabIndex`**, **`actionBtnDisabled` / dim styling**, and **early-return guards** in **`onClick`** / pointer handlers instead.

### Rationale
**`disabled`** controls are **skipped in hit testing**; **`pointerdown`** / **`click`** land on ancestor **`DIV`**s. The composited UI can still **look** like a button at that pixel, so the game felt “dead” while logs showed **`targetTag: "DIV"`** and no button handlers. **ADR-0256** alignment helped **Close** (always enabled) but not **Trade** / **Reload checkpoint** when gated off, nor **footer** clicks that missed the small enabled target.

### Consequences
- **`DeathModal.tsx`**, **`TradeModal.tsx`**, **`InventoryPanel.module.css`** (`.item[aria-disabled='true']`); **`DESIGN.md`** §6 / modal notes.

---

## ADR-0258 — `GamePopup` header/footer: center actions + pass-through pointer hits
Date: 2026-04-09

### Decision
- **`GamePopup.module.css`**: **`footer`** uses **`justify-content: center`** (was **`flex-end`**) and **`pointer-events: none`** with **`.footer > * { pointer-events: auto }`**. **`header`** uses **`pointer-events: none`** with **`.header > * { pointer-events: auto }`**.

### Rationale
Debug logs showed **`pointerdown`** on modal portals with **`targetTag: "DIV"`** at footer **y** while users aimed at **Trade** / **death** actions. **`flex-end`** left a wide **non-button** strip inside the footer flex box that remained the top hit target. **`space-between`** headers had a similar dead band between title and **Close**. Invisible dual-DOM modals make that feel like “dead” controls.

### Consequences
- **`GamePopup.module.css`** (title / trade / death / any shared **`popup.header`** / **`popup.footer`**); **`DESIGN.md`**.

---

## ADR-0259 — Stop `pointerup` bubble on modal buttons before parent `endPointerUp`
Date: 2026-04-09

### Decision
- Add **`stopModalPointerUpBubbleUnlessDragging`** (`web/src/ui/cursor/stopModalPointerUpBubble.ts`) and call it from **`onPointerUp`** on **trade** / **NPC dialog** / **paperdoll** chrome **`button`**s (when **`cursor.state.dragging?.started`** is false).

### Rationale
Those surfaces wrap content in a parent **`onPointerUp`** that calls **`cursor.endPointerUp`** (state updates during pointer-up). That interfered with the normal **`click`** sequence on child **`button`**s, so modal actions stayed **unreactive** even when hit-testing and layout were corrected (**ADR-0256**–**0254**).

### Consequences
- **`TradeModal.tsx`**, **`NpcDialogModal.tsx`**, **`PaperdollModal.tsx`**, **`DESIGN.md`**.

---

## ADR-0260 — Activate modal chrome on `pointerup` and dedupe synthetic `click`
Date: 2026-04-09

### Decision
- Replace **`stopModalPointerUpBubbleUnlessDragging`** with **`modalChromePointerUpActivate`** + **`modalChromeClickActivate`** in **`web/src/ui/cursor/modalChromeActivate.ts`**.
- On **`pointerup`** (primary button, not mid-drag): **`stopPropagation`**, run the action immediately, set a per-button **`suppressClickRef`**, clear it on the next animation frame.
- On **`click`**: **`stopPropagation`**; if the ref is set, **`preventDefault`** and skip the action (avoids double dispatch); otherwise run the action (keyboard / edge cases).

### Rationale
Stopping bubble alone still left cases where the synthetic **`click`** never reached the **`button`** after a parent handled **`pointerup`** (**`cursor.endPointerUp`**). The HUD already documents the same “lost synthetic **`click`**” class of bug for portrait taps; modal chrome now mirrors that pattern: **activate on `pointerup`**, tolerate missing **`click`**.

### Consequences
- **Removed** **`web/src/ui/cursor/stopModalPointerUpBubble.ts`**.
- **Wired** in **`TradeModal.tsx`**, **`NpcDialogModal.tsx`**, **`PaperdollModal.tsx`**, **`DeathModal.tsx`**, **`DESIGN.md`**.

---

## ADR-0261 — Modal chrome during drag + retarget under `pointer` capture
Date: 2026-04-09

### Decision
- **`modalChromePointerUpActivate`**: always **`stopPropagation`** on primary-button **`pointerup`**. If **`cursor.state.dragging?.started`**, call **`cursor.cancelDrag()`** then run the chrome action (no silent early return — that previously let parents handle **`pointerup`** and never activated the button).
- Mark portaled modal chrome **`button`**s with **`data-modal-chrome-hit`** (**`MODAL_CHROME_HIT_ATTR`**).
- **`CursorProvider.endPointerUp`**: after normal teardown, **`queueMicrotask`** + **`elementFromPoint`**: if the top hit is a marked chrome **`button`** and the **`pointerup`** **`target`** is not that button, **`hit.click()`** so **`click`** handlers run when capture targeted a drag source.

### Rationale
Drags use **`setPointerCapture`**, so **`pointerup`** can be delivered to the captured node while the cursor is visually over modal chrome. Separately, an active drag that *did* deliver **`pointerup`** to chrome previously hit the **`dragging?.started`** early return without **`stopPropagation`**, so **`endPointerUp`** on ancestors still ran and the chrome action did not.

### Consequences
- **`modalChromeActivate.ts`**, **`CursorProvider.tsx`**, modal **`button`**s in **`TradeModal`**, **`NpcDialogModal`**, **`PaperdollModal`**, **`DeathModal`**, **`DESIGN.md`**.

---

## ADR-0262 — Stop `pointerup` bubble after `endPointerUp` on nested modal surfaces
Date: 2026-04-09

### Decision
- **`TradeModal`**: after **`endPointerUp`** on the **panel** wrapper (`panelPointerChrome`), call **`e.stopPropagation()`** so the same **`pointerup` does not reach **`tradeGameOverlay`** (which also called **`endPointerUp`**).
- **`PaperdollModal`**: equipment **`onPointerUp`** (after **`endPointerUp`**) **`stopPropagation`** so the **backdrop** does not run **`endPointerUp`** a second time.
- **`CursorProvider.endPointerUp`**: run modal-chrome **retarget** (`elementFromPoint` + **`hit.click()`**) only when **`hadPointerSession`** (`pendingPayload` was non-null), avoiding spurious chrome activation from unrelated **`endPointerUp`** callers (e.g. **DebugPanel**).

### Rationale
A second **`endPointerUp`** on the same **`pointerup`** ran with **refs/state already cleared**, corrupting cursor bookkeeping and leaving modal chrome unreliable (interactive **trade** nests **panel** inside **overlay**; **paperdoll** nests **panel** inside **backdrop**).

### Consequences
- **`TradeModal.tsx`**, **`PaperdollModal.tsx`**, **`CursorProvider.tsx`**, **`DESIGN.md`**.

---

## ADR-0263 — Interactive `TradeModal` in `HudLayout` game cell (inventory depth)
Date: 2026-04-09

### Decision
- Render **`TradeModal variant="interactive"`** inside **`HudLayout`**’s **`.panel.game`** (sibling stack above **`HubViewport`** / **`GameViewport`**), with **`tradeGameOverlay`** (**`position: absolute; inset: 0`**) and **`tradePanelInGameCell`** for the **`popup.panel`** — **no** **`createPortal(..., document.body)`**, no **`tradeInteractivePortalRoot`** / **`viewportDismiss`** / **`tradePanelPositionShell`**.
- Keep **`TradeModal variant="capture"`** in **`captureFullHudOverlay`** only; **remove** interactive **trade** from **`DitheredFrameRoot`’s `stageModalLayer`** and from the **`stageModalLayer`** mount condition (**`tradeModalOpen`** remains only for choosing capture overlay content).

### Rationale
Body-portaled trade hit layers fought **`opacity`**, **`pointer-events`**, and **client-rect** alignment vs the dithered **full-HUD** capture. Mounting trade **in the same `interactiveHud` subtree as `InventoryPanel`** uses **stage-local** coordinates, matches **scale**, and avoids a separate **z-index 10100** stack.

### Consequences
- **`TradeModal.tsx`**, **`TradeModal.module.css`**, **`HudLayout.tsx`**, **`DitheredFrameRoot.tsx`**, **`DitheredFrameRoot.module.css`**, **`DESIGN.md`** §5.1 / §11; supersedes interactive body-portal trade geometry described in **ADR-0250**–**ADR-0255** for the **interactive** path (capture + dual-DOM unchanged).

---

## ADR-0264 — Octopus door tiles, door-open VFX, combat attack cursor, well glow in `Content/`
Date: 2026-04-10

### Decision
- Add **`doorOctopus`** / **`lockedDoorOctopus`** **`Tile`** values (mirroring **`door`** / **`lockedDoor`** for walkability, clicks, and key unlock). Helpers live in **`web/src/game/tiles.ts`**; procgen **`placeLocksOnPath`** writes **`lockedDoorOctopus`** on a deterministic RNG subset, with higher probability when **`floorProperties`** includes **`Infested`**.
- **3D**: closed billboards use **`door_octopus_closed.png`** for octopus tiles; **`ui.doorOpenFx`** carries **`visual: 'wooden' | 'octopus'`** with **420 ms** vs **900 ms** duration; **`WorldRenderer.syncDoorFx`** cycles **`door_octopus_opening_01..03.png`** at **~280 ms** per frame for octopus.
- **Cursor**: combat **attack** telegraph uses alternating **`hand_attack_01.png` / `hand_attack_02.png`** when hovering a valid in-encounter NPC with a resolved weapon (and when drag affordance is **Attack**).
- Ship **`npc_well_glow.png`** under repo **`Content/`** (was only under **`web/public/content/`**) so **Vite** production **`dist/content`** matches **`POI_WELL_GLOW_SRC`**.

### Rationale
New art in **`Content/`** needed first-class types and rendering paths instead of overloading a single door texture; attack hands reinforce combat affordance; well glow must exist in the canonical content tree the build copies.

### Consequences
- **`types.ts`**, **`tiles.ts`**, **`reducer.ts`**, **`locks.ts`**, **`generateDungeon.ts`**, **`validate.ts`**, **`shapeRooms.ts`**, **`layoutPasses.ts`**, **`WorldRenderer.ts`**, **`GameViewport.tsx`**, **`CursorLayer`**, minimap **CSS**, **`Content/npc_well_glow.png`**, **`DESIGN.md`** §3 / §6 / doors; **`CharacterEquipStrip`** **`endPointerUp`** outcome updated to **`PointerUpOutcome.drop`** (type fix).

---

## ADR-0265 — Title / death / paperdoll interactive hits in `HudLayout` (not `document.body`)
Date: 2026-04-10

### Decision
- **Interactive** **`TitleScreen`**, **`DeathModal`**, and **`PaperdollModal`** render **inside** **`HudLayout`**: **`fullHudInteractiveLayer`** (full-bleed over the HUD grid) for title and paperdoll; **`gameCellModalHitLayer`** in **`.panel.game`** for death (**same padding** as **`npcCaptureLayer`**, **`z-index: 7`** above interactive **trade**).
- **Remove** **`createPortal(..., document.body)`** and **`modalPortalHitRoot`** from those three; **remove** **`DeathModal`** **`gameViewportRef`** / **`ResizeObserver`** / fixed shell.
- **`DitheredFrameRoot`’s `stageModalLayer`** mounts **`NpcDialogModal`** only (still body-portaled). **Capture** paths unchanged (**`captureNpcOverlay`**, **`captureFullHudOverlay`**).

### Rationale
Body-portaled invisible hit layers were unreliable for clicks; mounting in the same scaled-stage subtree as **`TradeModal`** / inventory aligns hit geometry with **`html2canvas`** capture and matches the pattern that already worked for trade (**ADR-0263**).

### Consequences
- **`DeathModal.tsx`**, **`TitleScreen.tsx`**, **`PaperdollModal.tsx`**, **`HudLayout.tsx`**, **`HudLayout.module.css`**, **`DitheredFrameRoot.tsx`**, **`DitheredFrameRoot.module.css`**, **`npcCaptureInteractiveRect.ts`** comment, **`GamePopup.module.css`** comment, **`DESIGN.md`**.
- **Partially supersedes** the **interactive** body-portal story in **ADR-0205** for title / death / paperdoll; **NPC dialog** unchanged.

---

## ADR-0266 — Player spawn: BFS to plain floor + hub enter resnap
Date: 2026-04-10

### Decision
- **`pickPlayerSpawnCell`** (**`web/src/game/state/playerFloorCell.ts`**) uses **BFS** from **`gen.entrance`**: traverse only **orthogonal** steps through tiles that are **`floor` or any door**, skipping **POI-occupied** cells (same occupancy rule as **`player/step`**); the **first** dequeued cell with **`tile === 'floor'`** (and thus not POI, since POI cells are never enqueued) is the spawn. Fast-path if **`entrance`** is already plain **`floor`** without a POI. If **`entrance`** is POI-blocked, seed the queue from **orthogonal neighbors** when the entrance itself cannot be enqueued. If BFS finds nothing, fall back to **`nearestFloorCellWithoutPoi`**.
- **`hub/enterDungeon`** applies **`snapViewToGrid`** for the current **`floor.playerPos` / `playerDir`** and **`render.camEyeHeight`** so the camera is aligned when switching from the **hub** to the **game** screen (clears any **`view.anim`** via **`snapViewToGrid`**).

### Rationale
**`gen.entrance`** can be a **door** tile (**`isGoodSpawn`** uses **`isWalkable`**, which includes doors). Spawning on a **door** left the **3D** camera inside the **door billboard** (“stuck in geometry”), especially noticeable when first entering the dungeon from the **village hub**. Spawning on the **nearest reachable plain floor** matches **`attemptMoveTo`** stand tiles and avoids the mesh overlap.

### Consequences
- **`playerFloorCell.ts`**, **`reducer.ts`** (**`hub/enterDungeon`**), **`playerFloorCell.test.ts`**; **`DESIGN.md`** §6.4 / §8.2 / §8.3 **First load**; **ADR-0230** spawn bullet is **superseded** for **regen / descend / initial gen** (checkpoint reload unchanged).

---

## ADR-0267 — Spawn fallback must not return door; relaxed BFS + hub geom refresh
Date: 2026-04-10

### Decision
- When **strict** **`pickPlayerSpawnCell`** BFS finds no plain **`floor`**, run a **relaxed** BFS that may **enqueue POI-occupied** tiles (still only **returns** **`floor` && !POI**), then require **`nearestFloorCellWithoutPoi`** to be plain **`floor`** before using it, else **row-major scan** for any plain **`floor`**. This removes the previous fallback that returned **`gen.entrance`** unchanged when it was a **door** and had no POI (which reproduced **door** spawns and **“solid stone”** bumps).
- **`hub/enterDungeon`** also increments **`floor.floorGeomRevision`** so **`WorldRenderer`** rebuilds dungeon meshes after the **hub** 3D pass used a different **viewport** size for the same floor state.

### Rationale
A **door** entrance with **all** strict neighbors **POI**-blocked left **no** strict BFS target; **`nearestFloorCellWithoutPoi`** then returned the **door** because the blocked set only keyed **POIs**, not **non-floor** tiles. **Relaxed** search finds interior **`floor`** without changing in-run walking rules. Refreshing geometry addresses residual **camera / mesh** mismatch reports when switching **hub → game**.

### Consequences
- **`playerFloorCell.ts`**, **`playerFloorCell.test.ts`**, **`reducer.ts`**, **`DESIGN.md`** §6.4.

---

## ADR-0268 — Smash opened barrel/crate to clear blocking tile
Date: 2026-04-10

### Decision
- A **second** interaction (**click** or **item dragged onto** the POI) on an **already opened** **Barrel** or **Crate** **removes** that POI from the floor, **increments** **`floorGeomRevision`**, and plays feedback (**shake**, **`pickup`** SFX, activity log). **Chest** unchanged (still only reports empty when opened).

### Rationale
**Open** barrels and crates still **occupy** their grid cell (**`poiOccupiesCell`** ignores **`opened`**), which blocked **walking** through that tile; letting the player **clear** the wreckage matches the visual of a broken container and restores **pathing** without new art (billboard simply disappears).

### Consequences
- **`web/src/game/state/poi.ts`** (`applyPoiUse`), **`web/src/game/state/poi.test.ts`**, **`DESIGN.md`** §9 (Barrel / Crate bullets).

---

## ADR-0269 — Procgen lock placement uses lock-blocking reachability
Date: 2026-04-10

### Decision
- **`separatesExit`** and the two-lock probe in **`web/src/procgen/locks.ts`** use **`allReachableWithLocks(..., { lockedDoorsAreWalkable: false })`** instead of **`allReachable`**, so a probe **`lockedDoor`** cell actually blocks BFS.
- **`validateGen`** (when any procgen locks exist) uses **`shortestPathLatticeStatsWithLocks`**, **`allReachableWithLocks`** for partial-open simulations, and **`bfsDistancesWithLocks`** for Well/Bed distance from **`entrance`**, all with **`lockedDoorsAreWalkable: false`**, matching gameplay.
- **`web/src/procgen/validate.ts`** adds **`bfsDistancesWithLocks`** and **`shortestPathLatticeStatsWithLocks`**; existing **`bfsDistances`** / **`shortestPathLatticeStats`** stay unchanged for other callers.
- **`web/src/procgen/locks.test.ts`** covers a corridor “bridge” map so **`placeLocksOnPath`** places at least one lock when the path is long enough.

### Rationale
**`isWalkable`** treats every door tile (including locked) as traversable for generic graph metrics. **`separatesExit`** temporarily set a cell to **`lockedDoor`** but still called **`allReachable`**, so connectivity never changed and **`placeLocksOnPath`** almost always returned no doors. Validation had the same mismatch for lock-aware puzzles.

### Consequences
- Locked wooden and octopus doors can appear again on valid floors; stricter validation may reject more attempts (bounded rerolls + last-attempt fallback unchanged). **`layoutScore`** lattice/branch bonuses still use the pre-lock walkability model as before.


---

## ADR-0270 — More common procgen locked doors
Date: 2026-04-10

### Decision
- Lower **`lockThresholds`** min path lengths: easy **8** / **12** (was 10 / 14), normal **4** / **11** (was 6 / 14), hard **4** / **9** (was 5 / 11).
- **`validateGen`** lock lattice rule: require **`latticeCells > shortestLen + 1`** instead of **`> shortestLen + 2`** (still blocks a pure 1-wide spine; accepts one step thinner bands).
- **`shortestPathIndices`** accepts optional **`pathChoiceRng`**: **`placeLocksOnPath`** passes the **locks** stream so BFS tie-breaking among equal-length shortest paths is seeded, improving odds a chosen path contains a **cut** cell for **`separatesExit`**.

### Rationale
After fixing lock-aware reachability, doors were still rare because many layouts have **no** articulation on the canonical shortest path, validation rejected thin lattices, and minimum path length excluded shorter runs.

### Consequences
- **`web/src/procgen/locks.ts`**, **`DESIGN.md`** §8.1 / §8.2 / §8.3; other callers of **`shortestPathIndices`** unchanged (no RNG → deterministic neighbor order).

---

## ADR-0271 — Reskin-first floor expansion via layout profiles
Date: 2026-04-10

### Decision
Add six **`FloorType`** values (**`Jungle`**, **`LivingBio`**, **`Bunker`**, **`Catacombs`**, **`Golem`** (shipped historically as **`MagicalNano`**), **`Palace`**) that **do not** get bespoke generators yet. Each maps through **`layoutProfile(floorType)`** to reuse **Cave**, **Ruins**, or **Dungeon** procgen (including door frames only on the Dungeon profile, junction caps keyed off profile). Differentiation uses **per-type theme pools**, **env texture mapping** (often aliased to existing PNG triples), **music**, **spawn bias**, and **debug / descent cycling** through all nine types.

### Rationale
Ships a wider fantasy palette without multiplying layout bugs or validation surface; keeps determinism and save/debug ids stable. Art can replace aliased textures later without changing topology rules.

### Consequences
- **`web/src/procgen/floorLayoutProfile.ts`**, **`generateDungeon.ts`**, **`shapeRooms.ts`**, **`floorTheme.ts`**, **`dungeonEnvTextures.ts`**, **`floorProgression.ts`**, **`DESIGN.md`** §8. Bespoke generators remain future work.

---

## ADR-0272 — Room hazards, statuses, NPC/items/recipes expansion + NPC billboard tuning
Date: 2026-04-10

### Decision
- Extend **`roomProperties`** with **SporeMist**, **NanoHaze**, **Unstable**, **Haunted**, **RoyalMiasma**; wire **decals**, **HUD telegraph**, **`applyRoomHazardOnEnter`**, **districts/spawn/population** nudges, and debug telegraph modes.
- Add **StatusEffectId** values **NanoTagged**, **Spored**, **Parasitized** with **DEFAULT_STATUSES**, feed/remedy hooks, and light **encounter** modifiers (PC to-hit / defense).
- Add **twelve** **`NpcKind`** values with **combat**, **loot**, **sprites** (placeholder paths), **spawn tables**, and **population** hostility hints.
- Add **items** and **recipes** (light/food/bio/bone line); **procgen** tables + **allowlist** for craft-only ids; extend **NPC quest want** pools in **`population.ts`** (constants live beside **`spawnNpcsAndItems`**, not **`spawnTables`**, to avoid circular imports).
- Replace flat **`npcGroundY_*` / `npcSize_*`** render keys with **`render.npcBillboard: Record<NpcKind, { groundY, size, sizeRand }>`**, **legacy JSON merge** for old **`debug-settings.json`**, and F2 sliders for **every** kind.

### Rationale
One vertical slice ties content to systems players see (hazards, combat, crafting, debug tuning). Table-driven NPC tuning scales to **17** kinds without growing **WorldRenderer** if-chains. Status combat hooks stay minimal but make new debuffs mechanically meaningful.

### Consequences
- **`hazardDefs.ts`**, **`WorldRenderer.ts`**, **`DitheredFrameRoot.tsx`**, **`reducer.ts`**, **`districtsTags.ts`**, **`population.ts`**, **`spawnTables.ts`**, **`types.ts`**, **`statuses.ts`**, **`interactions.ts`**, **`combat.ts`**, **`items.ts`**, **`recipes.ts`**, **`npcCombat.ts`**, **`npcLoot.ts`**, **`npcDefs.ts`**, **`npcBillboardTuning.ts`**, **`DebugPanel.tsx`**, **`debug-settings.json`**, **`DESIGN.md`** §7 / §8 / §11.

---

## ADR-0273 — Room hazards once per visit; Moss feed for NanoTagged
Date: 2026-04-10

### Decision
- **Room hazards**: track **`floor.roomHazardAppliedForRoomId`** so **`applyRoomHazardOnEnter`** runs **once per procgen-room visit** (first step into a tagged room or when the party is **spawned** there after **initial state**, **new run**, **regen**, **descend**, or **Exit** POI). Leaving a tagged room clears the guard so **re-entry** triggers again. Walking **within** the same room does **not** re-run HP chips or rolls each tile.
- **Moss**: give **`Moss`** a neutral **`feed`** entry (and **`food`** tag) so portrait **feed** reaches the existing **`NanoTagged`** remedy branch in **`feedCharacter`** (previously blocked by “refuse to eat” when **`!def.feed`**).

### Rationale
Per-tile hazard application matched neither the design intent (“on entering a room”) nor readable balance. **Moss** was documented as a remedy but could never be fed.

### Consequences
- **`web/src/game/types.ts`**, **`web/src/game/reducer.ts`**, **`web/src/game/state/floorProgression.ts`**, **`web/src/game/content/items.ts`**, **`DESIGN.md`** (room-hazard gameplay bullet).

---

## ADR-0274 — Portrait shake on NPC hit damage
Date: 2026-04-10

### Decision
When **`npcTakeTurn`** resolves a **hit** against a PC, set **`ui.portraitShake`** for **that** character’s id (same transform and **`RenderTuning`** envelope/HZ/amplitude as inspect/feed). Use **`state.nowMs`** for **`startedAtMs` / `untilMs`**. Base magnitudes: **0.18** normal hit, **0.24** on **nat 20**; duration **`max(180ms, portraitShakeLengthMs + portraitShakeDecayMs)`**. Existing **`applyUiShake`** on hits is unchanged.

### Rationale
Reuses the proven portrait feedback channel instead of a parallel effect; ties the wiggle to the **victim** so multi-character parties read clearly.

### Consequences
- **`web/src/game/state/combat.ts`**, **`web/src/game/state/combat.test.ts`**, **`web/src/game/types.ts`** (comments), **`DESIGN.md`** §6.3 / §7.1.

---

## ADR-0276 — Camp hubs, segment floor typing, `Golem` floor type
Date: 2026-04-10

### Decision
- **Mid-run camp**: After every **`campEveryFloors`** completed dungeon floors (**default 10**, F2 **`RenderTuning.campEveryFloors`**), descending (Exit POI or debug) **pre-generates** the next floor, applies normal **+12 XP**, sets **`ui.screen === 'hub'`**, **`hubScene === 'village'`**, **`ui.hubKind === 'camp'`**, and clears **`run.hubInnkeeperTradeStock`** so the camp merchant uses **`CAMP_INNKEEPER_TRADE`**. **`hub/enterDungeon`** clears **`hubKind`** and enters 3D with the already-generated floor (mirrors starting village).
- **Segment typing**: **`floorType`** for floor index **`i`** is **`FLOOR_TYPE_ORDER[floor(i / N) % 9]`** with **`N = clamp(campEveryFloors)`** and order **Cave → Ruins → Dungeon → Jungle → Catacombs → Palace → Bunker → LivingBio → Golem**. Replaces **per-descent** cycling of **`floorType`**.
- **Difficulty by segment**: segments **0–1** → **`0`**, **2–4** → **`1`**, **5+** → **`2`** (**`FloorGenDifficulty`**).
- **Rename**: **`FloorType` `MagicalNano` → `Golem`** (same layout profile and nano-themed assets/spawns until bespoke art).
- **Camp art**: Duplicate PNGs under **`Content/camp_*.png`** (copies of village/tavern/bartender assets) served at **`/content/camp_*.png`**.

### Rationale
Gives predictable pacing and thematic escalation without new procgen realizers; camp reuses proven hub UX. **`Golem`** matches player-facing vocabulary; behavior stays aligned with the former nano reskin.

### Consequences
- **`runFloorSchedule.ts`**, **`floorProgression.ts`**, **`initialState.ts`**, **`types.ts`** (**`hubKind`**, **`campEveryFloors`**), **`trade.ts`**, **`trading.ts`**, **`HubViewport.tsx`**, **`reducer.ts`**, **`DebugPanel.tsx`**, **`procgen/types.ts`**, **`floorLayoutProfile.ts`**, **`floorTheme.ts`**, **`spawnTables.ts`**, **`dungeonEnvTextures.ts`**, **`musicTracks.ts`**, **`Content/camp_*.png`**, **`runFloorSchedule.test.ts`**, **`DESIGN.md`** §8.1.

---

## ADR-0275 — Main menu at cold start; Escape settings menu
Date: 2026-04-10

### Decision
- **Bootstrap**: **`makeInitialState`** uses **`ui.screen: 'title'`** (was **`game`**) so **`TitleScreen`** shows on first paint.
- **`ui.settingsOpen`** + actions **`ui/toggleSettings`** / **`ui/setSettingsOpen`**: when **`true`**, an early reducer guard blocks gameplay (same allowlist idea as title/hub/death gates). Clear **`settingsOpen`** on **`ui/goTitle`**, **`run/new`**, and **`run/reloadCheckpoint`**.
- **Settings UI**: **`SettingsMenu`** in **`DitheredFrameRoot`** **`stageModalLayer`** (above **`interactiveHud`**); **capture** tree renders **`SettingsMenu`** alongside title/paperdoll/trade when open. Sliders use existing **`audio/set`** (persisted with F2 tuning via **`debugSettingsPersistence`**).
- **Title screen**: primary label **Start**; **Quit** uses **`quitApplication()`** (**`window.close()`** then **`location.replace('about:blank')`**).
- **Escape** in **`GameApp`**: **`stateRef`** + priority **settings → NPC dialog → paperdoll → trade → toggle settings**.

### Rationale
Ships a conventional main menu and pause/settings without a second audio state: player volume and dev sliders stay aligned. **`stageModalLayer`** already hosted NPC dialog; settings stacks above it so pause is reachable over modals when appropriate, while Escape ordering closes the topmost blocking UI first.

### Consequences
- **`web/src/game/types.ts`**, **`web/src/game/state/initialState.ts`**, **`web/src/game/reducer.ts`**, **`web/src/app/GameApp.tsx`**, **`web/src/ui/frame/DitheredFrameRoot.tsx`**, **`web/src/ui/settings/*`**, **`web/src/ui/title/TitleScreen.tsx`**, **`web/src/game/state/combat.test.ts`**, **`DESIGN.md`** §5.1 / §6.4.

---

## ADR-0277 — Global cursor pointermove; game-only 3D virtual hover; title/settings hand-active
Date: 2026-04-10

### Decision
- **`CursorProvider`**: extract **`applyPointerMove(x, y)`**; subscribe to **`window` `pointermove`** (**`passive: true`**) so pointer position and DOM hover update outside **`HudLayout`** (e.g. **Settings** in **`stageModalLayer`**). Remove redundant **`onPointerMove={cursor.onPointerMove}`** from HUD/modal widgets so virtual-hover ordering stays correct (**`HudLayout`** **`setVirtualHover`** in the same tick, then the **`window`** listener consumes the ref).
- **`HudLayout`**: run **3D pick / `floorDrop` virtual hover** only when **`ui.screen === 'game'`** (was “not hub”, which still ran on **title**).
- **`CursorLayer`**: treat **`data-cursor-hand-active`** (on **Title** / **Settings** buttons) as **`Hand_Active`** when hit-testing with **`elementFromPoint`**.

### Rationale
Settings and other stage modals are siblings of **`.interactiveHud`**; pointer moves there never reached **`HudLayout`**, so the custom hand lagged or froze. Pinning **`floorDrop`** on the title screen kept **`hoverTarget`** non-interactive for **`Hand_Active`**. A single global move path avoids duplicate ref churn and preserves **`setVirtualHover`** semantics.

### Consequences
- **`web/src/ui/cursor/CursorProvider.tsx`**, **`CursorLayer.tsx`**, **`cursorHandActiveAttr.ts`**, **`HudLayout.tsx`**, **`TitleScreen.tsx`**, **`SettingsMenu.tsx`**, and removal of move forwarding from **viewport / inventory / portraits / trade / death / NPC dialog / paperdoll / debug** panels. **`DESIGN.md`** §6.1 / §6.2.

---

## ADR-0278 — Innkeeper trade layout, chrome, mojibake speech, expanded Trade outcomes
Date: 2026-04-10

### Decision
- **`TradeModal`**: single **row** for **their stock** + **your offer** + **you request**; **offer/request** slots match **inventory** slot visuals and cell sizing (measured from the stock grid width). **Trade** stays in the **footer**; **Close** in the **header**; both use **`GamePopup.close`** styling with **inventory-slot** border color.
- **`ui.hubInnkeeperSpeech`**: mojibake lines for **hub/camp innkeeper** when setting **you request** (3 vs 5 “words” + template variants) and on **Trade** (**4-word** templates; **gift** path includes a **garbled heart**). **Floor NPC** trade uses the same **execute** mechanics but **no** speech.
- **`trade/execute`**: **no-op** if both slots empty; **speech-only** if only request; **consume offer only** if only offer; **full barter** if both (existing stock decrement + mint item). **`tryConsumeStagedOfferOnly`** in **`trade.ts`**.

### Rationale
Clearer shop layout; innkeeper feedback matches the NPC **speech strip** aesthetic; **Trade** always clickable; **gift** supports offering payment without picking stock.

### Consequences
- **`TradeModal.tsx` / `.module.css`**, **`types.ts`**, **`trade.ts`**, **`reducer.ts`**, **`floorProgression.ts`**, **`gibberish.ts`**, **`innkeeperTradeMojibake.ts`**, **`trade.test.ts`**, **`DESIGN.md`** §5.1.

---

## ADR-0279 — Innkeeper trade speech: `document.body` portal (no HUD hit blocking)
Date: 2026-04-10

### Decision
Render **hub innkeeper** **`ui.hubInnkeeperSpeech`** via **`createPortal`** to **`document.body`** (**`InnkeeperTradeSpeechPortal.tsx`**: **`position: fixed`**, **`z-index: 10050`**, **`pointer-events: none`**, same **`npcCaptureInteractiveRectFromGameViewportEl`** bottom anchoring as **NPC dialog** speech). Do **not** mount a full-bleed layer inside **`.panel.game`**.

### Rationale
**`DitheredFrameRoot`’s** **`interactiveHud`** is **`opacity: 0`** but receives hits; a full-screen speech layer inside the game cell risked blocking **Trade** / **Close** despite **`pointer-events: none`** on the wrapper. Portaling only the caption strip keeps the invisible HUD hit tree unobstructed while keeping speech above the composited canvas visually.

### Consequences
- **`InnkeeperTradeSpeechPortal.tsx`**, **`HudLayout.tsx`**, **`TradeModal.tsx` / `.module.css`** (capture-only speech), **`DESIGN.md`** §5.1.

---

## ADR-0280 — Global `pointerup` microtask retarget for `[data-modal-chrome-hit]`
Date: 2026-04-10

### Decision
Remove the **`hadPointerSession`** gate from **`endPointerUp`’s** modal-chrome **`click()`** synthesis (and remove that microtask entirely). Register a **`window` `pointerup` (capture)** listener in **`CursorProvider`** that **`queueMicrotask`s** an **`elementFromPoint`** test: if the top hit under the release coordinates is an enabled **`HTMLButtonElement`** matching **`[data-modal-chrome-hit]`** and the **`pointerup`’s `target`** is **not** contained in that button, call **`chromeBtn.click()`**. If the target **is** inside that button, do nothing so normal **`pointerup` + `modalChromePointerUpActivate`** paths do not double-fire.

### Rationale
Retargeting only when **`pendingPayload != null`** missed cases where **`pointerup` never reached** the chrome control (capture / stacking) **without** a drag session, and **`endPointerUp`’s** microtask never ran when chrome **`stopPropagation`** prevented **`HudLayout`** / panel handlers from running. A **single global** post-**`pointerup`** microtask matches release **coordinates** to chrome regardless of which node received the event, while **`contains(origTarget)`** preserves deduping when the button already got the real **`pointerup`**.

### Consequences
- **`CursorProvider.tsx`**, **`modalChromeActivate.ts`** (remove debug ingest **`fetch`**), **`DESIGN.md`** §11 modal bullet.

---

## ADR-0281 — Innkeeper speech TTL, MBA trade log, barter remainder, log stacking
Date: 2026-04-10

### Decision
- **`InnkeeperTradeSpeechPortal`**: after **2 s** with the same **`text`**, dispatch **`ui/clearHubInnkeeperSpeech`** (innkeeper/camp strip only).
- **`run.hubInnkeeperTradesCompleted`**: increment on each successful **hub** **`trade/execute`** full barter; **`pushActivityLog`** uses **`innkeeperBarterActivityLogLine(1..10)`** then **`Deal has been done.`** for **11+** (**`innkeeperBarterLog.ts`**). **Floor NPC** barter keeps **`Trade complete.`**
- **`tryExecuteTrade`**: if **`consumeItem`** leaves a **remainder stack** in **`party.items`**, keep **`offerItemId`** on the session instead of forcing **`null`** (avoids orphaned items when **qty > 1**).
- **`HudLayout`**: **`gameCornerStackAboveTrade`** (**z-index: 8**) when **hub** + interactive trade is open so the log is visible over the trade overlay (default stack stays **z-index: 2** so **death** at **7** still wins).

### Rationale
Players need readable **activity** feedback during tavern trade; timed speech avoids clutter; MBA lines reward repeat barter; remainder fix matches **1 unit per Trade** semantics; z-index targets innkeeper trade without covering **death**.

### Consequences
- **`innkeeperBarterLog.ts`**, **`types.ts`**, **`trade.ts`**, **`reducer.ts`**, **`InnkeeperTradeSpeechPortal.tsx`**, **`HudLayout.tsx` / `.module.css`**, **`trade.test.ts`**, **`DESIGN.md`** §5.1.

---

## ADR-0282 — Activity log descendants `pointer-events: none` when stacked above trade
Date: 2026-04-10

### Decision
In **`ActivityLog.module.css`**, set **`.wrap * { pointer-events: none }`** in addition to **`.wrap { pointer-events: none }`**.

### Rationale
With **`gameCornerStackAboveTrade`** (**z-index: 8** over trade’s **6**), log **lines** still used the initial **`pointer-events: auto`** and could sit above the **Trade** button after **long** entries (e.g. MBA copy). Clicks hit the **log** instead of **`[data-modal-chrome-hit]`**, so **Trade** failed once **offer** + **request** were set and the player tried to finish—exactly when the log was busiest. **`CombatIndicator`** is a **sibling** (not under **`.wrap`**) and keeps its own **Defend** / **Flee** **`pointer-events: auto`** on **`.actions`**.

### Consequences
- **`ActivityLog.module.css`**, **`DESIGN.md`** §6.3 activity bullet.

---

## ADR-0283 — Trade UI: drop “you request” slot; stock is click-only selection
Date: 2026-04-10

### Decision
Remove the **You request** column and **`data-drop-kind="tradeAskSlot"`** from **`TradeModal`**. **Their stock** uses **`onClick`** → **`trade/selectStock`** only (no **`beginPointerDown`** / drag from stock). Remove **`DragSource` `tradeStockSlot`** and **`DragTarget` `tradeAskSlot`** from **`types.ts`**; delete reducer **`drag/drop`** branches and **`CursorProvider` / `CursorLayer`** affordances tied to stock→ask. **Selected** stock keeps **`askStockIndex`** in session; **`.stockSlotSelected`** uses **`outline: 1px`** + **`outline-offset: 3px`**. **`trade/selectStock`** on the **same** index as the current selection dispatches **`tryClearTradeAsk`** (toggle off); **`trade/clearAsk`** retained.

### Rationale
One less column and no drag-to-slot flow; selection is explicit click; borders match the requested **1 px / 3 px** treatment via outline + offset.

### Consequences
- **`TradeModal.tsx` / `.module.css`**, **`types.ts`**, **`reducer.ts`**, **`CursorProvider.tsx`**, **`CursorLayer.tsx`**, **`trade.test.ts`**, **`DESIGN.md`** §5.1 / §6.2.

---

## ADR-0284 — Trade stock selection: visible 4px border + copy tweak
Date: 2026-04-10

### Decision
**`.stockSlotSelected`**: **4 px** solid bright border + soft outer glow (higher-specificity selector **`.tradeStockGridInv .stockSlotSelected`** so it overrides **`InventoryPanel` `.slot`**’s **2 px** border). Section label: **“Their stock — Click to choose what you want to barter”**.

### Rationale
Outline-only styling was easy to miss against the default slot chrome; explicit **4 px** + brighter color makes selection obvious.

### Consequences
- **`TradeModal.tsx`**, **`TradeModal.module.css`**, **`DESIGN.md`** §5.1.

---

## ADR-0285 — Trade: prune zero-qty stock rows; shorter innkeeper trade speech
Date: 2026-04-10

### Decision
After **`tryExecuteTrade`** decrements a merchant row, **`filter((r) => r.qty > 0)`** updates persisted **hub** stock and **floor NPC** **`trade.stock`** (and the open **`hub_innkeeper`** session’s **`stock`** snapshot). **Innkeeper** trade mojibake helpers emit **at most two** procedural words (no multi-word paragraphs; gift line no longer adds a heart symbol).

### Rationale
A single-unit offer should disappear from **their stock** instead of leaving a dead **qty 0** cell. Shorter gibberish matches the requested **1–2 word** feel for innkeeper reactions.

### Consequences
- **`trade.ts`**, **`innkeeperTradeMojibake.ts`**, **`trade.test.ts`**, **`DESIGN.md`** §5.1.

---

## ADR-0286 — Innkeeper welcome speech when opening trade
Date: 2026-04-10

### Decision
**`hub/openTavernTrade`** sets **`hubInnkeeperSpeech`** to **`Welcome. I take …`** plus a **mojibake** token for each **`tradeSession.wants`** entry (order matches **They want**). **`mojibakeFromUtf8Text`** is used when the display name already gains a mojibake look; **ASCII-only** names fall back to a **`mojibakeFakeWord`** seeded from **`ItemDefId` + label**.

### Rationale
Greets the player on enter and ties the strip to the same buy list as the modal without spelling item names in plain English.

### Consequences
- **`gibberish.ts`** (**`mojibakeFromUtf8Text`**), **`innkeeperTradeMojibake.ts`** (**`innkeeperSpeechWelcome`**), **`reducer.ts`**, **`trade.test.ts`**, **`DESIGN.md`** §5.1.

---

## ADR-0287 — Innkeeper welcome speech TTL 4s
Date: 2026-04-10

### Decision
Add **`ui.hubInnkeeperSpeechTtlMs`** (optional). **`hub/openTavernTrade`** sets **`4000`** for the welcome line; other innkeeper lines leave it **unset** (**2000** default in **`InnkeeperTradeSpeechPortal`**). Shared constants live in **`innkeeperSpeechTiming.ts`**.

### Rationale
The first trade message should stay readable longer than reaction blurbs.

### Consequences
- **`types.ts`**, **`innkeeperSpeechTiming.ts`**, **`InnkeeperTradeSpeechPortal.tsx`**, **`HudLayout.tsx`**, **`reducer.ts`**, **`trade.ts`**, **`floorProgression.ts`**, **`trade.test.ts`**, **`DESIGN.md`** §5.1.

---

## ADR-0288 — Trade merchant stock: same name tooltip as inventory
Date: 2026-04-10

### Decision
**`DragTarget`**: **`tradeStockSlot` { stockIndex }**; **`TradeModal`** stock cells use **`data-drop-kind="tradeStockSlot"`** + **`data-trade-stock-index`**. **`CursorLayer`** resolves the item **`defId`** via **`tradeStockRows`** and shows the same **`itemNameTooltip`** styling as **`inventorySlot`**. **`drag/drop`** onto **`tradeStockSlot`** rejects (not a drop target).

### Rationale
Parity with bottom inventory UX; stock is click-to-select only.

### Consequences
- **`types.ts`**, **`CursorProvider.tsx`**, **`CursorLayer.tsx`**, **`TradeModal.tsx`**, **`reducer.ts`**, **`DESIGN.md`** §5.1.

---

## ADR-0289 — Trade “your offer” slot: inventory-style name tooltip
Date: 2026-04-10

### Decision
**`CursorLayer`** **`itemNameTooltipHover`**: when **`hoverTarget.kind === 'tradeOfferSlot'`** and **`tradeSession.offerItemId`** is set, show **`content.item(defId).name`** (same strip as inventory / merchant stock). Empty offer slot: no tooltip.

### Rationale
Matches **their stock** and bottom-inventory affordance; **`TradeModal`** already exposes **`data-drop-kind="tradeOfferSlot"`**.

### Consequences
- **`CursorLayer.tsx`**, **`DESIGN.md`** §5.1.

---

## ADR-0290 — Activity log on opening village innkeeper trade
Date: 2026-04-10

### Decision
**`hub/goTavern`** (village → tavern, **`hubKind !== camp`**) calls **`pushActivityLog(..., INNKEEPER_OPEN_TRADE_ACTIVITY_LOG)`** so the line appears when the innkeeper **scene** is shown, not when **`hub/openTavernTrade`** opens the modal.

### Rationale
Flavor as soon as the player sees the tavern / innkeeper; **camp** hub skips the line.

### Consequences
- **`innkeeperBarterLog.ts`** (export), **`reducer.ts`**, **`trade.test.ts`**, **`DESIGN.md`** §5.1.

---

## ADR-0291 — Hub tavern: separate trade click rect from bartender sprite frame
Date: 2026-04-10

### Decision
**`HubHotspotConfig.tavern`**: add **`innkeeperTrade`** (normalized rect). **`innkeeper`** frames **`bartender_*.png`**; **`HotspotBox`** for **`hub/openTavernTrade`** uses **`innkeeperTrade`** only. Default **`innkeeperTrade`** is tighter and centered on the character silhouette.

### Rationale
Full sprite frame was too large a click target; trade should read as clicking the central NPC (“bear”) figure.

### Consequences
- **`types.ts`**, **`hubHotspotDefaults.ts`**, **`initialState.ts`**, **`HubViewport.tsx`**, **`reducer.ts`** (**`hubHotspot/setAxis`**), **`DebugPanel.tsx`**, **`debugSettingsPersistence.ts`**, **`public/debug-settings.json`**, **`combat.test.ts`**, **`DESIGN.md`** §5.1 / debug.

---

## ADR-0292 — Tavern: larger trade hit; LEAVE button; remove exit hotspot
Date: 2026-04-10

### Decision
**`innkeeperTrade`** default: **w = 0.28**, **h = 0.4** (40% viewport height), centered (**x/y** adjusted). Remove **`hubHotspots.tavern.exit`**; **`HubViewport`** adds a bottom-left **`LEAVE`** button (**`GamePopup.close`** + **`hub/goVillage`**).

### Rationale
Trade target should be clearly large; leaving the tavern is explicit UI instead of an invisible second hotspot.

### Consequences
- **`types.ts`**, **`hubHotspotDefaults.ts`**, **`initialState.ts`**, **`HubViewport.tsx`**, **`HubViewport.module.css`**, **`reducer.ts`**, **`DebugPanel.tsx`**, **`debugSettingsPersistence.ts`**, **`public/debug-settings.json`**, **`combat.test.ts`**, **`DESIGN.md`**.

---

## ADR-0293 — Tavern trade hotspot: much larger default + stack above foreground
Date: 2026-04-10

### Decision
**`innkeeperTrade`** default rect is **`x: 0.14`**, **`y: 0.14`**, **`w: 0.68`**, **`h: 0.58`** (~**3×** the prior click area). **`HubViewport`** renders the trade **`HotspotBox` after** the tavern **`foreground`** image and applies **`.hotspotTrade`** (**`z-index: 4`**) so the hit target is not visually “under” the fg layer in paint order. **`public/debug-settings.json`** matches so fresh loads and **Save to project** stay aligned.

### Rationale
Players still perceived the trade target as too small; the previous **0.28 × 0.4** rect was only a modest bump. DOM order + z-index removes ambiguity about which layer receives clicks.

### Consequences
- **`hubHotspotDefaults.ts`**, **`HubViewport.tsx`**, **`HubViewport.module.css`**, **`public/debug-settings.json`**, **`DESIGN.md`**.

---

## ADR-0294 — Tavern trade hotspot: half default width + 40px lower
Date: 2026-04-10

### Decision
**`innkeeperTrade`** default **`w`** is **half** the prior **0.68** (**`0.34`**), **`x`** recenters (**`0.31`**). **`.hotspotTrade`** adds **`transform: translateY(40px)`** so the trade hit sits **40px** lower than the normalized **`y`** (F2 sliders still edit **`y`** in 0–1; the **40px** offset is layout CSS).

### Rationale
Player tuning: narrower target, shifted down to align with the bartender figure.

### Consequences
- **`hubHotspotDefaults.ts`**, **`HubViewport.module.css`**, **`public/debug-settings.json`**, **`DESIGN.md`**.

---

## ADR-0295 — Tavern trade hotspot: no visible outline
Date: 2026-04-10

### Decision
**`.hotspotTrade`** sets **`border: none`** so the trade click region is invisible; village **Tavern** / **Cave** **`HotspotBox`**es keep the red debug outline.

### Rationale
Cleaner tavern presentation; the trade area remains fully clickable.

### Consequences
- **`HubViewport.module.css`**, **`DESIGN.md`**.

---

## ADR-0296 — Hub tavern: “Leave tavern” button label
Date: 2026-04-10

### Decision
The bottom-left tavern chrome label is **“Leave tavern”** (visible text and **`aria-label`** were already **Leave tavern**); **`DESIGN.md`** and **`types.ts`** comments refer to **Leave tavern** instead of **LEAVE**.

### Rationale
Clearer than a single-word **LEAVE** at a glance.

### Consequences
- **`HubViewport.tsx`**, **`HubViewport.module.css`** (comments), **`types.ts`**, **`DESIGN.md`**.

---

## ADR-0297 — Hub: clear activity log when leaving tavern
Date: 2026-04-10

### Decision
**`hub/goVillage`** sets **`ui.activityLog`** to **`[]`** so the corner log does not carry tavern/innkeeper lines back onto the village hub scene.

### Rationale
Cleaner village presentation; tavern feedback is scoped to the tavern visit.

### Consequences
- **`reducer.ts`** (**`hub/goVillage`**), **`trade.test.ts`**, **`DESIGN.md`**.
## ADR-0298 — Title **Start**: Bobr fade intro before **`run/new`**
Date: 2026-04-10

### Decision
- **`TitleScreen`** (**interactive** only): pressing **Start** does **not** dispatch **`run/new`** immediately. A **black full-stage overlay** with centered **`/content/npc_bobr.png`** runs a **CSS keyframed opacity** timeline (see **ADR-0301** for current segment lengths). On **`animationend`**, dispatch **`run/new`** once (ref-guarded). **Continue** / **Quit** are **disabled** while the intro plays.
- **Capture** title variant: unchanged (no intro) so offscreen HUD capture stays a static menu frame.
- **No** new **`GameState`** / reducer fields; timing lives in **`TitleScreen`** + CSS.

### Rationale
A lightweight narrative beat before the hub without threading UI choreography through the reducer or blocking the title-screen action allowlist.

### Consequences
- **`web/src/ui/title/TitleScreen.tsx`**, **`TitleScreen.module.css`**, **`DESIGN.md`** §5.1. Other **`run/new`** paths (**settings** restart, **death** new run, **F2** debug) remain instant.

---

## ADR-0299 — Title screen: isolate pointer hits from the invisible HUD grid
Date: 2026-04-10

### Decision
- **`HudLayout`**: when **`ui.screen === 'title'`**, set **`data-title-screen`** on the grid root and CSS **`pointer-events: none`** on **`section.panel`** descendants (grid cells **and** the **`bottomRow`** map/inventory/nav sections) so they do not receive clicks under the compositor’s **`opacity: 0`** interactive HUD. **`TitleScreen`** lives in **`fullHudInteractiveLayer`** and does not use **`HudLayout`’s **`section.panel`** class.
- **`NavigationPanel`**: treat **`screen === 'title'`** like hub for **`busy`** so nav buttons stay **disabled** on the title screen.
- **`TitleScreen`**: **`useEffect`** **`setTimeout`** matching the CSS intro duration while the Bobr intro runs (**interactive** only), calling the same **`onBobrIntroEnd`** path as **`animationend`** (still ref-guarded once).

### Rationale
Without this, some stacks let the **3D hit layer** and **nav** still capture input while the menu appears on the presenter, so **Start** / the intro felt broken.

### Consequences
- **`web/src/ui/hud/HudLayout.tsx`**, **`HudLayout.module.css`**, **`NavigationPanel.tsx`**, **`TitleScreen.tsx`**, **`DESIGN.md`** §5.1.

---

## ADR-0300 — Visible Bobr title intro: portal above **`presentCanvas`**
Date: 2026-04-10

### Decision
- **`DitheredFrameRoot`**: add **`titleCutsceneMount`** (**`position: absolute; inset: 0; z-index: 4`**, **`pointer-events: none`** on the empty shell) between **`presentCanvas`** and **`.interactiveHud`**, and provide it via **`TitleCutscenePortalContext`**.
- **`TitleScreen`** (**interactive**): render the Bobr intro overlay with **`createPortal(..., titleCutsceneMount)`** instead of inside **`TitleScreen`’s** subtree under **`.interactiveHud`** (**`opacity: 0`**), which made the cutscene invisible on the real stage while the end timer still delayed **`run/new`**.

### Rationale
Parent **`opacity`** applies to descendants; the hit HUD must stay invisible for compositing, but the intro must be **actually visible**.

### Consequences
- **`web/src/ui/title/TitleCutscenePortalContext.tsx`**, **`DitheredFrameRoot.tsx`**, **`DitheredFrameRoot.module.css`**, **`TitleScreen.tsx`**, **`DESIGN.md`** §5.1.

---

## ADR-0301 — Bobr title intro timing: pad + longer fades
Date: 2026-04-10

### Decision
- **Pre / post black**: **0.3s** hold at opacity **0** before fade-in starts, and **0.3s** at **0** after fade-out completes (still on the black overlay) before **`run/new`**.
- **Fades**: fade-in and fade-out each **200% longer** than the prior **1s** baseline → **3s** each; **hold** stays **2s**.
- **Total**: **8.6s**; **`TitleScreen`** **`BOBR_INTRO_TOTAL_MS`** and **`bobrIntroOpacity`** **`8.6s`** stay in sync.

### Rationale
More breathing room before the sprite appears and after it disappears; slower fades read less abrupt.

### Consequences
- **`TitleScreen.tsx`**, **`TitleScreen.module.css`**, **`DESIGN.md`** §5.1, cross-refs in **ADR-0298** / **ADR-0299** / **ADR-0300**.

---

## ADR-0302 — Title screen: village **`uiTex`** boot placeholder (no 3D flash)
Date: 2026-04-10

### Decision
- **`DitheredFrameRoot`**: on mount, build a **`THREE.CanvasTexture`** from **`/content/village.png`** drawn **cover**-fit into a **`STAGE_CSS_WIDTH` × `STAGE_CSS_HEIGHT`** canvas (opaque base fill, then image).
- **`renderOnce`**: **`presenter.setInputs({ uiTex })`** uses **`uiTexRef.current`**, or when **`ui.screen === 'title'`** and **`uiTexRef` is still null**, that **boot texture**—so the compositor never blends **3D** through an empty HUD texture before the first async **`html2canvas`** capture lands.

### Rationale
**`uiTex`** starts **null**; **`html2canvas`** is **idle-scheduled** with backoff. Without a fallback, **`CompositeShader`** shows the **dungeon** in the **game rect** for ~a second on cold load.

### Consequences
- **`DitheredFrameRoot.tsx`**, **`DESIGN.md`** §3 / §5.1. Placeholder art is intentionally the same **village** asset as the title background for now; can be swapped later.

---

## ADR-0303 — Bobr title intro: click to skip
Date: 2026-04-10

### Decision
- **`TitleScreen`** portaled **`.introOverlay`**: **`onPointerDown`** (primary button) calls **`onBobrIntroEnd`** (same as **`animationend`** / timeout; **`introEndOnceRef`** still dedupes **`run/new`**).
- **`TitleScreen.module.css`**: **`cursor: none`** on the overlay (matches HUD hand-cursor policy; overlay remains **`pointer-events: auto`**).

### Rationale
Players should not wait the full **8.6s** timeline if they want to start immediately.

### Consequences
- **`TitleScreen.tsx`**, **`TitleScreen.module.css`**, **`DESIGN.md`** §5.1.

---

## ADR-0304 — Per-entity placeholder PNG filenames (copy of `poi_placeholder.png`)
Date: 2026-04-10

### Decision
- Under repo-level **`Content/`**, add **`npc_<kind>.png`** for each **`NpcKind`** that previously shared **`poi_placeholder.png`**, and **`poi_bed.png`** / **`poi_cracked_wall.png`** for those POIs—each file is a **byte-for-byte copy** of **`Content/poi_placeholder.png`** for now.
- **`web/src/game/npc/npcDefs.ts`**: **`NPC_SPRITE_SRC`** references the new **`/content/npc_….png`** paths; **`web/src/game/poi/poiDefs.ts`**: **Bed** / **CrackedWall** reference **`/content/poi_bed.png`** and **`/content/poi_cracked_wall.png`**.

### Rationale
Stable, per-slot URLs make the art pipeline explicit (drop-in replacements without touching code) while keeping identical placeholder pixels until real sprites exist.

### Consequences
- **`Content/`** gains **15** new PNGs; **`poi_placeholder.png`** stays as an optional generic fallback.
- **`DESIGN.md`** §7.5 / §9 / §13 updated to describe dedicated filenames + copy-of-placeholder policy.

---

## ADR-0305 — Dedicated env triples + hazard decal PNGs for reskins / expansion properties
Date: 2026-04-10

### Decision
- **`Content/`**: add **18** environment textures (**`jungle_*`**, **`livingbio_*`**, **`bunker_*`**, **`golem_*`**, **`catacombs_*`**, **`palace_*`**) as **copies** of the **`cave_*`**, **`Dungeon`** triple, or **`ruins_*`** sources they previously aliased in code; add **5** hazard sprites (**`hazard_spore_mist.png`**, **`hazard_nano_haze.png`**, **`hazard_unstable.png`**, **`hazard_haunted.png`**, **`hazard_royal_miasma.png`**) as copies of **`hazard_poison.png`**, **`hazard_water.png`**, or **`hazard_fire.png`** as before.
- **`web/src/world/dungeonEnvTextures.ts`**: **`getDungeonEnvTextureSrcs`** returns a **distinct triple per `FloorType`** (explicit **`switch`**).
- **`web/src/game/world/hazardDefs.ts`**: **`ROOM_HAZARD_SPRITE_SRC`** points each **`RoomHazardProperty`** at its own **`/content/hazard_….png`**.

### Rationale
Stable per-type URLs for environment and hazard decals so art can replace files without changing TypeScript, while keeping **identical pixels** until new art ships.

### Consequences
- **`DESIGN.md`** §8.1, §11 (dungeon albedo), §11 (room-hazard decals), §13 (asset list) updated.
- Base **`Dungeon`** / **`Cave`** / **`Ruins`** triples and the three baseline hazard PNGs **unchanged** on disk.

---

## ADR-0306 — Camp hub: themed village art + hover overlays
Date: 2026-04-10

### Decision
- **`HubViewport`**: **Camp** village background is **`/content/camp_<skin>.png`** with **skin** from **`floor.floorType`** (next segment, already generated when the camp opens): **`Cave`** → **`cave`**, **`Dungeon`** → **`dungeon`**, everything else → **`village`**.
- **Hover**: interactive village shows **`camp_<skin>_tavern_hover.png`** or **`_dungeon_hover.png`** over the **Tavern** / **Cave** hotspots; **starting hub** keeps **`village_*.png`** hovers over **`village.png`**. **Capture** variant skips hovers.

### Rationale
New **Content** ships three camp village sets plus per-skin hovers; mapping non-Cave/non-Dungeon segment types to **`camp_village`** matches available files without extra art.

### Consequences
- **`web/src/ui/hub/HubViewport.tsx`**, **`HubViewport.module.css`** (stacking), **`DESIGN.md`** §5.1 (village hover) and §8.1 (camps).

---

## ADR-0286 — Camp village hotspot hover art
Date: 2026-04-10

### Decision
- **`HubViewport`**: when **`ui.hubKind === 'camp'`** and **`hubScene: village`**, pointer hover over the **Tavern** or **Cave** hotspot shows **`/content/camp_village_tavern_hover.png`** or **`/content/camp_village_dungeon_hover.png`** as a **full-viewport** **`object-fit: cover`** layer over **`camp_village.png`**. The **capture** variant does not mount hover layers.

### Rationale
Authored hover sprites ship in **`Content/`**; wiring them gives clear affordance for camp village exits without changing hotspot geometry.

### Consequences
- **`web/src/ui/hub/HubViewport.tsx`**, **`HubViewport.module.css`**, **`DESIGN.md`** §5.1.

---

## ADR-0287 — Starting village: duplicate hover PNGs + same hotspot behavior
Date: 2026-04-10

### Decision
- **`Content/`**: add **`village_tavern_hover.png`** and **`village_dungeon_hover.png`** as **byte copies** of the camp hover pair (same pixels until art diverges).
- **`HubViewport`**: **`hubScene: village`** uses **`START_VILLAGE_HOVER`** vs **`CAMP_VILLAGE_HOVER`** by **`ui.hubKind`**, with the same **interactive-only** overlay rules as **ADR-0286**.

### Rationale
Matches the existing **starting vs camp** asset split so hover art can be retuned per hub without sharing one URL.

### Consequences
- **`Content/`** (+2 PNGs), **`web/src/ui/hub/HubViewport.tsx`**, **`DESIGN.md`** §5.1.

---

## ADR-0288 — Player-held light sources drive camera lantern intensity/distance
Date: 2026-04-10

### Decision
- **`ItemDef`**: optional **`playerLight`** on equippable light items (see **ADR-0289** for full tag set including **Glowbug**).
- Equipped light on **`party.chars[0]`** drives the camera PointLight via **`resolvePlayerCameraLightKind`** and **`WorldRenderer.syncTuning`** (per-mode **`render`** keys in **ADR-0289**; POI torches stay on **`torchIntensity` / `torchDistance`** only).

### Rationale
Reuses existing F2 tuning pairs so POI torches and held torches stay visually tunable together; equipping a proper lantern or headlamp restores full reach without a separate “dark empty hands” rule.

### Consequences
Equip changes immediately change dungeon visibility; **`DESIGN.md`** §7.3 and §11 updated. Per-mode **`render`** keys and **`resolvePlayerCameraLightKind`** are specified in **ADR-0289**.

---

## ADR-0289 — Split camera light tuning: bare vs each equipped source; POI torch separate
Date: 2026-04-10

### Decision
- **`RenderTuning`**: remove **`lanternIntensity` / `lanternDistance`** from the camera path; add **`bareLight*`**, **`heldTorch*`**, **`equippedLantern*`**, **`headlamp*`**, **`glowbug*`** (ten scalars). **`torchIntensity` / `torchDistance`** apply **only** to POI torch PointLights.
- **`resolvePlayerCameraLightKind`**: returns **`bare` | `torch` | `lantern` | `headlamp` | `glowbug`**; priority **Lantern > Headlamp > Torch > Glowbug > bare**.
- **`PlayerLightTag`**: add **`glowbug`**; **Glowbug** item is **`playerLight`** + equippable in hands (`tool`, `oneHand`).
- **Theme**: held torch uses **`torchIntensityMult`**; bare, equipped lantern, headlamp, glowbug use **`lanternIntensityMult`**.

### Rationale
Lets F2 tune **placed** torches independently of **held** torch and separates **bare** visibility from **equipped lantern** / **headlamp** / **glowbug**.

### Consequences
**`debug-settings.json`** and F2 labels updated; **`DESIGN.md`** §7.3 / §11 / materials; supersedes the tuning details in **ADR-0288** for intensity/distance keys (ADR-0288 remains as the original equip-wiring decision).

---

## ADR-0290 — Camera light uses strongest party-wide equipped `playerLight`
Date: 2026-04-10

### Decision
**`resolvePlayerCameraLightKind`** evaluates equipped **`playerLight`** on **each** **`party.chars`** entry (hands + head), ranks kinds **Lantern > Headlamp > Torch > Glowbug > bare**, and returns the **maximum** rank so a headlamp (or any light) on **any** portrait affects the dungeon camera—not only **`party.chars[0]`**.

### Rationale
HUD equips per-character strips; tying the camera only to the first roster slot made headlamps on other PCs appear broken, and matched player expectation poorly.

### Consequences
**`DESIGN.md`** §7.3 / §11 wording updated; **`playerLight.ts`** only.

---

## ADR-0291 — Debug tuning: canonical render/audio snapshot + debounced project file write (dev)
Date: 2026-04-10

### Decision
- **`pickRenderTuningForPersistence`** / **`pickAudioTuningForPersistence`** (`tuningDefaults.ts`): when writing **`debug-settings.json`** or **localStorage**, copy only keys defined on **`DEFAULT_RENDER`** / **`DEFAULT_AUDIO`** so the file always carries the full schema and omits stale properties (e.g. removed `lanternIntensity`).
- **`GameApp`**: under **`vite dev`**, debounced (~**2 s**) **`saveDebugSettingsToProject`** mirrors the same payload as local persistence (in addition to **Save to project**).

### Rationale
New F2 keys were easy to lose if saves relied on accidental object shape; auto-writing the project JSON in dev matches **ADR-0006** intent and keeps repo snapshots current without only manual saves.

### Consequences
**`debugSettingsPersistence.ts`**, **`GameApp.tsx`**, **`tuningDefaults.ts`**, **`DESIGN.md`** §3 debug bullet.

---

## ADR-0292 — Portrait idle overlay hides base body sprite
Date: 2026-04-10

### Decision
While portrait **idle** is active (ambient flash, frame press / `ui.portraitIdlePulse`, or held press), **`PortraitPanel`** hides the **base** `<img>` as well as the eyes—same gating as eye suppression (`!showEyesInspect`), reusing **`.eyesHidden`** on the base layer.

### Rationale
Idle art is often a full replacement or has transparency; leaving the base visible caused double-stacking and leaks. Hiding the base in the DOM (including HUD capture) aligns with compositor idle overlays blended over the captured HUD.

### Consequences
**`PortraitPanel.tsx`**, **`DESIGN.md`** §7.1 portrait idle bullet.

---

## ADR-0293 — Portrait wall-clock refresh for pulse/mouth expiry
Date: 2026-04-10

### Decision
**`PortraitPanel`** schedules **`setTimeout`** at **`ui.portraitIdlePulse.untilMs`** and **`ui.portraitMouth.untilMs`** when each cue targets that **`characterId`**, bumping local React state so the panel re-renders as soon as the wall-clock window ends.

### Rationale
Cue visibility uses **`performance.now()`** at render time, but renders were mostly driven by **`time/tick`** on **`requestAnimationFrame`**. Throttled rAF (background tab, heavy frames) delayed repaints after **`untilMs`**, so idle/base/eyes and mouth layers felt like they cleared too late.

### Consequences
**`PortraitPanel.tsx`**, **`DESIGN.md`** §7.1 portrait idle bullet; reducer pruning on **`time/tick`** unchanged.

---

## ADR-0294 — Shorter portrait ambient / frame-pulse idle flash; stable wall-clock effect deps
Date: 2026-04-10

### Decision
- **`RenderTuning`**: default **`portraitIdleFlashMinMs`** **70** (was **120**), **`portraitIdleFlashMaxMs`** **220** (was **350**); same pair drives **ambient** idle flashes and **`ui.portraitIdlePulse`** frame-press bursts.
- **`PortraitPanel`**: wall-clock **`useEffect`** depends on **`portraitIdlePulse` / `portraitMouth`** **`characterId` + `untilMs`** primitives only, not whole UI objects, so pending expiry timers are not cleared and rescheduled on unrelated state churn.

### Rationale
Debug logs showed **`showIdleForEyes`** returning to **`false`** was dominated by **`idleFlash`** with **~180–360 ms** gaps, matching the old **120–350 ms** flash window; pulse/mouth wall-clock bumps were only **~10 ms** past **`untilMs`**. Narrowing deps reduces spurious timer resets when pulse windows update.

### Consequences
**`tuningDefaults.ts`**, **`web/public/debug-settings.json`**, **`PortraitPanel.tsx`**.

---

## ADR-0295 — Expand crafting: alternates, order traps, swarm inventory crafts
Date: 2026-04-10

### Decision
Grow **`ALL_RECIPES`** in **`web/src/game/content/recipes.ts`** with:
- **Alternate ingredient pairs** to existing results (e.g. **Club** smashes **Stone** for **Stone shard**, **Claw**/**Tooth**/**Bone** branches for weapons and remedies, **Moss**/**Mushrooms** cooking paths, **Bone** + **Gem** for **Staff**).
- **Order-sensitive “traps”** where reversing drag order changes the result (e.g. **Salt** + **Rootsoup** → **Mold** vs **Rootsoup** + **Salt** → salted soup; **Lantern** + **Bobr juice** vs **Torch** + **Bobr juice**; **Slime**/**Fungus** reciprocals; **Bone**/**Stick**, **Foodroot**/**Waterbag (Full)**, **Cloth scrap**/**Mushrooms**, **Sweetroot**/**Shroomcake**).
- **Swarm tools** from inventory: **Twine** + **Hive** → **Swarm basket**; **Hive** + **Grubling** or **Mushrooms** → **Captured swarm** (world drag of basket onto **Swarm** unchanged).

No recipes use **Iron key**, **Brass key**, or other keys. No new **`ItemDef`**s.

### Rationale
Rewards experimentation with materials already in **`DEFAULT_ITEMS`**, deepens the **drag-order** identity of crafting, and gives **Hive** / **Swarm basket** / **Captured swarm** a path without floor-only reliance.

### Consequences
Keep **`ALL_RECIPES`** inputs and outputs aligned with **`web/src/game/content/items.ts`**. **`DESIGN.md`** §7.3 documents order sensitivity and new breadth at a summary level; full matrix remains **`recipes.ts`**.

---

## ADR-0296 — Ambient portrait idle: compositor overlay + capture keeps base/eyes
Date: 2026-04-10

### Decision
- **`portraitAmbientCompositorIdle.ts`**: per-character flag set from the **capture** `PortraitPanel` when **only** random **`idleFlash`** is active (no `portraitIdlePulse`, no pressed-frame idle, no inspect hover).
- **`DitheredFrameRoot`**: OR **`getPortraitAmbientCompositorIdle(id)`** into **`portraitIdleOn`** so the WebGL composite draws the idle sprite at full frame rate for ambient flashes (same path as pulse/press).
- **`PortraitPanel` (capture)**: while that flag is on, **do not** apply **`idleHideBase` / `idleHideEyes`**—the captured HUD keeps the normal face rasterized; the compositor paints idle on top.

### Rationale
`html2canvas` often finishes **after** a short ambient flash ends. If the capture DOM had base/eyes hidden during the flash, the **completed** capture could still show the hidden state, so the face felt slow to return even when capture scheduling was immediate (**ADR-0295**). Keeping base+eyes in the bitmap and using the existing compositor idle layer avoids that race entirely for ambient idle.

### Consequences
**`portraitAmbientCompositorIdle.ts`**, **`PortraitPanel.tsx`**, **`DitheredFrameRoot.tsx`**, **`DESIGN.md`** portrait reaction bullet.

---

## ADR-0298 — Revert ADR-0296 ambient compositor idle (portrait went blank; Afonso mouth only)
Date: 2026-04-10

### Decision
Remove **`portraitAmbientCompositorIdle.ts`** and the **`portraitIdleOn`** OR from **`getPortraitAmbientCompositorIdle`**. Restore **`PortraitPanel`** capture behavior: **`idleHideBase` / `idleHideEyes`** during **all** idle (`idleFlash` / pulse / press), with no “compositor covers ambient” exception.

### Rationale
Turning on compositor **idle** for random ambient while the **capture** stack still omitted the idle `<img>` (`showIdleSprite` false) produced a mismatch: the UI texture had **no** face layers while **`portraitIdleOn`** could still drive idle/mouth compositing—**Afonso** kept a **compositor closed-mouth** quad, so slots read as “empty portrait, mouth only”; others read as fully blank.

### Consequences
Deletes **`portraitAmbientCompositorIdle.ts`**; **`PortraitPanel.tsx`**, **`DitheredFrameRoot.tsx`**, **`DESIGN.md`** portrait reaction bullet. **ADR-0295** (capture `hudKey` revision + `hudDirty` immediate capture) and **ADR-0297** (blink open on ambient `idleFlash` end) stay.

---

## ADR-0299 — Rasterize idle sprite in capture for ambient-only flashes
Date: 2026-04-10

### Decision
**`PortraitPanel`**: **`showIdleSprite`** in **`captureForPostprocess`** mode is **`true`** only when **`idleFlash && !pulseIdle && !pressIdle`** (ambient random flash); pulse/press idle keep **`showIdleSprite` false** in capture so compositor idle is not doubled.

### Rationale
After **ADR-0298**, ambient idle again hid base/eyes in capture while suppressing the idle `<img>`, and **`portraitIdleOn`** does not cover ambient—so the portrait art region in **uiTex** was fully transparent (“entire portrait disappears”). Afonso could still show a compositor mouth; others showed nothing.

### Consequences
**`PortraitPanel.tsx`**, **`DESIGN.md`** portrait reaction bullet.

---

## ADR-0297 — Open eyes when ambient idle flash ends (blink vs idle overlap)
Date: 2026-04-10

### Decision
**`PortraitPanel`**: on **`idleFlash` true → false** (per slot), call **`setBlinkClosed(false)`** and clear Frosh **`blinkClosedL` / `blinkClosedR`**, resetting the independent blink cycle so eyes are not left closed exactly when the ambient idle overlay drops.

### Rationale
Session logs showed **`idleHideBase`** already **`false`** while **`blinkHideEyes`** was **`true`** right after idle ended—blink timing overlapped the return to the normal face, so the portrait read as “slow to come back” even when capture/compositor idle was correct.

### Consequences
**`PortraitPanel.tsx`**, **`DESIGN.md`** portrait blinking bullet.

---

## ADR-0295 — Sync HUD capture to ambient portrait idle (base/eyes hide)
Date: 2026-04-10

### Decision
- **`portraitCaptureHudRev.ts`**: monotonic revision bumped from the **capture** `PortraitPanel` whenever **`idleHideBase`** (ambient / press / pulse idle) toggles.
- **`DitheredFrameRoot`**: append **`pCapIdle=${getPortraitCaptureHudRev()}`** to the capture **`hudKey`**, and set **`immediateCapture = highFpsUi || poseDirty || hudDirty`** so a dirty HUD is not blocked by the ~720ms **`effectiveIntervalMs`** backoff.

### Rationale
Logs showed **`html2canvas`** runs were gated by **`stale` (~650ms)** with **`hudDirty: false`** while **`idleFlash`** only lived in local React state; after idle ended the capture DOM showed base+eyes immediately but the compositor texture could stay on the hidden-base frame for hundreds of milliseconds.

### Consequences
**`portraitCaptureHudRev.ts`**, **`PortraitPanel.tsx`**, **`DitheredFrameRoot.tsx`**, **`DESIGN.md`** §7.1 portrait idle bullet.

---

## ADR-0300 — Bump HUD capture rev on capture idle sprite visibility too
Date: 2026-04-10

### Decision
In the **capture** `PortraitPanel`, call **`bumpPortraitCaptureHudRev()`** when either **`idleHideBase`** or **`showIdleSprite`** changes (same character), not only when **`idleHideBase`** changes.

### Rationale
**`idleHideBase`** and **ambient** **`showIdleSprite`** usually flip together, but any future or edge divergence would leave **`hudKey`**/`pCapIdle` stale while the rasterized idle `<img>` toggles—risking a blank or mismatched composited frame until the next unrelated bump.

### Consequences
**`PortraitPanel.tsx`**, **`DESIGN.md`** portrait idle bullet.

---

## ADR-0301 — Capture keeps base+eyes under compositor-only idle (pulse / press)
Date: 2026-04-10

### Decision
In **`PortraitPanel`**, when **`captureForPostprocess`** and idle is driven only by **`ui.portraitIdlePulse`** or **frame press** (compositor **`portraitIdleOn`**), **do not** apply **`idleHideBase` / `idleHideEyes`** in the capture tree. **Random ambient** idle (capture-local **`idleFlash`**) still hides base+eyes and rasterizes the idle `<img>` in capture.

### Rationale
Debug logs showed **`idleHideBase: true`** with **`showIdleSprite: false`** on capture during pulse/press—by design the idle `<img>` is omitted so the compositor can draw idle once. If compositor idle turns off before the HUD texture is recaptured, the stack is **only hidden layers** → visible **blank** portrait.

### Consequences
**`PortraitPanel.tsx`**, **`DESIGN.md`** portrait idle + reaction bullets.

---

## ADR-0302 — 3D drag-drop: raycast POI/NPC/floor-item at pointer-up
Date: 2026-04-10

### Decision
When **`drag/drop`** resolves to **`floorDrop`** and the pointer is over the dungeon **3D viewport**, **`HudLayout`** first calls **`WorldRenderer.pickTarget`** at the release pixel. If the hit is **`poi`**, **`npc`**, or **`floorItem`**, dispatch **`drag/drop`** with that target; otherwise keep the existing **`pickFloorPoint`** snap for plain floor drops.

### Rationale
**`GameViewport`** exposes **`data-drop-kind="floorDrop"`** for the whole cell, so **`CursorProvider`’s** DOM **`elementsFromPoint`** never yields a POI target on release. **Virtual hover** from **`pickObject`** is consumed/cleared on each move and is not reliable at **`pointerup`**, which broke **apply item on POI** even when the hand showed **Apply**.

### Consequences
**`HudLayout.tsx`** pointer-up path; **`DESIGN.md`** §6.2 drop rules.

---

## ADR-0303 — Resolve 3D `floorDrop` targets on captured drag sources (inventory / equip)
Date: 2026-04-10

### Decision
Extract **`resolveGameViewportDragDropTarget`** (**`web/src/ui/viewport/resolveGameViewportDragDropTarget.ts`**) and call it from **`HudLayout`**, **`InventoryPanel`**, and **`CharacterEquipStrip`** whenever **`endPointerUp`** yields **`drag/drop`** with **`target.kind === 'floorDrop'`**. **`HudLayout`** passes **`world`** + **`gameViewportRef`** into those panels.

### Rationale
**`beginPointerDown`** uses **`setPointerCapture`** on inventory slot buttons (and equip buttons). **`pointerup`** is delivered to the captured element, which calls **`endPointerUp`** and **`stopPropagation`**—so **`HudLayout`’s** root **`pointerup`** never ran the 3D raycast branch. Drops from inventory still looked like **`floorDrop`** and fell through to **`dropItemToFloor`**.

### Consequences
**`resolveGameViewportDragDropTarget.ts`**, **`HudLayout.tsx`**, **`InventoryPanel.tsx`**, **`CharacterEquipStrip.tsx`**, **`DESIGN.md`** §6.2.

---

## ADR-0304 — Compositor idle: clear stale HUD pixels under idle sprite (shader) + rAF during pulse/press
Date: 2026-04-10

### Decision
- **`CompositeShader`**: When **`portraitIdleOn`** is active for a slot, **zero** the captured **`uiTex`** sample inside the **same idle sprite bounding quad** used for idle overlay sampling (stats rect excluded), **before** compositing portrait overlays. This removes the **stale base+eyes** from async **`html2canvas`** while compositor idle is on.
- **`DitheredFrameRoot`**: Extend the presenter **rAF** “active” gate so **`renderOnce`** runs every frame while **`ui.portraitIdlePulse`** is in window or a **portrait press** is active (**`cursorLatestRef`** + **`getPressedPortraitCharacterId`**), matching the existing **`highFpsUi`** capture burst intent.

### Rationale
**ADR-0301** keeps base+eyes in the capture texture during pulse/press so a slow recapture cannot flash a blank portrait. Compositor idle turns on immediately; **`uiTex`** can lag, so **`over(uiTex, idle)`** showed **duplicate** face wherever the idle PNG is transparent. Shader-side suppression fixes that without abandoning the fast overlay path.

### Consequences
**`CompositeShader.ts`**, **`DitheredFrameRoot.tsx`**, **`DESIGN.md`** portrait reaction bullet.

---

## ADR-0305 — Compositor idle stale-kill: gate on idle texture alpha (keep portrait backdrop)
Date: 2026-04-10

### Decision
**`killStaleUiUnderCompositorIdle`** (**`CompositeShader`**) clears **`uiTex`** only where **`texture2D(tIdle, uv).a`** exceeds a small threshold (~**0.008**), using the same UV math as the idle overlay. Fully transparent idle pixels keep the captured HUD (portrait gradient / plate) instead of replacing it with **transparent black**, which had read as a flat **black** panel behind the sprite.

### Rationale
**ADR-0304** zeroed the **entire** idle sprite bounding quad. Transparent regions of the idle PNG are meant to show the **HUD backdrop** from capture; wiping them removed that layer, so **`over(cleared, idle)`** left holes that composite as **black** relative to the dither pass.

### Consequences
**`CompositeShader.ts`** (add **`sampler2D tIdle`** to the kill helper; pass **`tPortraitIdle0..3`** from **`main`**), **`DESIGN.md`** portrait reaction bullet.

---

## ADR-0306 — Phase 1 items/recipes: Mold branch, body slots, ranged tuning
Date: 2026-04-10

### Decision
Expand authored content in **`web/src/game/content/items.ts`** and **`web/src/game/content/recipes.ts`**:
- **Mold** is no longer only a dead-end product: **Spore paste** (**Mold** + **Herb leaf**, or **Mushrooms** + **Mold**) and **Spore stew** (**Spore paste** + **Waterbag (Full)**, both orders).
- Add crafted gear for unused paperdoll slots: **Moss wrap** (**clothing**), **Moss sandals** (**feet**), **Gem charm** (**accessory**).
- Tune **Sling** (lighter), **Bow** (heavier), and **Bolas** (**Rooted** on hit via **`statusOnHit`**).
- Allowlist new craft outputs in **`web/src/tools/procgenContentNonSpawnAllowlist.ts`** for **`npm run audit:procgen-content`**.

### Rationale
Gives players a payoff for **Mold** and uses **`feet` / `clothing` / `accessory`** equipment slots already present in **`PaperdollModal`**. Separates the three agility ranged weapons without new systems.

### Consequences
Regenerate **[`CraftingRecipesGraph.md`](CraftingRecipesGraph.md)** after recipe edits (`npm run gen:crafting-graph` in **`web/`**). **`DESIGN.md`** §7.3 and §7.4 updated.

---

## ADR-0307 — `renderOnce` uses `cursorLatestRef` (rAF closure vs live cursor)
Date: 2026-04-10

### Decision
Inside **`DitheredFrameRoot`’s** **`renderOnce`**, read **`cursorLatestRef.current`** (aliased as **`cs`**) for **`getPressedPortraitCharacterId`**, **`hudKey`** portrait-hover fields, compositor **`portraitHoverEyesOn` / `portraitHoverMouthOn`**, and **`__elfensteinPerf.pointer.isDown`**—not **`cursor.state`** from the React closure.

### Rationale
The presenter **rAF** `useEffect` depends only on **`[world]`** and calls **`renderOnce`** every frame while **`idlePulseActive`** or **`portraitPressActive`** is true (**ADR-0304**). That **`renderOnce`** instance closes over **`cursor`** from the effect’s mount render, so **`cursor.state`** was **stale** during those bursts. Compositor inspect/mouth **hover** overlays stopped updating; **mouth chomp** still worked because it uses **`latestStateRef`** + **`ui.portraitMouth`**, not hover.

### Consequences
**`DitheredFrameRoot.tsx`**; **`DESIGN.md`** portrait reaction bullet.

---

## ADR-0307 — Weapon `damageStat` may scale off Intelligence
Date: 2026-04-10

### Decision
- **`WeaponDamageStat`** in **`web/src/game/types.ts`**: **`strength` | `agility` | `intelligence`**.
- **`ItemDef.weapon.damageStat`** and **`computePcAttackDamage`** use that type; **`intelligence`** contributes **`floor(intelligence × 0.25)`** like the other stats (e.g. **Attuned staff** in **`web/src/game/content/items.ts`**).

### Rationale
Magic-oriented weapons should type-check and apply the same additive scaling rule as physical stat-scaled weapons.

### Consequences
**`web/src/game/types.ts`**, **`web/src/game/content/contentDb.ts`**, **`web/src/game/state/combat.ts`**, **`DESIGN.md`** §8 (PC damage resolution).

---

## ADR-0308 — Phase 2 items/recipes: breadth, Burning/Drenched remedies, Shrine offerings
Date: 2026-04-10

### Decision
- **Crafting**: add **Brined spore** (**Spore paste** + **Salt**), **Smolder bundle** (**Ash** + **Twine**), **River tonic** (**Bobr juice** + **Bitter herb**), **Cooling poultice** (**Herb leaf** + **Moss**), **Dry wrap** (**Salt** + **Cloth scrap**, both orders); allowlist craft outputs in **`procgenContentNonSpawnAllowlist.ts`**; regenerate **[`CraftingRecipesGraph.md`](CraftingRecipesGraph.md)**.
- **Feed remedies**: **Cooling poultice** removes **Burning**; **Dry wrap** removes **Drenched**; extend **`remedyHint`** and **`feedCharacter`** in **`web/src/game/state/interactions.ts`**.
- **Shrine**: extend **`ItemPoiUseHook`** / **`ItemDef.useOnPoi`** in **`contentDb.ts`** with optional **`consumeOffering`** and **`blessPartyMs`**; **`applyItemOnPoi`** in **`poi.ts`** handles **Shrine** before **`applyPoiUse`**. **Sweetroot** gains **`useOnPoi.Shrine`** (consume + party **Blessed**).
- **Tests**: **`poi.test.ts`** (shrine offering), **`interactions.test.ts`** (new feed cures).

### Rationale
Phase 2 from the content roadmap: more recipe discovery without new combat systems, hazard counterplay for room effects that already apply **Burning** / **Drenched**, and a minimal second POI hook alongside **Well**.

### Consequences
**`DESIGN.md`** §7.3, §9 POI list; new ADR (this entry).

---

## ADR-0309 — Camp hub village skin uses `layoutProfile` (not raw `FloorType`)
Date: 2026-04-10

### Decision
**`HubViewport`** **`campVillageSkinId`**: map **`/content/camp_<skin>.png`** and matching **`_tavern_hover` / `_dungeon_hover`** from **`layoutProfile(state.floor.floorType)`** (**`floorLayoutProfile.ts`**): **`Cave`** profile → **`cave`**, **`Dungeon`** profile → **`dungeon`**, **`Ruins`** profile → **`village`**.

### Rationale
Mapping only exact **`Cave`** / **`Dungeon`** **`FloorType`** values meant most segment boundaries (e.g. **`Jungle`**, **`Bunker`**) never loaded **`camp_cave`** / **`camp_dungeon`** art; the three camp PNG sets align with the **three layout realizers**, not the nine-type rotation.

### Consequences
**`web/src/ui/hub/HubViewport.tsx`**, **`DESIGN.md`** §5.1 and §8.1; supersedes the skin table in **ADR-0306** (camp hub themed art).

---

## ADR-0310 — Camp hub skin from completed segment, not next `floor.floorType`
Date: 2026-04-10

### Decision
**`HubViewport`**: when **`hubKind === 'camp'`**, derive **`campVillageSkinId`** input from **`floorTypeForFloorIndex(max(0, floor.floorIndex - 1), clampCampEveryFloors(render.campEveryFloors))`**, then **`layoutProfile`** → **`camp_cave` / `camp_dungeon` / `camp_village`** URLs (unchanged triple). **`state.floor`** at camp already describes the **pre-generated next** floor, so **index − 1** is the last floor of the segment that triggered the camp.

### Rationale
Camp art should reflect the expedition **just cleared** (cave- vs dungeon- vs ruins-layout segment), not the **upcoming** segment’s type.

### Consequences
**`web/src/ui/hub/HubViewport.tsx`** (imports **`runFloorSchedule`**); **`DESIGN.md`** §5.1 / §8.1; refines **ADR-0309** (which keyed off **`floor.floorType`** at camp).

---

## ADR-0311 — Portrait idle capture-baked only (no compositor idle for pulse / press)
Date: 2026-04-10

### Decision
- **`PortraitPanel`**: for **`captureForPostprocess`**, treat **all** idle visibility (**`idleFlash`**, **`ui.portraitIdlePulse`**, frame **press**) like ambient idle: apply **`idleHideBase` / `idleHideEyes`** and rasterize the idle **`<img>`** in the capture tree. **`showIdleSprite`** follows **`showIdleForEyes`** with no compositor-only carve-out.
- **`DitheredFrameRoot`**: drive **`portraitIdleOn`** as **all zeros** for party slots (compositor does not draw player portrait idle). Keep **`idlePulseActive`**, **`portraitPressActive`**, and capture **`hudKey`** fields (**`pulse`**, **`press`**, **`pCapIdle`**) so **`html2canvas`** burst cadence still tracks idle.

### Rationale
**ADR-0301** / **ADR-0304** / **ADR-0305** kept **base+eyes** in **`uiTex`** during pulse/press and relied on compositor idle plus alpha-gated **`killStaleUiUnderCompositorIdle`**. Semi-transparent idle pixels and async capture still showed a **duplicate** base under the overlay. A **single** source of truth (same DOM stack as the interactive HUD) removes that mismatch; end-of-pulse **blank** risk is mitigated by restoring base+eyes in the capture DOM when idle ends and by existing **burst** capture (**ADR-0295**, **ADR-0155**).

### Consequences
**`PortraitPanel.tsx`**, **`DitheredFrameRoot.tsx`**, **`DESIGN.md`** portrait idle + reaction bullets. **`CompositeShader`** idle stale-kill path is effectively unused for player portraits while **`portraitIdleOn`** stays off; shader left in place for minimal churn.

---

## ADR-0312 — F2 Clear local overrides in production builds
Date: 2026-04-10

### Decision
**`DebugPanel`**: render **Clear local overrides** outside **`import.meta.env.DEV`** so it appears in **production** as well as dev. Keep **Save to project** (and the existing dev-only **`POST /__debug_settings/save`** path) **dev-only**.

### Rationale
Tuning loads **`/debug-settings.json`** first, then merges **`elfenstein.debugSettings`** from **localStorage**, which can mask a newer shipped JSON. The clear button existed but was hidden in prod, so published players had no in-app way to reset.

### Consequences
**`web/src/ui/debug/DebugPanel.tsx`**, **`DESIGN.md`** §3 (Debug F2 persistence).

---

## ADR-0313 — Hub tavern trade: `hubInnkeeperTrade` drop kind + `hand_trade` cursor
Date: 2026-04-10

### Decision
**`innkeeperTrade`** **`HotspotBox`** sets **`data-drop-kind="hubInnkeeperTrade"`**; **`DragTarget`** adds **`{ kind: 'hubInnkeeperTrade' }`**. **`CursorLayer`** alternates **`hand_trade_01/02.png`** trade cursor frames on the same **~280 ms** cadence when hovering that region in the tavern hub (and not dragging). **`drag/drop`** onto **`hubInnkeeperTrade`** rejects (**`ui/sfx` `reject`**) like **`tradeStockSlot`**.

### Rationale
Clear affordance for “trade here,” distinct from combat attack sprites.

### Consequences
- **`types.ts`**, **`CursorProvider.tsx`**, **`CursorLayer.tsx`**, **`CursorLayer.module.css`**, **`HubViewport.tsx`**, **`reducer.ts`**, **`DESIGN.md`**.

---

## ADR-0314 — Trade vs attack cursor sprites + tavern trade virtual hover
Date: 2026-04-10

### Decision
**`CursorLayer`**: combat attack uses **`hand_attack_01/02`** (**.attack1/2**); hub tavern **`hubInnkeeperTrade`** uses **`hand_trade_01/02.png`** (**.trade1/2**). **`HubViewport`** syncs the trade **`HotspotBox`** **`getBoundingClientRect`** into **`hubTavernTradeHoverRectRef`** (`ResizeObserver` + **`resize`/`scroll`**). **`CursorProvider` `applyPointerMove`** sets **`virtualHover`** to **`hubInnkeeperTrade`** when the pointer is inside that rect **before** **`elementsFromPoint`**.

### Rationale
Sprites must differ; **`elementsFromPoint`** alone was unreliable under the invisible HUD.

### Consequences
- **`HubViewport.tsx`**, **`hubTavernTradeCursorRect.ts`**, **`CursorProvider.tsx`**, **`CursorLayer.tsx`**, **`CursorLayer.module.css`**, **`DESIGN.md`**.

---

## ADR-0315 — Tavern trade hotspot: layout to **`top: 350px`**, **`h: 0.5`**, no border
Date: 2026-04-10

### Decision
**`innkeeperTrade`** defaults **`w/h`** **`0.28` × `0.5`** (**`x`** **`0.36`**); **`HubViewport`** uses **`TAVERN_TRADE_TOP_PX = 350`** (**`fixedTopPx`**; normalized **`y`** ignored). **`.hotspotTrade`** sets **`border: none`** (invisible hit target over the tavern foreground). Prior steps (smaller rect, **50%** height, moving **100px**/**150px**/**100px** down, removing the red outline) are folded here so IDs **ADR-0302**–**ADR-0306** in earlier branches remain historical references only.

### Rationale
Player-driven iteration on trade click target size and position without **`translateY`** hacks.

### Consequences
- **`HubViewport.tsx`**, **`HubViewport.module.css`**, **`hubHotspotDefaults.ts`**, **`public/debug-settings.json`**, **`DESIGN.md`**.

---

## ADR-0316 — Tavern trade cursor assets: `hand_trade_01/02` filenames
Date: 2026-04-10

### Decision
**`.trade1` / `.trade2`** and **`CursorLayer`** preload use **`/content/hand_trade_01.png`** and **`/content/hand_trade_02.png`** (stable lowercase URLs).

### Rationale
Authoritative art filenames in **`Content/`**.

### Consequences
- **`CursorLayer.module.css`**, **`CursorLayer.tsx`**, **`Content/hand_trade_*.png`**, **`DESIGN.md`**.

---

## ADR-0317 — Bed POI: one rest per floor
Date: 2026-04-10

### Decision
**Bed** uses existing **`FloorPoi.opened`**: first interaction applies the rest heal and sets **`opened: true`**; later interactions only log **Already used.** (activity log), with a light shake—same pattern as an empty **Chest**.

### Rationale
Prevents farming infinite rests from one bed while keeping the POI clickable for feedback.

### Consequences
- **`web/src/game/state/poi.ts`**, **`web/src/procgen/population.ts`** (seed **`opened: false`**), **`web/src/game/types.ts`** (comment), **`DESIGN.md`** §9.
