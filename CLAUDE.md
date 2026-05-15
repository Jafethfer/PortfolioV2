# PortfolioV2

Interactive portfolio site. The stage features Terry Bogard (KOF) walking, jumping, crouching across a parallax background with a train and stage music. Angular 21 (standalone, signals, SCSS).

## Repo layout

- `src/index.html`, `src/main.ts`, `src/styles.scss` — entry + stage/parallax CSS (sprite styles live with each character)
- `src/tailwind.css` — Tailwind v4 entry (plain CSS so Sass doesn't try to process it)
- `src/app/app.{ts,html,scss}` — root component, hosts `<app-stage>` + `<app-music-control>`; picks which `Character` subclass the stage instantiates
- `src/app/models/character.ts` — shared types: `AnimationName`, `CharacterAnimations`, `CharacterVoices`, `Direction`
- `src/app/services/`
  - `input.service.ts` — keyboard → signals (`rightKey`, `leftKey`, `downKey`, `lastDir`, `jumpPressed`)
  - `game-loop.service.ts` — 30 ms `tick` signal; effects depending on it re-run each frame
  - `audio.service.ts` — voice + bg music playback
- `src/app/characters/` — one folder per character. Each character is a concrete `@Component` subclass of `Character` plus its sprite stylesheet.
  - `terry.{ts,scss}` — `Terry extends Character`, selector `app-terry`, owns its animation map + sprite styles.
- `src/app/components/`
  - `character/character.ts` — abstract `@Directive()` base class; owns physics, input wiring, and animation state machine; declares `protected abstract readonly animations`. Has no template/styles of its own — concrete subclasses supply both.
  - `character/character.html` — shared template used by every character subclass via relative `templateUrl`.
  - `stage/stage.ts` — owns parallax bg, misc layer, train; measures own width + edges; computes `blocked` flags; instantiates the active `Character` subclass via `*ngComponentOutlet`.
  - `music-control/music-control.ts` — bg music toggle
- `public/assets/img/` — sprite strips and stage backgrounds (served at `/assets/img/…`)
- `public/assets/sfx/` — audio

## Architectural rules

- **Characters do not know about the stage.** The character receives `worldWidth`, `blockedRight`, `blockedLeft` as Angular inputs from its parent and never reaches into the DOM for stage geometry.
- **Polymorphism by class inheritance — game-engine style.** Each character is a `@Component` that `extends Character` (the abstract `@Directive()` base). The subclass supplies its own `selector`, shared `templateUrl: '../components/character/character.html'`, dedicated `styleUrl: './<name>.scss'`, `protected override readonly animations` map, optional `voices`, and `protected override` tuning fields (walkSpeed, jumpDistancePct, etc).
- **Stage spawns the character imperatively.** Stage's template has `<ng-container #characterHost></ng-container>` as a host slot. In `afterNextRender`, Stage calls `viewContainerRef.createComponent(this.characterClass())` and stores `ComponentRef.instance` in a `signal<Character | null>`; Stage forwards its computed `worldWidth`/`blockedRight`/`blockedLeft` into the spawned instance via `ComponentRef.setInput`. This mirrors a game scene instantiating a player prefab, and avoids the `viewChild` resolution issues that come with `*ngComponentOutlet`. App picks the character with `[characterClass]="SomeCharacter"`. Adding a character = new `<name>.ts` + `<name>.scss` pair under `src/app/characters/` and a one-line change in App.
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
node sprite-tool.mjs crop    <source> <transparent> <row> <frames> <out> [align=center|box]
```
- Detects **67 rows** by connected components of the light-teal frame-box colour (0,128,128).
- `contact` builds an indexed grid (3×5 pixel digit font baked in) — split into 10-row chunks for easy browsing.
- `crop` has two alignment modes:
  - **`center` (default)** — detect each sprite's bounding box by scanning per-column bg-fraction in the source sheet (≥85% → "between frames"). Pick the (N−1) widest gap runs, **merge runs separated by 1–2 columns** (anti-aliasing splits gaps), then place each divider at the centre of the **tightest pure-bg subrun** (≥99.5% bg) within the gap so toes/fingertips that bleed into the gap don't get cropped. Each sprite's bbox is centred in its output cell. Right for step animations (walk, idle) where every frame has roughly the same silhouette width.
  - **`box`** — use the source sheet's frame BOXES (the cyan/teal rectangles) directly as the cropping spans, and centre each box in its output cell. Boxes vary in width when a limb extends but stay positioned around the character's body anchor, so this keeps the body's pixel position constant across frames — correct for attack animations where one frame extends an arm/leg far beyond the others. Note: residual body shift from genuine artistic lean in the source is preserved (this mode only removes the artificial centring shift).
- Y bounds are expanded into the safe gap to neighbouring rows so motion lines / extended limbs aren't clipped.
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
| 26  | 3 | `terry-light-punch.png` | `.terry-light-punch` (one-shot, `forwards`) | `lightPunch` |

Vertical jump (`.terry-jump-up` / `.terry-jump-fall` / `.terry-jump-ground`) still uses the legacy hand-cropped `terry-jump.png` — not from the sheet pipeline.

## Sizing and keyframe math

- `app-stage .stage { container-type: inline-size; }` — children resolve `cqw` against the stage (75 vw). Widening the stage scales every sprite and animation up — Terry's `--terry-height: 25cqw` is bound to this container.
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

Train scroll rate is owned by the Stage (`walkScrollRate` / `crouchScrollRate` inputs, default 20 / 10) — it scrolls each tick the character is **pinned at an edge AND still holding the direction key into that edge** (right key at the right limit, left key at the left limit). Releasing the key stops the scroll even though the character is still pixel-aligned with the edge. Equivalently: when the character has nowhere left to walk, the world walks instead.

`lastDir` (`'right' | 'left' | null`) drives active direction, not `rightKey`/`leftKey` directly. It's the most-recently pressed horizontal arrow and falls back to the still-held opposite key on keyup — this is what fixes the "press opposite while held → character frozen" bug.

`InputService` calls `event.preventDefault()` on arrow keys in keydown to block the browser's default page scrolling.
