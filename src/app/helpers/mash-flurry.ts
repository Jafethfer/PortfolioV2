import { AttackButton } from '../models/character';

/**
 * A mash-punch flurry: several rapid presses of a button trigger ONE full
 * playthrough of a looping/one-shot clip (optionally chased by a finisher),
 * after which the move ends and is immediately re-triggerable. Mashing never
 * extends a single activation into an endless loop.
 *
 * Kept engine-agnostic: the controller owns only the mash-detection state
 * machine and phase timing. All side effects (setting the animation, playing
 * audio, leaving the attack lock) go through a {@link MashFlurryHost} that the
 * character binds to its own base-class internals — so Joe and Ryo share this
 * logic while differing only in their config (buttons, clips, finisher, SFX).
 */
export interface MashFlurryHost {
  /** Current game tick (monotonic, `GameLoopService.tick`). */
  currentTick(): number;
  /** True only when a flurry may start — grounded and standing (not mid-jump
   * or crouching, whose punches fire their own normals). */
  canStart(): boolean;
  /** Enter the attack lock-in and show `animation`. */
  showAnimation(animation: string): void;
  /** Fire a one-shot voice cue (kiai shout / finisher grunt). */
  playVoice(src: string): void;
  /** Start a looping whoosh and return the element so the controller can stop
   * it when the flurry's active phase ends. */
  playLoopingWhoosh(src: string): HTMLAudioElement | null;
  /** Leave the attack lock-in and snap back to a grounded idle. */
  end(): void;
}

/** One button's flurry. Light and heavy share this shape; heavy typically adds
 * a finisher, light omits it. */
export interface MashFlurryVariant {
  /** Button whose rapid presses trigger this variant. */
  readonly button: AttackButton;
  /** Animation key for the flurry clip (a looping clip is held for
   * `loopDurationMs`; a one-shot clip should set `loopDurationMs` to its own
   * total so it plays through exactly once). */
  readonly loopAnimation: string;
  /** How long the flurry clip runs before ending / handing off to the finisher. */
  readonly loopDurationMs: number;
  /** Voice fired as the flurry starts. Omit for none. */
  readonly startVoiceSrc?: string;
  /** Optional one-shot finisher clip played after the flurry. */
  readonly finishAnimation?: string;
  /** Finisher length (sum of its frame durations). Required with `finishAnimation`. */
  readonly finishDurationMs?: number;
  /** Voice fired as the finisher starts. Omit for none. */
  readonly finishVoiceSrc?: string;
}

export interface MashFlurryConfig {
  readonly variants: readonly MashFlurryVariant[];
  /** Rapid same-button presses required to trigger (e.g. 3). */
  readonly triggerCount: number;
  /** Max gap between consecutive presses that still counts toward the streak. */
  readonly mashWindowMs: number;
  /** Game-loop tick length, for ms→tick conversion. */
  readonly tickMs: number;
  /** Looping whoosh played for the flurry's active phase. Omit for none. */
  readonly whooshSrc?: string;
}

export class MashFlurry {
  private _pendingButton: AttackButton | null = null;
  private _count = 0;
  private _lastPressTick = 0;
  private _active = false;
  private _phase: 'loop' | 'finish' = 'loop';
  private _phaseEndTick = 0;
  private _variant: MashFlurryVariant | null = null;
  private _whoosh: HTMLAudioElement | null = null;

  constructor(
    private readonly host: MashFlurryHost,
    private readonly config: MashFlurryConfig,
  ) {}

  /** True while a flurry is playing. */
  get active(): boolean {
    return this._active;
  }

  /**
   * Feed an attack-button press. Returns true when the press is fully consumed
   * (the caller must NOT run its normal attack). While a flurry plays, every
   * press is swallowed but does not extend it. Otherwise, presses that don't
   * yet reach the trigger fall through (return false) so the first jabs still
   * fire the normal punch.
   */
  press(button: AttackButton): boolean {
    if (this._active) return true;
    const variant = this.config.variants.find((v) => v.button === button);
    if (!variant) return false;
    if (!this.host.canStart()) {
      this._resetStreak();
      return false;
    }
    const tick = this.host.currentTick();
    if (button === this._pendingButton && tick - this._lastPressTick <= this._windowTicks) {
      this._count++;
    } else {
      this._pendingButton = button;
      this._count = 1;
    }
    this._lastPressTick = tick;
    if (this._count >= this.config.triggerCount) {
      this._start(variant);
      return true;
    }
    return false;
  }

  /**
   * Advance the active flurry. Returns true while the flurry owns the tick (the
   * caller skips its own physics/attack handling). Ends the flurry — or hands
   * off to the finisher — once the current phase's frames run out.
   */
  tick(): boolean {
    if (!this._active) return false;
    if (this.host.currentTick() < this._phaseEndTick) return true;
    if (this._phase === 'loop') {
      this._stopWhoosh();
      if (this._variant?.finishAnimation) {
        this._startFinish();
        return true;
      }
    }
    this._end();
    return false;
  }

  private _start(variant: MashFlurryVariant): void {
    this._active = true;
    this._variant = variant;
    this._phase = 'loop';
    this._resetStreak();
    this._phaseEndTick = this.host.currentTick() + this._ticks(variant.loopDurationMs);
    this.host.showAnimation(variant.loopAnimation);
    if (variant.startVoiceSrc) this.host.playVoice(variant.startVoiceSrc);
    if (this.config.whooshSrc) {
      const el = this.host.playLoopingWhoosh(this.config.whooshSrc);
      if (el) el.loop = true;
      this._whoosh = el;
    }
  }

  private _startFinish(): void {
    const variant = this._variant!;
    this._phase = 'finish';
    this._phaseEndTick = this.host.currentTick() + this._ticks(variant.finishDurationMs ?? 0);
    this.host.showAnimation(variant.finishAnimation!);
    if (variant.finishVoiceSrc) this.host.playVoice(variant.finishVoiceSrc);
  }

  private _end(): void {
    this._stopWhoosh();
    this._active = false;
    this._variant = null;
    this._resetStreak();
    this.host.end();
  }

  private _stopWhoosh(): void {
    if (!this._whoosh) return;
    this._whoosh.pause();
    this._whoosh = null;
  }

  private _resetStreak(): void {
    this._count = 0;
    this._pendingButton = null;
  }

  private get _windowTicks(): number {
    return Math.round(this.config.mashWindowMs / this.config.tickMs);
  }

  private _ticks(ms: number): number {
    return Math.round(ms / this.config.tickMs);
  }
}
