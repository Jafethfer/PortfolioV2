import { Injectable, signal } from '@angular/core';

/** One special-move row in the controls legend. `motion` renders as arrow
 * `<kbd>`s, `buttons` as `<kbd>`s joined with `/`; either may be empty. */
export interface LegendSpecial {
  readonly motion: readonly string[];
  readonly buttons: readonly string[];
  readonly label: string;
}

/**
 * Backs the root-level `<app-legend>`'s per-character Specials list. The legend
 * persists across stage navigation, so the active Stage publishes its specials
 * here on render — the same root-singleton pattern as `AudioService.setBgMusic`.
 */
@Injectable({ providedIn: 'root' })
export class LegendService {
  readonly specials = signal<readonly LegendSpecial[]>([]);

  setSpecials(specials: readonly LegendSpecial[]): void {
    this.specials.set(specials);
  }
}
