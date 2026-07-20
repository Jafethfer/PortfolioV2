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
import { AudioService, SfxHandle, SoundCategory } from '../../services/audio.service';
import { MashFlurry, MashFlurryConfig } from '../../helpers/mash-flurry';
import { REFERENCE_WIDTH } from '../../constants/viewport';

/**
 * Abstract character base. Owns the physics, input wiring, and animation
 * state machine. Concrete @Component subclasses supply their own
 * `animationFrames` map and sprite stylesheet, and override tuning fields
 * (`protected override`) to retune walk speed, jump distance, etc. The Stage
 * instantiates the chosen subclass imperatively and forwards its geometry via
 * `ComponentRef.setInput`.
 */
@Directive()
export abstract class Character {
  protected readonly voices: CharacterVoices = {};
  /** Per-frame animation data, one entry per `AnimationName` used. Each frame
   * carries its own image and `anchorX/Y` (sprite-pixel coords) so the runtime
   * lands every frame's anchor at the same world coordinate. `idle` is always
   * required — it's the initial state. */
  protected readonly animationFrames: Partial<Record<AnimationName, AnimationData>> = {};
  /** Character-specific special moves. On each attack-button press the base
   * scans this array (longest motion first) and fires the first whose
   * `matchMotion` matches, playing its frames + audio instead of the normal
   * attack. Default `[]` for characters without specials. */
  protected readonly specials: readonly SpecialMove[] = [];
  /** Body anchor X (source pixels) for strip-rendered animations like
   * idle/walk. Aligns per-frame animations with strip ones at transition time
   * so the sprite doesn't jump left/right. Subclasses override. */
  protected readonly bodyAnchorX: number = 35;
  /** Source-pixel height of the idle/standing sprite — the baseline every
   * per-frame sprite is scaled against (`frame.h × renderedHeight /
   * spriteBaseHeight`). Pairs with the `--character-height` CSS var. */
  protected readonly spriteBaseHeight: number = 107;

  protected readonly walkSpeed: number = 10;
  protected readonly crouchSpeed: number = 5;
  /** Reference stage width the per-tick pixel rates are calibrated against; the
   * effective rate scales by `worldWidth / referenceWidth` so the character
   * covers the same fraction of the stage per tick on any viewport. */
  protected readonly referenceWidth: number = REFERENCE_WIDTH;
  /** Fraction of the surrounding world width covered in a forward/back jump. */
  protected readonly jumpDistancePct: number = 0.4;
  protected readonly jumpTicks: number = 29;
  protected readonly jumpDurationMs: number = 870;
  protected readonly jumpApexMs: number = 500;
  protected readonly jumpVerticalStep: number = 5;
  /** Per-tick Y descent during a jump's fall phase. Higher than
   * `jumpVerticalStep` so the character rises slowly but falls faster, giving a
   * weighted arc instead of a floaty symmetric one. */
  protected readonly jumpDescentVerticalStep: number = 7;
  protected readonly jumpYScale: number = 0.4;
  /** Fraction of the world width covered by a single backstep (left→left
   * double-tap). Always backwards-relative-to-facing. */
  protected readonly backstepDistancePct: number = 0.4;
  /** Peak vertical arc of a backstep (accumulated-Y units, rendered as
   * `y × jumpYScale` cqw). Parabolic rise+fall over the animation. */
  protected readonly backstepArcHeight: number = 30;
  /** Backstep sound cues, each pinned to a frame index. Default is a single
   * landing-thud on the recovery frame; the push-off is silent. */
  protected readonly backstepVoices: readonly { readonly src: string; readonly frame?: number }[] =
    [{ src: 'assets/sfx/misc/backstep-1.mp3', frame: 1 }];
  /** Volume for backstep SFX. Lower than `sfxVolume` — short, sharp foot SFX. */
  protected readonly backstepSfxVolume: number = 0.25;
  /** Lock-in duration for the lightPunch animation. Must match the CSS
   * `animation:` duration on the sprite class. */
  protected readonly lightPunchDurationMs: number = 200;
  /** Fallback heavy-punch lock-in, used only when no per-frame `heavyPunch`
   * data exists (otherwise duration is the sum of frame durations). */
  protected readonly heavyPunchDurationMs: number = 500;
  /** Fallback kick lock-in durations — used only when no per-frame data is
   * supplied. */
  protected readonly lightKickDurationMs: number = 300;
  protected readonly heavyKickDurationMs: number = 500;
  protected readonly voiceVolume: number = 0.3;
  /** Volume for non-voice combat SFX (whiffs, hit confirms, jump). Set high
   * because the source files have low natural gain. */
  protected readonly sfxVolume: number = 0.7;
  /** Volume for a SPECIAL move's whiff/whoosh. Lower than `sfxVolume` so the
   * sustained whoosh doesn't clip the vocal shout. */
  protected readonly specialWhiffVolume: number = 0.35;
  /** Volume for the jump-takeoff whoosh. Lower than `sfxVolume` — sharp
   * transient reads as too loud otherwise. */
  protected readonly jumpSfxVolume: number = 0.25;

