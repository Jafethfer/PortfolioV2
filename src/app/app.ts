import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Stage } from './components/stage/stage';
import { MusicControl } from './components/music-control/music-control';
import { TERRY_CONFIG } from './characters/terry';

@Component({
  selector: 'app-root',
  imports: [Stage, MusicControl],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly terry = TERRY_CONFIG;
  protected readonly bgMusic = '/assets/sfx/terry-stage-ost.mp3';
}
