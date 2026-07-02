import {
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
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
  ProjectileSpawn,
  ProjectileSpawnRequest,
  SpecialMove,
} from '../../models/character';
import { InputService } from '../../services/input.service';
import { GameLoopService } from '../../services/game-loop.service';
import { AudioService, SoundCategory } from '../../services/audio.service';
import { REFERENCE_WIDTH } from '../../constants/viewport';

/**
 * Abstract character base. Owns the physics, input wiring, and animation
 * state machine. Subclasses are concrete @Component classes that supply
 * their own `animationFrames` map (per-frame image + anchor data) and
 * styleUrl (the matching sprite stylesheet) — same shape as a game-engine
 * character prefab.
 *
 * Subclasses must:
 *  - decorate with @Component, sharing the character template
 *      `templateUrl: '../components/character/character.html'`
 *  - declare an `animationFrames` entry for every animation they set
 *    (`idle` is always required — it's the initial state).
 *
 * The Stage instantiates the chosen subclass imperatively
 * (`viewContainerRef.createComponent`) and forwards its geometry via
 * `ComponentRef.setInput` — no provider registration needed.
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
  /** Source-pixel height of the idle/standing sprite — the baseline every
   * per-frame sprite is scaled against (`frame.h × renderedHeight /
   * spriteBaseHeight`). Pairs with the `--character-height` CSS var (the
   * rendered standing height, in cqw) set in the character's SCSS. Terry's
   * idle is 107px tall; a character with a different idle height overrides. */
  protected readonly spriteBaseHeight: number = 107;

  protected readonly walkSpeed: number = 10;
  protected readonly crouchSpeed: number = 5;
  /** Reference stage width the per-tick pixel rates above are calibrated
   * against; the effective rate scales by `worldWidth / referenceWidth` so the
   * character covers the same FRACTION of the stage per tick on any viewport.
   * Defaults to the shared `REFERENCE_WIDTH`; override per character if needed. */
  protected readonly referenceWidth: number = REFERENCE_WIDTH;
  /** Fraction of the surrounding world width covered in a forward/back jump. */
  protected readonly jumpDistancePct: number = 0.4;
  protected readonly jumpTicks: number = 29;
  protected readonly jumpDurationMs: number = 870;
  protected readonly jumpApexMs: number = 500;
  protected readonly jumpVerticalStep: number = 5;
  /** Per-tick Y descent during a normal jump's fall phase. Higher than
   * `jumpVerticalStep` so Terry rises slowly (heavy "lift" feel) but falls
   * faster, killing the float that comes with a symmetric arc. Tuned so
   * descentTicks × this ≈ ascentTicks × jumpVerticalStep — peak is reached
   * via slow ascent, then gravity feels weighted on the way back down. */
  protected readonly jumpDescentVerticalStep: number = 7;
  /** Per-tick Y descent during the post-special fall (after `fallAfterArc`).
   * Faster than `jumpDescentVerticalStep` so Terry doesn't loiter mid-air
   * after a Rising Tackle — anti-air specials feel snappier landing quickly. */
  protected readonly specialFallVerticalStep: number = 9;
  protected readonly jumpYScale: number = 0.4;
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
    [{ src: 'assets/sfx/misc/backstep-1.mp3', frame: 1 }];
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
  /** True when the stage has at least one projectile alive (forwarded from
   * `Stage.hasActiveProjectile`). Specials whose `projectile` config is set
   * are gated on this — without the gate, the cast animation plays in full
   * but the spawn is silently dropped by the stage's concurrency cap. */
  readonly projectileActive = input(false);

  readonly el = viewChild.required<ElementRef<HTMLElement>>('el');

  // Injected engine services. `protected` so character-specific moves (wired
  // via the `interceptAttack` / `tickCustomAttack` hooks) can read input,
  // schedule off the loop tick, and play audio the same way the base does.
  protected readonly _input = inject(InputService);
  protected readonly _loop = inject(GameLoopService);
  protected readonly _audio = inject(AudioService);

  // Public reactive state — Stage reads worldX() to drive train scrolling.
  // Animation is typed as `string` (not `AnimationName`) so specials — whose
  // names live outside the built-in union — can be assigned without a cast.
  // Built-ins set literal `AnimationName` values; `currentAnimData` resolves
  // the name by looking up `animationFrames` first, then scanning `specials`.
  readonly animation = signal<string>('idle');
  readonly accumulated = signal(4);
  readonly accumulatedY = signal(0);
  readonly inJump = signal(false);
  readonly inAttack = signal(false);
  readonly width = signal(0);
  /** True while a scripted, input-independent sequence is playing (the
   * stage-exit outro — see `playOutro`). Suppresses the animation state
   * machine and ignores player input so the choreographed back-dash →
   * hat-throw can't be overridden mid-play. Intentionally never cleared
   * once engaged: Terry holds his final pose while the loading transition
   * covers the screen, and the character is destroyed on navigation. */
  readonly scripted = signal(false);
  /** Frame index within the current per-frame animation (no effect on strip
   * animations). Reset when a new per-frame animation starts. */
  readonly currentFrameIndex = signal(0);
  /** Flips to true once `_initialX` and `width` have been measured. Stage
   * gates edge checks on this — without it, the few-tick window before the
   * first afterNextRender fires causes `worldX` (with `_initialX === 0`)
   * to fall well below `leftLimit`, falsely tripping `blockedLeft`. */
  readonly ready = signal(false);

  /** Fires once per projectile-spawning special when the spawn frame is
   * reached. Stage subscribes via effect on the spawned character and
   * instantiates the projectile in its `#projectileHost` slot. Keeps
   * the "character knows nothing about the stage" rule intact — the
   * character just declares it needs a thing spawned at a coordinate;
   * the stage handles instantiation and cleanup. */
  readonly projectileSpawnRequested = output<ProjectileSpawnRequest>();

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
   * still above ground. Each physics tick descends Y by `specialFallVerticalStep`
   * until ground contact, at which point the state-machine handover
   * snaps in. The state-machine effect and `_startAttack` / `_startJump`
   * all gate on this so the character can't be re-triggered mid-descent. */
  private _specialFallingDescent = false;
  /** Absolute loop tick at which the active heavy aerial's animation
   * finishes (sum of frame durations). The past-apex branch in
   * `_physicsTick` fires the swap to `airHeavyRecover` once BOTH
   * conditions are met: tick ≥ this AND elapsed ≥ apexTicks. That's the
   * "recover at MAX(animation end, descent start)" rule — kicks pressed
   * early hold their last frame until apex, kicks pressed close to apex
   * play through past apex before recovering, kicks pressed during
   * descent play through and recover on their own end tick. 0 = no
   * recovery scheduled (light aerials, or recover already fired). */
  private _airHeavyAttackEndTick = 0;
  /** True between the first air-attack trigger of a jump and landing. One air
   * normal per jump — the gate has to outlive the active animation because the
   * heavy variant transitions through `airHeavyPunch` → `airHeavyRecover`
   * mid-air, so an animation-name check would let a second press slip through
   * during the recovery window. Cleared on land. */
  private _airAttackUsed = false;
  /** Queue of voice cues from the active special, each tagged with the
   * absolute tick at which it should fire (computed from `SpecialMove.voices`
   * frame indices at launch). The physics tick drains entries as their
   * tick is reached; the queue is cleared on attack end. */
  private _pendingVoiceCues: {
    src: string;
    volume: number;
    tick: number;
    category: SoundCategory;
  }[] = [];
  private _pendingWhiffSrc: string | undefined = undefined;
  /** Queue of projectile-spawn events from the active special, each
   * tagged with the absolute tick at which `projectileSpawnRequested`
   * should fire. Drained per-tick in `_physicsTick`, same shape as the
   * voice-cue queue. */
  private _pendingProjectileSpawns: { config: ProjectileSpawn; tick: number }[] = [];
  private _pendingWhiffVolume = 0;
  /** The Audio element from the currently-playing jump SFX, so a special
   * that cancels the jump (e.g. Rising Tackle on `down→up+P`, where the
   * Up press fires the jump a few ms before the punch arrives) can stop
   * the whoosh — otherwise the jump SFX bleeds over into the special. */
  private _activeJumpSfx: HTMLAudioElement | null = null;
  private _frameStartTick = 0;
  /** Step direction (+1 forward / -1 reverse) for `bounce` (ping-pong)
   * animations. Reset to +1 whenever the animation changes. */
  private _frameDir = 1;
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
   * expressed in `cqw` (via `var(--character-height) / spriteBaseHeight`) so
   * it scales with the sprite when the stage resizes, matching the cqw-based
   * sprite sizing. */
  frameTransform(frame: AnimationFrame): string {
    const spritePxOffset = this.bodyAnchorX - frame.anchorX;
    const xPart = `calc(${this.accumulated()}px + ${spritePxOffset} * var(--character-height) / ${this.spriteBaseHeight})`;
    const yRaw = this.accumulatedY();
    if (yRaw !== 0) {
      return `translate(${xPart}, ${yRaw * this.jumpYScale}cqw)`;
    }
    return `translateX(${xPart})`;
  }

  /** CSS width string for an `<img>` rendering a per-frame sprite — matches
   * the cqw scaling formula used by strip-mode sprite classes. */
  frameWidth(frame: AnimationFrame): string {
    return `calc(${frame.w} * var(--character-height) / ${this.spriteBaseHeight})`;
  }

  frameHeight(frame: AnimationFrame): string {
    return `calc(${frame.h} * var(--character-height) / ${this.spriteBaseHeight})`;
  }

  /**
   * Wire a one-shot reaction to a global press-counter signal. The counter
   * lives on the root-singleton InputService and survives stage navigation,
   * so we snapshot its current value when this character spawns and only run
   * `handler` on increments beyond that baseline. Prevents a freshly-spawned
   * character from replaying presses that happened on a previous stage.
   */
  private _onPress(counter: () => number, handler: () => void): void {
    let last = counter();
    effect(() => {
      const n = counter();
      if (n === last) return;
      last = n;
      // Player input is inert during a scripted outro (still advance the
      // baseline above so we don't replay the press when it ends).
      if (untracked(() => this.scripted())) return;
      untracked(handler);
    });
  }

  constructor() {
    // Order matters: effects run in creation order, so the wiring below is
    // sequenced state-machine → input triggers → frame engine → physics.
    this._measureAndPreloadOnRender();
    this._wireAnimationStateMachine();
    this._wireInputTriggers();
    this._wireFrameEngine();
    this._wirePhysics();
  }

  /** Measure the layout origin + width on first render, mark ready, and warm
   * the sprite cache. */
  private _measureAndPreloadOnRender(): void {
    afterNextRender(() => {
      this._measureLayout();
      this.ready.set(true);
      this._preloadAllFrames();
    });
  }

  /** Re-read the layout origin + sprite width, and rescale how far the
   * character has walked (`accumulated`) by `widthRatio` (newWidth / oldWidth)
   * so its position relative to the rescaled stage is preserved — otherwise the
   * fixed px walk offset pushes it off a now-smaller stage when pinned at an
   * edge. The element is sized in `cqw`, so the layout origin already rescales;
   * `accumulated` is plain px, so it needs the explicit scale. Called by the
   * Stage on viewport resize. (Future jump/special travel recomputes from the
   * updated `worldWidth`; the in-flight one keeps its takeoff value.) */
  remeasure(widthRatio: number): void {
    // Compute the layout origin from the CURRENT (pre-scale) accumulated first,
    // then rescale — `worldX` (`_initialX + accumulated`) stays consistent.
    this._measureLayout();
    if (widthRatio > 0 && widthRatio !== 1) {
      this.accumulated.update((x) => x * widthRatio);
    }
  }

  private _measureLayout(): void {
    const node = this.el().nativeElement;
    // `rect.x` is post-transform; subtract the translation already applied
    // (via `accumulated`) so the baseline is the layout origin, not wherever
    // the character currently sits. Matters if keys fired before this ran.
    this._initialX = node.getBoundingClientRect().x - this.accumulated();
    this.width.set(node.clientWidth);
  }

  /** Warm the browser cache for every per-frame sprite so frame-to-frame src
   * changes don't flash. Reads `animationFrames` / `specials` here (not the
   * constructor) so subclass field overrides are already applied. Each
   * preloaded Image is retained on the instance so the memory cache can't
   * evict it — which dev's no-store cache-control would otherwise force a
   * re-fetch on with every src change. */
  private _preloadAllFrames(): void {
    const preload = (data: AnimationData): void => {
      for (const frame of data.frames) {
        const img = new Image();
        img.src = frame.src;
        this._preloadedImages.push(img);
      }
    };
    for (const data of Object.values(this.animationFrames)) {
      if (data) preload(data);
    }
    for (const special of this.specials) preload(special.frames);
  }

  /** Animation state machine — picks the grounded animation from input when
   * not mid-jump/attack/descent and not in a scripted outro. `inAttack` is
   * tracked so it re-runs (and re-selects) the moment an attack ends. */
  private _wireAnimationStateMachine(): void {
    effect(() => {
      const lastDir = this._input.lastDir();
      const down = this._input.downKey();
      const inAttack = this.inAttack();
      // A scripted outro owns the animation outright — never let input-driven
      // selection override the choreographed back-dash / hat-throw.
      if (this.scripted()) return;
      if (untracked(() => this.inJump())) return;
      if (untracked(() => this._specialFallingDescent)) return;
      if (inAttack) return;
      untracked(() => this._selectGroundAnimation(lastDir, down));
    });
  }

  /** Choose the standing / walking / crouching animation for the current
   * input. When crouching, holds the deep-crouch still pose if already
   * crouched (incl. crouching attacks) rather than replaying the crouch entry
   * — otherwise a punch ending while Down is held reads as Terry briefly
   * standing before crouching again. */
  private _selectGroundAnimation(lastDir: Direction, down: boolean): void {
    if (down) {
      const a = this.animation();
      const alreadyCrouched =
        a === 'crouch' ||
        a === 'crouchStill' ||
        a === 'crouchForward' ||
        a === 'crouchLightPunch' ||
        a === 'crouchHeavyPunch' ||
        a === 'crouchLightKick' ||
        a === 'crouchHeavyKick';
      if (lastDir === 'right') this.animation.set('crouchForward');
      else if (alreadyCrouched) this.animation.set('crouchStill');
      else this.animation.set('crouch');
      return;
    }
    if (lastDir === 'right') this.animation.set('forward');
    else if (lastDir === 'left') this.animation.set('backwards');
    else this.animation.set('idle');
  }

  /** One-shot input triggers. Each `*Pressed` signal is a global,
   * monotonically-increasing counter on the root-singleton InputService that
   * PERSISTS across navigation; `_onPress` baselines it at spawn so a freshly
   * created character doesn't replay presses from the previous stage. */
  private _wireInputTriggers(): void {
    this._onPress(() => this._input.jumpPressed(), () => this._startJump());
    // Backstep — purely motion-driven (left→left double-tap), no attack
    // button. No-ops silently if the character has no `backstep` frames.
    this._onPress(() => this._input.backstepPressed(), () => this._startBackstep());
    // Attack buttons fan through `_tryAttack` (special-scan → normal).
    this._onPress(() => this._input.lightPunchPressed(), () => this._tryAttack('lightPunch'));
    this._onPress(() => this._input.heavyPunchPressed(), () => this._tryAttack('heavyPunch'));
    this._onPress(() => this._input.lightKickPressed(), () => this._tryAttack('lightKick'));
    this._onPress(() => this._input.heavyKickPressed(), () => this._tryAttack('heavyKick'));
  }

  /** Data-driven frame engine: advance the current animation each tick, and
   * reset the frame index whenever the animation changes (so the next
   * per-frame anim starts at frame 0, not wherever the last left off). */
  private _wireFrameEngine(): void {
    effect(() => {
      this._loop.tick();
      untracked(() => this._advanceFrame());
    });
    effect(() => {
      this.animation();
      untracked(() => {
        this.currentFrameIndex.set(0);
        this._frameDir = 1;
        this._frameStartTick = this._loop.tick();
      });
    });
  }

  /** Physics tick — single dependency on the loop signal; everything else is
   * read untracked so we don't feedback-loop. */
  private _wirePhysics(): void {
    effect(() => {
      this._loop.tick();
      untracked(() => this._physicsTick());
    });
  }

  /**
   * Scripted stage-exit outro, awaited by the Stage before the loading
   * transition. Default: nothing — a character with no outro just transitions
   * straight away. Override to choreograph a send-off (back-dashes, a victory
   * pose, a tossed prop, …) by composing the `backDash` / `playScriptedClip`
   * primitives below, engaging `scripted` for the duration so player input and
   * the animation state machine don't interfere. The choreography is the
   * character's own — the base only provides the building blocks. */
  async playOutro(): Promise<void> {}

  /** Perform one scripted back-dash and await its full duration, plus a 2-tick
   * buffer so its `inAttack` lock-in clears before the next scripted clip
   * starts. No-op if the character has no `backstep` frames. Requires
   * `scripted` to be engaged by the caller (so the held pose isn't overridden
   * between clips). */
  protected async backDash(): Promise<void> {
    this._startBackstep();
    await this._wait(this._animDurationMs('backstep') + GameLoopService.TICK_MS * 2);
  }

  /**
   * Play a single scripted animation clip — the unit a `playOutro` override
   * composes. Optionally fires a frame-anchored voice cue and/or spawns a
   * projectile (same scheduling specials use), then awaits until the clip and
   * any projectile flight + rest beat complete, leaving the character frozen
   * on the clip's last frame. Requires `scripted` engaged. No-op if the
   * animation has no frames.
   */
  protected async playScriptedClip(
    animation: AnimationName,
    opts: {
      readonly voice?: { readonly src: string; readonly frame?: number };
      readonly projectile?: ProjectileSpawn;
      /** Throw→land flight of `projectile`; holds the clip open until it lands. */
      readonly projectileFlightMs?: number;
      /** Extra beat after the projectile lands before resolving. */
      readonly holdAfterLandMs?: number;
    } = {},
  ): Promise<void> {
    const data = this.animationFrames[animation];
    if (!data) return;
    this._startAttack({ animation, frames: data, fallbackDurationMs: 800 });
    if (!(this.inAttack() && this.animation() === animation)) return;

    if (opts.voice) {
      this._pendingVoiceCues.push({
        src: opts.voice.src,
        volume: this.voiceVolume,
        category: 'voice',
        tick: this._attackStartTick + this._windupTicks(data.frames, opts.voice.frame ?? 0),
      });
    }

    let outroMs = this._animDurationMs(animation);
    if (opts.projectile) {
      const spawnFrame = opts.projectile.spawnFrame ?? 0;
      this._pendingProjectileSpawns.push({
        config: opts.projectile,
        tick: this._attackStartTick + this._windupTicks(data.frames, spawnFrame),
      });
      // Hold the clip open until the prop lands (throw time + flight) plus a
      // rest beat, so the loading transition only starts after it completes.
      if (opts.projectileFlightMs != null) {
        const throwMs = data.frames
          .slice(0, spawnFrame)
          .reduce((sum, f) => sum + f.durationMs, 0);
        const landMs = throwMs + opts.projectileFlightMs;
        outroMs = Math.max(outroMs, landMs + (opts.holdAfterLandMs ?? 0));
      }
    }
    await this._wait(outroMs);
  }

  /** Sum of a per-frame animation's frame durations (ms), or 0 if undefined. */
  private _animDurationMs(name: AnimationName): number {
    const data = this.animationFrames[name];
    return data ? data.frames.reduce((sum, f) => sum + f.durationMs, 0) : 0;
  }

  private _wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
  /** Crouching light punch — triggered when lightPunch is pressed while
   * Down is held. Reuses the standing light punch's voice + whiff (same
   * grunt, same whoosh); only the animation differs. The state machine
   * picks `crouchStill` (not `crouch` entry) when the attack lock-in
   * ends, so Terry stays in the deep crouch pose instead of replaying
   * the crouch entry every time he punches. */
  crouchLightPunch(): void {
    this._startAttack({
      animation: 'crouchLightPunch',
      voiceSrc: this.voices.lightPunch,
      whiffSrc: this.voices['lightPunchWhiff'],
      frames: this.animationFrames['crouchLightPunch'],
      fallbackDurationMs: this.lightPunchDurationMs,
    });
  }
  /** Crouching heavy punch — triggered when heavyPunch is pressed while
   * Down is held. Mirrors `crouchLightPunch` (shared voice + whiff with
   * its standing counterpart, state machine returns to `crouchStill`
   * when the lock-in ends). */
  crouchHeavyPunch(): void {
    this._startAttack({
      animation: 'crouchHeavyPunch',
      voiceSrc: this.voices.heavyPunch,
      whiffSrc: this.voices['heavyPunchWhiff'],
      frames: this.animationFrames['crouchHeavyPunch'],
      fallbackDurationMs: this.heavyPunchDurationMs,
    });
  }
  /** Crouching light kick — triggered when lightKick is pressed while
   * Down is held. Same shape as the other crouching attacks (shared
   * voice + whiff, state machine returns to `crouchStill`). */
  crouchLightKick(): void {
    this._startAttack({
      animation: 'crouchLightKick',
      voiceSrc: this.voices.lightKick,
      whiffSrc: this.voices['lightKickWhiff'],
      frames: this.animationFrames['crouchLightKick'],
      fallbackDurationMs: this.lightKickDurationMs,
    });
  }
  /** Crouching heavy kick — triggered when heavyKick is pressed while
   * Down is held. Same shape as the other crouching attacks. */
  crouchHeavyKick(): void {
    this._startAttack({
      animation: 'crouchHeavyKick',
      voiceSrc: this.voices.heavyKick,
      whiffSrc: this.voices['heavyKickWhiff'],
      frames: this.animationFrames['crouchHeavyKick'],
      fallbackDurationMs: this.heavyKickDurationMs,
    });
  }
  /** Air light punch — fires only mid-jump. See `_startAirAttack`. Last
   * frame holds until landing. */
  airLightPunch(): void {
    this._startAirAttack({
      animation: 'airLightPunch',
      voiceSrc: this.voices.lightPunch,
      whiffSrc: this.voices['lightPunchWhiff'],
    });
  }
  /** Air heavy punch — fires only mid-jump. See `_startAirAttack`. Unlike
   * the light variant, heavy schedules a recovery: after the punch frames
   * finish, the sprite swaps to `airHeavyRecover` so Terry visibly
   * recovers his stance mid-air before landing (and is "punishable" — can't
   * act again until landing). */
  airHeavyPunch(): void {
    this._startAirAttack({
      animation: 'airHeavyPunch',
      voiceSrc: this.voices.heavyPunch,
      whiffSrc: this.voices['heavyPunchWhiff'],
      recover: true,
    });
  }
  /** Air light kick — direction-aware sprite. Forward/backward jumps use
   * `airLightKick` (forward-pointing knee/leg); vertical (in-place) jumps
   * use `airLightKickUp` from a different sheet row (legs tucked under,
   * kicking down). Both variants hold the extended pose until landing,
   * same as `airLightPunch`. */
  airLightKick(): void {
    const animation = this._forwardJump || this._backwardJump ? 'airLightKick' : 'airLightKickUp';
    this._startAirAttack({
      animation,
      voiceSrc: this.voices.lightKick,
      whiffSrc: this.voices['lightKickWhiff'],
    });
  }
  /** Air heavy kick — direction-aware sprite. Forward/backward jumps use
   * `airHeavyKick` (forward kick extension); vertical (in-place) jumps
   * use `airHeavyKickUp` from a different sheet row (full leap-and-kick
   * sequence with windup, cock-back, and follow-through). Both variants
   * schedule `airHeavyRecover` after the kick frames finish so Terry
   * visibly resets his stance mid-air. */
  airHeavyKick(): void {
    const animation = this._forwardJump || this._backwardJump ? 'airHeavyKick' : 'airHeavyKickUp';
    this._startAirAttack({
      animation,
      voiceSrc: this.voices.heavyKick,
      whiffSrc: this.voices['heavyKickWhiff'],
      recover: true,
    });
  }
  taunt(): void {
    this._audio.playVoice(this.voices.taunt, this.voiceVolume);
  }

  /** Generic attack-button dispatcher. Lets a subclass intercept first (for a
   * character-specific move like Joe's mash flurry), then tries a motion-matched
   * special, then routes to the air / crouch / ground normal for that button. */
  private _tryAttack(button: AttackButton): void {
    if (this.interceptAttack(button)) return;
    if (this._tryRunSpecial(button)) return;
    // Buttons without an air normal yet are no-ops in the air.
    if (this.inJump()) return this._dispatchAirAttack(button);
    // Down held swaps to the crouching variant; falls through to standing if
    // the character has no crouching variant for the button.
    if (this._input.downKey() && this._dispatchCrouchAttack(button)) return;
    this._dispatchGroundAttack(button);
  }

  /** Extension hook: a subclass returns true to fully handle an attack-button
   * press itself (e.g. a mash-triggered move), suppressing the base's special /
   * normal dispatch for that press. Default: no interception. */
  protected interceptAttack(_button: AttackButton): boolean {
    return false;
  }

  /** Extension hook: a subclass returns true to own the physics tick this frame
   * (e.g. sustaining a character-specific move), so the base skips its own
   * attack / jump / ground handling. Default: not handled. */
  protected tickCustomAttack(): boolean {
    return false;
  }

  /** Scan specials bound to `button` (longest motion first, so a 4-input
   * motion isn't short-circuited by a 2-input subset) and fire the first
   * whose motion matches. Returns true iff a special actually launched (the
   * caller stops); a matched-but-no-op'd special returns false so the press
   * falls through to the normal attack.
   *
   * Specials are tried even mid-jump — motions like Rising Tackle's `down→up`
   * arrive after Up has already started the jump, and `_runSpecial` is what
   * knows how to cancel a just-started jump. */
  private _tryRunSpecial(button: AttackButton): boolean {
    const candidates = this.specials
      .filter((s) => s.button === button)
      // Suppress projectile-spawning specials when one is already on screen —
      // otherwise the cast plays in full and the Stage's concurrency cap
      // silently drops the spawn. Filtering BEFORE the loop also preserves
      // the motion (matchMotion consumes events) for any non-projectile
      // fallback on the same button.
      .filter((s) => !(s.projectile && this.projectileActive()))
      .slice()
      .sort((a, b) => b.motion.length - a.motion.length);
    for (const s of candidates) {
      if (this._input.matchMotion(s.motion)) {
        this._runSpecial(s);
        // Once one motion matched, its events are consumed — no other special
        // could match, so we're done scanning regardless.
        return this.inAttack();
      }
    }
    return false;
  }

  private _dispatchAirAttack(button: AttackButton): void {
    if (button === 'lightPunch') this.airLightPunch();
    else if (button === 'heavyPunch') this.airHeavyPunch();
    else if (button === 'lightKick') this.airLightKick();
    else if (button === 'heavyKick') this.airHeavyKick();
  }

  /** Fire the crouching variant of `button` if the character defines one.
   * Returns whether it handled the press. */
  private _dispatchCrouchAttack(button: AttackButton): boolean {
    if (button === 'lightPunch' && this.animationFrames['crouchLightPunch']) {
      this.crouchLightPunch();
      return true;
    }
    if (button === 'heavyPunch' && this.animationFrames['crouchHeavyPunch']) {
      this.crouchHeavyPunch();
      return true;
    }
    if (button === 'lightKick' && this.animationFrames['crouchLightKick']) {
      this.crouchLightKick();
      return true;
    }
    if (button === 'heavyKick' && this.animationFrames['crouchHeavyKick']) {
      this.crouchHeavyKick();
      return true;
    }
    return false;
  }

  private _dispatchGroundAttack(button: AttackButton): void {
    if (button === 'lightPunch') this.lightPunch();
    else if (button === 'heavyPunch') this.heavyPunch();
    else if (button === 'lightKick') this.lightKick();
    else if (button === 'heavyKick') this.heavyKick();
  }

  private _runSpecial(s: SpecialMove): void {
    // Bail upfront if a previous attack/special is still locked in —
    // otherwise the scheduling below would stack cues/travel on top of the
    // in-progress special. The `inJump` check is intentionally omitted so we
    // can still cancel a just-started jump; the `_startAttack` call enforces
    // the jump gate itself.
    if (this.inAttack() || this._specialFallingDescent) return;
    this._cancelJustStartedJump();

    // Traveling specials defer the whoosh to travel start. Voices use the
    // explicit `frame`-indexed cues array, so `_startAttack` gets no
    // `voiceSrc` and plays nothing itself.
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
    // `_startAttack` no-ops when blocked by the jump/attack lock — only
    // commit the rest once the special actually launched. The animation name
    // is the tell: `_startAttack` sets it on success.
    if (!(this.inAttack() && this.animation() === s.name)) return;
    this._scheduleSpecialCues(s, defer);
    this._commitSpecialTravel(s);
  }

  /** Cancel an in-progress jump iff it JUST started — i.e. the Up press is
   * part of the special's motion (e.g. `down→up+P` for Rising Tackle, where
   * Up fires the jump a few ms before the punch arrives). A jump running
   * longer than this means the player committed to it earlier, so a stale
   * `down→up` in the buffer shouldn't hijack it into a special. */
  private _cancelJustStartedJump(): void {
    const jumpJustStartedTicks = 4; // ~120ms — about one human input gap
    if (!(this.inJump() && this._loop.tick() - this._jumpStartTick <= jumpJustStartedTicks)) {
      return;
    }
    this.inJump.set(false);
    this.accumulatedY.set(0);
    this._forwardJump = false;
    this._backwardJump = false;
    // Stop the jump whoosh — the follow-up punch converts the jump into a
    // special; letting it ring through bleeds into the special's voice/whiff.
    if (this._activeJumpSfx) {
      this._activeJumpSfx.pause();
      this._activeJumpSfx.currentTime = 0;
      this._activeJumpSfx = null;
    }
  }

  /** Queue a launched special's scheduled cues: the deferred travel whiff,
   * each frame-anchored voice shout, and the projectile spawn (if any). All
   * tick targets are relative to `_attackStartTick`; the physics tick drains
   * them as their tick is reached. */
  private _scheduleSpecialCues(s: SpecialMove, defer: boolean): void {
    if (defer) {
      this._pendingWhiffSrc = s.whiffSrc;
      this._pendingWhiffVolume = this.specialWhiffVolume;
    }
    for (const v of s.voices ?? []) {
      this._pendingVoiceCues.push({
        src: v.src,
        volume: this.voiceVolume,
        category: 'voice',
        tick: this._attackStartTick + this._windupTicks(s.frames.frames, v.frame ?? 0),
      });
    }
    if (s.projectile) {
      this._pendingProjectileSpawns.push({
        config: s.projectile,
        tick: this._attackStartTick + this._windupTicks(s.frames.frames, s.projectile.spawnFrame ?? 0),
      });
    }
  }

  /** Commit a launched special's travel state (per-tick X step + Y arc +
   * travel window). No-op for stationary specials. */
  private _commitSpecialTravel(s: SpecialMove): void {
    if (!(s.travelDistancePct || s.arcHeight)) return;
    const startFrame = s.travelStartFrame ?? 0;
    const endFrame = s.travelEndFrame ?? s.frames.frames.length;
    const windupTicks = this._windupTicks(s.frames.frames, startFrame);
    const travelMs = s.frames.frames
      .slice(startFrame, endFrame)
      .reduce((sum, f) => sum + f.durationMs, 0);
    // Guard the divisor against a degenerate `endFrame <= startFrame` — NaN.
    const travelTicks = Math.max(1, Math.round(travelMs / GameLoopService.TICK_MS));
    this._specialXStep = s.travelDistancePct
      ? (this.worldWidth() * s.travelDistancePct) / travelTicks
      : 0;
    this._specialArcHeight = s.arcHeight ?? 0;
    this._specialFallAfterArc = !!s.fallAfterArc;
    this._specialTravelStartTick = this._attackStartTick + windupTicks;
    this._specialTravelEndTick = this._specialTravelStartTick + travelTicks;
  }

  /** Whole-tick windup delay before the frame at `uptoFrame` — the summed
   * duration of the leading frames, in ticks. The anchor every scheduled cue,
   * projectile spawn, and travel window measures its start from. */
  private _windupTicks(frames: readonly AnimationFrame[], uptoFrame: number): number {
    const ms = frames.slice(0, uptoFrame).reduce((sum, f) => sum + f.durationMs, 0);
    return Math.round(ms / GameLoopService.TICK_MS);
  }

  /** Shared kickoff for air normals (light / heavy). Distinct from
   * `_startAttack` because air attacks DO NOT enter the `inAttack` lock-in
   * — that would freeze jump physics. The sprite is swapped to the air
   * animation; jump physics keep advancing underneath; the animation's
   * `loop: false` holds the last frame.
   *
   * `recover: true` schedules an auto-transition back to a jump-fall sprite
   * after the animation's total frame duration elapses (used by heavy
   * variants so Terry visibly recovers his stance mid-air). Without
   * `recover`, the last frame holds until the jump's land tick.
   *
   * One air normal per jump — re-presses while either air punch is up are
   * ignored. */
  private _startAirAttack(opts: {
    readonly animation: AnimationName;
    readonly voiceSrc?: string;
    readonly whiffSrc?: string;
    readonly recover?: boolean;
  }): void {
    if (!this.inJump()) return;
    if (this._airAttackUsed) return;
    const frames = this.animationFrames[opts.animation];
    if (!frames) return;
    this._audio.playVoice(opts.voiceSrc, this.voiceVolume);
    this._audio.playVoice(opts.whiffSrc, this.sfxVolume, 'sfx');
    this.animation.set(opts.animation);
    this._airAttackUsed = true;
    // Heavy aerials schedule a recovery transition. The past-apex branch
    // in `_physicsTick` consumes the milestone once BOTH gates are true:
    // animation frames have all played AND Terry has crossed apex. This
    // is the "MAX(animation end, descent start)" rule — kicks pressed
    // early hold their last frame until apex, kicks pressed close to
    // apex play through past apex, kicks pressed during descent play
    // through then recover on their own end tick.
    if (opts.recover) {
      const totalMs = frames.frames.reduce((sum, f) => sum + f.durationMs, 0);
      this._airHeavyAttackEndTick =
        this._loop.tick() + Math.round(totalMs / GameLoopService.TICK_MS);
    } else {
      this._airHeavyAttackEndTick = 0;
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
      this._audio.playVoice(opts.whiffSrc, opts.whiffVolume ?? this.sfxVolume, 'sfx');
    }
    this.animation.set(opts.animation);
    // Reset frame state explicitly. The animation-change effect already does
    // this when the name CHANGES, but replaying the SAME animation back-to-back
    // (e.g. the outro's double backstep) sets the signal to an unchanged value,
    // which doesn't fire that effect — without this the replay stays stuck on
    // the previous play's last (recovery) frame.
    this.currentFrameIndex.set(0);
    this._frameStartTick = this._loop.tick();
    const totalMs = opts.frames
      ? opts.frames.frames.reduce((sum, f) => sum + f.durationMs, 0)
      : opts.fallbackDurationMs;
    this._attackStartTick = this._loop.tick();
    this._attackDurationTicks = Math.round(totalMs / GameLoopService.TICK_MS);
    this.inAttack.set(true);
    // Optional per-animation forward travel for a NORMAL attack (e.g. a
    // lunging crouch kick). Sets up the same travel window the physics tick's
    // `_applySpecialTravel` consumes; specials use `_commitSpecialTravel`
    // instead and never carry travel on their AnimationData, so this only
    // fires for normals that opt in via `AnimationData.travelDistancePct`.
    const data = opts.frames;
    if (data?.travelDistancePct) {
      const startFrame = data.travelStartFrame ?? 0;
      const endFrame = data.travelEndFrame ?? data.frames.length;
      const windupTicks = this._windupTicks(data.frames, startFrame);
      const travelMs = data.frames
        .slice(startFrame, endFrame)
        .reduce((sum, f) => sum + f.durationMs, 0);
      const travelTicks = Math.max(1, Math.round(travelMs / GameLoopService.TICK_MS));
      this._specialXStep = (this.worldWidth() * data.travelDistancePct) / travelTicks;
      this._specialTravelStartTick = this._attackStartTick + windupTicks;
      this._specialTravelEndTick = this._specialTravelStartTick + travelTicks;
    }
  }

  /** Backstep — a quick backwards hop triggered by left→left. Reuses the
   * special-travel machinery (lock-in via `inAttack`, per-tick X update via
   * `_specialXStep`) but with no voice/whiff and a negative X step. Travel
   * spans the full animation. */
  private _startBackstep(): void {
    if (this.inJump() || this.inAttack() || this._specialFallingDescent) return;
    // No `blockedLeft` bail: the dash should still PLAY near/at the edge — the
    // physics tick clamps the leftward travel itself (it only moves while
    // `!blockedLeft()`), so Terry hops back as far as there's room and simply
    // stays put when flush against the wall, instead of the move being
    // swallowed entirely (which it was the moment he reached the left edge).
    const frames = this.animationFrames['backstep'];
    if (!frames) return;
    this._startAttack({
      animation: 'backstep',
      frames,
      fallbackDurationMs: 200,
    });
    if (this.inAttack() && this.animation() === 'backstep') {
      // Travel (X + Y arc) spans only the launch frame (0); the parabolic arc
      // returns Y to 0 at travel end, so later frames are grounded recovery.
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
        this._pendingVoiceCues.push({
          src: v.src,
          volume: this.backstepSfxVolume,
          category: 'sfx',
          tick: this._attackStartTick + this._windupTicks(frames.frames, v.frame ?? 0),
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
    this._activeJumpSfx = this._audio.playVoice(this.voices['jump'], this.jumpSfxVolume, 'sfx');
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
    const n = data.frames.length;
    if (data.bounce && n > 2) {
      // Reflect one step short of each end so end frames aren't repeated.
      let next = idx + this._frameDir;
      if (next >= n) { next = n - 2; this._frameDir = -1; }
      else if (next < 0) { next = 1; this._frameDir = 1; }
      this.currentFrameIndex.set(next);
      this._frameStartTick = this._loop.tick();
    } else if (idx + 1 < n) {
      this.currentFrameIndex.set(idx + 1);
      this._frameStartTick = this._loop.tick();
    } else if (data.loop) {
      this.currentFrameIndex.set(0);
      this._frameStartTick = this._loop.tick();
    }
  }

  /**
   * Per-tick physics dispatcher. Exactly one movement state is active at a
   * time, so this just routes to the matching phase handler — each owns its
   * own slice of the physics (descent / attack lock-in / jump arc / ground
   * walk). Order matters: the post-special descent is checked first so the
   * attack/jump branches can't interfere with it.
   */
  private _physicsTick(): void {
    if (this._specialFallingDescent) return this._tickSpecialFallingDescent();
    if (this.tickCustomAttack()) return;
    if (this.inAttack()) return this._tickAttack();
    if (this.inJump()) return this._tickJump();
    this._tickGroundMovement();
  }

  /** Post-special falling descent — pure Y descent at jump speed until ground
   * contact, then snap to the right input-based ground animation (same
   * handover the jump's landing branch does). */
  private _tickSpecialFallingDescent(): void {
    this.accumulatedY.update((y) => y + this.specialFallVerticalStep);
    if (this.accumulatedY() >= 0) {
      this.accumulatedY.set(0);
      this._specialFallingDescent = false;
      this._snapToGroundAnimation();
    }
  }

  /** Attack / special lock-in. Fires scheduled cues, applies any special
   * travel, and ends the lock-in once its duration elapses. */
  private _tickAttack(): void {
    const tick = this._loop.tick();
    const travelElapsed = tick - this._specialTravelStartTick;
    const travelTicks = this._specialTravelEndTick - this._specialTravelStartTick;
    // Play the deferred travel whiff on the FIRST tick of the travel window
    // (when travelElapsed crosses 0) so the whoosh lands with the forward
    // motion, not during the windup.
    if (travelElapsed >= 0 && this._pendingWhiffSrc) {
      this._audio.playVoice(this._pendingWhiffSrc, this._pendingWhiffVolume, 'sfx');
      this._pendingWhiffSrc = undefined;
    }
    this._drainVoiceCues(tick);
    this._drainProjectileSpawns(tick);
    this._applySpecialTravel(tick, travelElapsed, travelTicks);
    if (tick - this._attackStartTick >= this._attackDurationTicks) this._endAttack();
  }

  /** Drain voice cues whose target tick has been reached. Independent of the
   * travel window — each cue is anchored to its own frame so stationary
   * specials (no travel) get the same scheduling treatment. */
  private _drainVoiceCues(tick: number): void {
    if (this._pendingVoiceCues.length === 0) return;
    this._pendingVoiceCues = this._pendingVoiceCues.filter((cue) => {
      if (tick >= cue.tick) {
        this._audio.playVoice(cue.src, cue.volume, cue.category);
        return false;
      }
      return true;
    });
  }

  /** Drain projectile spawns whose target tick has been reached. World-X is
   * computed at emit time (not queue time) so the projectile anchors to the
   * character's CURRENT position; sprite-pixel offsets are scaled by the
   * rendered height vs `spriteBaseHeight`, same as the per-frame anchor math. */
  private _drainProjectileSpawns(tick: number): void {
    if (this._pendingProjectileSpawns.length === 0) return;
    this._pendingProjectileSpawns = this._pendingProjectileSpawns.filter((evt) => {
      if (tick < evt.tick) return true;
      const scale = this.el().nativeElement.clientHeight / this.spriteBaseHeight;
      const offX = (evt.config.spawnOffsetX ?? 0) * scale;
      const offY = (evt.config.spawnOffsetY ?? 0) * scale;
      this.projectileSpawnRequested.emit({
        config: evt.config,
        worldX: this.worldX() + offX,
        worldY: offY,
        direction: 'right',
      });
      return false;
    });
  }

  /** Apply a traveling special's per-tick X step + parabolic Y arc, pinned at
   * the relevant stage edge. Regular attacks no-op here (`_specialXStep` and
   * arc both 0). Past the travel window the Y is pinned back to ground so
   * grounded recovery frames don't render mid-air. */
  private _applySpecialTravel(tick: number, travelElapsed: number, travelTicks: number): void {
    if (travelElapsed >= 0 && tick < this._specialTravelEndTick) {
      if (this._specialXStep > 0 && !this.blockedRight()) {
        this.accumulated.update((x) => x + this._specialXStep);
      } else if (this._specialXStep < 0 && !this.blockedLeft()) {
        this.accumulated.update((x) => x + this._specialXStep);
      }
      if (this._specialArcHeight !== 0 && travelTicks > 0) {
        // Two Y curves:
        //   parabolic (default): y(t) = -arcHeight × 4t(1-t) — rise+fall
        //     within the travel window, Y returns to 0 at t=1.
        //   half-sine (fallAfterArc): y(t) = -arcHeight × sin(t × π/2)
        //     — rise only, peaking at t=1. The fall happens after the
        //     animation, via the jump-physics hand-off in `_endAttack`.
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
      // Past the travel window — pin to ground so grounded recovery frames
      // (declared via `travelEndFrame`) don't render mid-air on the parabola's
      // last sample. Skipped for `fallAfterArc` specials, which WANT Y to stay
      // at peak between travel-end and the hand-off to jump-fall physics.
      this.accumulatedY.set(0);
    }
  }

  /** End an attack lock-in. A `fallAfterArc` special still above ground hands
   * off to the post-special descent (keeps Y, flips to `jumpFall`); every
   * other attack just clears its state and pins Y to ground. */
  private _endAttack(): void {
    if (this._specialFallAfterArc && this.accumulatedY() < 0) {
      this.inAttack.set(false);
      this._clearSpecialState();
      // Custom descent (not the jump physics) — the jump's ascending phase
      // would otherwise push Y further up for the first `apexTicks` ticks
      // before descent kicks in. Picked up by `_tickSpecialFallingDescent`.
      this._specialFallingDescent = true;
      this.animation.set('jumpFall');
      return;
    }
    this.inAttack.set(false);
    this._clearSpecialState();
    this.accumulatedY.set(0);
  }

  /** Reset all transient special-move physics + scheduled cues. Shared by the
   * normal attack-end path and the `fallAfterArc` hand-off. Does NOT touch
   * `accumulatedY` — callers decide whether to keep or zero it. */
  private _clearSpecialState(): void {
    this._specialXStep = 0;
    this._specialArcHeight = 0;
    this._specialFallAfterArc = false;
    this._pendingWhiffSrc = undefined;
    this._pendingVoiceCues = [];
    this._pendingProjectileSpawns = [];
  }

  /** Jump arc: lands once the duration elapses, otherwise rises to apex then
   * falls (handing the sprite to the `Fall` variants / aerial recovery), with
   * horizontal travel for forward/back jumps. */
  private _tickJump(): void {
    const elapsed = this._loop.tick() - this._jumpStartTick;
    const apexTicks = Math.round(this.jumpApexMs / GameLoopService.TICK_MS);
    const landTicks = Math.round(this.jumpDurationMs / GameLoopService.TICK_MS);

    if (elapsed >= landTicks) return this._landJump();

    if (elapsed < apexTicks) this.accumulatedY.update((y) => y - this.jumpVerticalStep);
    else this._tickJumpDescent();

    if (this._forwardJump && !this.blockedRight()) {
      this.accumulated.update((x) => x + this._jumpXStep);
    }
    if (this._backwardJump && !this.blockedLeft()) {
      this.accumulated.update((x) => x - this._jumpXStep);
    }
  }

  /** Land from a jump — reset Y/flags and snap straight to the right ground
   * animation (no input change for the state-machine effect to react to). */
  private _landJump(): void {
    this._forwardJump = false;
    this._backwardJump = false;
    this.accumulatedY.set(0);
    this.inJump.set(false);
    this._airHeavyAttackEndTick = 0;
    this._airAttackUsed = false;
    this._snapToGroundAnimation();
  }

  /** Past-apex descent: transition each jump direction to its `Fall` variant
   * (held on the last frame via `loop: false`), fire heavy-aerial recovery
   * once the kick animation has finished, and accelerate Y downward. */
  private _tickJumpDescent(): void {
    const anim = this.animation();
    if (anim === 'jumpUp') this.animation.set('jumpFall');
    else if (anim === 'jumpForward') this.animation.set('jumpForwardFall');
    else if (anim === 'jumpBackward') this.animation.set('jumpBackwardFall');
    // Heavy aerial recovery fires here, but only once the kick animation has
    // finished — so a kick pressed close to apex plays through instead of
    // being cut off mid-swing.
    if (this._airHeavyAttackEndTick > 0 && this._loop.tick() >= this._airHeavyAttackEndTick) {
      this.animation.set('airHeavyRecover');
      this._airHeavyAttackEndTick = 0;
    }
    this.accumulatedY.update((y) => y + this.jumpDescentVerticalStep);
  }

  /** Grounded walk / crouch-walk movement from the currently-held input. */
  private _tickGroundMovement(): void {
    const down = this._input.downKey();
    const dir = this._input.lastDir();
    if (down) {
      if (dir === 'right' && !this.blockedRight()) {
        this.accumulated.update((x) => x + this._scaledRate(this.crouchSpeed));
      }
      return;
    }
    if (dir === 'right' && !this.blockedRight()) {
      this.accumulated.update((x) => x + this._scaledRate(this.walkSpeed));
    } else if (dir === 'left' && !this.blockedLeft()) {
      this.accumulated.update((x) => x - this._scaledRate(this.walkSpeed));
    }
  }

  /** Scale a reference-width px/tick rate to the current viewport, so movement
   * covers the same fraction of the stage on any screen size. */
  private _scaledRate(rate: number): number {
    return (rate * this.worldWidth()) / this.referenceWidth;
  }

  /** Pick the right grounded animation from the currently-held input. Used on
   * landing (from a jump or a post-special descent) where there's no input
   * *change* for the state-machine effect to react to. */
  protected _snapToGroundAnimation(): void {
    const dir = this._input.lastDir();
    const down = this._input.downKey();
    if (down) this.animation.set(dir === 'right' ? 'crouchForward' : 'crouch');
    else this.animation.set(dir === 'right' ? 'forward' : dir === 'left' ? 'backwards' : 'idle');
  }
}