  readonly blockedRight = input(false);
  readonly blockedLeft = input(false);
  /** Pixel width of the surrounding world, forwarded by the Stage. The
   * character never reaches into the DOM for stage geometry. */
  readonly worldWidth = input(0);
  /** True when the stage has at least one projectile alive. Projectile-spawning
   * specials are gated on this so their cast doesn't play while the spawn would
   * be dropped by the stage's concurrency cap. */
  readonly projectileActive = input(false);

  readonly el = viewChild.required<ElementRef<HTMLElement>>('el');

  // Injected engine services. `protected` so character-specific moves (wired
  // via the `interceptAttack` / `tickCustomAttack` hooks) can read input,
  // schedule off the loop tick, and play audio the same way the base does.
  protected readonly _input = inject(InputService);
  protected readonly _loop = inject(GameLoopService);
  protected readonly _audio = inject(AudioService);

  // Public reactive state. `animation` is typed `string` (not `AnimationName`)
  // so specials — whose names live outside the built-in union — assign without
  // a cast; `currentAnimData` resolves the name against built-ins then specials.
  readonly animation = signal<string>('idle');
  readonly accumulated = signal(4);
  readonly accumulatedY = signal(0);
  readonly inJump = signal(false);
  readonly inAttack = signal(false);
  readonly width = signal(0);
  /** True while a scripted, input-independent sequence plays (the stage-exit
   * outro — see `playOutro`). Suppresses the animation state machine and player
   * input so the choreography can't be overridden. Never cleared once engaged —
   * the character holds its final pose and is destroyed on navigation. */
  readonly scripted = signal(false);
  /** Frame index within the current per-frame animation. Reset when a new
   * per-frame animation starts. */
  readonly currentFrameIndex = signal(0);
  /** Flips true once `_initialX` and `width` are measured. Stage gates edge
   * checks on this so the pre-measure window (with `_initialX === 0`) doesn't
   * falsely trip `blockedLeft`. */
  readonly ready = signal(false);

  /** Fires once per projectile-spawning special when the spawn frame is
   * reached. Stage subscribes and instantiates the projectile, keeping the
   * "character knows nothing about the stage" rule intact — the character just
   * declares it needs a spawn at a coordinate. */
  readonly projectileSpawnRequested = output<ProjectileSpawnRequest>();

  /** Direction the character is trying to move, driving the stage's edge-scroll
   * logic. Precedence: active special's travel direction → directional jump →
   * user input. Committed specials and jumps win over input so a move that
   * drives into the edge still tells the stage to scroll. `null` for vertical
   * jumps with no input and stationary specials. */
  get motionIntent(): Direction {
    // Only report a special-driven intent inside its actual travel window,
    // not during windup/recovery when the character isn't moving.
    const sv = this.specialXVelocity;
    if (sv > 0) return 'right';
    if (sv < 0) return 'left';
    if (this._forwardJump) return 'right';
    if (this._backwardJump) return 'left';
    // Raw input only counts when free to walk — during a neutral jump or attack
    // the character is pinned, so a held direction must not scroll the world.
    if (this.inJump() || this.inAttack()) return null;
    return this._input.lastDir();
  }

