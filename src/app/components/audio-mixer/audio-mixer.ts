import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AudioService } from '../../services/audio.service';

/**
 * Global volume mixer — three sliders (music / SFX / voices) bound directly to
 * the `AudioService` master-volume signals. Lives at the app root (outside any
 * stage) so it persists across stage navigation. Each slider's start position
 * is the channel's reference level, so on load the mix matches the pre-mixer
 * app; dragging a slider attenuates every sound in that channel live.
 */
@Component({
  selector: 'app-audio-mixer',
  templateUrl: './audio-mixer.html',
  styleUrl: './audio-mixer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioMixer {
  protected readonly audio = inject(AudioService);
}
