import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { InfoCard, InfoCardData } from '../info-card/info-card';

/**
 * Scroll-driven parallax overlay. A fixed window over the stage with a
 * wider horizontal track of `app-info-card`s; scrolling the wheel down
 * pans the track rightward through the cards.
 *
 * The host (`:host`) is the overlay window and is `pointer-events: none`
 * so it never blocks interaction with the scene behind it. Because of
 * that, wheel events don't bubble through the host — so we listen on
 * `window` and translate vertical wheel deltas into a clamped horizontal
 * offset. `passive: false` lets us `preventDefault` so no stray page
 * scroll fights us (the page body is `overflow: hidden` anyway).
 */
@Component({
  selector: 'app-parallax',
  templateUrl: './parallax.html',
  styleUrl: './parallax.scss',
  imports: [InfoCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Parallax {
  /** Info-card content for this stage. Required — each stage supplies its
   * own array. */
  readonly cards = input.required<ReadonlyArray<InfoCardData>>();

  /** Vertical position of the card band, as any CSS length/percentage
   * measured from the top of the stage to the *center* of the band. Each
   * stage tunes this to clear its own ground/background (e.g. a stage with
   * a tall foreground floor wants the cards higher). Defaults to centered. */
  readonly cardsY = input<string>('50%');

  /** Normalized world-scroll progress (0 → 1) driven by the stage as the
   * character walks forward. Mapped 1:1 onto the pixel `offset` so the
   * cards finish exactly when the world runs out of scroll. The wheel
   * remains a secondary input (see `_onWheel`); whichever moved last wins. */
  readonly progress = input(0);

  /** Whether a next/previous stage exists. The stage feeds these from the
   * router config; they hide the corresponding nav button at the ends. */
  readonly hasNext = input(false);
  readonly hasPrevious = input(false);

  /** Fired when the user clicks the respective stage-nav button. The stage
   * handles the actual routing — this component stays navigation-agnostic. */
  readonly next = output<void>();
  readonly previous = output<void>();

  readonly trackEl = viewChild.required<ElementRef<HTMLDivElement>>('trackEl');

  /** Clamped horizontal offset (px) the track is shifted left by. */
  readonly offset = signal(0);

  /** Max scrollable offset (px) — how far the track overflows its window.
   * Measured after render and on every wheel tick. */
  private readonly _maxOffset = signal(0);

  /** Set true once we've measured the track, so `atEnd` can't read a stale
   * `0 >= 0` as "at the end" during the first paint before measurement. */
  private readonly _measured = signal(false);

  /** True once the user has scrolled at all. Drives the fade-out of the
   * scroll-down hint — it shows on load, then disappears the moment any
   * scrolling begins. */
  readonly scrolled = computed(() => this.offset() > 0);

  /** True when scrolled to the last card (or the cards already fit without
   * scrolling). Drives the fade-in of the Next/Previous stage nav. */
  readonly atEnd = computed(
    () => this._measured() && this.offset() >= this._maxOffset(),
  );

  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Movement-driven scrolling: map the stage's normalized world progress
    // onto the pixel offset. Re-runs when `progress` changes (Terry walks)
    // or when the track is (re)measured. The wheel writes `offset` directly
    // too; while Terry is idle `progress` is constant so this effect stays
    // dormant and the wheel value persists — last mover wins.
    effect(() => {
      const p = this.progress();
      const max = this._maxOffset();
      this.offset.set(Math.min(max, Math.max(0, p * max)));
    });

    afterNextRender(() => {
      window.addEventListener('wheel', this._onWheel, { passive: false });
      window.addEventListener('resize', this._onResize);
      this._measure();
    });
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('wheel', this._onWheel);
      window.removeEventListener('resize', this._onResize);
    });
  }

  /** Re-measure the scroll range on resize. The cards are `cqw`-sized, so the
   * track width (and thus `_maxOffset`) changes with the viewport; the
   * `offset` effect re-runs off `_maxOffset` and repositions the cards to the
   * same `progress`. Without this the range stays frozen until the next
   * wheel/walk tick. */
  private readonly _onResize = (): void => {
    this._measure();
  };

  /** Measure how far the track overflows its window, store it, and return
   * it. `clientWidth`/`scrollWidth` are read fresh each call so a resized
   * window (or font/layout shift) is picked up on the next wheel tick. */
  private _measure(): number {
    const track = this.trackEl().nativeElement;
    const layer = this._host.nativeElement;
    const max = Math.max(0, track.scrollWidth - layer.clientWidth);
    this._maxOffset.set(max);
    this._measured.set(true);
    return max;
  }

  private readonly _onWheel = (e: WheelEvent): void => {
    const max = this._measure();
    if (max <= 0) return;
    e.preventDefault();
    // Clamp to [0, max] so the last card stops flush at the right edge
    // instead of scrolling into empty space.
    this.offset.update((x) => Math.min(max, Math.max(0, x + e.deltaY)));
  };
}
