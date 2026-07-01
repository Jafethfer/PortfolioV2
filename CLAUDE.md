# PortfolioV2

Interactive portfolio site. The stage features Terry Bogard (KOF) walking, jumping, crouching across a parallax background with a train and stage music. Angular 21 (standalone, signals, SCSS).

## Commenting policy

Only write comments that explain **core engine mechanics** — the non-obvious *why* behind engine behavior (the physics/jump state machine, signal/effect wiring, audio rescaling, projectile spawn flow, data-contract interfaces in `models/`). If the code already says *what* it does, don't restate it.

Do **not** write low-value comments, especially in character/animation **data** files (`characters/*.ts`, `*-frames.ts`, character `*.scss`):
- No narrating a data literal — frame source rows/numbers, poses, silhouettes, per-frame `w/h/anchorX/durationMs`, or which sheet a sprite came from.
- No per-animation description blocks (what a punch/jump/crouch "looks like" or "reads as").
- No comparisons between characters (e.g. "how Joe differs from Terry", "same as Terry's walk", "matches Terry's timing").
- No rationale for a tuning number in a subclass (why a duration/anchor/volume has its value).

For a character subclass, the only acceptable comment is a one-line class identifier (e.g. `/** Joe Higashi — concrete Character subclass (Muay Thai fighter, JoeStage). */`). Frame-mapping details belong in commit messages or the Joe/Terry progress notes, not in the source. When in doubt, leave the comment out.

## Repo layout

