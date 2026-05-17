import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Character } from '../components/character/character';
import { AnimationData, AnimationName, CharacterVoices, SpecialMove } from '../models/character';
import {
  BURNING_KNUCKLE_FRAMES,
  CRACK_SHOOT_FRAMES,
  POWER_WAVE_FRAMES,
  RISING_TACKLE_FRAMES,
  withDurations,
} from './terry-specials';

/**
 * Terry Bogard (Fatal Fury / KOF). Concrete character. Owns the mapping from
 * abstract animation names to sprite CSS classes, and its sprite stylesheet
 * lives next to this file as `terry.scss`.
 *
 * Adding another character: copy this pair (`<name>.ts` + `<name>.scss`),
 * swap the animation class names, drop the matching sprite strips into
 * `public/assets/img/`, then have App pass the new class to <app-stage>.
 */
@Component({
  selector: 'app-terry',
  templateUrl: '../components/character/character.html',
  styleUrl: './terry.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Terry extends Character {
  protected override readonly voices: CharacterVoices = {
    lightPunch: '/assets/sfx/terry/terry-light-punch.mp3',
    heavyPunch: '/assets/sfx/terry/terry-heavy-punch.mp3',
    // Reuse the punch shout for kicks — same exertion grunt works for both.
    lightKick: '/assets/sfx/terry/terry-light-punch.mp3',
    heavyKick: '/assets/sfx/terry/terry-heavy-punch.mp3',
    taunt: '/assets/sfx/terry/terry-taunt.mp3',
    // Non-voice combat SFX live in `misc/` because they're character-agnostic
    // (every fighter's jab makes the same whoosh). Played at `sfxVolume`
    // alongside the character-specific voice clip.
    lightPunchWhiff: '/assets/sfx/misc/light-punch-whiff.mp3',
    heavyPunchWhiff: '/assets/sfx/misc/heavy-punch-whiff.mp3',
    // Reuse the punch whiff for kicks — same generic whoosh works for both.
    lightKickWhiff: '/assets/sfx/misc/light-punch-whiff.mp3',
    heavyKickWhiff: '/assets/sfx/misc/heavy-punch-whiff.mp3',
    jump: '/assets/sfx/misc/jump.mp3',
    // lightKick / heavyKick still TBD — no SFX file yet.
  };

  /** Per-frame (data-driven) animations. Each frame has its own image and an
   * anchor (foot-centre) — the runtime positions every frame so its anchor
   * lands at the same world X, which keeps Terry's body stable even when a
   * limb extends. Cropped via `sprite-tool.mjs crop-frames`. */
  protected override readonly animationFrames: Partial<Record<AnimationName, AnimationData>> = {
    idle: {
      loop: true,
      frames: [
        {
          src: '/assets/img/characters/terry/idle/0.png',
          w: 64,
          h: 107,
          anchorX: 31,
          anchorY: 100,
          durationMs: 150,
        },
        {
          src: '/assets/img/characters/terry/idle/1.png',
          w: 64,
          h: 107,
          anchorX: 31,
          anchorY: 100,
          durationMs: 150,
        },
        {
          src: '/assets/img/characters/terry/idle/2.png',
          w: 65,
          h: 107,
          anchorX: 31,
          anchorY: 100,
          durationMs: 150,
        },
        {
          src: '/assets/img/characters/terry/idle/3.png',
          w: 64,
          h: 107,
          anchorX: 31,
          anchorY: 100,
          durationMs: 150,
        },
      ],
    },
    /**
     * Walk-forward step cycle. The auto-detected foot/body anchors drift
     * by 10+ sprite-px between frames because Terry's stepping legs (and
     * to a lesser extent, his swinging arm) shift the centroid. Hand-set
     * `anchorX` to `floor(w/2)` instead — each frame's bounding box is
     * roughly centred on the body in the source sheet, so frame-centre is
     * a more stable anchor than detected feet for step cycles.
     */
    forward: {
      loop: true,
      frames: [
        {
          src: '/assets/img/characters/terry/walk/0.png',
          w: 69,
          h: 103,
          anchorX: 34,
          anchorY: 102,
          durationMs: 175,
        },
        {
          src: '/assets/img/characters/terry/walk/1.png',
          w: 63,
          h: 103,
          anchorX: 31,
          anchorY: 102,
          durationMs: 175,
        },
        {
          src: '/assets/img/characters/terry/walk/2.png',
          w: 61,
          h: 103,
          anchorX: 30,
          anchorY: 102,
          durationMs: 175,
        },
        {
          src: '/assets/img/characters/terry/walk/3.png',
          w: 58,
          h: 103,
          anchorX: 29,
          anchorY: 102,
          durationMs: 175,
        },
      ],
    },
    /** Same step-cycle treatment as `forward` — frame-centre anchors. */
    backwards: {
      loop: true,
      frames: [
        {
          src: '/assets/img/characters/terry/backwards/0.png',
          w: 62,
          h: 105,
          anchorX: 31,
          anchorY: 104,
          durationMs: 175,
        },
        {
          src: '/assets/img/characters/terry/backwards/1.png',
          w: 65,
          h: 105,
          anchorX: 32,
          anchorY: 104,
          durationMs: 175,
        },
        {
          src: '/assets/img/characters/terry/backwards/2.png',
          w: 59,
          h: 105,
          anchorX: 29,
          anchorY: 104,
          durationMs: 175,
        },
        {
          src: '/assets/img/characters/terry/backwards/3.png',
          w: 62,
          h: 105,
          anchorX: 31,
          anchorY: 104,
          durationMs: 175,
        },
      ],
    },
    /** Backstep — quick backwards hop, 2 frames from row 8. Frame 0 is the
     * launch pose (Terry leaning back, planting his front foot), frame 1
     * the recovery (arms pulled into guard). Body-anchored — both frames'
     * `anchorX` is close to idle's 31 so the body stays centered as Terry
     * slides backwards. */
    backstep: {
      frames: [
        {
          src: '/assets/img/characters/terry/backstep/0.png',
          w: 73,
          h: 92,
          anchorX: 29,
          anchorY: 91,
          durationMs: 380,
        },
        {
          src: '/assets/img/characters/terry/backstep/1.png',
          w: 57,
          h: 92,
          anchorX: 31,
          anchorY: 91,
          durationMs: 70,
        },
      ],
    },
    /** Crouch entry: standing → deep crouch. Plays once, holds on the deep
     * crouch frame until input releases. Foot-anchored since both poses have
     * feet on the ground. */
    crouch: {
      frames: [
        {
          src: '/assets/img/characters/terry/crouch/0.png',
          w: 56,
          h: 87,
          anchorX: 27,
          anchorY: 79,
          durationMs: 45,
        },
        {
          src: '/assets/img/characters/terry/crouch/1.png',
          w: 58,
          h: 87,
          anchorX: 29,
          anchorY: 80,
          durationMs: 150,
        },
      ],
    },
    /** Held deep-crouch pose — reached via crouchForward → release direction.
     * Reuses crouch's frame 1 as a single static frame. */
    crouchStill: {
      frames: [
        {
          src: '/assets/img/characters/terry/crouch/1.png',
          w: 58,
          h: 87,
          anchorX: 29,
          anchorY: 80,
          durationMs: 1000,
        },
      ],
    },
    /** Crouch-walk step cycle. Body-anchored (feet swing) — `anchorY = h-1`
     * means the image bottom aligns to the ground. */
    crouchForward: {
      loop: true,
      frames: [
        {
          src: '/assets/img/characters/terry/crouch-forward/0.png',
          w: 53,
          h: 77,
          anchorX: 30,
          anchorY: 76,
          durationMs: 117,
        },
        {
          src: '/assets/img/characters/terry/crouch-forward/1.png',
          w: 52,
          h: 77,
          anchorX: 26,
          anchorY: 76,
          durationMs: 117,
        },
        {
          src: '/assets/img/characters/terry/crouch-forward/2.png',
          w: 55,
          h: 77,
          anchorX: 27,
          anchorY: 76,
          durationMs: 117,
        },
        {
          src: '/assets/img/characters/terry/crouch-forward/3.png',
          w: 61,
          h: 77,
          anchorX: 30,
          anchorY: 76,
          durationMs: 117,
        },
        {
          src: '/assets/img/characters/terry/crouch-forward/4.png',
          w: 55,
          h: 77,
          anchorX: 27,
          anchorY: 76,
          durationMs: 117,
        },
        {
          src: '/assets/img/characters/terry/crouch-forward/5.png',
          w: 52,
          h: 77,
          anchorX: 26,
          anchorY: 76,
          durationMs: 117,
        },
      ],
    },
    /** Vertical jump — ascent. Cropped from the legacy `terry-jump.png` strip
     * (6 frames at 68×136 each); preparation through launch. */
    jumpUp: {
      frames: [
        {
          src: '/assets/img/characters/terry/jump/0.png',
          w: 68,
          h: 136,
          anchorX: 31,
          anchorY: 135,
          durationMs: 167,
        },
        {
          src: '/assets/img/characters/terry/jump/1.png',
          w: 68,
          h: 136,
          anchorX: 31,
          anchorY: 135,
          durationMs: 167,
        },
        {
          src: '/assets/img/characters/terry/jump/2.png',
          w: 68,
          h: 136,
          anchorX: 32,
          anchorY: 135,
          durationMs: 167,
        },
      ],
    },
    /** Vertical jump — descent. Last frame is the "hat-down" pose; `loop:
     * false` makes the engine hold on it until the physics tick lands. */
    jumpFall: {
      frames: [
        {
          src: '/assets/img/characters/terry/jump/3.png',
          w: 68,
          h: 136,
          anchorX: 34,
          anchorY: 135,
          durationMs: 250,
        },
        {
          src: '/assets/img/characters/terry/jump/4.png',
          w: 68,
          h: 136,
          anchorX: 37,
          anchorY: 135,
          durationMs: 250,
        },
      ],
    },
    /** Landing pose — set by the state machine on land if it ever wants to
     * play a recover. Currently the state machine goes idle → on land, so
     * jumpGround is wired but unused. */
    jumpGround: {
      frames: [
        {
          src: '/assets/img/characters/terry/jump/5.png',
          w: 69,
          h: 136,
          anchorX: 42,
          anchorY: 135,
          durationMs: 200,
        },
      ],
    },
    /** Forward jump — ascent half. Frames 0-3 of the cropped 8-frame strip.
     * Physics transitions to `jumpForwardFall` at the apex.
     *
     * Brief launch crouch (frame 0), then the rotation frames (1-3) cycle
     * fast — quick frame cadence reads as continuous spinning motion
     * instead of three separately-held poses. Total (380ms) finishes well
     * before the 500ms ascent so the engine holds on the apex pose for
     * the remaining ~120ms before the physics-driven cut to the fall. */
    jumpForward: {
      frames: [
        {
          src: '/assets/img/characters/terry/jump-forward/0.png',
          w: 56,
          h: 136,
          anchorX: 30,
          anchorY: 135,
          durationMs: 110,
        },
        {
          src: '/assets/img/characters/terry/jump-forward/1.png',
          w: 68,
          h: 136,
          anchorX: 45,
          anchorY: 135,
          durationMs: 150,
        },
        {
          src: '/assets/img/characters/terry/jump-forward/2.png',
          w: 80,
          h: 136,
          anchorX: 40,
          anchorY: 135,
          durationMs: 60,
        },
        {
          src: '/assets/img/characters/terry/jump-forward/3.png',
          w: 59,
          h: 136,
          anchorX: 29,
          anchorY: 135,
          durationMs: 60,
        },
      ],
    },
    /** Forward jump — descent half. Frames 4-6 of the cropped strip. The
     * landing-stand frame (7) is intentionally NOT included so the engine
     * holds on the "hat-down" pose (frame 6) until ground contact, instead
     * of cutting to the standing pose mid-air. Per-frame durations slow
     * toward landing so the hat-down brace reads as deliberate, not snappy. */
    jumpForwardFall: {
      frames: [
        {
          src: '/assets/img/characters/terry/jump-forward/4.png',
          w: 80,
          h: 136,
          anchorX: 40,
          anchorY: 135,
          durationMs: 60,
        },
        {
          src: '/assets/img/characters/terry/jump-forward/5.png',
          w: 60,
          h: 136,
          anchorX: 30,
          anchorY: 135,
          durationMs: 220,
        },
        {
          src: '/assets/img/characters/terry/jump-forward/6.png',
          w: 57,
          h: 136,
          anchorX: 28,
          anchorY: 135,
          durationMs: 240,
        },
      ],
    },
    /** Backward jump — ascent half. Frames 0-2 of the cropped 6-frame strip. */
    jumpBackward: {
      frames: [
        {
          src: '/assets/img/characters/terry/jump-backward/0.png',
          w: 56,
          h: 105,
          anchorX: 30,
          anchorY: 104,
          durationMs: 167,
        },
        {
          src: '/assets/img/characters/terry/jump-backward/1.png',
          w: 80,
          h: 105,
          anchorX: 40,
          anchorY: 104,
          durationMs: 60,
        },
        {
          src: '/assets/img/characters/terry/jump-backward/2.png',
          w: 59,
          h: 105,
          anchorX: 29,
          anchorY: 104,
          durationMs: 60,
        },
      ],
    },
    /** Backward jump — descent half. Frames 3-4; last frame holds for the
     * remainder of the descent. Frame 5 (landing) is omitted, same as the
     * forward variant. */
    jumpBackwardFall: {
      frames: [
        {
          src: '/assets/img/characters/terry/jump-backward/3.png',
          w: 80,
          h: 105,
          anchorX: 40,
          anchorY: 104,
          durationMs: 60,
        },
        {
          src: '/assets/img/characters/terry/jump-backward/4.png',
          w: 68,
          h: 105,
          anchorX: 43,
          anchorY: 104,
          durationMs: 167,
        },
      ],
    },
    lightPunch: {
      frames: [
        {
          src: '/assets/img/characters/terry/light-punch/0.png',
          w: 66,
          h: 101,
          anchorX: 32,
          anchorY: 93,
          durationMs: 50,
        },
        {
          src: '/assets/img/characters/terry/light-punch/1.png',
          w: 89,
          h: 101,
          anchorX: 32,
          anchorY: 93,
          durationMs: 50,
        },
        {
          src: '/assets/img/characters/terry/light-punch/2.png',
          w: 66,
          h: 101,
          anchorX: 32,
          anchorY: 93,
          durationMs: 50,
        },
      ],
    },
    /** Heavy punch — 6-frame windup → big extension → recovery (row 27 of
     * the sheet). Frame 3 is the full-extension swing (100px wide vs ~66 for
     * the others); foot-detected anchors stay stable around (32-33, 97). The
     * windup and recovery linger longer than the extension to sell the weight. */
    heavyPunch: {
      frames: [
        {
          src: '/assets/img/characters/terry/heavy-punch/0.png',
          w: 66,
          h: 105,
          anchorX: 32,
          anchorY: 97,
          durationMs: 100,
        },
        {
          src: '/assets/img/characters/terry/heavy-punch/1.png',
          w: 65,
          h: 105,
          anchorX: 32,
          anchorY: 97,
          durationMs: 100,
        },
        {
          src: '/assets/img/characters/terry/heavy-punch/2.png',
          w: 67,
          h: 105,
          anchorX: 33,
          anchorY: 97,
          durationMs: 67,
        },
        {
          src: '/assets/img/characters/terry/heavy-punch/3.png',
          w: 100,
          h: 105,
          anchorX: 33,
          anchorY: 97,
          durationMs: 133,
        },
        {
          src: '/assets/img/characters/terry/heavy-punch/4.png',
          w: 67,
          h: 105,
          anchorX: 33,
          anchorY: 97,
          durationMs: 67,
        },
        {
          src: '/assets/img/characters/terry/heavy-punch/5.png',
          w: 67,
          h: 105,
          anchorX: 33,
          anchorY: 97,
          durationMs: 100,
        },
      ],
    },
    /** Light kick — 4-frame brace → extended kick → retract → recover.
     * Cropped from row 28 via the flood-fill extractor (sprite-tool's gap
     * detector misread the wide extended-kick cell as two frames because of
     * the empty cell-bg between Terry's body and his outstretched foot).
     * Per-frame `anchorX` = each frame's torso centroid + 3 (the idle
     * frames' own anchor-vs-centroid offset), so the body lands at the
     * same world-X as idle on transition — without that 3px nudge the
     * sprite jumps left/right when you trigger the kick. */
    lightKick: {
      frames: [
        {
          src: '/assets/img/characters/terry/light-kick/0.png',
          w: 54,
          h: 108,
          anchorX: 29,
          anchorY: 107,
          durationMs: 60,
        },
        {
          src: '/assets/img/characters/terry/light-kick/1.png',
          w: 99,
          h: 105,
          anchorX: 41,
          anchorY: 104,
          durationMs: 100,
        },
        {
          src: '/assets/img/characters/terry/light-kick/2.png',
          w: 54,
          h: 108,
          anchorX: 29,
          anchorY: 107,
          durationMs: 60,
        },
        {
          src: '/assets/img/characters/terry/light-kick/3.png',
          w: 66,
          h: 101,
          anchorX: 37,
          anchorY: 100,
          durationMs: 80,
        },
      ],
    },
    /** Heavy kick — 8-frame windup → knee raise → full extension → retract
     * → recover. Re-extracted from row 29 as SOURCE-CELL crops (not
     * alpha-tight) — alpha trimming made foot detection unreliable since
     * cropped-X depended on whatever body part extended leftmost.
     *
     * Per-frame `anchorX` = PLANTED foot X (detected via rightmost
     * bottom-pixel cluster — Terry's right foot, which stays planted
     * during the kick) − 26. The −26 offset matches idle's relationship
     * (idle planted foot at X=57, anchor=31, so 31 − 57 = −26), so the
     * planted foot lands at the same world position across idle and every
     * kick frame. The kicking foot (Terry's LEFT in the sprite) is what
     * swings up and forward — opposite of what I initially assumed. */
    heavyKick: {
      frames: [
        {
          src: '/assets/img/characters/terry/heavy-kick/0.png',
          w: 55,
          h: 108,
          anchorX: 22,
          anchorY: 107,
          durationMs: 60,
        },
        {
          src: '/assets/img/characters/terry/heavy-kick/1.png',
          w: 55,
          h: 108,
          anchorX: 22,
          anchorY: 107,
          durationMs: 70,
        },
        {
          src: '/assets/img/characters/terry/heavy-kick/2.png',
          w: 60,
          h: 108,
          anchorX: 24,
          anchorY: 107,
          durationMs: 70,
        },
        {
          src: '/assets/img/characters/terry/heavy-kick/3.png',
          w: 64,
          h: 108,
          anchorX: 9,
          anchorY: 107,
          durationMs: 70,
        },
        {
          src: '/assets/img/characters/terry/heavy-kick/4.png',
          w: 99,
          h: 108,
          anchorX: -6,
          anchorY: 107,
          durationMs: 120,
        },
        {
          src: '/assets/img/characters/terry/heavy-kick/5.png',
          w: 64,
          h: 108,
          anchorX: 9,
          anchorY: 107,
          durationMs: 70,
        },
        {
          src: '/assets/img/characters/terry/heavy-kick/6.png',
          w: 60,
          h: 108,
          anchorX: 24,
          anchorY: 107,
          durationMs: 70,
        },
        {
          src: '/assets/img/characters/terry/heavy-kick/7.png',
          w: 55,
          h: 108,
          anchorX: 22,
          anchorY: 107,
          durationMs: 100,
        },
      ],
    },
  };

  /** Special moves — each is a directional motion + an attack button. The
   * base `Character` class scans this on every attack-button press and, on
   * match, plays the special's frames + audio in place of the normal attack. */
  protected override readonly specials: readonly SpecialMove[] = [
    /** Crack Shoot — Terry's QCB-style forward flip kick. Frames 4-6 are
     * the airborne flip, frame 7 the grounded landing pose. Whiff reuses
     * the generic heavy whoosh until a Crack-Shoot-specific clip exists. */
    {
      name: 'crackShoot',
      motion: ['down', 'left'],
      button: 'lightKick',
      // Shout fires on the launch frame (4) so it lands with the flip,
      // not during the windup.
      voices: [{ src: '/assets/sfx/terry/terry-crackshoot.mp3', frame: 4 }],
      whiffSrc: '/assets/sfx/misc/special-travel.mp3',
      // 25% of stage width — comparable to a forward jump (30%), tuned
      // shorter since the active hit window is mid-flip not the apex.
      travelDistancePct: 0.25,
      // X+Y travel runs through frame 6; frame 7 pins to ground for the
      // landing pose (see `_physicsTick` past-travel-end branch).
      travelStartFrame: 4,
      travelEndFrame: 7,
      // Low forward leap — half-ish of a default jump's peak — to sell
      // the mid-air flip without competing with the jump's verticality.
      arcHeight: 20,
      // Frame timing: snappy windup (0-3 at 40-60ms), quick flip (4-6 at
      // 80-100ms), longer landing recovery (7 at 180ms). The voice cue +
      // travel both anchor to frame 4, so shortening the windup shifts
      // them earlier proportionally — exactly the snappier feel we want.
      frames: { frames: withDurations(CRACK_SHOOT_FRAMES, [40, 40, 50, 60, 100, 100, 80, 180]) },
    },
    /** Heavy Crack Shoot — same flip, more committed. Same sprites and
     * motion as the light variant; tuning differs: longer windup, bigger
     * arc, more travel, slower airborne frames so the bigger leap reads. */
    {
      name: 'crackShootHeavy',
      motion: ['down', 'left'],
      button: 'heavyKick',
      voices: [{ src: '/assets/sfx/terry/terry-crackshoot.mp3', frame: 4 }],
      whiffSrc: '/assets/sfx/misc/special-travel.mp3',
      // 50% of the stage (vs 25% light) — Terry leaps roughly twice as far.
      travelDistancePct: 0.5,
      travelStartFrame: 4,
      travelEndFrame: 7,
      // Double the light arc — reads as a higher leap matching the travel.
      arcHeight: 40,
      // Frames 1-3 are heavier windup (sells the bigger commitment); 4-6
      // hold longer so the wider leap doesn't blur past in a few ticks.
      // Travel distance is unaffected by frame timing — `_specialXStep`
      // scales by travelTicks.
      frames: {
        frames: withDurations(CRACK_SHOOT_FRAMES, [80, 120, 120, 140, 170, 170, 140, 180]),
      },
    },
    /** Burning Knuckle — Terry's QCF charging-fist punch. Frames 0-5 are
     * the windup (stance → V-pose flash → lean back → brace → charge),
     * frames 6-8 are the airborne charge forward (punch released → big
     * punch with trailing flame → recovery with fading flame), frames 9-10
     * are grounded recovery. No Y arc — Terry stays at ground level the
     * whole move, just translates forward fast during the charge window. */
    {
      name: 'burningKnuckle',
      motion: ['down', 'left'],
      button: 'lightPunch',
      // Shout fires on the charge frame (6) so it lands with the punch.
      voices: [{ src: '/assets/sfx/terry/terry-burning-knuckle.mp3', frame: 6 }],
      whiffSrc: '/assets/sfx/misc/special-travel.mp3',
      // 25% of stage width during the charge window — light commitment.
      travelDistancePct: 0.3,
      // Travel only during the punch-with-flame frames (6, 7, 8); frames
      // 9-10 are stationary recovery.
      travelStartFrame: 6,
      travelEndFrame: 10,
      // No `arcHeight` — Burning Knuckle is a horizontal charge, not a leap.
      // Quick windup, single-frame V-pose flash, short charge, punctuated
      // by the punch frame (7) lingering slightly to register the impact.
      frames: {
        frames: withDurations(
          BURNING_KNUCKLE_FRAMES,
          [50, 50, 50, 50, 50, 50, 80, 100, 80, 80, 150],
        ),
      },
    },
    /** Heavy Burning Knuckle — bigger commitment. Same sprites and motion
     * as the light variant; tuning differs: longer windup frames so the
     * charge reads as more dangerous, more travel distance. No arc still. */
    {
      name: 'burningKnuckleHeavy',
      motion: ['down', 'left'],
      button: 'heavyPunch',
      voices: [{ src: '/assets/sfx/terry/terry-burning-knuckle.mp3', frame: 6 }],
      whiffSrc: '/assets/sfx/misc/special-travel.mp3',
      // 40% of the stage (vs 25% light) — Terry charges further.
      travelDistancePct: 0.6,
      travelStartFrame: 6,
      travelEndFrame: 10,
      // Windup frames 1-5 hold ~50% longer than light to sell the bigger
      // commitment, but the travel frames (6-8) are SHORTER than light —
      // heavier variants linger on the buildup and then snap through the
      // forward charge fast. Per-tick X step scales as 1 / travelTicks, so
      // shorter durations here = visibly faster traversal across the same
      // 40% distance.
      frames: {
        frames: withDurations(
          BURNING_KNUCKLE_FRAMES,
          [60, 140, 120, 120, 90, 90, 50, 100, 60, 80, 150],
        ),
      },
    },
    /** Rising Tackle (light) — anti-air spinning uppercut, leaps straight
     * up. Frames 0-2 are the windup crouch, frames 3-8 are the airborne
     * spin (this is the arc window), frames 9-10 are landing recovery.
     * No X travel — pure Y arc, peaking at ~half a jump's apex height. */
    {
      name: 'risingTackle',
      motion: ['down', 'up'],
      button: 'lightPunch',
      // Shout fires on the launch frame (3) so it lands with the leap.
      voices: [{ src: '/assets/sfx/terry/terry-rising-tackle.mp3', frame: 3 }],
      whiffSrc: '/assets/sfx/misc/special-travel.mp3',
      // Y arc only — Terry leaps straight up, no horizontal travel.
      // `fallAfterArc` makes the arc rise-only (peaks at end of travel
      // window) and hands off to the jump's descent physics after the
      // animation ends, so Terry physically falls back to ground using
      // the `jumpFall` sprite.
      arcHeight: 40,
      travelDistancePct: 0.05,
      fallAfterArc: true,
      travelStartFrame: 3,
      // 8 frames here — the source's grounded recovery frames are dropped
      // because the fall phase (jumpFall sprite descending) replaces them.
      // Airborne window is frames 3-7.
      travelEndFrame: 8,
      frames: {
        frames: withDurations(RISING_TACKLE_FRAMES.slice(0, 8), [50, 50, 50, 60, 80, 80, 80, 110]),
      },
    },
    /** Rising Tackle (heavy) — bigger commitment, peaks at a full jump's
     * apex height. Same frames, motion, and button family as light;
     * windup frames hold longer to sell the deeper crouch and the
     * airborne spin reads slower since the arc is taller. */
    {
      name: 'risingTackleHeavy',
      motion: ['down', 'up'],
      button: 'heavyPunch',
      voices: [{ src: '/assets/sfx/terry/terry-rising-tackle.mp3', frame: 3 }],
      whiffSrc: '/assets/sfx/misc/special-travel.mp3',
      // Matches the default jump's peak (jumpVerticalStep × apexTicks
      // = 5 × 17 = 85) — Terry rises as high as he would in a jump.
      arcHeight: 120,
      // Small forward leap on the heavy variant — Terry takes a step
      // into the rising tackle instead of going straight up. X applies
      // only during the rising phase (frames 3-7); the jump-fall descent
      // afterward has no X motion.
      travelDistancePct: 0.1,
      fallAfterArc: true,
      travelStartFrame: 3,
      travelEndFrame: 8,
      frames: {
        frames: withDurations(
          RISING_TACKLE_FRAMES.slice(0, 8),
          [60, 140, 140, 80, 100, 100, 100, 130],
        ),
      },
    },
    /** Power Wave (light) — QCF projectile cast. Terry stays planted (no
     * X or Y travel — the wave projectile, added later, is what flies
     * forward). Frames 0-3 are the windup (settle → gather → charge ball
     * overhead → cock back). Frame 4 is the lunge / release pose. Frame 5
     * is the arm-extended pose where the wave would spawn. Frame 6 is
     * recovery. */
    {
      name: 'powerWave',
      motion: ['down', 'right'],
      button: 'lightPunch',
      // Shout splits across two clips — "Power!" at launch, "Wave!" on
      // the release frame (5, arm extended).
      voices: [
        { src: '/assets/sfx/terry/terry-power-wave-1.mp3', frame: 0 },
        { src: '/assets/sfx/terry/terry-power-wave-2.mp3', frame: 5 },
      ],
      // No whiff — Power Wave is a stationary cast; the projectile (added
      // later) will own its own travel/impact SFX.
      frames: {
        frames: withDurations(POWER_WAVE_FRAMES, [40, 70, 90, 80, 80, 100, 150]),
      },
    },
    /** Power Wave (heavy) — same sprites and motion as the light variant;
     * the windup frames (1-3) hold longer to sell the bigger charge. */
    {
      name: 'powerWaveHeavy',
      motion: ['down', 'right'],
      button: 'heavyPunch',
      voices: [
        { src: '/assets/sfx/terry/terry-power-wave-1.mp3', frame: 0 },
        { src: '/assets/sfx/terry/terry-power-wave-2.mp3', frame: 5 },
      ],
      frames: {
        frames: withDurations(POWER_WAVE_FRAMES, [50, 130, 160, 130, 80, 110, 170]),
      },
    },
  ];

  /** Idle's detected foot anchor (sprite-x 31). Used as the world-X reference
   * so other per-frame animations align with idle, and so the strip-mode
   * walk/backwards/crouch animations don't visually jump too far when
   * transitioning to/from idle. */
  protected override readonly bodyAnchorX = 31;
}
