import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Legend } from './components/legend/legend';
import { StageTransition } from './components/stage-transition/stage-transition';
import { AudioMixer } from './components/audio-mixer/audio-mixer';
import { TouchControls } from './components/touch-controls/touch-controls';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Legend, StageTransition, AudioMixer, TouchControls],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Swallow the long-press / right-click context menu across the whole scene
  // (Android & desktop fire `contextmenu`; iOS uses the callout suppressed in
  // styles.scss). Bubbles up to the root, so one listener covers every element.
  host: { '(contextmenu)': 'swallowContextMenu($event)' },
})
export class App {
  private readonly _router = inject(Router);

  /** True on the non-interactive book-end screens (`''` landing + `end`
   * closing). Gates the root overlays (Controls legend + audio mixer) so those
   * screens stay clean; the overlays return once a playable stage route loads. */
  readonly chromeless = toSignal(
    this._router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => this._isChromeless(e.urlAfterRedirects)),
      startWith(this._isChromeless(this._router.url)),
    ),
    { initialValue: true },
  );

  private _isChromeless(url: string): boolean {
    return url === '/' || url === '' || url === '/end';
  }

  protected swallowContextMenu(event: Event): void {
    event.preventDefault();
  }
}
