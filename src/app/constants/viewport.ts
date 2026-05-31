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
