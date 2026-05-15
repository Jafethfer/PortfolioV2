import {
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AnimationData, AnimationFrame, AnimationName, CharacterAnimations, CharacterVoices } from '../../models/character';
import { InputService } from '../../services/input.service';
import { GameLoopService } from '../../services/game-loop.service';
import { AudioService } from '../../services/audio.service';

/**
 * Abstract character base. Owns the physics, input wiring, and animation
 * state machine. Subclasses are concrete @Component classes that supply
 * their own `animations` map (mapping abstract names to sprite CSS classes)
 * and styleUrl (the matching sprite stylesheet) — same shape as a game-engine
 * character prefab.
 *
 * Subclasses must:
 *  - decorate with @Component, sharing the character template
 *      `templateUrl: '../components/character/character.html'`
 *  - register themselves as a Character via:
 *      `providers: [{ provide: Character, useExisting: forwardRef(() => Self) }]`
 *    so the Stage can `viewChild.required(Character)`.
 *
 * Tuning fields are plain class properties — override with `protected override`
 * to retune walk speed, jump distance, etc. per character.
 */
@Directive()
export abstract class Character {
  protected abstract readonly animations: CharacterAnimations;
  protected readonly voices: CharacterVoices = {};
  /** Sparse map of data-driven per-frame animations. Animations listed here
   * bypass the CSS-strip rendering and use the per-frame engine instead —
   * one image per frame, positioned so each frame's `anchorX/Y` lands at
   * the same world coordinate. Animations NOT listed here keep using the
   * strip + class rendering. Migrate strip animations to this map one at
   * a time as silhouette-variance issues come up. */
  protected readonly animationFrames: Partial<Record<AnimationName, AnimationData>> = {};
  /** The body anchor X (in source pixels) for strip-rendered animations like
   * idle/walk. Used to align per-frame animations with strip ones at
   * transition time — without this, transitioning idle → per-frame jumps the
   * sprite left/right by the difference between sprite-left and body-centre.
   * Default 35 ≈ centre of a 70-wide idle sprite; subclasses override. */
  protected readonly bodyAnchorX: number = 35;

  protected readonly walkSpeed: number = 10;
  protected readonly crouchSpeed: number = 5;
  /** Fraction of the surrounding world width covered in a forward/back jump. */
  protected readonly jumpDistancePct: number = 0.30;
  protected readonly jumpTicks: number = 33;
  protected readonly jumpDurationMs: number = 1000;
  protected readonly jumpApexMs: number = 500;
  protected readonly jumpVerticalStep: number = 5;
  protected readonly jumpYScale: number = 0.3;
  /** Total duration the lightPunch animation is locked in. Must match the CSS
   * `animation:` duration on the sprite class, otherwise the sprite either
   * snaps back to idle mid-animation (too short) or pins on the last frame
   * longer than expected (too long). */
  protected readonly lightPunchDurationMs: number = 200;
  protected readonly voiceVolume: number = 0.3;
  /** Volume for non-voice combat SFX (whiffs, hit confirms, jump). The
   * source files have low natural gain so we set this higher than you'd
   * expect — `0.7` lands roughly at parity with `voiceVolume = 0.3` when
   * the two play simultaneously. Overridable per character. */
  protected readonly sfxVolume: number = 0.7;

  readonly blockedRight = input(false);
  readonly blockedLeft = input(false);
  /** Pixel width of the surrounding world. Used to convert `jumpDistancePct`
   * into a per-tick px step at takeoff. The character has no other way of
   * knowing — it doesn't reach into the DOM for stage geometry. */
  readonly worldWidth = input(0);

  readonly el = viewChild.required<ElementRef<HTMLElement>>('el');

  private readonly _input = inject(InputService);
  private readonly _loop = inject(GameLoopService);
  private readonly _audio = inject(AudioService);

