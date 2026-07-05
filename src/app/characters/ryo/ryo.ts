import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Character } from '../../components/character/character';
import {
  AnimationData,
  AnimationName,
  AttackButton,
  CharacterVoices,
  SpecialMove,
} from '../../models/character';
import { withDurations, totalDurationMs } from '../../helpers/special-frame';
import { GameLoopService } from '../../services/game-loop.service';
import {
  KO_OH_KEN_FRAMES,
  HAOH_SHOKOU_KEN_FRAMES,
  ZAN_RETSU_KEN_FRAMES,
  HIEN_SHIPPU_KYAKU_FRAMES,
  KOHOU_FRAMES,
} from './ryo-specials';
import { KoOhKen } from '../../projectiles/ko-oh-ken/ko-oh-ken';
import { HaohShokouKen } from '../../projectiles/haoh-shokou-ken/haoh-shokou-ken';

/** Ryo Sakazaki — concrete `Character` subclass (Kyokugen karate, `RyoStage`). */
@Component({
  selector: 'app-ryo',
  templateUrl: '../../components/character/character.html',
  styleUrl: './ryo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ryo extends Character {
  protected override readonly spriteBaseHeight = 107;
  protected override readonly bodyAnchorX = 26;

  protected override readonly specials: readonly SpecialMove[] = [
    {
      name: 'koOhKen',
      motion: ['down', 'right'],
      button: 'lightPunch',
      voices: [{ src: 'assets/sfx/ryo/ko-oh-ken.mp3', frame: 2 }],
      frames: { frames: withDurations(KO_OH_KEN_FRAMES, [50, 60, 60, 60, 70, 90, 60, 130]) },
      projectile: {
        componentClass: KoOhKen,
        spawnFrame: 5,
        spawnOffsetX: 48,
        spawnOffsetY: -55,
      },
    },
    {
      name: 'koOhKenHeavy',
      motion: ['down', 'right'],
      button: 'heavyPunch',
      voices: [{ src: 'assets/sfx/ryo/ko-oh-ken.mp3', frame: 2 }],
      frames: { frames: withDurations(KO_OH_KEN_FRAMES, [60, 90, 90, 80, 90, 100, 70, 150]) },
      projectile: {
        componentClass: KoOhKen,
        spawnFrame: 5,
        spawnOffsetX: 48,
        spawnOffsetY: -55,
        speed: 36,
      },
    },
    {
      name: 'haohShokouKen',
      motion: ['left', 'down', 'right'],
      button: 'heavyPunch',
      voices: [
        { src: 'assets/sfx/ryo/haoh-shokou-ken-1.mp3', frame: 0 },
        { src: 'assets/sfx/ryo/haoh-shoukou-ken-2.mp3', frame: 5 },
      ],
      frames: { frames: withDurations(HAOH_SHOKOU_KEN_FRAMES, [100, 100, 100, 100, 200, 400]) },
      projectile: {
        componentClass: HaohShokouKen,
        spawnFrame: 5,
        spawnOffsetX: 48,
        spawnOffsetY: -25,
      },
    },
    // Zan-Retsu-Ken — Ryo's mash-punch flurry. Empty motion: it never fires via
    // the base's motion dispatch. The `MashFlurry` controller (see the bottom
    // of the class) counts rapid heavy-punch presses and plays this clip once.
    {
      name: 'zanRetsuKen',
      motion: [],
      button: 'heavyPunch',
      frames: {
        frames: withDurations(
          ZAN_RETSU_KEN_FRAMES,
          [70, 55, 55, 55, 55, 55, 55, 55, 70, 55, 55, 55, 55, 55, 55, 55, 55, 200],
        ),
      },
    },
    // Hien-Shippu-Kyaku — quarter-circle-back kick that leaps forward on an arc.
    // Windup frames 0–1 stay grounded; the airborne kick (2–8) carries the X
    // travel + Y arc; frame 9 is the grounded landing recovery.
    {
      name: 'hienShippuKyaku',
      motion: ['down', 'left'],
      button: 'lightKick',
      voices: [{ src: 'assets/sfx/ryo/hien-shippu-kyaku.mp3', frame: 2 }],
      whiffSrc: 'assets/sfx/misc/special-travel.mp3',
      travelDistancePct: 0.4,
      travelStartFrame: 2,
      // Light drops the two extra side-kick frames (source 4 & 5), so its
      // landing lands at index 7 instead of 9.
      travelEndFrame: 7,
      arcHeight: 26,
      frames: {
        frames: withDurations(
          HIEN_SHIPPU_KYAKU_FRAMES.filter((_, i) => i !== 4 && i !== 5),
          [95, 80, 100, 100, 100, 100, 115, 90],
        ),
      },
    },
    {
      name: 'hienShippuKyakuHeavy',
      motion: ['down', 'left'],
      button: 'heavyKick',
      voices: [{ src: 'assets/sfx/ryo/hien-shippu-kyaku.mp3', frame: 2 }],
      whiffSrc: 'assets/sfx/misc/special-travel.mp3',
      travelDistancePct: 0.55,
      travelStartFrame: 2,
      travelEndFrame: 9,
      arcHeight: 38,
      frames: {
        frames: withDurations(
          HIEN_SHIPPU_KYAKU_FRAMES,
          [95, 80, 100, 100, 100, 100, 100, 100, 115, 90],
        ),
      },
    },
    // Kohou — rising anti-air uppercut (down→up). Windup frames 0–3 stay
    // grounded; the airborne rise (4–6) carries the Y arc, and frame 7 (reused
    // jump-fall sprite) is the descent as the parabola comes back down.
    {
      name: 'kohou',
      motion: ['down', 'up'],
      button: 'lightPunch',
      voices: [{ src: 'assets/sfx/ryo/light-punch.mp3', frame: 4 }],
      whiffSrc: 'assets/sfx/misc/special-travel.mp3',
      travelDistancePct: 0.04,
      travelStartFrame: 4,
      travelEndFrame: 8,
      arcHeight: 44,
      frames: {
        frames: withDurations(KOHOU_FRAMES, [26, 26, 26, 34, 85, 85, 110, 150]),
      },
    },
    {
      name: 'kohouHeavy',
      motion: ['down', 'up'],
      button: 'heavyPunch',
      voices: [{ src: 'assets/sfx/ryo/heavy-punch.mp3', frame: 4 }],
      whiffSrc: 'assets/sfx/misc/special-travel.mp3',
      travelDistancePct: 0.07,
      travelStartFrame: 4,
      travelEndFrame: 8,
      arcHeight: 60,
      frames: {
        frames: withDurations(KOHOU_FRAMES, [100, 90, 80, 90, 115, 115, 150, 240]),
      },
    },
  ];

  protected override readonly voices: CharacterVoices = {
    lightPunch: 'assets/sfx/ryo/light-punch.mp3',
    heavyPunch: 'assets/sfx/ryo/heavy-punch.mp3',
    lightKick: 'assets/sfx/ryo/light-punch.mp3',
    heavyKick: 'assets/sfx/ryo/heavy-punch.mp3',
    lightPunchWhiff: 'assets/sfx/misc/light-punch-whiff.mp3',
    heavyPunchWhiff: 'assets/sfx/misc/heavy-punch-whiff.mp3',
    lightKickWhiff: 'assets/sfx/misc/light-punch-whiff.mp3',
    heavyKickWhiff: 'assets/sfx/misc/heavy-punch-whiff.mp3',
    jump: 'assets/sfx/misc/jump.mp3',
    zanRetsuKen: 'assets/sfx/ryo/zan-retsu-ken.mp3',
    zanRetsuKenSfx: 'assets/sfx/ryo/zan-retsu-ken-sfx.mp3',
  };

  protected override readonly animationFrames: Partial<Record<AnimationName, AnimationData>> = {
    idle: {
      loop: true,
      bounce: true,
      frames: [
        {
          src: 'assets/img/characters/ryo/idle/0.png',
          w: 62,
          h: 103,
          anchorX: 26,
          anchorY: 103,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/ryo/idle/1.png',
          w: 60,
          h: 104,
          anchorX: 26,
          anchorY: 104,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/ryo/idle/2.png',
          w: 58,
          h: 106,
          anchorX: 26,
          anchorY: 106,
          durationMs: 150,
        },
        {
          src: 'assets/img/characters/ryo/idle/3.png',
          w: 55,
          h: 107,
          anchorX: 25,
          anchorY: 107,
          durationMs: 150,
        },
      ],
    },
    forward: {
      loop: true,
      frames: [
        {
          src: 'assets/img/characters/ryo/walk/0.png',
          w: 60,
          h: 104,
          anchorX: 32,
          anchorY: 104,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/walk/1.png',
          w: 60,
          h: 103,
          anchorX: 31,
          anchorY: 103,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/walk/2.png',
          w: 56,
          h: 104,
          anchorX: 29,
          anchorY: 104,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/walk/3.png',
          w: 60,
          h: 104,
          anchorX: 32,
          anchorY: 104,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/walk/4.png',
          w: 57,
          h: 105,
          anchorX: 28,
          anchorY: 105,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/walk/5.png',
          w: 57,
          h: 106,
          anchorX: 28,
          anchorY: 106,
          durationMs: 175,
        },
      ],
    },
    backwards: {
      loop: true,
      frames: [
        {
          src: 'assets/img/characters/ryo/backwards/0.png',
          w: 53,
          h: 107,
          anchorX: 31,
          anchorY: 107,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/backwards/1.png',
          w: 54,
          h: 106,
          anchorX: 31,
          anchorY: 106,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/backwards/2.png',
          w: 56,
          h: 105,
          anchorX: 32,
          anchorY: 105,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/backwards/3.png',
          w: 54,
          h: 105,
          anchorX: 32,
          anchorY: 105,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/backwards/4.png',
          w: 53,
          h: 104,
          anchorX: 31,
          anchorY: 104,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/backwards/5.png',
          w: 53,
          h: 105,
          anchorX: 32,
          anchorY: 105,
          durationMs: 175,
        },
      ],
    },
    backstep: {
      frames: [
        {
          src: 'assets/img/characters/ryo/backstep/0.png',
          w: 88,
          h: 94,
          anchorX: 44,
          anchorY: 94,
          durationMs: 380,
        },
        {
          src: 'assets/img/characters/ryo/backstep/1.png',
          w: 76,
          h: 90,
          anchorX: 36,
          anchorY: 90,
          durationMs: 70,
        },
      ],
    },
    crouch: {
      frames: [
        {
          src: 'assets/img/characters/ryo/crouch/0.png',
          w: 59,
          h: 89,
          anchorX: 26,
          anchorY: 89,
          durationMs: 45,
        },
        {
          src: 'assets/img/characters/ryo/crouch/1.png',
          w: 58,
          h: 70,
          anchorX: 27,
          anchorY: 70,
          durationMs: 150,
        },
      ],
    },
    crouchStill: {
      frames: [
        {
          src: 'assets/img/characters/ryo/crouch/1.png',
          w: 58,
          h: 70,
          anchorX: 27,
          anchorY: 70,
          durationMs: 1000,
        },
      ],
    },
    crouchForward: {
      loop: true,
      frames: [
        {
          src: 'assets/img/characters/ryo/crouch-forward/0.png',
          w: 53,
          h: 72,
          anchorX: 30,
          anchorY: 72,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/crouch-forward/1.png',
          w: 54,
          h: 74,
          anchorX: 25,
          anchorY: 74,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/crouch-forward/2.png',
          w: 58,
          h: 72,
          anchorX: 28,
          anchorY: 72,
          durationMs: 175,
        },
        {
          src: 'assets/img/characters/ryo/crouch-forward/1.png',
          w: 54,
          h: 74,
          anchorX: 25,
          anchorY: 74,
          durationMs: 175,
        },
      ],
    },
    crouchLightPunch: {
      frames: [
        {
          src: 'assets/img/characters/ryo/crouch-light-punch/0.png',
          w: 63,
          h: 72,
          anchorX: 27,
          anchorY: 72,
          durationMs: 45,
        },
        {
          src: 'assets/img/characters/ryo/crouch-light-punch/1.png',
          w: 87,
          h: 72,
          anchorX: 27,
          anchorY: 72,
          durationMs: 95,
        },
      ],
    },
    crouchHeavyPunch: {
      frames: [
        {
          src: 'assets/img/characters/ryo/crouch-heavy-punch/0.png',
          w: 66,
          h: 85,
          anchorX: 27,
          anchorY: 85,
          durationMs: 55,
        },
        {
          src: 'assets/img/characters/ryo/crouch-heavy-punch/1.png',
          w: 60,
          h: 82,
          anchorX: 27,
          anchorY: 82,
          durationMs: 45,
        },
        {
          src: 'assets/img/characters/ryo/crouch-heavy-punch/2.png',
          w: 63,
          h: 96,
          anchorX: 26,
          anchorY: 96,
          durationMs: 45,
        },
        {
          src: 'assets/img/characters/ryo/crouch-heavy-punch/3.png',
          w: 80,
          h: 133,
          anchorX: 25,
          anchorY: 133,
          durationMs: 130,
        },
        {
          src: 'assets/img/characters/ryo/crouch-heavy-punch/2.png',
          w: 63,
          h: 96,
          anchorX: 26,
          anchorY: 96,
          durationMs: 45,
        },
        {
          src: 'assets/img/characters/ryo/crouch-heavy-punch/1.png',
          w: 60,
          h: 82,
          anchorX: 27,
          anchorY: 82,
          durationMs: 45,
        },
        {
          src: 'assets/img/characters/ryo/crouch-heavy-punch/0.png',
          w: 66,
          h: 85,
          anchorX: 27,
          anchorY: 85,
          durationMs: 55,
        },
      ],
    },
    crouchLightKick: {
      frames: [
        {
          src: 'assets/img/characters/ryo/crouch-light-kick/0.png',
          w: 57,
          h: 66,
          anchorX: 28,
          anchorY: 66,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/ryo/crouch-light-kick/1.png',
          w: 110,
          h: 62,
          anchorX: 29,
          anchorY: 62,
          durationMs: 140,
        },
      ],
    },
    crouchHeavyKick: {
      frames: [
        {
          src: 'assets/img/characters/ryo/crouch-heavy-kick/0.png',
          w: 74,
          h: 66,
          anchorX: 29,
          anchorY: 66,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/ryo/crouch-heavy-kick/1.png',
          w: 68,
          h: 67,
          anchorX: 27,
          anchorY: 67,
          durationMs: 75,
        },
        {
          src: 'assets/img/characters/ryo/crouch-heavy-kick/2.png',
          w: 64,
          h: 70,
          anchorX: 27,
          anchorY: 70,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/ryo/crouch-heavy-kick/3.png',
          w: 110,
          h: 69,
          anchorX: 28,
          anchorY: 69,
          durationMs: 200,
        },
        {
          src: 'assets/img/characters/ryo/crouch-heavy-kick/4.png',
          w: 45,
          h: 72,
          anchorX: 27,
          anchorY: 72,
          durationMs: 120,
        },
      ],
    },
    jumpUp: {
      frames: [
        {
          src: 'assets/img/characters/ryo/jump-up/0.png',
          w: 51,
          h: 119,
          anchorX: 27,
          anchorY: 119,
          durationMs: 130,
        },
        {
          src: 'assets/img/characters/ryo/jump-up/1.png',
          w: 59,
          h: 93,
          anchorX: 32,
          anchorY: 93,
          durationMs: 130,
        },
        {
          src: 'assets/img/characters/ryo/jump-up/2.png',
          w: 53,
          h: 74,
          anchorX: 32,
          anchorY: 74,
          durationMs: 130,
        },
        {
          src: 'assets/img/characters/ryo/jump-up/3.png',
          w: 59,
          h: 93,
          anchorX: 32,
          anchorY: 93,
          durationMs: 130,
        },
      ],
    },
    jumpFall: {
      frames: [
        {
          src: 'assets/img/characters/ryo/jump-fall/0.png',
          w: 53,
          h: 103,
          anchorX: 30,
          anchorY: 103,
          durationMs: 160,
        },
        {
          src: 'assets/img/characters/ryo/jump-fall/1.png',
          w: 51,
          h: 118,
          anchorX: 27,
          anchorY: 118,
          durationMs: 160,
        },
      ],
    },
    jumpForward: {
      frames: [
        {
          src: 'assets/img/characters/ryo/jump-forward/0.png',
          w: 51,
          h: 118,
          anchorX: 22,
          anchorY: 118,
          durationMs: 180,
        },
        {
          src: 'assets/img/characters/ryo/jump-forward/1.png',
          w: 73,
          h: 80,
          anchorX: 38,
          anchorY: 80,
          durationMs: 180,
        },
        {
          src: 'assets/img/characters/ryo/jump-forward/2.png',
          w: 75,
          h: 43,
          anchorX: 38,
          anchorY: 43,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/ryo/jump-forward/3.png',
          w: 43,
          h: 75,
          anchorX: 22,
          anchorY: 75,
          durationMs: 80,
        },
      ],
    },
    jumpForwardFall: {
      frames: [
        {
          src: 'assets/img/characters/ryo/jump-forward/4.png',
          w: 110,
          h: 45,
          anchorX: 50,
          anchorY: 45,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/ryo/jump-forward/5.png',
          w: 69,
          h: 107,
          anchorX: 38,
          anchorY: 107,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/ryo/jump-forward/0.png',
          w: 51,
          h: 118,
          anchorX: 22,
          anchorY: 118,
          durationMs: 180,
        },
      ],
    },
    // Backward jump = the forward somersault run in reverse (a backflip),
    // reusing the same jump-forward sprites.
    jumpBackward: {
      frames: [
        {
          src: 'assets/img/characters/ryo/jump-forward/5.png',
          w: 69,
          h: 107,
          anchorX: 38,
          anchorY: 107,
          durationMs: 250,
        },
        {
          src: 'assets/img/characters/ryo/jump-forward/4.png',
          w: 110,
          h: 45,
          anchorX: 50,
          anchorY: 45,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/ryo/jump-forward/3.png',
          w: 43,
          h: 75,
          anchorX: 22,
          anchorY: 75,
          durationMs: 80,
        },
      ],
    },
    jumpBackwardFall: {
      frames: [
        {
          src: 'assets/img/characters/ryo/jump-forward/2.png',
          w: 75,
          h: 43,
          anchorX: 38,
          anchorY: 43,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/ryo/jump-forward/1.png',
          w: 73,
          h: 80,
          anchorX: 38,
          anchorY: 80,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/ryo/jump-forward/0.png',
          w: 51,
          h: 118,
          anchorX: 22,
          anchorY: 118,
          durationMs: 180,
        },
      ],
    },
    airLightPunch: {
      frames: [
        {
          src: 'assets/img/characters/ryo/air-light-punch/0.png',
          w: 63,
          h: 79,
          anchorX: 28,
          anchorY: 79,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/ryo/air-light-punch/1.png',
          w: 91,
          h: 79,
          anchorX: 40,
          anchorY: 79,
          durationMs: 2000,
        },
      ],
    },
    airHeavyPunch: {
      frames: [
        {
          src: 'assets/img/characters/ryo/air-heavy-punch/0.png',
          w: 63,
          h: 79,
          anchorX: 28,
          anchorY: 79,
          durationMs: 80,
        },
        {
          src: 'assets/img/characters/ryo/air-heavy-punch/1.png',
          w: 91,
          h: 79,
          anchorX: 40,
          anchorY: 79,
          durationMs: 130,
        },
      ],
    },
    // Post-heavy-air recovery — the base swaps to this after a heavy aerial's
    // frames finish. Reuses the descending jump-fall sprites (row1 #6/#7).
    airHeavyRecover: {
      frames: [
        {
          src: 'assets/img/characters/ryo/jump-fall/0.png',
          w: 53,
          h: 103,
          anchorX: 30,
          anchorY: 103,
          durationMs: 120,
        },
        {
          src: 'assets/img/characters/ryo/jump-fall/1.png',
          w: 51,
          h: 118,
          anchorX: 27,
          anchorY: 118,
          durationMs: 2000,
        },
      ],
    },
    airLightKickUp: {
      frames: [
        {
          src: 'assets/img/characters/ryo/air-light-kick/0.png',
          w: 49,
          h: 75,
          anchorX: 23,
          anchorY: 75,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/ryo/air-light-kick/1.png',
          w: 115,
          h: 91,
          anchorX: 34,
          anchorY: 91,
          durationMs: 2000,
        },
      ],
    },
    airLightKick: {
      frames: [
        {
          src: 'assets/img/characters/ryo/air-light-kick-fwd/0.png',
          w: 49,
          h: 75,
          anchorX: 23,
          anchorY: 75,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/ryo/air-light-kick-fwd/1.png',
          w: 96,
          h: 81,
          anchorX: 37,
          anchorY: 81,
          durationMs: 2000,
        },
      ],
    },
    // Heavy air kicks reuse the light-kick sprites; the difference is the base
    // schedules airHeavyRecover after these frames (so the extend frame gets a
    // short duration instead of the light variant's hold-until-landing).
    airHeavyKickUp: {
      frames: [
        {
          src: 'assets/img/characters/ryo/air-light-kick/0.png',
          w: 49,
          h: 75,
          anchorX: 23,
          anchorY: 75,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/ryo/air-light-kick/1.png',
          w: 115,
          h: 91,
          anchorX: 34,
          anchorY: 91,
          durationMs: 160,
        },
      ],
    },
    airHeavyKick: {
      frames: [
        {
          src: 'assets/img/characters/ryo/air-light-kick-fwd/0.png',
          w: 49,
          h: 75,
          anchorX: 23,
          anchorY: 75,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/ryo/air-light-kick-fwd/1.png',
          w: 96,
          h: 81,
          anchorX: 37,
          anchorY: 81,
          durationMs: 160,
        },
      ],
    },
    lightPunch: {
      frames: [
        {
          src: 'assets/img/characters/ryo/light-punch/0.png',
          w: 54,
          h: 104,
          anchorX: 23,
          anchorY: 104,
          durationMs: 40,
        },
        {
          src: 'assets/img/characters/ryo/light-punch/1.png',
          w: 66,
          h: 104,
          anchorX: 25,
          anchorY: 104,
          durationMs: 45,
        },
        {
          src: 'assets/img/characters/ryo/light-punch/2.png',
          w: 83,
          h: 104,
          anchorX: 22,
          anchorY: 104,
          durationMs: 95,
        },
      ],
    },
    heavyPunch: {
      frames: [
        {
          src: 'assets/img/characters/ryo/heavy-punch/0.png',
          w: 69,
          h: 105,
          anchorX: 28,
          anchorY: 105,
          durationMs: 60,
        },
        {
          src: 'assets/img/characters/ryo/heavy-punch/1.png',
          w: 69,
          h: 104,
          anchorX: 35,
          anchorY: 104,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/ryo/heavy-punch/2.png',
          w: 101,
          h: 103,
          anchorX: 38,
          anchorY: 103,
          durationMs: 90,
        },
        {
          src: 'assets/img/characters/ryo/heavy-punch/1.png',
          w: 69,
          h: 104,
          anchorX: 35,
          anchorY: 104,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/ryo/heavy-punch/0.png',
          w: 69,
          h: 105,
          anchorX: 28,
          anchorY: 105,
          durationMs: 60,
        },
      ],
    },
    lightKick: {
      frames: [
        {
          src: 'assets/img/characters/ryo/light-kick/0.png',
          w: 63,
          h: 106,
          anchorX: 27,
          anchorY: 106,
          durationMs: 85,
        },
        {
          src: 'assets/img/characters/ryo/light-kick/1.png',
          w: 57,
          h: 106,
          anchorX: 44,
          anchorY: 106,
          durationMs: 85,
        },
        {
          src: 'assets/img/characters/ryo/light-kick/2.png',
          w: 100,
          h: 103,
          anchorX: 59,
          anchorY: 103,
          durationMs: 160,
        },
        {
          src: 'assets/img/characters/ryo/light-kick/1.png',
          w: 57,
          h: 106,
          anchorX: 44,
          anchorY: 106,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/ryo/light-kick/0.png',
          w: 63,
          h: 106,
          anchorX: 27,
          anchorY: 106,
          durationMs: 60,
        },
      ],
    },
    heavyKick: {
      frames: [
        {
          src: 'assets/img/characters/ryo/heavy-kick/0.png',
          w: 56,
          h: 106,
          anchorX: 32,
          anchorY: 106,
          durationMs: 90,
        },
        {
          src: 'assets/img/characters/ryo/heavy-kick/1.png',
          w: 54,
          h: 106,
          anchorX: 32,
          anchorY: 106,
          durationMs: 70,
        },
        {
          src: 'assets/img/characters/ryo/heavy-kick/2.png',
          w: 69,
          h: 101,
          anchorX: 31,
          anchorY: 101,
          durationMs: 60,
        },
        {
          src: 'assets/img/characters/ryo/heavy-kick/3.png',
          w: 108,
          h: 106,
          anchorX: 30,
          anchorY: 106,
          durationMs: 160,
        },
        {
          src: 'assets/img/characters/ryo/heavy-kick/4.png',
          w: 52,
          h: 106,
          anchorX: 18,
          anchorY: 106,
          durationMs: 90,
        },
      ],
    },
    victory: {
      frames: [
        {
          src: 'assets/img/characters/ryo/victory/0.png',
          w: 54,
          h: 109,
          anchorX: 26,
          anchorY: 109,
          durationMs: 420,
        },
        {
          src: 'assets/img/characters/ryo/victory/1.png',
          w: 47,
          h: 110,
          anchorX: 23,
          anchorY: 110,
          durationMs: 340,
        },
        {
          src: 'assets/img/characters/ryo/victory/2.png',
          w: 64,
          h: 102,
          anchorX: 31,
          anchorY: 102,
          durationMs: 950,
        },
      ],
    },
  };

  // ── Zan-Retsu-Ken (mash-punch flurry) ─────────────────────────────────────
  // Heavy-punch-only, no finisher. Three rapid heavy-punch presses trigger ONE
  // full playthrough of the `zanRetsuKen` clip; it ends itself when the frames
  // run out and is re-triggerable. All the mash/timing logic lives in the
  // shared `MashFlurry` controller — here we only supply the config.
  private readonly _flurry = this._createMashFlurry({
    variants: [
      {
        button: 'heavyPunch',
        loopAnimation: 'zanRetsuKen',
        loopDurationMs: totalDurationMs(
          this.specials.find((s) => s.name === 'zanRetsuKen')!.frames.frames,
        ),
        startVoiceSrc: this.voices['zanRetsuKen'],
      },
    ],
    triggerCount: 3,
    mashWindowMs: 220,
    tickMs: GameLoopService.TICK_MS,
    whooshSrc: this.voices['zanRetsuKenSfx'],
  });

  protected override interceptAttack(button: AttackButton): boolean {
    return this._flurry.press(button);
  }

  protected override tickCustomAttack(): boolean {
    return this._flurry.tick();
  }

  override async playOutro(): Promise<void> {
    this.scripted.set(true);
    await this.backDash();
    await this.backDash();
    await this.playScriptedClip('victory', {
      voice: { src: 'assets/sfx/ryo/victory.mp3', frame: 0 },
    });
  }
}
