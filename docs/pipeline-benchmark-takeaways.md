# Pipeline benchmark takeaways (GPU composer + html2canvas)

Engineering notes from measuring the **offscreen 3D render target**, **EffectComposer** (composite + dither), and **`html2canvas` → `CanvasTexture`** path. Numbers come from the harness under `web/src/bench/` and Playwright matrix `web/e2e/pipelineBenchMatrix.spec.ts` (Chromium, synthetic HUD for html2canvas).

## 1. Composer buffers dominate steady “VRAM math,” not the 3D scene RT

The game renders to an RT sized to the **game viewport** in CSS × capped DPR (e.g. 920×518 × DPR). **EffectComposer** keeps **two full-stage** targets (1920×1080 × DPR) using three.js’s default **`HalfFloatType`** ping-pong. In the budgeting model, **two RGBA16F surfaces at stage resolution** are the largest line item; the **scene RT** grows with **game rect × DPR** but stays smaller until the 3D view is very large.

**Implication:** Shrinking **game layout** helps scene RT and 3D work, but **stage resolution, DPR cap, and composer format** move the biggest estimated GPU footprint.

## 2. `pixelRatioCap` only matters when device DPR exceeds the effective cap

On **1×** `devicePixelRatio`, lowering **cap** (e.g. 1.5 → 1.0) may **not** change buffer sizes, because effective DPR is already **min(deviceDPR, cap) = 1**. On **2×** displays, **cap 1.0** pulls **drawing buffers** back to **1920×1080** and drops **estimated** totals into the same ballpark as **1×**.

**Implication:** GPU tier presets matter most on **HiDPI** (Retina laptops, many phones). On 1× displays, cap is mostly **headroom** unless internal resolution policy changes.

## 3. 2× @ cap 1.5 is a large step up vs 1×

Matrix runs showed roughly **~59 MiB → ~133 MiB** class **estimates** (model includes assumed depth; see `web/src/bench/pipelineEstimates.ts`) when moving from **1×** to **2×** with **cap 1.5**, consistent with **~2.25×** area on stage-sized targets plus a larger scene RT.

**Implication:** Treat **default high cap on Retina** as a **quality / cost** tradeoff; weak GPUs and memory-constrained tabs benefit from **lower cap**.

## 4. `cap 1.25` is a real middle setting

**2× DPR + cap 1.25** produced intermediate draw sizes (e.g. **2400×1350**) and **~92 MiB** estimated totals—between **1×-class** and **2× @ 1.5**.

**Implication:** The **balanced** GPU preset is doing meaningful work, not a tiny tweak between low and high.

## 5. Presenter GPU time stayed modest; large game rect nudged it

**Composite + dither** remained on the order of **~1.4–2.0 ms/frame** in the harness across matrix scenarios. The **largest game rect** scenario had the **highest** ms/frame (~2 ms), consistent with a bigger **scene RT** and more pixels in the 3D pass.

**Implication:** At current sizes, **per-frame presenter cost** is unlikely to be the first bottleneck vs **memory/bandwidth** and **html2canvas** on real hardware with a full HUD.

## 6. html2canvas: cold vs steady state

Short runs mix a **cold** first capture with **warmer** repeats. **Means** over 3 iterations are dominated by the first sample. On the **synthetic** capture DOM, **steady** captures clustered around **~56–59 ms** in Chromium; the **real** game HUD will be **heavier**.

**Implication:** When interpreting benchmarks, report **steady** (e.g. drop first) or **more iterations**; expect **higher ms** and **more DOM work** in production than the micro-fixture.

## 7. Very high device DPR with `cap 1.5` matches 2× @ 1.5 in buffer size

Effective DPR is **`min(devicePixelRatio, pixelRatioCap)`** (also adjusted for visual viewport scale in the game). So **3×** device DPR with **cap 1.5** matches **2×** with **cap 1.5** for **stage** and **scene** buffer dimensions until the cap is raised above 1.5.

**Implication:** The **cap** is doing its job on dense mobile displays: you do not pay **extra** stage resolution beyond the cap until you **increase the cap**.

## 8. Where to invest if optimizing

| Priority | Lever | Rationale |
|----------|--------|------------|
| High | **Composer RT format / ping-pong** (e.g. avoid default half-float if not needed) | Largest **steady** estimated GPU footprint in the model |
| High | **`pixelRatioCap` on HiDPI** | Already wired; large swing in estimated footprint (e.g. ~59 vs ~133 MiB class at 2×) |
| Medium | **html2canvas cadence + HUD weight** | Main-thread spikes; synthetic bench understates real capture |
| Medium | **Game viewport CSS size** | Moves **scene RT**; smaller effect than stage×DPR on composer |
| Lower | **Per-frame `FramePresenter.render()`** | Already low in harness; profile real content first |

## 9. Caveats

- **“VRAM” / MiB figures** are a **spreadsheet model** (depth assumptions; ignores driver pools and hidden allocations).
- Playwright runs **real WebGL** and **real html2canvas**, but **not** the full React HUD or all game assets.
- **`performance.memory`** in Chrome was **noisy** and not reliable for small deltas in these runs.

## Tooling reference

| What | Where |
|------|--------|
| VRAM formulas + DPR helpers | `web/src/bench/pipelineEstimates.ts` |
| Single-run browser bench | `web/bench-pipeline.html`, `npm run bench:pipeline` |
| Matrix scenarios list | `web/src/bench/pipelineScenarios.ts` |
| Playwright matrix | `npm run test:bench:matrix` (`web/e2e/pipelineBenchMatrix.spec.ts`, `playwright.bench.config.ts`) |
| Vitest (estimate math) | `web/src/bench/pipelineEstimates.test.ts` |
