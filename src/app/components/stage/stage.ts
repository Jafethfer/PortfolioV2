import {
  ChangeDetectionStrategy,
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
} from '@angular/core';
import { CharacterConfig } from '../../models/character';
import { Character } from '../character/character';
import { InputService } from '../../services/input.service';
import { GameLoopService } from '../../services/game-loop.service';

/**
 * The world. Owns the parallax backdrop, misc layer, and train; tracks its
 * own edge limits and scrolls the train when a character bumps against them.
 * The character is rendered as a child but does not know the stage exists —
 * Stage computes `blocked` flags from the character's reported worldX/width
 * and passes them down as inputs.
 */
@Component({
  selector: 'app-stage',
  imports: [Character],
  templateUrl: './stage.html',
  styleUrl: './stage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stage {
  readonly characterConfig = input.required<CharacterConfig>();
  readonly walkScrollRate = input(20);
  readonly crouchScrollRate = input(10);

  readonly stageEl = viewChild.required<ElementRef<HTMLDivElement>>('stageEl');
  readonly trainEl = viewChild.required<ElementRef<HTMLDivElement>>('trainEl');
  readonly trainImgEl = viewChild.required<ElementRef<HTMLImageElement>>('trainImgEl');
  readonly character = viewChild.required(Character);

  private readonly _input = inject(InputService);
  private readonly _loop = inject(GameLoopService);

  private _rightLimit = signal(0);
  private _leftLimit = signal(0);
  readonly width = signal(0);

  readonly blockedRight = computed(() => {
    const c = this.character();
    return c.worldX() >= this._rightLimit() - c.width();
  });

  readonly blockedLeft = computed(() => {
    const c = this.character();
    return c.worldX() < this._leftLimit();
  });

  constructor() {
    afterNextRender(() => {
      const rect = this.stageEl().nativeElement.getBoundingClientRect();
      this._rightLimit.set(rect.right);
      this._leftLimit.set(rect.left);
      this.width.set(rect.width);
    });

    // Each tick: if the character is pinned at an edge, scroll the train.
    effect(() => {
      this._loop.tick();
      untracked(() => this._scrollTrainIfEdge());
    });
  }

  private _scrollTrainIfEdge(): void {
    if (!this.blockedRight() && !this.blockedLeft()) return;
    const train = this.trainEl().nativeElement;
    const trainImg = this.trainImgEl().nativeElement;
    const x = this.character().worldX();
    const rate = this._input.downKey() ? this.crouchScrollRate() : this.walkScrollRate();
    if (this.blockedRight() && trainImg.scrollWidth > x) train.scrollLeft += rate;
    if (this.blockedLeft()  && train.scrollLeft > 0)     train.scrollLeft -= rate;
  }
}
