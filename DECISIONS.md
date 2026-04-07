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
