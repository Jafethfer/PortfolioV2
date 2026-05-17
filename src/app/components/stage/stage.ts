import {
  ComponentRef,
  Directive,
  ElementRef,
  Signal,
  Type,
  ViewContainerRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Character } from '../character/character';
import { InputService } from '../../services/input.service';
import { GameLoopService } from '../../services/game-loop.service';

/** One image in a stage layer animation. Subclasses that animate a layer
 * (Joe's water shimmer, Joe's clapping audience) declare an array of
 * these and feed it to `makeFrameCycle` for a `currentSrc` signal +
 * `advance(tick)` method. Single-image layers don't need this — they can
 * just inline the URL. */
export interface StageFrame {
  readonly src: string;
  readonly durationMs: number;
}

/**
 * Abstract stage base — owns the *behavior* every stage shares, not its
 * layout. Each concrete subclass supplies its own template + SCSS and
 * implements its own per-tick rules (parallax pan vs. scroll-linked bg
 * vs. anything else). This mirrors the Character abstraction: layout and
 * visuals live in the subclass; the base handles physics-side plumbing.
 *
 * What the base owns:
 *   - Character spawn into a `#characterHost` slot the subclass declares
 *   - Edge detection (`blockedRight` / `blockedLeft`) from the
 *     `#stageEl` element's bounding box
 *   - Forwarding `worldWidth` + blocked flags into the character's inputs
 *   - A single game-loop tick effect that calls `_onTick()` each frame
 *   - Generic frame-cycling utility (`makeFrameCycle`) for any subclass
 *     that wants animated layers
 *   - Optional `musicSrc` for stages that wire up `<app-music-control>`
 *
 * What every subclass must declare in its template:
 *   - `#stageEl` — the playable-area container (used for edge limits)
 *   - `#characterHost` — an `<ng-container>` slot the spawn pipeline
 *     fills in
 *
 * What every subclass typically implements (all optional):
 *   - `_onAfterRender()` — one-time DOM init (centering scroll, etc.)
 *   - `_onTick()` — per-tick logic (scroll the ground, advance frame
 *     cycles, update parallax positions, etc.)
 */
@Directive()
export abstract class Stage {
  /** Background music for the stage. Optional — stages without an OST
   * yet can omit the music-control button in their template. */
  protected readonly musicSrc?: string;

  /** Per-tick scroll rates for ground panning when the character is
   * pinned at an edge. Plain protected fields (not `input()`) because
   * `withComponentInputBinding()` wipes any input not present in the
   * route's `data`. Subclasses override with `protected override readonly`. */
  protected readonly walkScrollRate: number = 20;
  protected readonly crouchScrollRate: number = 10;

  readonly characterClass = input.required<Type<Character>>();

  readonly stageEl = viewChild.required<ElementRef<HTMLElement>>('stageEl');
  readonly characterHost = viewChild.required('characterHost', { read: ViewContainerRef });

  /** Shared services exposed to subclasses so they can read input state
   * and the game-loop tick from inside `_onTick`. Kept protected (not
   * exposed publicly) — the template never reads these directly. */
  protected readonly input = inject(InputService);
  protected readonly loop = inject(GameLoopService);

  private _rightLimit = signal(0);
  private _leftLimit = signal(0);
  readonly width = signal(0);

  /** The spawned character instance. `null` until afterNextRender creates it. */
  readonly character = signal<Character | null>(null);
  private _characterRef?: ComponentRef<Character>;

  readonly blockedRight = computed(() => {
    const c = this.character();
    if (!c || !c.ready()) return false;
    return c.worldX() >= this._rightLimit() - c.width();
  });

  readonly blockedLeft = computed(() => {
    const c = this.character();
    if (!c || !c.ready()) return false;
    return c.worldX() < this._leftLimit();
  });

  constructor() {
    afterNextRender(() => {
      const rect = this.stageEl().nativeElement.getBoundingClientRect();
      this._rightLimit.set(rect.right);
      this._leftLimit.set(rect.left);
      this.width.set(rect.width);

      // Subclass hook for one-time DOM setup — runs BEFORE the character
      // spawns so things like initial scroll centering happen on the
      // empty stage, then the character drops in on top.
      this._onAfterRender();

      this._characterRef = this.characterHost().createComponent(this.characterClass());
      this.character.set(this._characterRef.instance);
    });

    // Forward Stage-computed signals into the character's inputs. Reading
    // `character()` here means this effect activates once the character is
    // spawned, then re-runs whenever any forwarded signal changes.
    effect(() => {
      const inst = this.character();
      if (!inst || !this._characterRef) return;
      this._characterRef.setInput('worldWidth', this.width());
      this._characterRef.setInput('blockedRight', this.blockedRight());
      this._characterRef.setInput('blockedLeft', this.blockedLeft());
    });

    // Per-tick subclass hook. Gated on `character()` so subclass logic
    // doesn't run before the character exists.
    effect(() => {
      this.loop.tick();
      untracked(() => {
        if (this.character()) this._onTick();
      });
    });
  }

  /** Subclass hook — runs once after the stage view is rendered and
   * before the character is spawned. Override to do one-time DOM init
   * (e.g. centering a scrollable element's `scrollLeft`). */
  protected _onAfterRender(): void {}

  /** Subclass hook — called every game-loop tick after the character is
   * spawned. Override to implement scroll/parallax/animation behavior. */
  protected _onTick(): void {}

  /** Helper for subclasses with animated layers. Returns a `currentSrc`
   * signal (bind it to `[src]` or `[style.background-image]`) and an
   * `advance(tick)` method to call from `_onTick`. Single-frame inputs
   * are static — `advance` early-returns and `currentSrc` is constant. */
  protected makeFrameCycle(frames: readonly StageFrame[]): {
    readonly currentSrc: Signal<string>;
    advance(tick: number): void;
  } {
    const idx = signal(0);
    let startTick = 0;
    const currentSrc = computed(() => frames[idx()]?.src ?? '');
    return {
      currentSrc,
      advance: (tick: number) => {
        if (frames.length <= 1) return;
        const cur = frames[idx()];
        if (!cur) return;
        const durTicks = Math.round(cur.durationMs / GameLoopService.TICK_MS);
        if (tick - startTick < durTicks) return;
        idx.set((idx() + 1) % frames.length);
        startTick = tick;
      },
    };
  }
}
