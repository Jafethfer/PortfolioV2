# PortfolioV2

Interactive portfolio site. The stage features Terry Bogard (KOF) walking, jumping, crouching across a parallax background with a train and stage music. Angular 21 (standalone, signals, SCSS).

## Repo layout

- `src/index.html`, `src/main.ts`, `src/styles.scss` — entry + global sprite/stage CSS
- `src/tailwind.css` — Tailwind v4 entry (plain CSS so Sass doesn't try to process it)
- `src/app/app.{ts,html,scss}` — root component, hosts `<app-stage>` + `<app-music-control>`
- `src/app/models/character.ts` — types: `CharacterConfig`, `AnimationName`, `Direction`, `CharacterVoices`
- `src/app/services/`
  - `input.service.ts` — keyboard → signals (`rightKey`, `leftKey`, `downKey`, `lastDir`, `jumpPressed`)
  - `game-loop.service.ts` — 30 ms `tick` signal; effects depending on it re-run each frame
  - `audio.service.ts` — voice + bg music playback
- `src/app/characters/terry.ts` — `TERRY_CONFIG` (animation class map + voices stub)
- `src/app/components/`
  - `character/character.ts` — generic, config-driven character; takes `[config]`, `[worldWidth]`, `[blockedRight]`, `[blockedLeft]`; exposes `worldX()` / `width()` for the parent
  - `stage/stage.ts` — owns parallax bg, misc layer, train; measures own width + edges; computes `blocked` flags
  - `music-control/music-control.ts` — bg music toggle
- `public/assets/img/` — sprite strips and stage backgrounds (served at `/assets/img/…`)
- `public/assets/sfx/` — audio

## Architectural rules

- **Characters do not know about the stage.** The character receives `worldWidth`, `blockedRight`, `blockedLeft` as Angular inputs from its parent and never reaches into the DOM for stage geometry.
- **Polymorphism by composition, not inheritance.** Add a new character by writing a new `CharacterConfig` (sprite class names + voice files + tuning) and dropping a matching `.<name>-*` CSS block into `styles.scss`. Pass it via `[characterConfig]`. For per-character behavior overrides (a unique jab combo, different physics on a stage), inject the `Character` component into a directive and adjust state — no class subclass needed.
- **Signals over imperative state.** All character state is `signal()` (e.g. `accumulated`, `animation`, `inJump`). The template binds to `animClass()` / `transform()` computeds. Physics runs in an `effect()` that depends only on `loop.tick()`; everything else is read inside `untracked()` so we don't feedback-loop.
- **Jump phases are tick-driven, not setTimeout-driven.** `_physicsTick` checks elapsed ticks since takeoff against `jumpApexMs` and `jumpDurationMs` to decide ascend/descend/land. Easier to reason about than scheduled callbacks.

## Terry sprite sheet

Source sheet (with cyan/teal backgrounds, 756×8896):
- `C:\Users\jafet\Pictures\terry-sheet.png`

Transparent version (used at runtime and for cropping):
- `public/assets/img/terry-sheet.png`

Keep BOTH around. The cropping tool needs the source (light-teal frame boxes mark frame boundaries) AND the transparent version (alpha mask for sprite Y-bounds, output blits).

## Tooling

Lives in a Jimp install at `C:\Users\jafet\AppData\Local\Temp\bg-removal\` (Node v25). Set up once via `npm init -y && npm install jimp` in that folder.

### `remove-bg.mjs` — background removal
```
node remove-bg.mjs <input.png> <output.png> [tolerance=28]
```
Auto-detects up to ~4 dominant background colours via horizontal-run weight scoring with a 5× gap cutoff (separates true bg fills from large flat sprite regions). Used once on the master sheet to produce the transparent `terry-sheet.png`.

### `sprite-tool.mjs` — row/frame detection + cropping
```
node sprite-tool.mjs analyze <source>
node sprite-tool.mjs preview <source> <transparent> <row> <out>
node sprite-tool.mjs contact <source> <transparent> <out> [start] [end]
node sprite-tool.mjs crop    <source> <transparent> <row> <frames> <out>
```
- Detects **67 rows** by connected components of the light-teal frame-box colour (0,128,128).
- `contact` builds an indexed grid (3×5 pixel digit font baked in) — split into 10-row chunks for easy browsing.
- `crop` finds frame dividers by scanning per-column bg-fraction in the source sheet (≥85% → "between frames"). It picks the (N−1) widest gap runs, **merges runs separated by 1–2 columns** (anti-aliasing splits gaps), then places each divider at the centre of the **tightest pure-bg subrun** (≥99.5% bg) within the gap so toes/fingertips that bleed into the gap don't get cropped. Y bounds are expanded into the safe gap to neighbouring rows so motion lines / extended limbs aren't clipped.
- Output cells are `maxFrameW + 4` wide with each sprite centred — prevents adjacent-frame bleed during step animations.

## Row → animation mapping

| Row | Frames | File (in `public/assets/img/`) | CSS class | `CharacterConfig.animations` key |
|-----|--------|--------------------------------|-----------|----------------------------------|
| 0   | 4 | `terry-idle.png` | `.terry-idle` | `idle` |
| 2   | 2 | `terry-crouch.png` | `.terry-crouch` (entry, plays once) + `.terry-crouch-still` (static frame 1) | `crouch` / `crouchStill` |
| 3   | 4 | `terry-walk.png` | `.terry-forward` | `forward` |
| 4   | 4 | `terry-backwards.png` | `.terry-backwards` | `backwards` |
| 6   | 8 | `terry-jump-forward.png` | `.terry-jump-forward` | `jumpForward` |
| 7   | 6 | `terry-jump-backward.png` | `.terry-jump-backward` | `jumpBackward` |
| 9   | 6 | `terry-crouch-forward.png` | `.terry-crouch-forward` | `crouchForward` |

Vertical jump (`.terry-jump-up` / `.terry-jump-fall` / `.terry-jump-ground`) still uses the legacy hand-cropped `terry-jump.png` — not from the sheet pipeline.

## Sizing and keyframe math

- `app-stage .stage { container-type: inline-size; }` — children resolve `cqw` against the stage (75 vw).
- `app-character > div { --terry-height: 25cqw; }` — single source of truth for the standing-character height. All animations derive their width from this so cover-scaling maps one source frame onto the element exactly.
- For source frame `W × H` and element sized to match: `width = var(--terry-height) × W / 107` (using idle's 107 as the standing baseline). Crouch heights use `× 87/107` / `× 77/107` so Terry actually looks shorter when crouched.
- For an N-frame strip rendered one-frame-per-element, the keyframe end value is `N/(N-1) × 100%`:
  - 2 frames → 200% — BUT for one-shot transitions with `forwards`, use an explicit `100%` keyframe to pin the final state instead, otherwise CSS extrapolates back toward the underlying property value.
  - 4 frames → 133.33%, 6 → 120%, 8 → 114.29%.

## Movement model

Per-tick (30 ms) from `_physicsTick` in `character.ts`:
- Walk: ±`walkSpeed` (default 10) px/tick
- Crouch-forward: +`crouchSpeed` (default 5) px/tick (half walk)
- Jump: ±`_jumpXStep` per tick, computed at takeoff as `worldWidth × jumpDistancePct / jumpTicks` (default `0.30 / 33`) so a leap covers ~30% of the stage regardless of viewport.

Train scroll rate is owned by the Stage (`walkScrollRate` / `crouchScrollRate` inputs, default 20 / 10) — it scrolls when the character is `blockedRight`/`blockedLeft`. This matches the character's ground speed so the world appears to move under them.

`lastDir` (`'right' | 'left' | null`) drives active direction, not `rightKey`/`leftKey` directly. It's the most-recently pressed horizontal arrow and falls back to the still-held opposite key on keyup — this is what fixes the "press opposite while held → character frozen" bug.

`InputService` calls `event.preventDefault()` on arrow keys in keydown to block the browser's default page scrolling.
