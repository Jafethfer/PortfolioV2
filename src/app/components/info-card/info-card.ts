import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** A clickable link rendered as a button on a card (e.g. the closing CTA's
 * GitHub / LinkedIn / email). `url` may be any href, including `mailto:`. */
export interface InfoCardLink {
  readonly label: string;
  readonly url: string;
}

/** Shape of one info card's content. Exported so the parallax component
 * (and anything else that feeds cards) shares a single type. Title/body are
 * optional so a card can be image-only — a dedicated logo/screenshot beat. */
export interface InfoCardData {
  readonly title?: string;
  readonly body?: string;
  /** Optional image shown above the title (headshot, project screenshot, …).
   * Path under `assets/` so the landing preloader covers it. */
  readonly image?: string;
  /** Alt text for `image`. Leave empty for a purely decorative image. */
  readonly imageAlt?: string;
  /** Optional small caption/disclaimer rendered directly under `image` (e.g. a
   * "reference only / under NDA" note on a placeholder screenshot). Muted and
   * smaller than the body. */
  readonly caption?: string;
  /** Optional row of small tech-logo icons shown at the bottom of the card.
   * Decorative (the body already names the tech), so they render with empty
   * alt. Paths under `assets/`. */
  readonly logos?: readonly string[];
  /** Optional clickable link buttons (e.g. the closing CTA). */
  readonly links?: readonly InfoCardLink[];
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
  // Image-only and logos-only cards get a centering layout modifier on the host.
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
   * centered big (e.g. a single tech logo between description cards). A
   * captioned image (e.g. an NDA-labelled screenshot) instead renders as a
   * normal top-aligned card so the image sits framed above its disclaimer. */
  readonly imageOnly = computed(
    () => !!this.image() && !this.title() && !this.body() && !this.caption(),
  );

  /** A dedicated logo card — only a logo row, no title/body/image/caption
   * (e.g. a Docker + Kubernetes beat). Centers the logos big, the same way
   * `imageOnly` centers a single hero image. */
  readonly logosOnly = computed(
    () =>
      this.logos().length > 0 &&
      !this.title() &&
      !this.body() &&
      !this.image() &&
      !this.caption(),
  );
}
