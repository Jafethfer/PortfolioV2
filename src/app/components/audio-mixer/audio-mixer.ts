import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { IS_COMPACT_POINTER } from '../../constants/viewport';

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

  /** Sliders shown by default on desktop; collapsed to a speaker button on
   * touch so they don't cover a small landscape screen (they open as a centered
   * dialog there — see the compact-pointer block in the stylesheet). */
  protected readonly open = signal(!IS_COMPACT_POINTER);

  protected toggle(): void {
    this.open.update((v) => !v);
  }
}
