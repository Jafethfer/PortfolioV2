import { Injectable, signal } from '@angular/core';
import { Direction } from '../models/character';

const ARROW_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown']);

/**
 * Pure keyboard state. Exposes signals consumers can react to via effects.
 * Knows nothing about characters, stages, or animation — just keys.
 */
@Injectable({ providedIn: 'root' })
export class InputService {
  readonly rightKey = signal(false);
  readonly leftKey = signal(false);
  readonly downKey = signal(false);
  /** Increments on each ArrowUp keydown — consumers detect change to fire one-shot. */
  readonly jumpPressed = signal(0);
  /** Increments on each `A` keydown — one-shot for the light-punch attack. */
  readonly lightPunchPressed = signal(0);
  /** Most-recently pressed horizontal arrow. Survives keyup of the opposite. */
  readonly lastDir = signal<Direction>(null);

  constructor() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (ARROW_KEYS.has(e.key)) e.preventDefault();
    if (e.key === 'ArrowRight') {
      this.rightKey.set(true);
      if (!e.repeat) this.lastDir.set('right');
    } else if (e.key === 'ArrowLeft') {
      this.leftKey.set(true);
      if (!e.repeat) this.lastDir.set('left');
    } else if (e.key === 'ArrowDown') {
      this.downKey.set(true);
    } else if (e.key === 'ArrowUp' && !e.repeat) {
      this.jumpPressed.update(n => n + 1);
    } else if ((e.key === 'a' || e.key === 'A') && !e.repeat) {
      this.lightPunchPressed.update(n => n + 1);
    }
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowRight') {
      this.rightKey.set(false);
      if (this.lastDir() === 'right') this.lastDir.set(this.leftKey() ? 'left' : null);
    } else if (e.key === 'ArrowLeft') {
      this.leftKey.set(false);
      if (this.lastDir() === 'left') this.lastDir.set(this.rightKey() ? 'right' : null);
    } else if (e.key === 'ArrowDown') {
      this.downKey.set(false);
    }
  };
}
