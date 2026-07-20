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

/** Horizontal finger travel (px) before a touch counts as a card-track pan
 * rather than a tap, so taps on card links keep working. */
const DRAG_THRESHOLD_PX = 8;

/**
 * Scroll-driven parallax overlay: a fixed window over the stage with a wider
 * horizontal track of `app-info-card`s; wheel-down pans the track through them.
 * The host is `pointer-events: none` so it never blocks the scene, which means
 * wheel/pointer events are handled on `window` instead of bubbling through it.
 */
@Component({
  selector: 'app-parallax',
  templateUrl: './parallax.html',
  styleUrl: './parallax.scss',
  imports: [InfoCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Parallax {
  /** Info-card content for this stage. */
  readonly cards = input.required<ReadonlyArray<InfoCardData>>();

  /** Vertical position of the card band's center, as any CSS length/percentage
   * from the top of the stage. Each stage tunes it to clear its own ground. */
  readonly cardsY = input<string>('50%');

  /** Normalized world-scroll progress (0 → 1) driven by the stage as the
   * character walks. Mapped 1:1 onto the pixel `offset`; the wheel is a
   * secondary input and whichever moved last wins. */
  readonly progress = input(0);

  /** Whether a next/previous stage exists; hides the nav button at the ends. */
  readonly hasNext = input(false);
  readonly hasPrevious = input(false);

  /** Fired when the user clicks a stage-nav button; the stage handles routing. */
  readonly next = output<void>();
  readonly previous = output<void>();

  readonly trackEl = viewChild.required<ElementRef<HTMLDivElement>>('trackEl');

  /** The card strip. Touch drags only pan when they start inside this band,
   * since the window-level listeners would otherwise treat a swipe anywhere on
   * the scene as a card pan. */
  readonly bandEl = viewChild.required<ElementRef<HTMLDivElement>>('bandEl');

  /** Clamped horizontal offset (px) the track is shifted left by. */
  readonly offset = signal(0);

  /** Max scrollable offset (px) — how far the track overflows its window.
   * Measured after render and on every wheel tick. */
  private readonly _maxOffset = signal(0);

  /** Set true once the track is measured, so `atEnd` can't read a stale
   * `0 >= 0` as "at the end" during the first paint. */
  private readonly _measured = signal(false);

  /** True once the user has scrolled at all; drives the scroll-hint fade-out. */
  readonly scrolled = computed(() => this.offset() > 0);

  /** True when scrolled to the last card (or the cards fit without scrolling);
   * drives the fade-in of the stage nav. */
  readonly atEnd = computed(
    () => this._measured() && this.offset() >= this._maxOffset(),
  );

  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Movement-driven scrolling: map the stage's world progress onto the pixel
    // offset. Re-runs on `progress` change or re-measure; the wheel writes
    // `offset` directly too, so whichever moved last wins.
    effect(() => {
      const p = this.progress();
      const max = this._maxOffset();
      this.offset.set(Math.min(max, Math.max(0, p * max)));
    });

    afterNextRender(() => {
      window.addEventListener('wheel', this._onWheel, { passive: false });
      window.addEventListener('resize', this._onResize);
      // Touch has no wheel — a horizontal swipe across the scene pans the track.
      window.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointermove', this._onPointerMove, { passive: false });
      window.addEventListener('pointerup', this._onPointerUp);
      window.addEventListener('pointercancel', this._onPointerUp);
      // Capture phase so we can cancel the click BEFORE it reaches a card link.
      window.addEventListener('click', this._onClickCapture, true);
      this._measure();
    });
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('wheel', this._onWheel);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('pointerdown', this._onPointerDown);
      window.removeEventListener('pointermove', this._onPointerMove);
      window.removeEventListener('pointerup', this._onPointerUp);
      window.removeEventListener('pointercancel', this._onPointerUp);
      window.removeEventListener('click', this._onClickCapture, true);
    });
  }

  // --- Touch drag (mobile equivalent of the wheel) ---------------------------
  private _dragPending = false;
  private _dragActive = false;
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _dragLastX = 0;
  private _dragLastY = 0;
  /** Set when a drag ends so the synthesized release-click is swallowed once —
   * a pan across a card link mustn't also activate it. Reset on next
   * pointerdown so a genuine tap is never suppressed. */
  private _suppressClick = false;

  private readonly _onPointerDown = (e: PointerEvent): void => {
    this._suppressClick = false;
    // Desktop keeps the wheel; only touch/pen drive the drag.
    if (e.pointerType === 'mouse') return;
    // Don't hijack the volume sliders' own thumb-drag (gamepad buttons already
    // stop their events from ever reaching this window listener).
    if ((e.target as Element).closest?.('input')) return;
    // Only pan when the touch begins over the card strip — hit-test the band's
    // rect, since the click-through overlay spans the whole scene.
    const band = this.bandEl().nativeElement.getBoundingClientRect();
    if (
      e.clientX < band.left ||
      e.clientX > band.right ||
      e.clientY < band.top ||
      e.clientY > band.bottom
    ) {
      return;
    }
    if (this._measure() <= 0) return;
    this._dragPending = true;
    this._dragActive = false;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
    this._dragLastX = e.clientX;
    this._dragLastY = e.clientY;
  };

  private readonly _onClickCapture = (e: MouseEvent): void => {
    if (!this._suppressClick) return;
    e.preventDefault();
    e.stopPropagation();
    this._suppressClick = false;
  };

  private readonly _onPointerMove = (e: PointerEvent): void => {
    if (!this._dragPending) return;
    if (!this._dragActive) {
      const moved = Math.hypot(e.clientX - this._dragStartX, e.clientY - this._dragStartY);
      if (moved < DRAG_THRESHOLD_PX) return;
      // Crossed the threshold — commit to a pan. Re-anchor "last" here so the
      // threshold distance doesn't jump the offset.
      this._dragActive = true;
      this._dragLastX = e.clientX;
      this._dragLastY = e.clientY;
    }
    e.preventDefault();
    const max = this._measure();
    // Per-move delta so repeated swipes accumulate. Both axes advance the track:
    // a swipe up or left reveals later cards.
    const dx = e.clientX - this._dragLastX;
    const dy = e.clientY - this._dragLastY;
    this._dragLastX = e.clientX;
    this._dragLastY = e.clientY;
    this.offset.update((x) => Math.min(max, Math.max(0, x - dx - dy)));
  };

  private readonly _onPointerUp = (): void => {
    if (this._dragActive) this._suppressClick = true;
    this._dragPending = false;
    this._dragActive = false;
  };

  /** Re-measure the scroll range on resize. The cards are `cqw`-sized, so
   * `_maxOffset` changes with the viewport and the `offset` effect re-runs to
   * reposition the cards at the same `progress`. */
  private readonly _onResize = (): void => {
    this._measure();
  };

  /** Measure how far the track overflows its window, store it, and return it.
   * Read fresh each call so a resize or layout shift is picked up. */
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
    // Clamp to [0, max] so the last card stops flush at the right edge.
    this.offset.update((x) => Math.min(max, Math.max(0, x + e.deltaY)));
  };
}
