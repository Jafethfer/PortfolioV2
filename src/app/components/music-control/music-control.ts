import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-music-control',
  templateUrl: './music-control.html',
  styleUrl: './music-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MusicControl {
  readonly src = input.required<string>();
  readonly volume = input(0.2);
  readonly playing = signal(false);

  private readonly _audio = inject(AudioService);

  toggle(): void {
    if (this.playing()) {
      this._audio.pauseBgMusic();
      this.playing.set(false);
    } else {
      this._audio.playBgMusic(this.src(), this.volume());
      this.playing.set(true);
    }
  }
}
