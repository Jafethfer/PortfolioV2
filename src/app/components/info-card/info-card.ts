import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Shape of one info card's content. Exported so the parallax component
 * (and anything else that feeds cards) shares a single type. */
export interface InfoCardData {
  readonly title: string;
  readonly body: string;
}

/**
 * Presentational "about me" card. Pure dumb component — takes a title +
 * body and renders the styled panel. Layout/scroll behavior lives in the
 * parent (`app-parallax`); this component only knows how to look.
 */
@Component({
  selector: 'app-info-card',
  templateUrl: './info-card.html',
  styleUrl: './info-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoCard {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
}
