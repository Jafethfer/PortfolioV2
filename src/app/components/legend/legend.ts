import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LegendService } from '../../services/legend.service';

@Component({
  selector: 'app-legend',
  templateUrl: './legend.html',
  styleUrl: './legend.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Legend {
  readonly open = signal(true);

  /** Per-character specials, published by the active stage. Movement / Attacks
   * are universal and stay hardcoded in the template. */
  readonly specials = inject(LegendService).specials;

  toggle(): void {
    this.open.update((v) => !v);
  }
}
