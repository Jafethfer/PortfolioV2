import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** A clickable link rendered as a button on a card. `url` may be any href. */
export interface InfoCardLink {
  readonly label: string;
  readonly url: string;
}

/** Shape of one info card's content. Title/body are optional so a card can be
 * image-only. */
export interface InfoCardData {
  readonly title?: string;
  readonly body?: string;
  /** Optional image shown above the title. Path under `assets/`. */
  readonly image?: string;
  /** Alt text for `image`. Leave empty for a purely decorative image. */
  readonly imageAlt?: string;
  /** Optional small caption/disclaimer rendered directly under `image`. */
  readonly caption?: string;
  /** Optional row of small tech-logo icons shown at the bottom of the card. */
  readonly logos?: readonly string[];
  /** Optional clickable link buttons. */
  readonly links?: readonly InfoCardLink[];
}

/**
 * Presentational "about me" card. Pure dumb component; layout/scroll behavior
 * lives in the parent (`app-parallax`).
 */
@Component({
  selector: 'app-info-card',
  templateUrl: './info-card.html',
  styleUrl: './info-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.card--image]': 'imageOnly()',
    '[class.card--logos]': 'logosOnly()',
  },
})
export class InfoCard {
  readonly title = input<string>();
  readonly body = input<string>();
  /** Optional card image (see `InfoCardData.image`). No image renders when unset. */
  readonly image = input<string>();
  readonly imageAlt = input<string>('');
  /** Optional image caption/disclaimer (see `InfoCardData.caption`). */
  readonly caption = input<string>();
  /** Optional tech-logo row (see `InfoCardData.logos`). Empty renders nothing. */
  readonly logos = input<readonly string[]>([]);
  /** Optional clickable link buttons (see `InfoCardData.links`). */
  readonly links = input<readonly InfoCardLink[]>([]);

  /** A dedicated image card — an image with no title, body, or caption,
   * centered big. A captioned image renders as a normal top-aligned card. */
  readonly imageOnly = computed(
    () => !!this.image() && !this.title() && !this.body() && !this.caption(),
  );

  /** A dedicated logo card — only a logo row, no title/body/image/caption.
   * Centers the logos big, like `imageOnly` does for a hero image. */
  readonly logosOnly = computed(
    () =>
      this.logos().length > 0 &&
      !this.title() &&
      !this.body() &&
      !this.image() &&
      !this.caption(),
  );
}
