import { Injectable, signal } from '@angular/core';
import { Direction, MotionInput } from '../models/character';

const ARROW_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']);

/** Directional opposite of each motion input — used by `matchMotion` to break a
 * partial motion when a contradicting tap arrives. */
const OPPOSITE_INPUT: Record<MotionInput, MotionInput> = {
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
};

interface MotionEvent { input: MotionInput; t: number; }

/** Max time the entire motion can span. */
const MOTION_WINDOW_MS = 450;
/** Cap on stored events so arrow-mashing can't grow the buffer without bound. */
const MOTION_BUFFER_LIMIT = 16;
/** Max gap between the two left-arrow taps that trigger a backstep. */
const DOUBLE_TAP_WINDOW_MS = 300;

/**
 * Pure keyboard state. Exposes signals consumers can react to via effects.
 * Knows nothing about characters, stages, or animation — just keys.
 */
@Injectable({ providedIn: 'root' })
export class InputService {
  readonly rightKey = signal(false);
  readonly leftKey = signal(false);
  readonly downKey = signal(false);
  /** Increments on each ArrowUp keydown — consumers detect change to fire one-shot. */
  readonly jumpPressed = signal(0);
  /** Whether the jump direction is being HELD (only the joystick sets this;
   * keyboard jump is a one-shot). Drives land-time re-jump. */
  readonly jumpHeld = signal(false);
  /** Increments on each `A` keydown — one-shot for the light-punch attack. */
  readonly lightPunchPressed = signal(0);
  /** Increments on each `S` keydown — one-shot for the heavy-punch attack. */
  readonly heavyPunchPressed = signal(0);
  /** Increments on each `Z` keydown — one-shot for the light-kick attack. */
  readonly lightKickPressed = signal(0);
  /** Increments on each `X` keydown — one-shot for the heavy-kick attack. */
  readonly heavyKickPressed = signal(0);
  /** Increments on an ArrowLeft double-tap within `DOUBLE_TAP_WINDOW_MS`. Drives
   * the backstep. */
  readonly backstepPressed = signal(0);
  /** Most-recently pressed horizontal arrow. Survives keyup of the opposite. */
  readonly lastDir = signal<Direction>(null);

  /** Buffer of recent directional keydowns used by `matchMotion`. */
  private _motionBuffer: MotionEvent[] = [];

  constructor() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /**
   * Matches `sequence` as an in-order subsequence of recent directional keydowns
   * within `windowMs`, ignoring stray keys between elements. A tap opposite to a
   * direction the motion relies on cancels it (resetting progress for a later
   * re-attempt). Consumes the matched events on success so the move can't
   * trigger twice. Returns whether a match was consumed.
   */
  matchMotion(sequence: readonly MotionInput[], windowMs: number = MOTION_WINDOW_MS): boolean {
    if (sequence.length === 0) return false;
    const now = performance.now();
    const cutoff = now - windowMs;
    const finalOpposite = OPPOSITE_INPUT[sequence[sequence.length - 1]];
    // Indices of matched events in _motionBuffer, in order.
    const matched: number[] = [];
    let seqIdx = 0;
    let complete = false;
    for (let i = 0; i < this._motionBuffer.length; i++) {
      const evt = this._motionBuffer[i];
      if (evt.t < cutoff) continue;
      if (complete) {
        // A finished motion is only undone by a reversal against its final
        // direction; the reversal tap may itself start a fresh attempt.
        if (evt.input !== finalOpposite) continue;
        seqIdx = 0;
        matched.length = 0;
        complete = false;
      }
      // A tap opposite to the awaited direction cancels the partial motion.
      if (seqIdx > 0 && evt.input === OPPOSITE_INPUT[sequence[seqIdx]]) {
        seqIdx = 0;
        matched.length = 0;
      }
      if (evt.input === sequence[seqIdx]) {
        matched.push(i);
        seqIdx++;
        if (seqIdx === sequence.length) complete = true;
      }
    }
    if (!complete) return false;
    // Splice in reverse so earlier indices stay valid.
    for (let j = matched.length - 1; j >= 0; j--) {
      this._motionBuffer.splice(matched[j], 1);
    }
    return true;
  }

