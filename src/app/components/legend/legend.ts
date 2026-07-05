import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LegendService } from '../../services/legend.service';
import { IS_COMPACT_POINTER } from '../../constants/viewport';

@Component({
  selector: 'app-legend',
  templateUrl: './legend.html',
  styleUrl: './legend.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Legend {
  /** Open by default on desktop; collapsed to a corner button on touch so the
   * panel doesn't cover a small landscape screen (it opens as a centered dialog
   * there — see the compact-pointer block in the stylesheet). */
  readonly open = signal(!IS_COMPACT_POINTER);

  /** Per-character specials, published by the active stage. Movement / Attacks
   * are universal and stay hardcoded in the template. */
  readonly specials = inject(LegendService).specials;

  toggle(): void {
    this.open.update((v) => !v);
  }
}