  // Public reactive state — Stage reads worldX() to drive train scrolling.
  readonly animation = signal<AnimationName>('idle');
  readonly accumulated = signal(4);
  readonly accumulatedY = signal(0);
  readonly inJump = signal(false);
  readonly inAttack = signal(false);
  readonly width = signal(0);
  /** Frame index within the current per-frame animation (no effect on strip
   * animations). Reset when a new per-frame animation starts. */
  readonly currentFrameIndex = signal(0);
  /** Flips to true once `_initialX` and `width` have been measured. Stage
   * gates edge checks on this — without it, the few-tick window before the
   * first afterNextRender fires causes `worldX` (with `_initialX === 0`)
   * to fall well below `leftLimit`, falsely tripping `blockedLeft`. */
  readonly ready = signal(false);

  // Internal physics state — not signal, no rendering depends on it.
  private _initialX = 0;
  private _jumpStartTick = 0;
  private _jumpXStep = 0;
  private _forwardJump = false;
  private _backwardJump = false;
  private _attackStartTick = 0;
  private _attackDurationTicks = 0;
  private _frameStartTick = 0;
  /** Keeps preloaded Image objects alive for the character's lifetime so
   * the browser's memory cache doesn't evict them — otherwise the dev
   * server's no-store cache-control would force a fresh fetch on every
   * `[src]` change. Production builds with long-cache headers wouldn't
   * need this, but keeping refs is cheap and bulletproof. */
  private readonly _preloadedImages: HTMLImageElement[] = [];

  readonly worldX = computed(() => this._initialX + this.accumulated());

  readonly animClass = computed(() => this.animations[this.animation()]);

  /** Per-frame data for the currently-active animation, or `null` if the
   * animation is rendered via the strip/CSS path. */
  readonly currentAnimData = computed<AnimationData | null>(
    () => this.animationFrames[this.animation()] ?? null,
  );

  /** The current per-frame sprite, or `null` for strip animations. */
  readonly currentFrame = computed<AnimationFrame | null>(() => {
    const data = this.currentAnimData();
    return data ? data.frames[this.currentFrameIndex()] ?? null : null;
  });

  readonly transform = computed(() => {
    if (this.inJump()) {
      const y = this.accumulatedY() * this.jumpYScale;
      return `translate(${this.accumulated()}px, ${y}cqw)`;
    }
    return `translateX(${this.accumulated()}px)`;
  });

  /** Transform for a per-frame `<img>` element. Anchors `frame.anchorX` to
   * the same world X as a strip animation's body centre (`bodyAnchorX`), so
   * idle ↔ per-frame transitions don't visually jump and frame-to-frame
   * anchor stays constant inside a per-frame animation. The anchor offset is
   * expressed in `cqw` (via `var(--terry-height) / 107`) so it scales with
   * the sprite when the stage resizes, matching the cqw-based sprite sizing. */
  frameTransform(frame: AnimationFrame): string {
    const spritePxOffset = this.bodyAnchorX - frame.anchorX;
    const xPart = `calc(${this.accumulated()}px + ${spritePxOffset} * var(--terry-height) / 107)`;
    if (this.inJump()) {
      const y = this.accumulatedY() * this.jumpYScale;
      return `translate(${xPart}, ${y}cqw)`;
    }
    return `translateX(${xPart})`;
  }

  /** CSS width string for an `<img>` rendering a per-frame sprite — matches
   * the cqw scaling formula used by strip-mode sprite classes. */
  frameWidth(frame: AnimationFrame): string {
    return `calc(${frame.w} * var(--terry-height) / 107)`;
  }

  frameHeight(frame: AnimationFrame): string {
    return `calc(${frame.h} * var(--terry-height) / 107)`;
  }

