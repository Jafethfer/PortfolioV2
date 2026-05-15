import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AnimationName, CharacterConfig, DEFAULT_CONFIG } from '../../models/character';
import { InputService } from '../../services/input.service';
import { GameLoopService } from '../../services/game-loop.service';
import { AudioService } from '../../services/audio.service';

/**
 * Generic character. Takes a CharacterConfig (animations + voices + tuning)
 * and renders the right sprite, driven by InputService keyboard signals and
 * GameLoopService ticks. The component knows nothing about which stage it's
 * on — it consumes `blockedRight`/`blockedLeft` inputs from its parent for
 * world-imposed constraints, and exposes `worldX` / `width` for the parent
 * to read back.
 *
 * Polymorphism: subclass by composition. Pass a different `config` and the
 * same component does a different character. For per-character behavior
 * overrides (e.g. unique jab), provide a Directive that injects this
 * component and adjusts state — no inheritance needed.
 */
@Component({
  selector: 'app-character',
  templateUrl: './character.html',
  styleUrl: './character.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Character {
  readonly config = input.required<CharacterConfig>();
  readonly blockedRight = input(false);
  readonly blockedLeft = input(false);
  /** Pixel width of the surrounding world. Used to convert `jumpDistancePct`
   * into a per-tick px step at takeoff. The character has no other way of
   * knowing — it doesn't reach into the DOM for stage geometry. */
  readonly worldWidth = input(0);

  readonly el = viewChild.required<ElementRef<HTMLDivElement>>('el');

  private readonly _input = inject(InputService);
  private readonly _loop = inject(GameLoopService);
  private readonly _audio = inject(AudioService);

  // Public reactive state — Stage reads worldX() to drive train scrolling.
  readonly animation = signal<AnimationName>('idle');
  readonly accumulated = signal(4);
  readonly accumulatedY = signal(0);
  readonly inJump = signal(false);
  readonly width = signal(0);

  // Internal physics state — not signal, no rendering depends on it.
  private _initialX = 0;
  private _jumpStartTick = 0;
  private _jumpXStep = 0;
  private _forwardJump = false;
  private _backwardJump = false;

  // Resolved config with defaults applied.
  private readonly _cfg = computed(() => ({ ...DEFAULT_CONFIG, ...this.config() }));

  readonly worldX = computed(() => this._initialX + this.accumulated());

  readonly animClass = computed(() => this.config().animations[this.animation()]);

  readonly transform = computed(() => {
    if (this.inJump()) {
      const y = this.accumulatedY() * this._cfg().jumpYScale;
      return `translate(${this.accumulated()}px, ${y}cqw)`;
    }
    return `translateX(${this.accumulated()}px)`;
  });

  constructor() {
    afterNextRender(() => {
      const node = this.el().nativeElement;
      this._initialX = node.getBoundingClientRect().x;
      this.width.set(node.clientWidth);
    });

    // Animation state machine — reacts to direction / crouch changes when
    // not in a jump. Mid-jump landing is handled by the physics tick.
    effect(() => {
      const lastDir = this._input.lastDir();
      const down = this._input.downKey();
      if (untracked(() => this.inJump())) return;

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

    // Physics tick — single dependency on the loop signal; everything else
    // is read untracked so we don't feedback-loop.
    effect(() => {
      this._loop.tick();
      untracked(() => this._physicsTick());
    });
  }

  /** Combat / character actions — call from custom keybinds or a Directive. */
  jab():   void { this._audio.playVoice(this.config().voices?.jab,   this._cfg().voiceVolume); }
  punch(): void { this._audio.playVoice(this.config().voices?.punch, this._cfg().voiceVolume); }
  kick():  void { this._audio.playVoice(this.config().voices?.kick,  this._cfg().voiceVolume); }
  taunt(): void { this._audio.playVoice(this.config().voices?.taunt, this._cfg().voiceVolume); }

  private _startJump(): void {
    if (this.inJump()) return;
    const dir = this._input.lastDir();
    const cfg = this._cfg();
    this._jumpXStep = (this.worldWidth() * cfg.jumpDistancePct) / cfg.jumpTicks;
    this._jumpStartTick = this._loop.tick();
    this._forwardJump = dir === 'right';
    this._backwardJump = dir === 'left';
    this.inJump.set(true);
    if (dir === 'right')      this.animation.set('jumpForward');
    else if (dir === 'left')  this.animation.set('jumpBackward');
    else                      this.animation.set('jumpUp');
  }

  private _physicsTick(): void {
    const cfg = this._cfg();
    if (this.inJump()) {
      const elapsed = this._loop.tick() - this._jumpStartTick;
      const apexTicks = Math.round(cfg.jumpApexMs / GameLoopService.TICK_MS);
      const landTicks = Math.round(cfg.jumpDurationMs / GameLoopService.TICK_MS);

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
        this.accumulatedY.update(y => y - cfg.jumpVerticalStep);
      } else {
        // Mid-air for a vertical jump: swap to the fall sprite once.
        if (!this._forwardJump && !this._backwardJump && this.animation() === 'jumpUp') {
          this.animation.set('jumpFall');
        }
        this.accumulatedY.update(y => y + cfg.jumpVerticalStep);
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
        this.accumulated.update(x => x + cfg.crouchSpeed);
      }
      return;
    }
    if (dir === 'right' && !this.blockedRight()) {
      this.accumulated.update(x => x + cfg.walkSpeed);
    } else if (dir === 'left' && !this.blockedLeft()) {
      this.accumulated.update(x => x - cfg.walkSpeed);
    }
  }
}