  /** Per-tick X step the active special applies this tick, in px (positive =
   * right). Zero outside the special's travel window. Stage reads this as the
   * scroll rate so a traveling special pushing into the edge scrolls the world
   * at its own pace, not the slower `walkScrollRate`. */
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
  /** Per-tick X step applied during a traveling special (sign = direction).
   * Zero for normal attacks and stationary specials. Computed at launch from
   * `travelDistancePct` × stage width ÷ travel ticks. */
  private _specialXStep = 0;
  /** Absolute tick at which `_specialXStep` starts applying, so a special with
   * `travelStartFrame > 0` holds in place during windup. */
  private _specialTravelStartTick = 0;
  /** Absolute tick at which travel ends. Frames past this render grounded (Y
   * pinned to 0), letting a special declare a grounded recovery pose. */
  private _specialTravelEndTick = 0;
  /** Peak `accumulatedY` during the travel window (parabolic, apex at
   * midpoint). Zero for non-arcing specials. */
  private _specialArcHeight = 0;
  /** Absolute tick at which the active heavy aerial's animation finishes. The
   * past-apex branch swaps to `airHeavyRecover` once BOTH tick ≥ this AND past
   * apex ("recover at MAX(animation end, descent start)") so a kick pressed
   * near apex plays through instead of cutting off. 0 = no recovery scheduled. */
  private _airHeavyAttackEndTick = 0;
  /** True between a jump's first air-attack and landing — one air normal per
   * jump. Outlives the active animation because the heavy variant transitions
   * through `airHeavyRecover`, so an animation-name check would leak a second
   * press. Cleared on land. */
  private _airAttackUsed = false;
  /** Queue of the active special's voice cues, each tagged with its fire tick
   * (from `SpecialMove.voices` frame indices). Drained per-tick; cleared on
   * attack end. */
  private _pendingVoiceCues: {
    src: string;
    volume: number;
    tick: number;
    category: SoundCategory;
  }[] = [];
  private _pendingWhiffSrc: string | undefined = undefined;
  /** Queue of the active special's projectile-spawn events, each tagged with
   * its fire tick. Drained per-tick; same shape as the voice-cue queue. */
  private _pendingProjectileSpawns: { config: ProjectileSpawn; tick: number }[] = [];
  private _pendingWhiffVolume = 0;
  /** Audio handle for the current jump SFX, so a special that cancels the jump
   * (a `down→up+P` anti-air) can stop the whoosh before it bleeds into the
   * special. */
  private _activeJumpSfx: SfxHandle | null = null;
  private _frameStartTick = 0;
  /** Step direction (+1 forward / -1 reverse) for `bounce` (ping-pong)
   * animations. Reset to +1 whenever the animation changes. */
  private _frameDir = 1;
  /** Retains preloaded Image objects for the character's lifetime so the
   * memory cache can't evict them — dev's no-store cache-control would
   * otherwise re-fetch on every `[src]` change. */
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

  /** Transform for a per-frame `<img>`. Anchors `frame.anchorX` to the same
   * world X as a strip animation's body centre (`bodyAnchorX`) so idle ↔
   * per-frame transitions don't jump. The offset is in `cqw` so it scales with
   * the sprite on resize. */
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
   * survives stage navigation, so we baseline it at spawn and only run
   * `handler` on increments past that baseline — a freshly-spawned character
   * doesn't replay presses from a previous stage.
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

  /** Re-read the layout origin + sprite width and rescale `accumulated` (the px
   * walk offset) by `widthRatio` so the character's stage-relative position
   * survives a viewport resize. The element is `cqw`-sized so its origin
   * already rescales; `accumulated` is plain px and needs the explicit scale. */
  remeasure(widthRatio: number): void {
    // Measure the origin from the pre-scale accumulated, then rescale, so
    // `worldX` (`_initialX + accumulated`) stays consistent.
    this._measureLayout();
    if (widthRatio > 0 && widthRatio !== 1) {
      this.accumulated.update((x) => x * widthRatio);
    }
  }

  private _measureLayout(): void {
    const node = this.el().nativeElement;
    // `rect.x` is post-transform; subtract the applied `accumulated` translation
    // so the baseline is the layout origin, not wherever the character sits now.
    this._initialX = node.getBoundingClientRect().x - this.accumulated();
    this.width.set(node.clientWidth);
  }

