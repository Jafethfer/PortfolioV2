import { Injectable, signal } from '@angular/core';

/** One special-move row in the controls legend. `motion` chips render as arrow
 * `<kbd>`s in order; `buttons` render as `<kbd>`s joined with `/`. Either may be
 * empty — a mash move has no `motion`, a pure-directional move has no `buttons`. */
export interface LegendSpecial {
  readonly motion: readonly string[];
  readonly buttons: readonly string[];
  readonly label: string;
}

/**
 * Backs the root-level `<app-legend>`'s per-character Specials list. The legend
 * lives outside the router-outlet so it persists across stage navigation, so the
 * active Stage publishes its character's specials here on render — the same
 * root-singleton pattern as `AudioService.setBgMusic`. The transition cover sits
 * above the legend, so the brief window where the outgoing stage's specials are
 * still set (until the incoming stage registers on render) is never visible.
 */
@Injectable({ providedIn: 'root' })
export class LegendService {
  readonly specials = signal<readonly LegendSpecial[]>([]);

  setSpecials(specials: readonly LegendSpecial[]): void {
    this.specials.set(specials);
  }
}
