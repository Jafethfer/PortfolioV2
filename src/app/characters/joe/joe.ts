import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Character } from '../../components/character/character';
import {
  AnimationData,
  AnimationName,
  AttackButton,
  CharacterVoices,
  SpecialMove,
} from '../../models/character';
import {
  BAKURETSUKEN_FINISH_FRAMES,
  BAKURETSUKEN_FLURRY_FRAMES,
  HURRICANE_UPPER_FRAMES,
  SLASH_KICK_FRAMES,
  TIGER_KICK_FRAMES,
} from './joe-specials';
import { withDurations, totalDurationMs } from '../../helpers/special-frame';
import { GameLoopService } from '../../services/game-loop.service';
import { HurricaneUpper } from '../../projectiles/hurricane-upper/hurricane-upper';

/** Joe Higashi — concrete `Character` subclass (Muay Thai fighter, `JoeStage`). */
@Component({
  selector: 'app-joe',
  templateUrl: '../../components/character/character.html',
  styleUrl: './joe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Joe extends Character {
  protected override readonly spriteBaseHeight = 107;
  protected override readonly bodyAnchorX = 26;

  protected override readonly voices: CharacterVoices = {
    lightPunch: 'assets/sfx/joe/light-punch.mp3',
    heavyPunch: 'assets/sfx/joe/heavy-punch.mp3',
    lightKick: 'assets/sfx/joe/light-punch.mp3',
    heavyKick: 'assets/sfx/joe/heavy-punch.mp3',
    lightPunchWhiff: 'assets/sfx/misc/light-punch-whiff.mp3',
    heavyPunchWhiff: 'assets/sfx/misc/heavy-punch-whiff.mp3',
    lightKickWhiff: 'assets/sfx/misc/light-punch-whiff.mp3',
    heavyKickWhiff: 'assets/sfx/misc/heavy-punch-whiff.mp3',
    jump: 'assets/sfx/misc/jump.mp3',
    bakuretsuken: 'assets/sfx/joe/baku-retsu-ken-grunt.mp3',
    bakuretsukenSfx: 'assets/sfx/joe/baku-retsu-ken-sfx.mp3',
  };

  protected override readonly specials: readonly SpecialMove[] = [
    {
      name: 'slashKick',
      motion: ['left', 'right'],
      button: 'lightKick',
      voices: [{ src: 'assets/sfx/joe/slash-kick.mp3', frame: 4 }],
      whiffSrc: 'assets/sfx/misc/special-travel.mp3',
      travelDistancePct: 0.3,
      travelStartFrame: 4,
      travelEndFrame: 7,
      frames: { frames: withDurations(SLASH_KICK_FRAMES, [50, 40, 40, 40, 50, 60, 80, 150]) },
    },
    {
      name: 'slashKickHeavy',
      motion: ['left', 'right'],
      button: 'heavyKick',
      voices: [{ src: 'assets/sfx/joe/slash-kick.mp3', frame: 4 }],
      whiffSrc: 'assets/sfx/misc/special-travel.mp3',
      travelDistancePct: 0.6,
      travelStartFrame: 4,
      travelEndFrame: 7,
      frames: { frames: withDurations(SLASH_KICK_FRAMES, [60, 120, 90, 80, 70, 80, 100, 170]) },
    },
    {
      name: 'tigerKick',
      motion: ['down', 'up'],
      button: 'lightKick',
      voices: [{ src: 'assets/sfx/joe/tiger-kick.mp3', frame: 3 }],
      whiffSrc: 'assets/sfx/misc/special-travel.mp3',
      travelDistancePct: 0.05,
      travelStartFrame: 3,
      travelEndFrame: 9,
      arcHeight: 35,
      frames: { frames: withDurations(TIGER_KICK_FRAMES, [80, 60, 60, 70, 78, 78, 78, 78, 250]) },
    },
    {
      name: 'tigerKickHeavy',
      motion: ['down', 'up'],
      button: 'heavyKick',
      voices: [{ src: 'assets/sfx/joe/tiger-kick.mp3', frame: 3 }],
      whiffSrc: 'assets/sfx/misc/special-travel.mp3',
      travelDistancePct: 0.08,
      travelStartFrame: 3,
      travelEndFrame: 9,
      arcHeight: 90,
      frames: {
        frames: withDurations(TIGER_KICK_FRAMES, [150, 140, 110, 90, 92, 92, 92, 92, 458]),
      },
    },
    {
      name: 'hurricaneUpper',
      motion: ['down', 'right'],
      button: 'lightPunch',
      voices: [
        { src: 'assets/sfx/joe/hurricane-upper-1.mp3', frame: 0 },
        { src: 'assets/sfx/joe/hurricane-upper-2.mp3', frame: 4 },
      ],
      frames: { frames: withDurations(HURRICANE_UPPER_FRAMES, [60, 60, 70, 70, 150]) },
      projectile: {
        componentClass: HurricaneUpper,
        spawnFrame: 4,
        spawnOffsetX: 40,
        spawnOffsetY: 0,
      },
    },
    {
      name: 'hurricaneUpperHeavy',
      motion: ['down', 'right'],
      button: 'heavyPunch',
      voices: [
        { src: 'assets/sfx/joe/hurricane-upper-1.mp3', frame: 0 },
        { src: 'assets/sfx/joe/hurricane-upper-2.mp3', frame: 4 },
      ],
      frames: { frames: withDurations(HURRICANE_UPPER_FRAMES, [80, 100, 90, 90, 170]) },
      projectile: {
        componentClass: HurricaneUpper,
        spawnFrame: 4,
        spawnOffsetX: 40,
        spawnOffsetY: 0,
        speed: 36,
      },
    },
    // Bakuretsuken — Joe's mash-punch flurry. Empty motion: it never fires via
    // the base's motion dispatch. The `MashFlurry` controller (see the bottom
    // of the class) counts rapid punch presses and plays these clips once: the
    // loop for both light and heavy, chased by the finisher for heavy only.
    {
      name: 'bakuretsuken',
      motion: [],
      button: 'lightPunch',
      frames: {
        loop: true,
        frames: withDurations(BAKURETSUKEN_FLURRY_FRAMES, [90, 90, 90, 90, 90, 90]),
      },
    },
    {
      name: 'bakuretsukenFinish',
      motion: [],
      button: 'heavyPunch',
      frames: { frames: withDurations(BAKURETSUKEN_FINISH_FRAMES, [60, 70, 250]) },
    },
  ];

  protected override readonly animationFrames: Partial<Record<AnimationName, AnimationData>> = {
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
    forward: {
      loop: true,
      frames: [
        {
          src: 'assets/img/characters/joe/walk/0.png',
          w: 58,
          h: 107,
          anchorX: 29,
          anchorY: 107,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/joe/walk/1.png',
          w: 53,
          h: 106,
          anchorX: 26,
          anchorY: 106,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/joe/walk/2.png',
          w: 51,
          h: 109,
          anchorX: 25,
          anchorY: 109,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/joe/walk/3.png',
          w: 52,
          h: 108,
          anchorX: 26,
          anchorY: 108,
          durationMs: 175,
        },
      ],
    },
    backwards: {
      loop: true,
      frames: [
        {
          src: 'assets/img/characters/joe/backwards/0.png',
          w: 52,
          h: 108,
          anchorX: 26,
          anchorY: 108,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/joe/backwards/1.png',
          w: 50,
          h: 106,
          anchorX: 25,
          anchorY: 106,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/joe/backwards/2.png',
          w: 51,
          h: 108,
          anchorX: 25,
          anchorY: 108,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/joe/backwards/3.png',
          w: 49,
          h: 109,
          anchorX: 24,
          anchorY: 109,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/joe/backwards/4.png',
          w: 48,
          h: 109,
          anchorX: 24,
          anchorY: 109,
          durationMs: 175,
        },
      ],
    },
    backstep: {
      frames: [
        {
          src: 'assets/img/characters/joe/backstep/0.png',
          w: 70,
          h: 104,
          anchorX: 28,
          anchorY: 104,
          durationMs: 380,
        },
        {
          src: 'assets/img/characters/joe/backstep/1.png',
          w: 53,
          h: 95,
          anchorX: 21,
          anchorY: 95,
          durationMs: 70,
        },
      ],
    },
    crouch: {
      frames: [
        {
          src: 'assets/img/characters/joe/crouch/0.png',
          w: 53,
          h: 95,
          anchorX: 21,
          anchorY: 95,
          durationMs: 50,
        },
        {
          src: 'assets/img/characters/joe/crouch/1.png',
          w: 58,
          h: 71,
          anchorX: 29,
          anchorY: 71,
          durationMs: 100,
        },
      ],
    },
    crouchStill: {
      frames: [
        {
          src: 'assets/img/characters/joe/crouch/1.png',
          w: 58,
          h: 71,
          anchorX: 29,
          anchorY: 71,
          durationMs: 100,
        },
      ],
    },
    crouchForward: {
      loop: true,
      bounce: true,
      frames: [
        {
          src: 'assets/img/characters/joe/crouch-forward/0.png',
          w: 50,
          h: 71,
          anchorX: 25,
          anchorY: 71,
          durationMs: 200,
        },
        {
          src: 'assets/img/characters/joe/crouch-forward/1.png',
          w: 49,
          h: 73,
          anchorX: 24,
          anchorY: 73,
          durationMs: 200,
        },
        {
          src: 'assets/img/characters/joe/crouch-forward/2.png',
          w: 45,
          h: 74,
          anchorX: 22,
          anchorY: 74,
          durationMs: 200,
        },
      ],
    },
    jumpUp: {
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
    lightPunch: {
      frames: [
        {
          src: 'assets/img/characters/joe/light-punch/0.png',
          w: 68,
          h: 106,
          anchorX: 24,
          anchorY: 106,
          durationMs: 50,
        },
        {
          src: 'assets/img/characters/joe/light-punch/1.png',
          w: 88,
          h: 106,
          anchorX: 24,
          anchorY: 106,
          durationMs: 100,
        },
        {
          src: 'assets/img/characters/joe/light-punch/0.png',
          w: 68,
          h: 106,
          anchorX: 24,
          anchorY: 106,
          durationMs: 50,
        },
      ],
    },
    heavyPunch: {
      frames: [
        {
          src: 'assets/img/characters/joe/heavy-punch/0.png',
          w: 64,
          h: 108,
          anchorX: 29,
          anchorY: 108,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/joe/heavy-punch/1.png',
          w: 56,
          h: 106,
          anchorX: 23,
          anchorY: 106,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/joe/heavy-punch/2.png',
          w: 98,
          h: 104,
          anchorX: 24,
          anchorY: 104,
          durationMs: 200,
        },
        {
          src: 'assets/img/characters/joe/heavy-punch/1.png',
          w: 56,
          h: 106,
          anchorX: 23,
          anchorY: 106,
          durationMs: 80,
        },
      ],
    },
    lightKick: {
      frames: [
        {
          src: 'assets/img/characters/joe/light-kick/0.png',
          w: 61,
          h: 104,
          anchorX: 12,
          anchorY: 104,
          durationMs: 45,
        },
        {
          src: 'assets/img/characters/joe/light-kick/1.png',
          w: 55,
          h: 106,
          anchorX: 4,
          anchorY: 106,
          durationMs: 100,
        },
        {
          src: 'assets/img/characters/joe/light-kick/2.png',
          w: 86,
          h: 109,
          anchorX: -2,
          anchorY: 109,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/joe/light-kick/1.png',
          w: 55,
          h: 106,
          anchorX: 4,
          anchorY: 106,
          durationMs: 100,
        },
        {
          src: 'assets/img/characters/joe/light-kick/0.png',
          w: 61,
          h: 104,
          anchorX: 12,
          anchorY: 104,
          durationMs: 45,
        },
      ],
    },
    heavyKick: {
      frames: [
        {
          src: 'assets/img/characters/joe/heavy-kick/0.png',
          w: 51,
          h: 104,
          anchorX: 22,
          anchorY: 104,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/joe/heavy-kick/1.png',
          w: 45,
          h: 101,
          anchorX: 14,
          anchorY: 101,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/joe/heavy-kick/2.png',
          w: 63,
          h: 94,
          anchorX: 11,
          anchorY: 94,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/joe/heavy-kick/3.png',
          w: 88,
          h: 106,
          anchorX: 9,
          anchorY: 106,
          durationMs: 160,
        },
        {
          src: 'assets/img/characters/joe/heavy-kick/4.png',
          w: 55,
          h: 106,
          anchorX: 4,
          anchorY: 106,
          durationMs: 100,
        },
        {
          src: 'assets/img/characters/joe/heavy-kick/5.png',
          w: 61,
          h: 104,
          anchorX: 12,
          anchorY: 104,
          durationMs: 120,
        },
      ],
    },
    airLightPunch: {
      frames: [
        {
          src: 'assets/img/characters/joe/air-light-punch/0.png',
          w: 57,
          h: 84,
          anchorX: 28,
          anchorY: 84,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/joe/air-light-punch/1.png',
          w: 77,
          h: 80,
          anchorX: 44,
          anchorY: 80,
          durationMs: 2000,
        },
      ],
    },
    airHeavyPunch: {
      frames: [
        {
          src: 'assets/img/characters/joe/air-heavy-punch/0.png',
          w: 49,
          h: 85,
          anchorX: 24,
          anchorY: 85,
          durationMs: 100,
        },
        {
          src: 'assets/img/characters/joe/air-heavy-punch/1.png',
          w: 87,
          h: 74,
          anchorX: 46,
          anchorY: 74,
          durationMs: 220,
        },
      ],
    },
    airHeavyRecover: {
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
    airLightKickUp: {
      frames: [
        {
          src: 'assets/img/characters/joe/air-light-kick-up/0.png',
          w: 77,
          h: 82,
          anchorX: 43,
          anchorY: 82,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/joe/air-light-kick-up/1.png',
          w: 89,
          h: 89,
          anchorX: 45,
          anchorY: 89,
          durationMs: 2000,
        },
      ],
    },
    airLightKick: {
      frames: [
        {
          src: 'assets/img/characters/joe/air-light-kick/0.png',
          w: 45,
          h: 112,
          anchorX: 24,
          anchorY: 112,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/joe/air-light-kick/1.png',
          w: 79,
          h: 105,
          anchorX: 35,
          anchorY: 105,
          durationMs: 2000,
        },
      ],
    },
    airHeavyKickUp: {
      frames: [
        {
          src: 'assets/img/characters/joe/air-heavy-kick-up/0.png',
          w: 84,
          h: 98,
          anchorX: 44,
          anchorY: 98,
          durationMs: 160,
        },
        {
          src: 'assets/img/characters/joe/air-heavy-kick-up/1.png',
          w: 116,
          h: 72,
          anchorX: 50,
          anchorY: 72,
          durationMs: 350,
        },
      ],
    },
    airHeavyKick: {
      frames: [
        {
          src: 'assets/img/characters/joe/air-heavy-kick/0.png',
          w: 49,
          h: 111,
          anchorX: 28,
          anchorY: 111,
          durationMs: 100,
        },
        {
          src: 'assets/img/characters/joe/air-heavy-kick/1.png',
          w: 104,
          h: 95,
          anchorX: 50,
          anchorY: 95,
          durationMs: 220,
        },
      ],
    },
    crouchLightPunch: {
      frames: [
        {
          src: 'assets/img/characters/joe/crouch-light-punch/0.png',
          w: 53,
          h: 74,
          anchorX: 24,
          anchorY: 74,
          durationMs: 100,
        },
        {
          src: 'assets/img/characters/joe/crouch-light-punch/1.png',
          w: 74,
          h: 71,
          anchorX: 24,
          anchorY: 71,
          durationMs: 100,
        },
      ],
    },
    crouchHeavyPunch: {
      frames: [
        {
          src: 'assets/img/characters/joe/crouch-heavy-punch/0.png',
          w: 56,
          h: 70,
          anchorX: 29,
          anchorY: 70,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/joe/crouch-heavy-punch/1.png',
          w: 53,
          h: 69,
          anchorX: 24,
          anchorY: 69,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/joe/crouch-heavy-punch/2.png',
          w: 94,
          h: 65,
          anchorX: 24,
          anchorY: 65,
          durationMs: 200,
        },
        {
          src: 'assets/img/characters/joe/crouch-heavy-punch/1.png',
          w: 53,
          h: 69,
          anchorX: 24,
          anchorY: 69,
          durationMs: 80,
        },
      ],
    },
    crouchLightKick: {
      frames: [
        {
          src: 'assets/img/characters/joe/crouch-light-kick/0.png',
          w: 63,
          h: 65,
          anchorX: 39,
          anchorY: 65,
          durationMs: 60,
        },
        {
          src: 'assets/img/characters/joe/crouch-light-kick/1.png',
          w: 87,
          h: 64,
          anchorX: 28,
          anchorY: 64,
          durationMs: 120,
        },
      ],
    },
    crouchHeavyKick: {
      travelDistancePct: 0.15,
      travelStartFrame: 1,
      travelEndFrame: 3,
      frames: [
        {
          src: 'assets/img/characters/joe/crouch-heavy-kick/0.png',
          w: 63,
          h: 65,
          anchorX: 39,
          anchorY: 65,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/joe/crouch-heavy-kick/1.png',
          w: 58,
          h: 64,
          anchorX: 22,
          anchorY: 64,
          durationMs: 90,
        },
        {
          src: 'assets/img/characters/joe/crouch-heavy-kick/2.png',
          w: 82,
          h: 54,
          anchorX: 25,
          anchorY: 54,
          durationMs: 200,
        },
        {
          src: 'assets/img/characters/joe/crouch-heavy-kick/1.png',
          w: 58,
          h: 64,
          anchorX: 22,
          anchorY: 64,
          durationMs: 100,
        },
      ],
    },
  };

  // ── Bakuretsuken (mash-punch flurry) ──────────────────────────────────────
  // Three rapid punch presses trigger ONE flurry: light plays the loop then
  // ends; heavy plays the loop then the knockback finisher (grunt on its first
  // frame). Re-triggerable; mashing never sustains it endlessly. All the
  // mash/timing logic lives in the shared `MashFlurry` controller — here we
  // only supply the per-button config.
  private readonly _flurryLoopMs =
    2 * totalDurationMs(this.specials.find((s) => s.name === 'bakuretsuken')!.frames.frames);
  private readonly _flurryFinishMs = totalDurationMs(
    this.specials.find((s) => s.name === 'bakuretsukenFinish')!.frames.frames,
  );
  private readonly _flurry = this._createMashFlurry({
    variants: [
      {
        button: 'lightPunch',
        loopAnimation: 'bakuretsuken',
        loopDurationMs: this._flurryLoopMs,
      },
      {
        button: 'heavyPunch',
        loopAnimation: 'bakuretsuken',
        loopDurationMs: this._flurryLoopMs,
        finishAnimation: 'bakuretsukenFinish',
        finishDurationMs: this._flurryFinishMs,
        finishVoiceSrc: this.voices['bakuretsuken'],
      },
    ],
    triggerCount: 3,
    mashWindowMs: 220,
    tickMs: GameLoopService.TICK_MS,
    whooshSrc: this.voices['bakuretsukenSfx'],
  });

  protected override interceptAttack(button: AttackButton): boolean {
    return this._flurry.press(button);
  }

  protected override tickCustomAttack(): boolean {
    return this._flurry.tick();
  }
}