  /** Warm the browser cache for every per-frame sprite so frame-to-frame src
   * changes don't flash. Reads `animationFrames` / `specials` here (not the
   * constructor) so subclass field overrides are already applied. */
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
      // selection override the choreographed outro (back-dash / victory pose).
      if (this.scripted()) return;
      if (untracked(() => this.inJump())) return;
      if (inAttack) return;
      untracked(() => this._selectGroundAnimation(lastDir, down));
    });
  }

  /** Choose the standing / walking / crouching animation for the current input.
   * When already crouched (incl. crouching attacks), holds the deep-crouch
   * still pose rather than replaying the crouch entry. */
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

  /** One-shot input triggers. Each `*Pressed` signal is a global press counter
   * that persists across navigation; `_onPress` baselines it at spawn. */
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
   * transition. Default: nothing. Override to choreograph a send-off by
   * composing the `backDash` / `playScriptedClip` primitives, engaging
   * `scripted` for the duration so input and the state machine don't interfere. */
  async playOutro(): Promise<void> {}

  /** Perform one scripted back-dash and await its full duration, plus a 2-tick
   * buffer so its `inAttack` lock-in clears before the next scripted clip
   * starts. No-op if the character has no `backstep` frames. Requires
   * `scripted` to be engaged by the caller (so the held pose isn't overridden
   * between clips). */
  protected async backDash(): Promise<void> {
    // Only hop back when there's a full dash of ground behind us — near the
    // left edge `accumulated` is ~0 and the dash would clamp into a stutter.
    if (this.accumulated() < this.worldWidth() * this.backstepDistancePct) return;
    this._startBackstep();
    await this._wait(this._animDurationMs('backstep') + GameLoopService.TICK_MS * 2);
  }

  /**
   * Play a single scripted animation clip — the unit a `playOutro` override
   * composes. Optionally fires a frame-anchored voice cue and/or spawns a
   * projectile (same scheduling specials use), then awaits until the clip (plus
   * any projectile flight + rest beat) completes, leaving the character frozen
   * on the last frame. Requires `scripted` engaged; no-op if no frames.
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
  /** Crouching light punch — lightPunch pressed while Down is held. Reuses the
   * standing punch's voice + whiff; only the animation differs. */
  crouchLightPunch(): void {
    this._startAttack({
      animation: 'crouchLightPunch',
      voiceSrc: this.voices.lightPunch,
      whiffSrc: this.voices['lightPunchWhiff'],
      frames: this.animationFrames['crouchLightPunch'],
      fallbackDurationMs: this.lightPunchDurationMs,
    });
  }
  /** Crouching heavy punch — heavyPunch pressed while Down is held. Mirrors
   * `crouchLightPunch`. */
  crouchHeavyPunch(): void {
    this._startAttack({
      animation: 'crouchHeavyPunch',
      voiceSrc: this.voices.heavyPunch,
      whiffSrc: this.voices['heavyPunchWhiff'],
      frames: this.animationFrames['crouchHeavyPunch'],
      fallbackDurationMs: this.heavyPunchDurationMs,
    });
  }
  /** Crouching light kick — lightKick pressed while Down is held. Same shape as
   * the other crouching attacks. */
  crouchLightKick(): void {
    this._startAttack({
      animation: 'crouchLightKick',
      voiceSrc: this.voices.lightKick,
      whiffSrc: this.voices['lightKickWhiff'],
      frames: this.animationFrames['crouchLightKick'],
      fallbackDurationMs: this.lightKickDurationMs,
    });
  }
  /** Crouching heavy kick — heavyKick pressed while Down is held. */
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
  /** Air heavy punch — fires only mid-jump. Unlike the light variant, schedules
   * a recovery: after the punch frames the sprite swaps to `airHeavyRecover` so
   * the character visibly resets its stance mid-air. */
  airHeavyPunch(): void {
    this._startAirAttack({
      animation: 'airHeavyPunch',
      voiceSrc: this.voices.heavyPunch,
      whiffSrc: this.voices['heavyPunchWhiff'],
      recover: true,
    });
  }
  /** Air light kick — direction-aware sprite: forward/backward jumps use
   * `airLightKick`, vertical jumps use `airLightKickUp`. Both hold the extended
   * pose until landing. */
  airLightKick(): void {
    const animation = this._forwardJump || this._backwardJump ? 'airLightKick' : 'airLightKickUp';
    this._startAirAttack({
      animation,
      voiceSrc: this.voices.lightKick,
      whiffSrc: this.voices['lightKickWhiff'],
    });
  }
  /** Air heavy kick — direction-aware sprite: forward/backward jumps use
   * `airHeavyKick`, vertical jumps use `airHeavyKickUp`. Both schedule
   * `airHeavyRecover` after the kick frames so the stance resets mid-air. */
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
   * character-specific move like a mash flurry), then tries a motion-matched
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

  /** Build a {@link MashFlurry} bound to this character's engine internals
   * (tick clock, grounded/standing gate, animation lock, audio). A subclass
   * wires the returned controller into the two hooks above — `interceptAttack`
   * → `press`, `tickCustomAttack` → `tick` — and supplies only the config
   * (buttons, clips, finisher, SFX). Shared by every mash-flurry character. */
  protected _createMashFlurry(config: MashFlurryConfig): MashFlurry {
    return new MashFlurry(
      {
        currentTick: () => this._loop.tick(),
        canStart: () => !this.inJump() && !this._input.downKey(),
        showAnimation: (animation) => {
          this.inAttack.set(true);
          this.animation.set(animation);
        },
        playVoice: (src) => this._audio.playVoice(src, this.voiceVolume),
        playLoopingWhoosh: (src) => this._audio.playVoice(src, this.sfxVolume, 'sfx'),
        end: () => {
          this.inAttack.set(false);
          this._snapToGroundAnimation();
        },
      },
      config,
    );
  }

  /** Scan specials bound to `button` (longest motion first, so a 4-input motion
   * isn't short-circuited by a 2-input subset) and fire the first whose motion
   * matches. Returns true iff one actually launched; otherwise the press falls
   * through to the normal attack. Tried even mid-jump so an anti-air motion can
   * cancel a just-started jump. */
  private _tryRunSpecial(button: AttackButton): boolean {
    const candidates = this.specials
      .filter((s) => s.button === button)
      // Suppress projectile-spawning specials when one is already on screen, so
      // the cast doesn't play while the Stage's concurrency cap drops the spawn.
      // Filtering before the loop preserves the motion for a non-projectile
      // fallback on the same button.
      .filter((s) => !(s.projectile && this.projectileActive()))
      .slice()
      .sort((a, b) => b.motion.length - a.motion.length);
    for (const s of candidates) {
      if (this._input.matchMotion(s.motion)) {
        this._runSpecial(s);
        // Matched motion consumed its events — no other special can match.
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
    // Bail if an attack is still locked in, else the scheduling below stacks
    // onto it. The `inJump` check is omitted so we can cancel a just-started
    // jump; `_startAttack` enforces the jump gate itself.
    if (this.inAttack()) return;
    this._cancelJustStartedJump();

    // Traveling specials defer the whoosh to travel start. Voices use the
    // frame-indexed cues array, so `_startAttack` gets no `voiceSrc`.
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
    // `_startAttack` no-ops when jump/attack-locked; only commit the rest once
    // the special launched (the set animation name is the tell).
    if (!(this.inAttack() && this.animation() === s.name)) return;
    this._scheduleSpecialCues(s, defer);
    this._commitSpecialTravel(s);
  }

  /** Cancel an in-progress jump iff it JUST started — i.e. the Up press is part
   * of the special's motion (a `down→up+P` anti-air). A longer-running jump was
   * a committed leap and a stale buffered motion shouldn't hijack it. */
  private _cancelJustStartedJump(): void {
    const jumpJustStartedTicks = 4; // ~120ms — about one human input gap
    if (!(this.inJump() && this._loop.tick() - this._jumpStartTick <= jumpJustStartedTicks)) {
      return;
    }
    this.inJump.set(false);
    this.accumulatedY.set(0);
    this._forwardJump = false;
    this._backwardJump = false;
    // Stop the jump whoosh so it doesn't bleed into the special's voice/whiff.
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

  /** Shared kickoff for air normals. Distinct from `_startAttack` because air
   * attacks do NOT enter the `inAttack` lock-in (that would freeze jump
   * physics) — the sprite swaps to the air animation while jump physics keep
   * advancing underneath. `recover: true` schedules an auto-transition to a
   * jump-fall sprite after the frames elapse. One air normal per jump. */
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
    // Heavy aerials schedule a recovery: the past-apex branch swaps to
    // `airHeavyRecover` once both the frames have played AND apex is crossed
    // ("MAX(animation end, descent start)"), so a kick near apex plays through.
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
    /** Per-call whiff volume — specials pass `specialWhiffVolume`; built-in
     * attacks omit this and get `sfxVolume`. */
    readonly whiffVolume?: number;
    /** When true, suppress immediate whiff playback — the caller queues it for
     * `_specialTravelStartTick` so the whoosh syncs with movement. */
    readonly deferWhiff?: boolean;
    readonly frames?: AnimationData;
    readonly fallbackDurationMs: number;
  }): void {
    if (this.inJump() || this.inAttack()) return;
    this._audio.playVoice(opts.voiceSrc, this.voiceVolume);
    // Whiff plays immediately for normal attacks. Travel-aware specials
    // (which sync the whoosh with forward motion) defer via `deferWhiff`
    // and let the physics tick play it at travel-start.
    if (!opts.deferWhiff) {
      this._audio.playVoice(opts.whiffSrc, opts.whiffVolume ?? this.sfxVolume, 'sfx');
    }
    this.animation.set(opts.animation);
    // Reset frame state explicitly: replaying the SAME animation back-to-back
    // sets the signal to an unchanged value, which doesn't fire the
    // animation-change effect, so the replay would stick on the last frame.
    this.currentFrameIndex.set(0);
    this._frameStartTick = this._loop.tick();
    const totalMs = opts.frames
      ? opts.frames.frames.reduce((sum, f) => sum + f.durationMs, 0)
      : opts.fallbackDurationMs;
    this._attackStartTick = this._loop.tick();
    this._attackDurationTicks = Math.round(totalMs / GameLoopService.TICK_MS);
    this.inAttack.set(true);
    // Optional per-animation forward travel for a NORMAL attack (a lunging
    // crouch kick) that opts in via `AnimationData.travelDistancePct`. Sets up
    // the same travel window `_applySpecialTravel` consumes.
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
    if (this.inJump() || this.inAttack()) return;
    // No `blockedLeft` bail: the dash still plays at the edge, and the physics
    // tick clamps the leftward travel itself so the character hops as far as
    // there's room instead of the move being swallowed at the wall.
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
      // Queue the backstep SFX cues with the same per-frame scheduling as
      // `SpecialMove.voices`.
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
    // Block jumps during an active attack so the jump sprite change doesn't
    // interrupt the attack's animation/lock-in mid-move.
    if (this.inJump() || this.inAttack()) return;
    const dir = this._input.lastDir();
    this._jumpXStep = (this.worldWidth() * this.jumpDistancePct) / this.jumpTicks;
    this._jumpStartTick = this._loop.tick();
    this._forwardJump = dir === 'right';
    this._backwardJump = dir === 'left';
    this.inJump.set(true);
    if (dir === 'right') this.animation.set('jumpForward');
    else if (dir === 'left') this.animation.set('jumpBackward');
    else this.animation.set('jumpUp');
    // Same whoosh regardless of direction. Stash the handle so `_runSpecial`
    // can stop it when a follow-up motion converts the jump into a special.
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
   * own slice of the physics (attack lock-in / jump arc / ground walk).
   */
  private _physicsTick(): void {
    if (this.tickCustomAttack()) return;
    if (this.inAttack()) return this._tickAttack();
    if (this.inJump()) return this._tickJump();
    this._tickGroundMovement();
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
        // Parabolic arc: y(t) = -arcHeight × 4t(1-t) — rises then returns to 0
        // at t=1, so a rising special carries its own descent inside its frames.
        // Set absolutely (not accumulated) to avoid per-tick rounding drift;
        // normalize against `travelTicks - 1` so the last tick lands at t=1.
        const denom = Math.max(1, travelTicks - 1);
        const t = Math.min(1, travelElapsed / denom);
        this.accumulatedY.set(-this._specialArcHeight * 4 * t * (1 - t));
      }
    } else if (
      this._specialArcHeight !== 0 &&
      tick >= this._specialTravelEndTick &&
      this.accumulatedY() !== 0
    ) {
      // Past the travel window — pin to ground so grounded recovery frames
      // (declared via `travelEndFrame`) don't render mid-air on the parabola's
      // last sample.
      this.accumulatedY.set(0);
    }
  }

  /** End an attack lock-in — clear transient special state and pin Y to
   * ground. A rising special has already returned to Y≈0 via its parabolic
   * arc by the time its animation ends, so there's nothing to hand off. */
  private _endAttack(): void {
    this.inAttack.set(false);
    this._clearSpecialState();
    this.accumulatedY.set(0);
  }

  /** Reset all transient special-move physics + scheduled cues. Does NOT touch
   * `accumulatedY` — callers decide whether to keep or zero it. */
  private _clearSpecialState(): void {
    this._specialXStep = 0;
    this._specialArcHeight = 0;
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
    // Hold-to-hop: if the jump direction is still held, leap again instead of
    // settling. Only touch-stick sets `jumpHeld`; keyboard jump never does.
    if (this._input.jumpHeld() && !this.inAttack()) {
      this._startJump();
      return;
    }
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
