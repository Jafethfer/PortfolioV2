import { Injectable, signal } from '@angular/core';
import { Direction, MotionInput } from '../models/character';

const ARROW_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']);

/** Directional opposite of each motion input — used by `matchMotion` to break a
 * partial motion when a contradicting tap arrives (a 'back' can't sit inside a
 * 'toward' motion). */
const OPPOSITE_INPUT: Record<MotionInput, MotionInput> = {
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
};

interface MotionEvent { input: MotionInput; t: number; }

/** Max time the entire motion can span. 450ms feels right for a 2-input
 * special (forgiving but not so loose that random key mashing triggers it). */
const MOTION_WINDOW_MS = 450;
/** Cap on stored events so a long idle period of arrow-mashing doesn't grow
 * the buffer without bound. Far more than any motion needs. */
const MOTION_BUFFER_LIMIT = 16;
/** Max gap between the two left-arrow taps that trigger a backstep. Slightly
 * tighter than `MOTION_WINDOW_MS` so a deliberate double-tap registers but a
 * casual walk-press-release-press doesn't read as a backstep by accident. */
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
  /** Increments on each `A` keydown — one-shot for the light-punch attack. */
  readonly lightPunchPressed = signal(0);
  /** Increments on each `S` keydown — one-shot for the heavy-punch attack. */
  readonly heavyPunchPressed = signal(0);
  /** Increments on each `Z` keydown — one-shot for the light-kick attack. */
  readonly lightKickPressed = signal(0);
  /** Increments on each `X` keydown — one-shot for the heavy-kick attack. */
  readonly heavyKickPressed = signal(0);
  /** Increments when the player double-taps ArrowLeft within
   * `DOUBLE_TAP_WINDOW_MS`. Drives the backstep — purely motion-triggered,
   * no attack button involved. */
  readonly backstepPressed = signal(0);
  /** Most-recently pressed horizontal arrow. Survives keyup of the opposite. */
  readonly lastDir = signal<Direction>(null);

  /** Ring-ish buffer of recent directional keydown events used by
   * `matchMotion` to detect special-move inputs. Not a signal — consumers
   * call `matchMotion` imperatively, so we don't need fine-grained reactivity. */
  private _motionBuffer: MotionEvent[] = [];

  constructor() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  /**
   * Looks for `sequence` as an in-order subsequence of the recent directional
   * keydown history, with the entire span occurring within `windowMs` of now.
   * On match, removes the matched events so the same inputs can't trigger
   * the move twice. Returns whether a match was consumed.
   *
   * Matching ignores extra keys between sequence elements — pressing Down,
   * then accidentally tapping Up, then pressing Left still counts as
   * `['down','left']`. This matches how arcade input is forgiving with
   * stray buttons.
   *
   * Reversals break the motion — a tap OPPOSITE to a direction the motion
   * relies on cancels it:
   *   - opposite of the element currently being waited for, mid-motion: `down,
   *     left, right` does NOT match `['down','right']` (the `left` contradicts
   *     the `right` it's building toward);
   *   - opposite of the FINAL element, after the motion completes: `down, left,
   *     right` does NOT match `['down','left']` either (the `right` reverses
   *     out of the finished back-motion).
   * A cancel resets progress, so a later clean re-attempt within the same
   * window still matches. Contradicting-but-earlier taps are fine (`left, down,
   * right` matches `['down','right']`, which is also how the
   * `['left','down','right']` super stays distinct from a plain quarter-circle).
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
        // direction; any other trailing tap is an ignorable stray.
        if (evt.input !== finalOpposite) continue;
        seqIdx = 0;
        matched.length = 0;
        complete = false;
        // fall through — this reversal tap may itself start a fresh attempt.
      }
      // A tap opposite to the direction we're waiting for cancels the partial
      // motion; re-examine this same tap as a possible fresh start.
      if (seqIdx > 0 && evt.input === OPPOSITE_INPUT[sequence[seqIdx]]) {
        seqIdx = 0;
        matched.length = 0;
      }
      if (evt.input === sequence[seqIdx]) {
        matched.push(i);
        seqIdx++;
        // Don't return yet — a later reversal can still cancel this match.
        if (seqIdx === sequence.length) complete = true;
      }
    }
    if (!complete) return false;
    // Splice out matched indices in reverse so earlier indices stay valid.
    for (let j = matched.length - 1; j >= 0; j--) {
      this._motionBuffer.splice(matched[j], 1);
    }
    return true;
  }

  private _pushMotion(input: MotionInput): void {
    this._motionBuffer.push({ input, t: performance.now() });
    // Trim oldest entries first — both by total age (window × 2 to keep a
    // little slack for matchMotion's windowMs argument) and by hard cap.
    const cutoff = performance.now() - MOTION_WINDOW_MS * 2;
    while (this._motionBuffer.length && this._motionBuffer[0].t < cutoff) {
      this._motionBuffer.shift();
    }
    while (this._motionBuffer.length > MOTION_BUFFER_LIMIT) {
      this._motionBuffer.shift();
    }
  }

  /** Backstep is a left→left double-tap. Called right after a 'left' press is
   * pushed: if the previous motion was also 'left' within the double-tap
   * window, fire the signal and drop the pair so a third tap doesn't
   * re-trigger. */
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

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (ARROW_KEYS.has(e.key)) e.preventDefault();
    if (e.key === 'ArrowRight') {
      this.rightKey.set(true);
      if (!e.repeat) {
        this.lastDir.set('right');
        this._pushMotion('right');
      }
    } else if (e.key === 'ArrowLeft') {
      this.leftKey.set(true);
      if (!e.repeat) {
        this.lastDir.set('left');
        this._pushMotion('left');
        this._detectBackstep();
      }
    } else if (e.key === 'ArrowDown') {
      if (!e.repeat) this._pushMotion('down');
      this.downKey.set(true);
    } else if (e.key === 'ArrowUp' && !e.repeat) {
      this._pushMotion('up');
      this.jumpPressed.update(n => n + 1);
    } else if ((e.key === 'a' || e.key === 'A') && !e.repeat) {
      this.lightPunchPressed.update(n => n + 1);
    } else if ((e.key === 's' || e.key === 'S') && !e.repeat) {
      this.heavyPunchPressed.update(n => n + 1);
    } else if ((e.key === 'z' || e.key === 'Z') && !e.repeat) {
      this.lightKickPressed.update(n => n + 1);
    } else if ((e.key === 'x' || e.key === 'X') && !e.repeat) {
      this.heavyKickPressed.update(n => n + 1);
    }
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowRight') {
      this.rightKey.set(false);
      if (this.lastDir() === 'right') this.lastDir.set(this.leftKey() ? 'left' : null);
    } else if (e.key === 'ArrowLeft') {
      this.leftKey.set(false);
      if (this.lastDir() === 'left') this.lastDir.set(this.rightKey() ? 'right' : null);
    } else if (e.key === 'ArrowDown') {
      this.downKey.set(false);
    }
  };
}
