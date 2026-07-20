import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { InputService } from '../../services/input.service';

type TapButton = 'jump' | 'lightPunch' | 'heavyPunch' | 'lightKick' | 'heavyKick';

/** Held directions the stick resolves to (one per axis → eight compass dirs). */
interface Held {
  left: boolean;
  right: boolean;
  down: boolean;
  up: boolean;
}

const NEUTRAL: Held = { left: false, right: false, down: false, up: false };

/** Below this fraction of the stick radius the input reads neutral, so a
 * resting thumb doesn't twitch the character. */
const DEADZONE = 0.28;
/** Per-axis push at which that axis's direction activates, applied per axis for
 * an 8-way feel. */
const AXIS_THRESHOLD = 0.38;

/**
 * On-screen virtual gamepad for touch devices: an analog joystick plus four
 * attack buttons. Purely an input surface — every control drives the shared
 * `InputService` press/release API the keyboard uses, so physics and specials
 * react identically regardless of device. Mounted once at the app root so it
 * persists across navigation. The stick fires press/release only on
 * transitions, so rolling the knob emits a clean directional sequence into the
 * motion buffer; up is a one-shot jump.
 */
@Component({
  selector: 'app-touch-controls',
  templateUrl: './touch-controls.html',
  styleUrl: './touch-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TouchControls {
  private readonly _input = inject(InputService);

  private readonly _baseEl = viewChild.required<ElementRef<HTMLDivElement>>('joyBase');

  /** Knob offset from the base center (px). Bound to the knob's transform. */
  private readonly _knob = signal({ x: 0, y: 0 });
  readonly knobTransform = computed(() => `translate(${this._knob().x}px, ${this._knob().y}px)`);

  /** Pointer id currently driving the stick; null when released. Guards against
   * a second finger (an attack tap) hijacking the stick's move stream. */
  private _stickPointer: number | null = null;
  private _baseCx = 0;
  private _baseCy = 0;
  private _radius = 0;

  /** Directions currently held via the stick, so press/release fire only on
   * edges — re-pressing every move would flood the motion buffer. */
  private _held: Held = { ...NEUTRAL };

  onStickDown(e: PointerEvent): void {
    this._swallow(e);
    const base = this._baseEl().nativeElement;
    const rect = base.getBoundingClientRect();
    this._baseCx = rect.left + rect.width / 2;
    this._baseCy = rect.top + rect.height / 2;
    this._radius = rect.width / 2;
    this._stickPointer = e.pointerId;
    // Capture so the knob keeps tracking even when the thumb slides off the base.
    base.setPointerCapture(e.pointerId);
    this._updateStick(e.clientX, e.clientY);
  }

  onStickMove(e: PointerEvent): void {
    if (e.pointerId !== this._stickPointer) return;
    this._swallow(e);
    this._updateStick(e.clientX, e.clientY);
  }

  onStickUp(e: PointerEvent): void {
    if (e.pointerId !== this._stickPointer) return;
    this._swallow(e);
    this._stickPointer = null;
    this._knob.set({ x: 0, y: 0 });
    this._reconcile({ ...NEUTRAL });
  }

  onTap(e: Event, id: TapButton): void {
    this._swallow(e);
    if (id === 'jump') this._input.pressJump();
    else if (id === 'lightPunch') this._input.pressLightPunch();
    else if (id === 'heavyPunch') this._input.pressHeavyPunch();
    else if (id === 'lightKick') this._input.pressLightKick();
    else this._input.pressHeavyKick();
  }

  /** Kill the browser's default touch behavior and stop the event bubbling to
   * the parallax drag listener, so a control never also pans the info cards. */
  protected swallow(e: Event): void {
    this._swallow(e);
  }

  /** Resolve the knob's pixel offset into a held-direction set and update both
   * the visual knob (clamped to the base) and the input state. */
  private _updateStick(clientX: number, clientY: number): void {
    let dx = clientX - this._baseCx;
    let dy = clientY - this._baseCy;
    const dist = Math.hypot(dx, dy);
    if (dist > this._radius && dist > 0) {
      dx = (dx / dist) * this._radius;
      dy = (dy / dist) * this._radius;
    }
    this._knob.set({ x: dx, y: dy });

    const nx = this._radius ? dx / this._radius : 0;
    const ny = this._radius ? dy / this._radius : 0; // +y is downward (screen space)
    const desired: Held =
      Math.hypot(nx, ny) < DEADZONE
        ? { ...NEUTRAL }
        : {
            right: nx > AXIS_THRESHOLD,
            left: nx < -AXIS_THRESHOLD,
            down: ny > AXIS_THRESHOLD,
            up: ny < -AXIS_THRESHOLD,
          };
    this._reconcile(desired);
  }

  /** Fire press/release only where `desired` differs from the held-set. Down is
   * settled before the horizontals so a diagonal flick seeds the buffer as
   * `down` → `forward`, the order a quarter-circle special needs. */
  private _reconcile(desired: Held): void {
    const h = this._held;
    if (desired.down && !h.down) this._input.pressDown();
    else if (!desired.down && h.down) this._input.releaseDown();
    if (desired.left && !h.left) this._input.pressLeft();
    else if (!desired.left && h.left) this._input.releaseLeft();
    if (desired.right && !h.right) this._input.pressRight();
    else if (!desired.right && h.right) this._input.releaseRight();
    // Up: jump on the rising edge, holding the flag while up stays pushed so
    // the character keeps hopping.
    if (desired.up && !h.up) {
      this._input.pressJump();
      this._input.setJumpHeld(true);
    } else if (!desired.up && h.up) {
      this._input.setJumpHeld(false);
    }
    this._held = desired;
  }

  private _swallow(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }
}
