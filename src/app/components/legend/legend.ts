import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'app-legend',
  templateUrl: './legend.html',
  styleUrl: './legend.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Legend {
  readonly open = signal(true);

  toggle(): void {
    this.open.update((v) => !v);
  }
}
