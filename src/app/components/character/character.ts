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
import {
  AnimationData,
  AnimationFrame,
  AnimationName,
  AttackButton,
  CharacterVoices,
  Direction,
  SpecialMove,
} from '../../models/character';
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
  protected readonly voices: CharacterVoices = {};
  /** Per-frame animation data — one entry per `AnimationName` the character
   * uses. Each frame has its own image and an `anchorX/Y` (in sprite-pixel
   * coords) so the runtime positions every frame so its anchor lands at the
   * same world coordinate. Characters must declare an entry for every
   * animation they set (e.g. `idle` is always required since it's the
   * initial state). */
  protected readonly animationFrames: Partial<Record<AnimationName, AnimationData>> = {};
  /** Character-specific special moves. Subclasses override this; the base
   * class handles dispatch generically — on each attack-button press, scans
   * this array (longest motion first), and if `matchMotion` matches the
   * required motion the special's frames + audio play instead of the
   * normal attack. Default `[]` for characters without specials. */
  protected readonly specials: readonly SpecialMove[] = [];
  /** The body anchor X (in source pixels) for strip-rendered animations like
   * idle/walk. Used to align per-frame animations with strip ones at
   * transition time — without this, transitioning idle → per-frame jumps the
   * sprite left/right by the difference between sprite-left and body-centre.
   * Default 35 ≈ centre of a 70-wide idle sprite; subclasses override. */
  protected readonly bodyAnchorX: number = 35;

  protected readonly walkSpeed: number = 10;
  protected readonly crouchSpeed: number = 5;
  /** Fraction of the surrounding world width covered in a forward/back jump. */
  protected readonly jumpDistancePct: number = 0.3;
  protected readonly jumpTicks: number = 33;
  protected readonly jumpDurationMs: number = 1000;
  protected readonly jumpApexMs: number = 500;
  protected readonly jumpVerticalStep: number = 5;
  /** Per-tick Y descent during the post-special fall (after `fallAfterArc`).
   * Faster than `jumpVerticalStep` so Terry doesn't loiter mid-air after a
   * Rising Tackle — anti-air specials feel snappier landing quickly. */
  protected readonly specialFallVerticalStep: number = 6;
  protected readonly jumpYScale: number = 0.3;
  /** Fraction of the surrounding world width covered by a single backstep
   * (left→left double-tap). Sign is implicit — backstep is always
   * backwards-relative-to-facing; for now that's left. Tune per character
   * if heavier fighters should hop less. */
  protected readonly backstepDistancePct: number = 0.4;
  /** Peak vertical arc of a backstep (same accumulated-Y units as a jump —
   * rendered as `y × jumpYScale` cqw). Parabolic rise+fall over the whole
   * animation, so Terry leaves the ground, peaks at the midpoint, and
   * lands at the recovery frame. Tune lower if a character should slide
   * instead of hop. */
  protected readonly backstepArcHeight: number = 30;
  /** Sound cues for the backstep, each pinned to a frame index in the
   * backstep animation. Default is a single landing-thud cue on the
   * recovery frame (1) — the push-off itself is silent, so the only audible
   * beat is when Terry's feet hit the ground at the end of the hop.
   * Played at `backstepSfxVolume`. Override to silence or layer in extra
   * cues per character. */
  protected readonly backstepVoices: readonly { readonly src: string; readonly frame?: number }[] =
    [{ src: '/assets/sfx/misc/backstep-1.mp3', frame: 1 }];
  /** Volume for backstep SFX. Lower than `sfxVolume` because the push-off
   * and landing clips are short, sharp foot SFX that read as too loud at
   * the punch-whiff baseline. */
  protected readonly backstepSfxVolume: number = 0.25;
  /** Total duration the lightPunch animation is locked in. Must match the CSS
   * `animation:` duration on the sprite class, otherwise the sprite either
   * snaps back to idle mid-animation (too short) or pins on the last frame
   * longer than expected (too long). */
  protected readonly lightPunchDurationMs: number = 200;
  /** Fallback heavy-punch lock-in for strip-mode animations. When per-frame
   * data exists for `heavyPunch`, total duration is derived from the sum of
   * frame durations and this value is ignored. */
  protected readonly heavyPunchDurationMs: number = 500;
  /** Fallback kick lock-in durations — used only when no per-frame data is
   * supplied. With per-frame data, total lock-in is derived from frame
   * durations as usual. */
  protected readonly lightKickDurationMs: number = 300;
  protected readonly heavyKickDurationMs: number = 500;
  protected readonly voiceVolume: number = 0.3;
  /** Volume for non-voice combat SFX (whiffs, hit confirms, jump). The
   * source files have low natural gain so we set this higher than you'd
   * expect — `0.7` lands roughly at parity with `voiceVolume = 0.3` when
   * the two play simultaneously. Overridable per character. */
  protected readonly sfxVolume: number = 0.7;
  /** Volume for the whiff/whoosh SFX played at the start of a SPECIAL move.
   * Lower than `sfxVolume` because special travel whiffs are usually a
   * longer sustained whoosh and would clip the vocal shout if played at
   * full sfx gain. Doesn't affect normal jab/kick whiffs. */
  protected readonly specialWhiffVolume: number = 0.35;
  /** Volume for the jump-takeoff whoosh. Lower than `sfxVolume` because
   * the clip has a sharp transient that reads as too loud at the
   * jab-whiff baseline. */
  protected readonly jumpSfxVolume: number = 0.25;

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
  // Animation is typed as `string` (not `AnimationName`) so specials — whose
  // names live outside the built-in union — can be assigned without a cast.
  // Built-ins set literal `AnimationName` values; lookups into the built-in
  // `animations` map narrow with a cast and fall back to '' for specials.
  readonly animation = signal<string>('idle');
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

  /** Direction the character is currently trying to move in. Used by the
   * stage's per-tick scroll logic: if `motionIntent` is `'right'` AND
   * `blockedRight` is true, the stage should scroll the world left.
   *
   * Precedence: active special's travel direction → active directional
   * jump → user input. Specials and jumps win over input because once
   * committed they carry forward regardless of whether the player is
   * still holding the key. Without this, a special that drives Terry
   * into the edge just clamps to the limit — the stage never sees
   * "still trying to push right" and never scrolls. Returns `null` for
   * vertical jumps with no input and stationary specials. */
  get motionIntent(): Direction {
    // Defer to `specialXVelocity` so we only report a special-driven
    // intent when the special is actually inside its travel window —
    // otherwise the stage would scroll all through a special's windup
    // and recovery frames even though Terry isn't moving yet.
    const sv = this.specialXVelocity;
    if (sv > 0) return 'right';
    if (sv < 0) return 'left';
    if (this._forwardJump) return 'right';
    if (this._backwardJump) return 'left';
    return this._input.lastDir();
  }

  /** Per-tick X step the active special is applying THIS tick, in px
   * (positive = right, negative = left). Zero outside a special's
   * actual travel window — windup and recovery frames return 0 even
   * though the special is still in progress, because Terry isn't
   * actually moving during those frames. Stage reads this as the scroll
   * rate when non-zero, so a Burning Knuckle that pushes Terry into
   * the edge scrolls the world at the special's own travel pace instead
   * of the much slower default `walkScrollRate`. */
  get specialXVelocity(): number {
    if (!this.inAttack()) return 0;
    const tick = this._loop.tick();
    if (tick < this._specialTravelStartTick) return 0;
    if (tick >= this._specialTravelEndTick) return 0;
    return this._specialXStep;
  }

  // Internal physics state — not signal, no rendering depends on it.
  private _initialX = 0;
  private _jumpStartTick = 0;
  private _jumpXStep = 0;
  private _forwardJump = false;
  private _backwardJump = false;
  private _attackStartTick = 0;
  private _attackDurationTicks = 0;
  /** Per-tick X step applied during a traveling special. Zero for normal
   * attacks and stationary specials. Sign carries direction (positive =
   * right). Computed at special launch from `travelDistancePct` × stage
   * width ÷ traveling ticks; reset when the attack ends. */
  private _specialXStep = 0;
  /** Absolute loop tick at which `_specialXStep` starts being applied — so
   * a special with `travelStartFrame > 0` holds in place during its windup
   * frames and only launches when the active frame is reached. */
  private _specialTravelStartTick = 0;
  /** Absolute loop tick at which travel ends. Frames past this tick render
   * on the ground (Y pinned to 0) and X no longer accumulates — lets a
   * special declare a grounded recovery pose distinct from its airborne
   * frames. */
  private _specialTravelEndTick = 0;
  /** Peak `accumulatedY` magnitude during the special's travel window
   * (parabolic curve, apex at midpoint). Zero for non-arcing specials. */
  private _specialArcHeight = 0;
  /** Mirrors `SpecialMove.fallAfterArc` for the current special. Controls
   * two things: (a) the arc uses a rise-only half-sine instead of a
   * parabola, so Y peaks at travel end instead of returning to 0; and
   * (b) at attack end, if Y < 0, Terry hands off to a custom descent
   * state (`_specialFallingDescent`) so he physically falls back down. */
  private _specialFallAfterArc = false;
  /** Active after a `fallAfterArc` special's attack lock-in ends with Y
   * still above ground. Each physics tick descends Y by `jumpVerticalStep`
   * until ground contact, at which point the state-machine handover
   * snaps in. The state-machine effect and `_startAttack` / `_startJump`
   * all gate on this so the character can't be re-triggered mid-descent. */
  private _specialFallingDescent = false;
  /** Voice + whiff SFX queued to play when the special's travel window
   * starts — so the fighter's shout and the travel whoosh both sync with
   * Terry's actual forward motion instead of firing at the very start of
   * the windup. Cleared when played or when the attack ends. */
  /** Queue of voice cues from the active special, each tagged with the
   * absolute tick at which it should fire (computed from `SpecialMove.voices`
   * frame indices at launch). The physics tick drains entries as their
   * tick is reached; the queue is cleared on attack end. */
  private _pendingVoiceCues: { src: string; volume: number; tick: number }[] = [];
  private _pendingWhiffSrc: string | undefined = undefined;
  private _pendingWhiffVolume = 0;
  /** The Audio element from the currently-playing jump SFX, so a special
   * that cancels the jump (e.g. Rising Tackle on `down→up+P`, where the
   * Up press fires the jump a few ms before the punch arrives) can stop
   * the whoosh — otherwise the jump SFX bleeds over into the special. */
  private _activeJumpSfx: HTMLAudioElement | null = null;
  private _frameStartTick = 0;
  /** Keeps preloaded Image objects alive for the character's lifetime so
   * the browser's memory cache doesn't evict them — otherwise the dev
   * server's no-store cache-control would force a fresh fetch on every
   * `[src]` change. Production builds with long-cache headers wouldn't
   * need this, but keeping refs is cheap and bulletproof. */
  private readonly _preloadedImages: HTMLImageElement[] = [];

  readonly worldX = computed(() => this._initialX + this.accumulated());

  /** Per-frame data for the currently-active animation, or `null` if the
   * animation name has no matching entry. Looks up built-ins first (so a
   * special's `name` colliding with an `AnimationName` resolves to the
   * built-in), then scans the specials list. */
  readonly currentAnimData = computed<AnimationData | null>(() => {
    const name = this.animation();
    const builtIn = this.animationFrames[name as AnimationName];
    if (builtIn) return builtIn;
    for (const s of this.specials) {
      if (s.name === name) return s.frames;
    }
    return null;
  });

  /** The current per-frame sprite, or `null` if no data is bound. */
  readonly currentFrame = computed<AnimationFrame | null>(() => {
    const data = this.currentAnimData();
    return data ? (data.frames[this.currentFrameIndex()] ?? null) : null;
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
    const yRaw = this.accumulatedY();
    if (yRaw !== 0) {
      return `translate(${xPart}, ${yRaw * this.jumpYScale}cqw)`;
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
      const preloadFrames = (data: AnimationData): void => {
        for (const frame of data.frames) {
          const preload = new Image();
          preload.src = frame.src;
          this._preloadedImages.push(preload);
        }
      };
      for (const data of Object.values(this.animationFrames)) {
        if (data) preloadFrames(data);
      }
      for (const special of this.specials) preloadFrames(special.frames);
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
      if (untracked(() => this._specialFallingDescent)) return;
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

    // Backstep — purely motion-driven (left→left double-tap), no attack
    // button. Skipped silently if the character has no `backstep` frames,
    // so subclasses opt in by defining the animation.
    effect(() => {
      const n = this._input.backstepPressed();
      if (n === 0) return;
      untracked(() => this._startBackstep());
    });

    // One-shot attack triggers. Each button press fans through `_tryAttack`,
    // which scans the subclass's `specials` list (longest motion first) and
    // fires a matched special, falling through to the normal attack only
    // when no motion matches.
    effect(() => {
      const n = this._input.lightPunchPressed();
      if (n === 0) return;
      untracked(() => this._tryAttack('lightPunch'));
    });
    effect(() => {
      const n = this._input.heavyPunchPressed();
      if (n === 0) return;
      untracked(() => this._tryAttack('heavyPunch'));
    });
    effect(() => {
      const n = this._input.lightKickPressed();
      if (n === 0) return;
      untracked(() => this._tryAttack('lightKick'));
    });
    effect(() => {
      const n = this._input.heavyKickPressed();
      if (n === 0) return;
      untracked(() => this._tryAttack('heavyKick'));
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
    this._startAttack({
      animation: 'lightPunch',
      voiceSrc: this.voices.lightPunch,
      whiffSrc: this.voices['lightPunchWhiff'],
      frames: this.animationFrames['lightPunch'],
      fallbackDurationMs: this.lightPunchDurationMs,
    });
  }
  heavyPunch(): void {
    this._startAttack({
      animation: 'heavyPunch',
      voiceSrc: this.voices.heavyPunch,
      whiffSrc: this.voices['heavyPunchWhiff'],
      frames: this.animationFrames['heavyPunch'],
      fallbackDurationMs: this.heavyPunchDurationMs,
    });
  }
  lightKick(): void {
    this._startAttack({
      animation: 'lightKick',
      voiceSrc: this.voices.lightKick,
      whiffSrc: this.voices['lightKickWhiff'],
      frames: this.animationFrames['lightKick'],
      fallbackDurationMs: this.lightKickDurationMs,
    });
  }
  heavyKick(): void {
    this._startAttack({
      animation: 'heavyKick',
      voiceSrc: this.voices.heavyKick,
      whiffSrc: this.voices['heavyKickWhiff'],
      frames: this.animationFrames['heavyKick'],
      fallbackDurationMs: this.heavyKickDurationMs,
    });
  }
  taunt(): void {
    this._audio.playVoice(this.voices.taunt, this.voiceVolume);
  }

  /** Generic attack-button dispatcher. Scans this character's `specials` for
   * entries bound to `button`, sorted longest-motion-first so a 4-input
   * special isn't short-circuited by a 2-input subset. Fires the first
   * matching special; falls through to the normal attack if none match. */
  private _tryAttack(button: AttackButton): void {
    const candidates = this.specials
      .filter((s) => s.button === button)
      .slice()
      .sort((a, b) => b.motion.length - a.motion.length);
    for (const s of candidates) {
      if (this._input.matchMotion(s.motion)) {
        this._runSpecial(s);
        return;
      }
    }
    if (button === 'lightPunch') this.lightPunch();
    else if (button === 'heavyPunch') this.heavyPunch();
    else if (button === 'lightKick') this.lightKick();
    else if (button === 'heavyKick') this.heavyKick();
  }

  private _runSpecial(s: SpecialMove): void {
    // Bail upfront if a previous attack/special is still locked in —
    // otherwise the post-_startAttack queueing below would re-queue voice
    // cues and re-set travel state on top of the in-progress special
    // (`_startAttack` itself short-circuits but our extra setup didn't).
    // The `inJump` check is intentionally OMITTED here so we can still
    // cancel a just-started jump (the block below). The post-cancel
    // `_startAttack` call enforces the jump gate itself.
    if (this.inAttack() || this._specialFallingDescent) return;
    // Cancel any in-progress jump, but only if the jump JUST started —
    // i.e. the Up press is part of the special's motion (e.g. `down→up+P`
    // for Rising Tackle, where Up fires the jump a few ms before the
    // punch arrives). If the jump has been running for more than a few
    // ticks, the player committed to the jump earlier and the motion
    // buffer's stale `down→up` shouldn't hijack it into a special. In
    // that case we leave `inJump` true and let `_startAttack` short-
    // circuit naturally, so the punch does nothing mid-flight.
    const jumpJustStartedTicks = 4; // ~120ms — about one human input gap
    if (this.inJump() && this._loop.tick() - this._jumpStartTick <= jumpJustStartedTicks) {
      this.inJump.set(false);
      this.accumulatedY.set(0);
      this._forwardJump = false;
      this._backwardJump = false;
      // Stop the jump whoosh — Up triggered it ms ago but the player's
      // follow-up punch converts the jump into a special. Letting it ring
      // through bleeds into the special's voice/whiff.
      if (this._activeJumpSfx) {
        this._activeJumpSfx.pause();
        this._activeJumpSfx.currentTime = 0;
        this._activeJumpSfx = null;
      }
    }
    // Defer the travel whoosh to travel start for traveling specials.
    // Voices use the explicit `frame`-indexed cues array instead, so each
    // special author sets exactly when each shout fires — no per-special
    // auto-defer rule. `_startAttack` is given `voiceSrc: undefined` so
    // it doesn't play anything itself.
    const defer = !!(s.travelDistancePct || s.arcHeight);
    this._startAttack({
      animation: s.name,
      voiceSrc: undefined,
      whiffSrc: s.whiffSrc,
      whiffVolume: this.specialWhiffVolume,
      deferWhiff: defer,
      frames: s.frames,
      fallbackDurationMs: s.durationMs ?? 500,
    });
    if (defer && this.inAttack() && this.animation() === s.name) {
      this._pendingWhiffSrc = s.whiffSrc;
      this._pendingWhiffVolume = this.specialWhiffVolume;
    }
    // Queue every voice cue with its target tick (sum of frame durations
    // up to the cue's `frame`). The physics tick drains them as their tick
    // is reached. Frame index defaults to 0 (launch).
    if (s.voices && this.inAttack() && this.animation() === s.name) {
      for (const v of s.voices) {
        const frame = v.frame ?? 0;
        const windupMs = s.frames.frames.slice(0, frame).reduce((sum, f) => sum + f.durationMs, 0);
        const windupTicks = Math.round(windupMs / GameLoopService.TICK_MS);
        this._pendingVoiceCues.push({
          src: v.src,
          volume: this.voiceVolume,
          tick: this._attackStartTick + windupTicks,
        });
      }
    }
    // `_startAttack` no-ops when blocked by jump/attack lock — only commit
    // travel state when the special actually launched. The animation-name
    // check is the tell: `_startAttack` sets it on success.
    if (this.inAttack() && this.animation() === s.name && (s.travelDistancePct || s.arcHeight)) {
      const startFrame = s.travelStartFrame ?? 0;
      const endFrame = s.travelEndFrame ?? s.frames.frames.length;
      // Time before travel begins = sum of durations of the leading
      // (windup) frames. Converted to ticks so it lines up with the
      // game-loop clock the physics tick reads.
      const windupMs = s.frames.frames
        .slice(0, startFrame)
        .reduce((sum, f) => sum + f.durationMs, 0);
      const travelMs = s.frames.frames
        .slice(startFrame, endFrame)
        .reduce((sum, f) => sum + f.durationMs, 0);
      const windupTicks = Math.round(windupMs / GameLoopService.TICK_MS);
      // Guard the divisor against a degenerate `endFrame <= startFrame`
      // declaration — better than NaN.
      const travelTicks = Math.max(1, Math.round(travelMs / GameLoopService.TICK_MS));
      this._specialXStep = s.travelDistancePct
        ? (this.worldWidth() * s.travelDistancePct) / travelTicks
        : 0;
      this._specialArcHeight = s.arcHeight ?? 0;
      this._specialFallAfterArc = !!s.fallAfterArc;
      this._specialTravelStartTick = this._attackStartTick + windupTicks;
      this._specialTravelEndTick = this._specialTravelStartTick + travelTicks;
    }
  }

  /** Shared attack kickoff — plays the voice + whiff, sets the animation, and
   * computes the lock-in window. When `frames` is supplied, total duration is
   * derived from the sum of frame durations so the physics-tick lock and the
   * visual animation finish together; otherwise `fallbackDurationMs` is used. */
  private _startAttack(opts: {
    readonly animation: string;
    readonly voiceSrc?: string;
    readonly whiffSrc?: string;
    /** Per-call whiff volume — specials pass `specialWhiffVolume` (lower)
     * so sustained whoosh SFX don't drown the vocal shout. Built-in
     * jab/kick attacks omit this and get the default `sfxVolume`. */
    readonly whiffVolume?: number;
    /** When true, suppress immediate whiff playback — the caller queues it
     * to fire at `_specialTravelStartTick` so the whoosh syncs with the
     * actual movement. Built-in attacks leave this unset and get instant
     * playback. */
    readonly deferWhiff?: boolean;
    readonly frames?: AnimationData;
    readonly fallbackDurationMs: number;
  }): void {
    if (this.inJump() || this.inAttack() || this._specialFallingDescent) return;
    this._audio.playVoice(opts.voiceSrc, this.voiceVolume);
    // Whiff plays immediately for normal attacks. Travel-aware specials
    // (which sync the whoosh with forward motion) defer via `deferWhiff`
    // and let the physics tick play it at travel-start.
    if (!opts.deferWhiff) {
      this._audio.playVoice(opts.whiffSrc, opts.whiffVolume ?? this.sfxVolume);
    }
    this.animation.set(opts.animation); // frame-state reset is handled by the animation-change effect
    const totalMs = opts.frames
      ? opts.frames.frames.reduce((sum, f) => sum + f.durationMs, 0)
      : opts.fallbackDurationMs;
    this._attackStartTick = this._loop.tick();
    this._attackDurationTicks = Math.round(totalMs / GameLoopService.TICK_MS);
    this.inAttack.set(true);
  }

  /** Backstep — a quick backwards hop triggered by left→left. Reuses the
   * special-travel machinery (lock-in via `inAttack`, per-tick X update via
   * `_specialXStep`) but with no voice/whiff and a negative X step. Travel
   * spans the full animation. */
  private _startBackstep(): void {
    if (this.inJump() || this.inAttack() || this._specialFallingDescent) return;
    if (this.blockedLeft()) return;
    const frames = this.animationFrames['backstep'];
    if (!frames) return;
    this._startAttack({
      animation: 'backstep',
      frames,
      fallbackDurationMs: 200,
    });
    if (this.inAttack() && this.animation() === 'backstep') {
      // Travel (X + Y arc) spans only the launch frame (0); the remaining
      // frames are grounded recovery — same pattern Crack Shoot uses for
      // its landing pose. The parabolic arc returns Y to 0 at travel end,
      // so the second frame onward shows Terry planted on the ground.
      const travelMs = frames.frames[0].durationMs;
      const travelTicks = Math.max(1, Math.round(travelMs / GameLoopService.TICK_MS));
      this._specialXStep = -(this.worldWidth() * this.backstepDistancePct) / travelTicks;
      this._specialTravelStartTick = this._attackStartTick;
      this._specialTravelEndTick = this._attackStartTick + travelTicks;
      this._specialArcHeight = this.backstepArcHeight;
      this._specialFallAfterArc = false;
      // Queue the backstep SFX cues using the same per-frame scheduling
      // as `SpecialMove.voices`. Volume is `sfxVolume` (these are foot
      // SFX, not vocal shouts).
      for (const v of this.backstepVoices) {
        const frame = v.frame ?? 0;
        const windupMs = frames.frames.slice(0, frame).reduce((sum, f) => sum + f.durationMs, 0);
        const windupTicks = Math.round(windupMs / GameLoopService.TICK_MS);
        this._pendingVoiceCues.push({
          src: v.src,
          volume: this.backstepSfxVolume,
          tick: this._attackStartTick + windupTicks,
        });
      }
    }
  }

  private _startJump(): void {
    // Block jumps during any active attack (special or normal) so the
    // attack's animation/lock-in isn't interrupted by the jump sprite
    // change. Without this, an Up press mid-Burning-Knuckle swaps the
    // sprite to `jumpUp` while the special's physics keeps running.
    if (this.inJump() || this.inAttack() || this._specialFallingDescent) return;
    const dir = this._input.lastDir();
    this._jumpXStep = (this.worldWidth() * this.jumpDistancePct) / this.jumpTicks;
    this._jumpStartTick = this._loop.tick();
    this._forwardJump = dir === 'right';
    this._backwardJump = dir === 'left';
    this.inJump.set(true);
    if (dir === 'right') this.animation.set('jumpForward');
    else if (dir === 'left') this.animation.set('jumpBackward');
    else this.animation.set('jumpUp');
    // Same whoosh regardless of direction — vertical, forward, backward all
    // use the character-agnostic jump SFX from `voices.jump`. Stash the
    // Audio so `_runSpecial` can stop it when a follow-up motion (e.g.
    // `down→up+P` for Rising Tackle) converts the jump into a special.
    this._activeJumpSfx = this._audio.playVoice(this.voices['jump'], this.jumpSfxVolume);
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
    // Post-special falling descent — pure Y descent at jump speed until
    // ground contact, then snap to the right input-based ground animation
    // (same handover the jump's landing branch does). Runs before the
    // attack/jump branches so neither can interfere.
    if (this._specialFallingDescent) {
      this.accumulatedY.update((y) => y + this.specialFallVerticalStep);
      if (this.accumulatedY() >= 0) {
        this.accumulatedY.set(0);
        this._specialFallingDescent = false;
        const dir = this._input.lastDir();
        const down = this._input.downKey();
        if (down) this.animation.set(dir === 'right' ? 'crouchForward' : 'crouch');
        else
          this.animation.set(dir === 'right' ? 'forward' : dir === 'left' ? 'backwards' : 'idle');
      }
      return;
    }

    if (this.inAttack()) {
      // Lock-in: regular attacks don't move (_specialXStep and arc both 0).
      // Traveling specials wait out their windup ticks, then accumulate X
      // and apply the parabolic Y arc each tick, pinned at the relevant
      // stage edge. The animation state-machine effect re-runs when
      // `inAttack` flips back to false and picks the right ground animation
      // from the current input.
      const tick = this._loop.tick();
      const travelElapsed = tick - this._specialTravelStartTick;
      const travelTicks = this._specialTravelEndTick - this._specialTravelStartTick;
      // Play the queued travel voice + whiff on the FIRST tick of the
      // travel window (when travelElapsed crosses 0), then clear so they
      // don't repeat. Voice and whiff fire on the same tick so the shout
      // lands with the forward motion, not during the windup.
      if (travelElapsed >= 0 && this._pendingWhiffSrc) {
        this._audio.playVoice(this._pendingWhiffSrc, this._pendingWhiffVolume);
        this._pendingWhiffSrc = undefined;
      }
      // Drain voice cues whose target tick has been reached. Independent
      // of the travel window — each cue is anchored to its own frame so
      // stationary specials (no travel) get the same scheduling treatment.
      if (this._pendingVoiceCues.length > 0) {
        this._pendingVoiceCues = this._pendingVoiceCues.filter((cue) => {
          if (tick >= cue.tick) {
            this._audio.playVoice(cue.src, cue.volume);
            return false;
          }
          return true;
        });
      }
      if (travelElapsed >= 0 && tick < this._specialTravelEndTick) {
        if (this._specialXStep > 0 && !this.blockedRight()) {
          this.accumulated.update((x) => x + this._specialXStep);
        } else if (this._specialXStep < 0 && !this.blockedLeft()) {
          this.accumulated.update((x) => x + this._specialXStep);
        }
        if (this._specialArcHeight !== 0 && travelTicks > 0) {
          // Two Y curves:
          //   parabolic (default): y(t) = -arcHeight × 4t(1-t)  — rise+fall
          //     within the travel window, Y returns to 0 at t=1.
          //   half-sine (fallAfterArc): y(t) = -arcHeight × sin(t × π/2)
          //     — rise only, peaking at t=1. The fall happens after the
          //     animation, via the jump-physics hand-off below.
          // Setting absolutely (not accumulating) avoids drift from per-tick
          // rounding. Normalize against `travelTicks - 1` so the LAST tick
          // (travelElapsed = travelTicks - 1) lands at t=1.
          const denom = Math.max(1, travelTicks - 1);
          const t = Math.min(1, travelElapsed / denom);
          const norm = this._specialFallAfterArc ? Math.sin((t * Math.PI) / 2) : 4 * t * (1 - t);
          this.accumulatedY.set(-this._specialArcHeight * norm);
        }
      } else if (
        this._specialArcHeight !== 0 &&
        !this._specialFallAfterArc &&
        tick >= this._specialTravelEndTick &&
        this.accumulatedY() !== 0
      ) {
        // Past the travel window — pin to ground so grounded recovery
        // frames (declared via `travelEndFrame`) don't render mid-air on
        // the parabola's last sample. Skipped for `fallAfterArc` specials,
        // since those WANT Y to stay at peak between travel-end and the
        // hand-off to jump-fall physics.
        this.accumulatedY.set(0);
      }
      const elapsed = this._loop.tick() - this._attackStartTick;
      if (elapsed >= this._attackDurationTicks) {
        // If this special is configured to fall after the arc and Terry
        // is still above ground, hand off to the jump's descent physics:
        // set `inJump=true` and compute `_jumpStartTick` so the jump's
        // landing tick fires exactly when Y reaches 0 at jumpVerticalStep
        // per tick. Animation flips to `jumpFall`; jump physics handles
        // the rest (descent + ground landing → state-machine takeover).
        if (this._specialFallAfterArc && this.accumulatedY() < 0) {
          this.inAttack.set(false);
          this._specialXStep = 0;
          this._specialArcHeight = 0;
          this._specialFallAfterArc = false;
          this._pendingWhiffSrc = undefined;
          this._pendingVoiceCues = [];
          // Custom descent (not the jump physics) — jump's ascending
          // phase would otherwise push Y further up for the first
          // `apexTicks` ticks before the descent kicks in. Handled at
          // the top of `_physicsTick` next tick.
          this._specialFallingDescent = true;
          this.animation.set('jumpFall');
          return;
        }
        this.inAttack.set(false);
        this._specialXStep = 0;
        this._specialArcHeight = 0;
        this._specialFallAfterArc = false;
        this._pendingWhiffSrc = undefined;
        this._pendingVoiceCues = [];
        this.accumulatedY.set(0);
      }
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
        else
          this.animation.set(dir === 'right' ? 'forward' : dir === 'left' ? 'backwards' : 'idle');
        return;
      }

      const ascending = elapsed < apexTicks;
      if (ascending) {
        this.accumulatedY.update((y) => y - this.jumpVerticalStep);
      } else {
        // Past apex: transition each jump direction to its `Fall` variant
        // exactly once. The fall variants are `loop: false` so the engine
        // holds on the last (hat-down) frame until the physics tick lands
        // and the state-machine effect transitions to a ground animation.
        const anim = this.animation();
        if (anim === 'jumpUp') this.animation.set('jumpFall');
        else if (anim === 'jumpForward') this.animation.set('jumpForwardFall');
        else if (anim === 'jumpBackward') this.animation.set('jumpBackwardFall');
        this.accumulatedY.update((y) => y + this.jumpVerticalStep);
      }

      if (this._forwardJump && !this.blockedRight())
        this.accumulated.update((x) => x + this._jumpXStep);
      if (this._backwardJump && !this.blockedLeft())
        this.accumulated.update((x) => x - this._jumpXStep);
      return;
    }

    // Ground movement.
    const down = this._input.downKey();
    const dir = this._input.lastDir();
    if (down) {
      if (dir === 'right' && !this.blockedRight()) {
        this.accumulated.update((x) => x + this.crouchSpeed);
      }
      return;
    }
    if (dir === 'right' && !this.blockedRight()) {
      this.accumulated.update((x) => x + this.walkSpeed);
    } else if (dir === 'left' && !this.blockedLeft()) {
      this.accumulated.update((x) => x - this.walkSpeed);
    }
  }
}