  private _pushMotion(input: MotionInput): void {
    this._motionBuffer.push({ input, t: performance.now() });
    // Trim oldest entries by age (window × 2 for slack) and by hard cap.
    const cutoff = performance.now() - MOTION_WINDOW_MS * 2;
    while (this._motionBuffer.length && this._motionBuffer[0].t < cutoff) {
      this._motionBuffer.shift();
    }
    while (this._motionBuffer.length > MOTION_BUFFER_LIMIT) {
      this._motionBuffer.shift();
    }
  }

  /** Backstep is a left→left double-tap. Fires the signal and drops the pair so
   * a third tap doesn't re-trigger. */
  private _detectBackstep(): void {
    const buf = this._motionBuffer;
    if (buf.length < 2) return;
    const last = buf[buf.length - 1];
    const prev = buf[buf.length - 2];
    if (prev.input === 'left' && last.t - prev.t <= DOUBLE_TAP_WINDOW_MS) {
      this.backstepPressed.update((n) => n + 1);
      buf.length = buf.length - 2;
    }
  }

  // Device-agnostic input API: keyboard handlers and the touch gamepad both
  // drive state through these methods, so motion/backstep/`lastDir` logic lives
  // in one place. Each `press*` models a FRESH press (repeats are ignored).

  pressRight(): void {
    this.rightKey.set(true);
    this.lastDir.set('right');
    this._pushMotion('right');
  }
  releaseRight(): void {
    this.rightKey.set(false);
    if (this.lastDir() === 'right') this.lastDir.set(this.leftKey() ? 'left' : null);
  }

  pressLeft(): void {
    this.leftKey.set(true);
    this.lastDir.set('left');
    this._pushMotion('left');
    this._detectBackstep();
  }
  releaseLeft(): void {
    this.leftKey.set(false);
    if (this.lastDir() === 'left') this.lastDir.set(this.rightKey() ? 'right' : null);
  }

  pressDown(): void {
    this.downKey.set(true);
    this._pushMotion('down');
  }
  releaseDown(): void {
    this.downKey.set(false);
  }

  /** Up is a one-shot (jump) — it also seeds the motion buffer so `down→up`
   * anti-air specials read a touch/keyboard Up the same. */
  pressJump(): void {
    this._pushMotion('up');
    this.jumpPressed.update((n) => n + 1);
  }

  /** Set/clear the held-jump flag (joystick up). The character re-jumps on
   * landing while this is true, so holding up keeps the character hopping. */
  setJumpHeld(held: boolean): void {
    this.jumpHeld.set(held);
  }

  pressLightPunch(): void {
    this.lightPunchPressed.update((n) => n + 1);
  }
  pressHeavyPunch(): void {
    this.heavyPunchPressed.update((n) => n + 1);
  }
  pressLightKick(): void {
    this.lightKickPressed.update((n) => n + 1);
  }
  pressHeavyKick(): void {
    this.heavyKickPressed.update((n) => n + 1);
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (ARROW_KEYS.has(e.key)) e.preventDefault();
    if (e.repeat) return;
    if (e.key === 'ArrowRight') {
      this.pressRight();
    } else if (e.key === 'ArrowLeft') {
      this.pressLeft();
    } else if (e.key === 'ArrowDown') {
      this.pressDown();
    } else if (e.key === 'ArrowUp') {
      this.pressJump();
    } else if (e.key === 'a' || e.key === 'A') {
      this.pressLightPunch();
    } else if (e.key === 's' || e.key === 'S') {
      this.pressHeavyPunch();
    } else if (e.key === 'z' || e.key === 'Z') {
      this.pressLightKick();
    } else if (e.key === 'x' || e.key === 'X') {
      this.pressHeavyKick();
    }
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowRight') {
      this.releaseRight();
    } else if (e.key === 'ArrowLeft') {
      this.releaseLeft();
    } else if (e.key === 'ArrowDown') {
      this.releaseDown();
    }
  };
}
