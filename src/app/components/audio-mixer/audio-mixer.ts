import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { IS_COMPACT_POINTER } from '../../constants/viewport';

/**
 * Global volume mixer — three sliders (music / SFX / voices) bound to the
 * `AudioService` master-volume signals. Lives at the app root so it persists
 * across stage navigation; dragging a slider attenuates its channel live.
 */
@Component({
  selector: 'app-audio-mixer',
  templateUrl: './audio-mixer.html',
  styleUrl: './audio-mixer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AudioMixer {
  protected readonly audio = inject(AudioService);

  /** Sliders shown by default on desktop; collapsed to a speaker button on touch. */
  protected readonly open = signal(!IS_COMPACT_POINTER);

  protected toggle(): void {
    this.open.update((v) => !v);
  }
}
