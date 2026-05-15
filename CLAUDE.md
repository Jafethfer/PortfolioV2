# PortfolioV2

Interactive portfolio site. The stage features Terry Bogard (KOF) sprite walking, jumping, crouching across a parallax background with a train and stage music.

- `index.html` — HTML + Tailwind CDN
- `styles.css` — custom CSS, sprite animation rules
- `assets/js/main.js` — keyboard input, animation state machine
- `assets/img/` — sprite strips and stage backgrounds
- `assets/sfx/` — audio

## Terry sprite sheet

Source sheet (with cyan/teal backgrounds, 756×8896):
- `C:\Users\jafet\Pictures\terry-sheet.png`

Transparent version (used at runtime and for cropping):
- `assets/img/terry-sheet.png`

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

| Row | Frames | File | CSS class |
|-----|--------|------|-----------|
| 0   | 4 | `terry-idle.png` | `.terry-idle` |
| 2   | 2 | `terry-crouch.png` | `.terry-crouch` (entry transition, plays once) + `.terry-crouch-still` (static frame 1) |
| 3   | 4 | `terry-walk.png` | `.terry-forward` |
| 4   | 4 | `terry-backwards.png` | `.terry-backwards` |
| 6   | 8 | `terry-jump-forward.png` | `.terry-jump-forward` |
| 7   | 6 | `terry-jump-backward.png` | `.terry-jump-backward` |
| 9   | 6 | `terry-crouch-forward.png` | `.terry-crouch-forward` |

Vertical jump (`.terry-jump-up` / `.terry-jump-fall` / `.terry-jump-ground`) still uses the legacy hand-cropped `terry-jump.png` — not from the sheet pipeline.

## Sizing and keyframe math

- `#terry-stage-base-layer { container-type: inline-size; }` — children resolve `cqw` against the stage (75vw).
- `#terry-animation { --terry-height: 25cqw; }` — single source of truth for the standing-character height. All animations derive their width from this so cover-scaling maps one source frame onto the element exactly.
- For source frame `W × H` and element sized to match: `width = var(--terry-height) × W / 107` (using idle's 107 as the standing baseline). Crouch heights use `× 87/107` / `× 77/107` so Terry actually looks shorter when crouched.
- For an N-frame strip rendered one-frame-per-element, the keyframe end value is `N/(N-1) × 100%`:
  - 2 frames → 200% — BUT for one-shot transitions with `forwards`, use an explicit `100%` keyframe to pin the final state instead, otherwise CSS extrapolates back toward the underlying property value.
  - 4 frames → 133.33%, 6 → 120%, 8 → 114.29%.

## JS state model

Globals in `main.js`:
- `rightKey` / `leftKey` / `upKey` / `downKey` — physical key state.
- `lastDir` (`'right' | 'left' | null`) — most recently pressed horizontal arrow. **This drives the active direction**, not `rightKey`/`leftKey` directly. Falls back to the still-held opposite key on keyup. This is what fixed the "press opposite while held → Terry frozen" bug.
- `jumpUp` / `falling` / `forwardJump` / `backwardJump` — jump phase flags.
- `accumulated` (px) — X translate; `accumulatedY` — Y translate magnitude, applied as `accumulatedY × 0.3 cqw` so peak jump height is viewport-relative, not element-relative.
- `jumpXStep` — pixels per tick during a jump. Recomputed at takeoff as `stageWidth × JUMP_DISTANCE_PCT / JUMP_TICKS` (0.30 / 33) so a leap covers ~30% of the stage regardless of viewport.

Per-tick movement:
- Walk: ±10 px/tick
- Crouch-forward: +5 px/tick (half walk)
- Jump: `±jumpXStep`

`checkPosition` scrolls the train at the stage edge using `downKey ? 10 : 20` so crouch-scroll matches Terry's half-speed.

Jump cleanup `setTimeout` must reset `transform` to `translateX(...)` only — otherwise leftover Y from the last tick leaves Terry hovering above the baseline.

Arrow keys call `event.preventDefault()` in keydown to block the browser's default scrolling.