- `src/index.html`, `src/main.ts`, `src/styles.scss` — entry + stage/parallax CSS (sprite styles live with each character)
- `src/tailwind.css` — Tailwind v4 entry (plain CSS so Sass doesn't try to process it)
- `src/app/app.{ts,html,scss}` — root component, hosts `<router-outlet>` (the active stage) + the global `<app-audio-mixer>`; picks which `Character` subclass the stage instantiates
- `src/app/models/character.ts` — shared types: `AnimationName`, `CharacterAnimations`, `CharacterVoices`, `Direction`
- `src/app/services/`
  - `input.service.ts` — keyboard → signals (`rightKey`, `leftKey`, `downKey`, `lastDir`, `jumpPressed`)
  - `game-loop.service.ts` — 30 ms `tick` signal; effects depending on it re-run each frame
  - `audio.service.ts` — voice/SFX/bg-music playback **and** the volume mixer. Owns three master-volume signals (`musicVolume` 0.2, `sfxVolume` 0.7, `voiceVolume` 0.3) that back the mixer sliders. Each play call passes the per-sound level it was authored at; the service rescales it by the live master (`effective = base × master / reference`) so a slider attenuates its whole channel proportionally. `playVoice(src, volume, category)` takes a `SoundCategory` (`'music' | 'sfx' | 'voice'`). Stages register their OST via `setBgMusic(src)`; the live bg element's volume tracks the music slider, and autoplay-blocked starts resume on the first user gesture.
- `src/app/characters/` — one folder per character. Each character is a concrete `@Component` subclass of `Character` plus its sprite stylesheet.
  - `terry.{ts,scss}` — `Terry extends Character`, selector `app-terry`, owns its animation map + sprite styles.
- `src/app/components/`
  - `character/character.ts` — abstract `@Directive()` base class; owns physics, input wiring, and animation state machine; declares `protected abstract readonly animations`. Has no template/styles of its own — concrete subclasses supply both.
  - `character/character.html` — shared template used by every character subclass via relative `templateUrl`.
  - `stage/stage.ts` — owns parallax bg, misc layer, train; measures own width + edges; computes `blocked` flags; instantiates the active `Character` subclass via `*ngComponentOutlet`.
  - `audio-mixer/audio-mixer.ts` — global volume mixer (three sliders: music / SFX / voices) bound to the `AudioService` master-volume signals. Lives at the app root, outside any stage, so it persists across stage navigation.
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

Lives in a Jimp install at `C:\Users\jafet\Documents\PortfolioV2Assets\` (Node v25). Set up once via `npm install` in that folder (the `package.json` already declares the Jimp dep). Kept OUTSIDE the repo (deps are heavyweight, workflow is one-off) but inside `Documents\` so Windows doesn't clear it on reboot like it did the previous `\Temp\bg-removal\` location.

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
- `cropframes <src> <trans> <row> <i,j,k> <outDir>` crops a hand-picked frame LIST to tight bboxes (`0.png…`), printing per-frame `w/h/anchorX_feet/anchorX_boxC/anchorY`.
- `mergeframes <src> <trans> <row> <i,j,…> <out.png>` crops the **combined span** of several adjacent frame boxes as ONE sprite — for a pose the box detector split across boxes (e.g. Joe's crouch-sweep windup lived across row3 boxes 5+6). Union of the boxes' extents, tight-bboxed.
- `crop` has two alignment modes:
  - **`center` (default)** — detect each sprite's bounding box by scanning per-column bg-fraction in the source sheet (≥85% → "between frames"). Pick the (N−1) widest gap runs, **merge runs separated by 1–2 columns** (anti-aliasing splits gaps), then place each divider at the centre of the **tightest pure-bg subrun** (≥99.5% bg) within the gap so toes/fingertips that bleed into the gap don't get cropped. Each sprite's bbox is centred in its output cell. Right for step animations (walk, idle) where every frame has roughly the same silhouette width.
  - **`box`** — use the source sheet's frame BOXES (the cyan/teal rectangles) directly as the cropping spans, and centre each box in its output cell. Boxes vary in width when a limb extends but stay positioned around the character's body anchor, so this keeps the body's pixel position constant across frames — correct for attack animations where one frame extends an arm/leg far beyond the others. Note: residual body shift from genuine artistic lean in the source is preserved (this mode only removes the artificial centring shift).
- Y bounds are expanded into the safe gap to neighbouring rows so motion lines / extended limbs aren't clipped.
- Output cells are `maxFrameW + 4` wide with each sprite centred — prevents adjacent-frame bleed during step animations.

### `anchor-montage.mjs` — alignment verifier
```
node anchor-montage.mjs <out.png> <file,anchorX,anchorY> <file,anchorX,anchorY> …
```
Composites each cropped frame onto a fixed cell so its `anchorX` lands on a shared red guide column and `anchorY` (foot) on the cell baseline, and also emits `<out>-overlay.png` with all frames stacked semi-transparent. Ghosting in the overlay shows body drift, so it's the go-to check for whether a chosen anchor (feet-centre vs bbox-centre) keeps the torso planted before wiring an animation into the character.

**Output convention:** all verification/preview PNGs (anchor montages, `joe-zoom` contact sheets, etc.) are written to the `PortfolioV2Assets\` root so they persist and are easy to open. These `.mjs` tools all run from that folder (that's where the Jimp install lives); do not copy them elsewhere.

### `foot-detect.mjs` / `zoom-ruler.mjs` — foot-position helpers
```
node foot-detect.mjs <file> <file> …
node zoom-ruler.mjs <out.png> <file> <file> …
```
`foot-detect` scans the bottom ~12% of each sprite and reports the ground-contact pixel **clusters** (x-range + centre). `zoom-ruler` stacks the frames scaled up with a 5px column ruler so foot columns can be read by eye. Both report clusters **by screen x-position only** — they do NOT know anatomical left vs right, and cannot tell which of two grounded feet is the pivot. That identity must come from the user (or the reference animation).

### Planted-foot anchoring (kicks and any pivot move)
For a move where one foot must stay planted while a limb extends (kicks especially), the rule is: **`anchorX − pivotFootColumn` must be the same constant on every frame.** That pins the pivot foot to one world spot; the body/leg then extend around it. Method:
1. Get the pivot foot's column per frame from `foot-detect` (single ground cluster = unambiguous; if a frame has two feet, **ask which one is the pivot** — the tool can't tell).
2. Pick the constant `K` so the pivot lands where **idle** leaves that same foot (no pop on entry): measure idle's foot world (`26 + (idleFootCol − idleAnchorX)·scale`) and solve `anchorX = pivotFootColumn − (idleFootCol − idleAnchorX)`.
3. `anchorX` going **negative** on a wide extension frame is expected and correct (Terry's heavy kick frame 4 is `-6`; Joe's light-kick extension is `-2`).
Do NOT anchor kicks on the bbox-centre or foot-centre — those track the moving silhouette, so the planted foot visibly slides.

## Row → animation mapping

Row indices below match the rewritten `sprite-tool.mjs` (79 detected rows). The original tool's 67-row indexing differed for rows after #9 — re-run `node sprite-tool.mjs analyze ...` if a mapping doesn't match your sheet.

| Row | Frames | Folder (in `public/assets/img/characters/terry/`) | Notes |
|-----|--------|--------------------------------|-------|
| 0   | 4 | `idle/` | standing baseline (107px H) |
| 2   | 2 | `crouch/` | entry + crouchStill |
| 3   | 4 | `walk/` | forward |
| 4   | 4 | `backwards/` | walk-back |
| 6   | 8 | `jump-forward/` | |
| 7   | 6 | `jump-backward/` | |
| 9   | 6 | `crouch-forward/` | |
| 50  | 7 | `power-wave/` | casting (Power Wave) — Terry's body |
| 51  | 6 | `power-wave/projectile/` | flame projectile strip, sub-row below #50 |

Other rows (light/heavy normals, Crack Shoot, Burning Knuckle, Rising Tackle) live on the sheet but weren't tabulated here — read their frame-data files for source rows when needed.

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