  constructor() {
    afterNextRender(() => {
      const node = this.el().nativeElement;
      // `rect.x` is post-transform; subtract whatever translation has already
      // been applied (via `accumulated`) so the baseline is the layout origin,
      // not "wherever Terry happens to be right now". Matters if input keys
      // fired before this callback ran.
      this._initialX = node.getBoundingClientRect().x - this.accumulated();
      this.width.set(node.clientWidth);
      this.ready.set(true);

      // Warm the browser cache for every per-frame sprite so frame-to-frame
      // src changes don't flash while the new image fetches. Accessing
      // `animationFrames` here (not in the constructor) is intentional —
      // subclass field overrides aren't applied until after super() returns.
      // Each preload Image is stored on the instance so the GC can't collect
      // them — that would let the memory cache evict the bitmap and force
      // re-fetch on every src change in dev (no-store cache-control).
      for (const data of Object.values(this.animationFrames)) {
        if (!data) continue;
        for (const frame of data.frames) {
          const preload = new Image();
          preload.src = frame.src;
          this._preloadedImages.push(preload);
        }
      }
    });

    // Animation state machine — reacts to direction / crouch changes when
    // not in a jump or attack. Mid-jump landing is handled by the physics
    // tick. `inAttack` IS tracked so this effect re-runs when an attack
    // ends and picks the right ground animation from the current input.
    effect(() => {
      const lastDir = this._input.lastDir();
      const down = this._input.downKey();
      const inAttack = this.inAttack();
      if (untracked(() => this.inJump())) return;
      if (inAttack) return;

      if (down) {
        const a = untracked(() => this.animation());
        const alreadyCrouched = a === 'crouch' || a === 'crouchStill' || a === 'crouchForward';
        if (lastDir === 'right') this.animation.set('crouchForward');
        else if (alreadyCrouched) this.animation.set('crouchStill');
        else this.animation.set('crouch');
        return;
      }

      if (lastDir === 'right') this.animation.set('forward');
      else if (lastDir === 'left') this.animation.set('backwards');
      else this.animation.set('idle');
    });

    // One-shot jump trigger.
    effect(() => {
      const n = this._input.jumpPressed();
      if (n === 0) return;
      untracked(() => this._startJump());
    });

    // One-shot light punch trigger.
    effect(() => {
      const n = this._input.lightPunchPressed();
      if (n === 0) return;
      untracked(() => this.lightPunch());
    });

    // Per-frame animation advance — drives the data-driven engine. Strip
    // animations have no entry in `animationFrames`, so this is a no-op for
    // them and CSS keyframes drive the visuals as before.
    effect(() => {
      this._loop.tick();
      untracked(() => this._advanceFrame());
    });

    // Reset the frame index whenever the animation changes — otherwise the
    // next per-frame anim picks up at whatever index the previous one left
    // off at (so e.g. jab ends → idle starts at frame 2 instead of frame 0
    // until the next normal advance catches up).
    effect(() => {
      this.animation();
      untracked(() => {
        this.currentFrameIndex.set(0);
        this._frameStartTick = this._loop.tick();
      });
    });

    // Physics tick — single dependency on the loop signal; everything else
    // is read untracked so we don't feedback-loop.
    effect(() => {
      this._loop.tick();
      untracked(() => this._physicsTick());
    });
  }

  /** Combat / character actions — call from custom keybinds or a Directive. */
  lightPunch(): void {
    if (this.inJump() || this.inAttack()) return;
    this._audio.playVoice(this.voices.lightPunch, this.voiceVolume);
    // Whiff plays unconditionally for now — once hitboxes land, this becomes
    // gated on "swing didn't connect" and a separate hit-confirm SFX replaces
    // it on connect.
    this._audio.playVoice(this.voices['lightPunchWhiff'], this.sfxVolume);
    this.animation.set('lightPunch'); // frame-state reset is handled by the animation-change effect
    // When per-frame data exists for this attack, derive total lock-in from
    // the sum of frame durations so the physics-tick lock and the animation
    // finish together. Otherwise fall back to the legacy `lightPunchDurationMs`.
    const data = this.animationFrames['lightPunch'];
    const totalMs = data
      ? data.frames.reduce((sum, f) => sum + f.durationMs, 0)
      : this.lightPunchDurationMs;
    this._attackStartTick = this._loop.tick();
    this._attackDurationTicks = Math.round(totalMs / GameLoopService.TICK_MS);
    this.inAttack.set(true);
  }
  heavyPunch(): void { this._audio.playVoice(this.voices.heavyPunch, this.voiceVolume); }
  lightKick():  void { this._audio.playVoice(this.voices.lightKick,  this.voiceVolume); }
  heavyKick():  void { this._audio.playVoice(this.voices.heavyKick,  this.voiceVolume); }
  taunt():      void { this._audio.playVoice(this.voices.taunt,      this.voiceVolume); }

