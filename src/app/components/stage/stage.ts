import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ElementRef,
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

/**
 * The world. Owns the parallax backdrop, misc layer, and train; tracks its
 * own edge limits and scrolls the train when a character bumps against them.
 * The character is rendered as a child but does not know the stage exists —
 * Stage computes `blocked` flags from the character's reported worldX/width
 * and passes them down as inputs.
 *
 * Stage is character-agnostic: it takes a `characterClass` (a concrete
 * subclass of `Character`) and *spawns* it into a host `<ng-container>` via
 * `ViewContainerRef.createComponent` — the same shape a game scene takes
 * when instantiating a player prefab.
 */
@Component({
  selector: 'app-stage',
  imports: [],
  templateUrl: './stage.html',
  styleUrl: './stage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stage {
  readonly characterClass = input.required<Type<Character>>();
  readonly walkScrollRate = input(20);
  readonly crouchScrollRate = input(10);

  readonly stageEl = viewChild.required<ElementRef<HTMLDivElement>>('stageEl');
  readonly trainEl = viewChild.required<ElementRef<HTMLDivElement>>('trainEl');
  readonly trainImgEl = viewChild.required<ElementRef<HTMLImageElement>>('trainImgEl');
  readonly characterHost = viewChild.required('characterHost', { read: ViewContainerRef });

  private readonly _input = inject(InputService);
  private readonly _loop = inject(GameLoopService);

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

      // Center the train so there's equal scroll room on both sides
      // (Terry spawns near center, world extends both directions).
      const train = this.trainEl().nativeElement;
      const trainImg = this.trainImgEl().nativeElement;
      train.scrollLeft = (trainImg.scrollWidth - train.clientWidth) / 2;

      // Spawn the character. The host slot lives in our template, so its
      // viewChild is resolved by the time afterNextRender fires.
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

    // Each tick: if the character is pinned at an edge and still pressing
    // into it, move the world instead.
    effect(() => {
      this._loop.tick();
      untracked(() => this._scrollTrain());
    });
  }

  /** Scrolls the train when the character is pinned against an edge AND
   * still holding the direction key into that edge. Releasing the key (or
   * walking away) stops the scroll, even though the character may still be
   * pixel-aligned with the edge limit. */
  private _scrollTrain(): void {
    if (!this.character()) return;
    const dir = this._input.lastDir();
    if (!dir) return;
    const train = this.trainEl().nativeElement;
    const trainImg = this.trainImgEl().nativeElement;
    const rate = this._input.downKey() ? this.crouchScrollRate() : this.walkScrollRate();
    if (dir === 'right' && this.blockedRight()
        && train.scrollLeft + train.clientWidth < trainImg.scrollWidth) {
      train.scrollLeft += rate;
    } else if (dir === 'left' && this.blockedLeft() && train.scrollLeft > 0) {
      train.scrollLeft -= rate;
    }
  }
}
