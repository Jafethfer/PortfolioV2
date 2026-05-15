import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Stage } from './components/stage/stage';
import { MusicControl } from './components/music-control/music-control';
import { Terry } from './characters/terry';

@Component({
  selector: 'app-root',
  imports: [Stage, MusicControl],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly character = Terry;
  protected readonly bgMusic = '/assets/sfx/stage/terry-stage-ost.mp3';
}