  private _startJump(): void {
    if (this.inJump()) return;
    const dir = this._input.lastDir();
    this._jumpXStep = (this.worldWidth() * this.jumpDistancePct) / this.jumpTicks;
    this._jumpStartTick = this._loop.tick();
    this._forwardJump = dir === 'right';
    this._backwardJump = dir === 'left';
    this.inJump.set(true);
    if (dir === 'right')      this.animation.set('jumpForward');
    else if (dir === 'left')  this.animation.set('jumpBackward');
    else                      this.animation.set('jumpUp');
    // Same whoosh regardless of direction — vertical, forward, backward all
    // use the character-agnostic jump SFX from `voices.jump`.
    this._audio.playVoice(this.voices['jump'], this.sfxVolume);
  }

  /** Advances the current per-frame animation's frame index when the current
   * frame's `durationMs` has elapsed. Holds on the last frame for non-looping
   * animations; wraps to 0 for looping ones. No-op for strip animations. */
  private _advanceFrame(): void {
    const data = this.currentAnimData();
    if (!data) return;
    const idx = this.currentFrameIndex();
    const frame = data.frames[idx];
    if (!frame) return;
    const durationTicks = Math.round(frame.durationMs / GameLoopService.TICK_MS);
    if (this._loop.tick() - this._frameStartTick < durationTicks) return;
    if (idx + 1 < data.frames.length) {
      this.currentFrameIndex.set(idx + 1);
      this._frameStartTick = this._loop.tick();
    } else if (data.loop) {
      this.currentFrameIndex.set(0);
      this._frameStartTick = this._loop.tick();
    }
  }

  private _physicsTick(): void {
    if (this.inAttack()) {
      // Lock-in: no movement, just count down. The animation state-machine
      // effect re-runs when `inAttack` flips back to false and picks the
      // right ground animation from the current input.
      const elapsed = this._loop.tick() - this._attackStartTick;
      if (elapsed >= this._attackDurationTicks) this.inAttack.set(false);
      return;
    }

    if (this.inJump()) {
      const elapsed = this._loop.tick() - this._jumpStartTick;
      const apexTicks = Math.round(this.jumpApexMs / GameLoopService.TICK_MS);
      const landTicks = Math.round(this.jumpDurationMs / GameLoopService.TICK_MS);

      if (elapsed >= landTicks) {
        // Land — reset Y; the animation effect will pick the right ground
        // animation based on still-held keys.
        this._forwardJump = false;
        this._backwardJump = false;
        this.accumulatedY.set(0);
        this.inJump.set(false);
        // Force the ground animation immediately (no input change to react to).
        const dir = this._input.lastDir();
        const down = this._input.downKey();
        if (down) this.animation.set(dir === 'right' ? 'crouchForward' : 'crouch');
        else this.animation.set(dir === 'right' ? 'forward' : dir === 'left' ? 'backwards' : 'idle');
        return;
      }

      const ascending = elapsed < apexTicks;
      if (ascending) {
        this.accumulatedY.update(y => y - this.jumpVerticalStep);
      } else {
        // Past apex: transition each jump direction to its `Fall` variant
        // exactly once. The fall variants are `loop: false` so the engine
        // holds on the last (hat-down) frame until the physics tick lands
        // and the state-machine effect transitions to a ground animation.
        const anim = this.animation();
        if (anim === 'jumpUp') this.animation.set('jumpFall');
        else if (anim === 'jumpForward') this.animation.set('jumpForwardFall');
        else if (anim === 'jumpBackward') this.animation.set('jumpBackwardFall');
        this.accumulatedY.update(y => y + this.jumpVerticalStep);
      }

      if (this._forwardJump  && !this.blockedRight()) this.accumulated.update(x => x + this._jumpXStep);
      if (this._backwardJump && !this.blockedLeft())  this.accumulated.update(x => x - this._jumpXStep);
      return;
    }

    // Ground movement.
    const down = this._input.downKey();
    const dir = this._input.lastDir();
    if (down) {
      if (dir === 'right' && !this.blockedRight()) {
        this.accumulated.update(x => x + this.crouchSpeed);
      }
      return;
    }
    if (dir === 'right' && !this.blockedRight()) {
      this.accumulated.update(x => x + this.walkSpeed);
    } else if (dir === 'left' && !this.blockedLeft()) {
      this.accumulated.update(x => x - this.walkSpeed);
    }
  }
}
