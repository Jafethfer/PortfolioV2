/**
 * The stage width (px) the engine's per-tick pixel rates are calibrated
 * against. Effective rates scale by `currentWidth / REFERENCE_WIDTH` so
 * movement and world-scroll cover the same FRACTION of the stage on any
 * viewport (a fixed px/tick would feel faster on a narrower stage).
 *
 * ~75vw of a 1920px screen. Shared by `Character` (walk/crouch speed) and
 * `Stage` (scroll rates) as the default for their `referenceWidth` fields, so
 * the two stay consistent from one place. Retune if your design viewport
 * differs.
 */
export const REFERENCE_WIDTH = 1440;

/**
 * True on touch-primary devices (no hover, coarse pointer) — the same signal
 * the on-screen gamepad uses to reveal itself and the stages use to size for
 * the viewport. Used to default the HUD overlays (controls legend, audio mixer)
 * to COLLAPSED on phones/tablets, where an always-open corner panel would eat a
 * chunk of a small landscape screen, while keeping them open on desktop.
 *
 * Read once at module load. `matchMedia` is guarded for non-browser contexts so
 * an SSR/prerender pass can't throw. Keep this media query in lockstep with the
 * `@media (hover: none) and (pointer: coarse)` blocks in the overlay stylesheets.
 */
export const IS_COMPACT_POINTER =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: none) and (pointer: coarse)').matches
    : false;
