import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Character } from '../components/character/character';
import { AnimationData, AnimationName } from '../models/character';

/**
 * Joe Higashi (Fatal Fury / KOF) — Muay Thai fighter, home stage is the
 * Thailand `JoeStage`. Concrete `Character` subclass: shares the per-frame
 * render template, supplies its own sprite stylesheet, anchor tuning, and
 * animation map.
 *
 * Locomotion-first: idle is wired now; walk / backwards / crouch / jump land
 * as their frames are mapped off the source sheet (which packs moves densely
 * and out of order, so each animation is a hand-picked frame subset).
 *
 * Sprites are cropped from the magenta-boxed master sheet
 * (`PortfolioV2Assets/474537.png`) via `sprite-tool.mjs cropframes` with
 * `MARKER=255,0,255`. Standing height is ~107px, so Joe shares Terry's `107`
 * `spriteBaseHeight` and `25cqw` `--character-height`.
 */
@Component({
  selector: 'app-joe',
  templateUrl: '../components/character/character.html',
  styleUrl: './joe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Joe extends Character {
  protected override readonly spriteBaseHeight = 107;
  // Source-px body line every frame's anchorX is aligned to. Set to the idle
  // frames' feet-centre (≈26) so the stance plants without horizontal jitter.
  protected override readonly bodyAnchorX = 26;

  protected override readonly animationFrames: Partial<Record<AnimationName, AnimationData>> = {
    // Idle = row 0 frames 16, 17, 26 of the source sheet (the breathing
    // fight stance). anchorX is each frame's detected feet-centre so the body
    // stays put as the loop cycles. `bounce` ping-pongs the loop (0→1→2→1→0…)
    // for a smooth breathing bob instead of snapping last-pose→first.
    idle: {
      loop: true,
      bounce: true,
      frames: [
        {
          src: 'assets/img/characters/joe/idle/0.png',
          w: 64,
          h: 104,
          anchorX: 27,
          anchorY: 104,
          durationMs: 200,
        },
        {
          src: 'assets/img/characters/joe/idle/1.png',
          w: 58,
          h: 106,
          anchorX: 26,
          anchorY: 106,
          durationMs: 200,
        },
        {
          src: 'assets/img/characters/joe/idle/2.png',
          w: 56,
          h: 107,
          anchorX: 25,
          anchorY: 107,
          durationMs: 200,
        },
      ],
    },
    // Forward walk — a 4-step Muay Thai stride (source row 0 frames 25→22,
    // already renamed to 0→3 in playback order). Plain forward loop (NOT
    // bounce — a walk advances). anchorX is each frame's bbox-centre
    // (floor(w/2)), a stable body line as the legs step, so the torso glides
    // while the feet cycle — same approach as Terry's walk.
    forward: {
      loop: true,
      frames: [
        {
          src: 'assets/img/characters/joe/walk/0.png',
          w: 58,
          h: 107,
          anchorX: 29,
          anchorY: 107,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/joe/walk/1.png',
          w: 53,
          h: 106,
          anchorX: 26,
          anchorY: 106,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/joe/walk/2.png',
          w: 51,
          h: 109,
          anchorX: 25,
          anchorY: 109,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/joe/walk/3.png',
          w: 52,
          h: 108,
          anchorX: 26,
          anchorY: 108,
          durationMs: 150,
        },
      ],
    },
    // Backwards walk = row 0 frames 22→18 (a 5-step back-pedal). Same
    // treatment as `forward`: plain forward loop, frame-centre anchors.
    backwards: {
      loop: true,
      frames: [
        {
          src: 'assets/img/characters/joe/backwards/0.png',
          w: 52,
          h: 108,
          anchorX: 26,
          anchorY: 108,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/joe/backwards/1.png',
          w: 50,
          h: 106,
          anchorX: 25,
          anchorY: 106,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/joe/backwards/2.png',
          w: 51,
          h: 108,
          anchorX: 25,
          anchorY: 108,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/joe/backwards/3.png',
          w: 49,
          h: 109,
          anchorX: 24,
          anchorY: 109,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/joe/backwards/4.png',
          w: 48,
          h: 109,
          anchorX: 24,
          anchorY: 109,
          durationMs: 150,
        },
      ],
    },
    // Vertical jump-in-place = row 0 frames 3 (launch) → 2 (mid-air tuck) → 1
    // (recovery), split across the two phases the jump state machine drives:
    // `jumpUp` on the way up (held on the tuck at apex via default loop:false),
    // `jumpFall` on the way down. anchorX is the magenta box-centre — the
    // sheet's per-frame body placement — since these poses' silhouettes vary
    // too much for a bbox-centre to track the hips. Diagonal jumps (jumpForward
    // /jumpBackward) aren't mapped yet, so only a straight-up jump is animated.
    jumpUp: {
      // Launch holds longer than the tuck so it reads — the engine plays
      // frame 0 for its duration, then holds frame 1 at apex for the rest of
      // the ~500ms ascent (`jumpApexMs`). Too short a launch flashes by.
      frames: [
        {
          src: 'assets/img/characters/joe/jump/0.png',
          w: 38,
          h: 121,
          anchorX: 20,
          anchorY: 121,
          durationMs: 280,
        },
        {
          src: 'assets/img/characters/joe/jump/1.png',
          w: 53,
          h: 81,
          anchorX: 26,
          anchorY: 81,
          durationMs: 150,
        },
      ],
    },
    jumpFall: {
      frames: [
        {
          src: 'assets/img/characters/joe/jump/2.png',
          w: 59,
          h: 124,
          anchorX: 32,
          anchorY: 124,
          durationMs: 150,
        },
      ],
    },
    // Forward jump = a front flip: launch (row0 #0) → flip (row1 #22,23,24) on
    // the way up, recovery (row1 #21) on the way down. The flip frames span
    // rows and rotate, so they're composed into ONE uniform 88×130 canvas
    // with each frame's pixel centroid centred (anchorX 44) — bottom-alignment
    // then rotates the body around a stable pivot instead of bobbing. Same
    // uniform-canvas idea as Terry's jump-forward. (joe-flip.mjs.)
    jumpForward: {
      frames: [
        {
          src: 'assets/img/characters/joe/jump-forward/0.png',
          w: 88,
          h: 130,
          anchorX: 44,
          anchorY: 65,
          durationMs: 280,
        },
        {
          src: 'assets/img/characters/joe/jump-forward/1.png',
          w: 88,
          h: 130,
          anchorX: 44,
          anchorY: 65,
          durationMs: 130,
        },
        {
          src: 'assets/img/characters/joe/jump-forward/2.png',
          w: 88,
          h: 130,
          anchorX: 44,
          anchorY: 65,
          durationMs: 130,
        },
        {
          src: 'assets/img/characters/joe/jump-forward/3.png',
          w: 88,
          h: 130,
          anchorX: 44,
          anchorY: 65,
          durationMs: 120,
        },
      ],
    },
    jumpForwardFall: {
      frames: [
        {
          src: 'assets/img/characters/joe/jump-forward/fall0.png',
          w: 88,
          h: 130,
          anchorX: 44,
          anchorY: 65,
          durationMs: 150,
        },
      ],
    },
    // Backward jump = a back flip, built by reusing the forward-jump frames
    // (joe/jump-backward/, generated from jump-forward/): start = forward's
    // last frame (recovery), descent = forward's first (launch), and the flip
    // frames reversed + horizontally mirrored so the body spins the other way.
    // Same uniform 88×130 canvas; centroid sits at x=44 (canvas centre) so the
    // mirror leaves anchorX unchanged.
    jumpBackward: {
      frames: [
        {
          src: 'assets/img/characters/joe/jump-backward/0.png',
          w: 88,
          h: 130,
          anchorX: 44,
          anchorY: 65,
          durationMs: 180,
        },
        {
          src: 'assets/img/characters/joe/jump-backward/1.png',
          w: 88,
          h: 130,
          anchorX: 44,
          anchorY: 65,
          durationMs: 130,
        },
        {
          src: 'assets/img/characters/joe/jump-backward/2.png',
          w: 88,
          h: 130,
          anchorX: 44,
          anchorY: 65,
          durationMs: 130,
        },
        {
          src: 'assets/img/characters/joe/jump-backward/3.png',
          w: 88,
          h: 130,
          anchorX: 44,
          anchorY: 65,
          durationMs: 130,
        },
      ],
    },
    jumpBackwardFall: {
      frames: [
        {
          src: 'assets/img/characters/joe/jump-backward/fall0.png',
          w: 88,
          h: 130,
          anchorX: 44,
          anchorY: 65,
          durationMs: 150,
        },
      ],
    },
  };
}
