import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { Legend } from './components/legend/legend';
import { StageTransition } from './components/stage-transition/stage-transition';
import { AudioMixer } from './components/audio-mixer/audio-mixer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Legend, StageTransition, AudioMixer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly _router = inject(Router);

  /** True on the `''` landing screen. Gates the root overlays (Controls legend
   * + audio mixer) so the title screen stays clean; they return once a stage
   * route loads. */
  readonly isLanding = toSignal(
    this._router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => this._isLanding(e.urlAfterRedirects)),
      startWith(this._isLanding(this._router.url)),
    ),
    { initialValue: true },
  );

  private _isLanding(url: string): boolean {
    return url === '/' || url === '';
  }
}
