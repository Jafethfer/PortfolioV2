import { CharacterConfig } from '../models/character';

/**
 * Terry Bogard (Fatal Fury / KOF). Animation class names match the sprite
 * strips cropped from terry-sheet.png and styled in styles/sprites/terry.scss.
 *
 * To add another character: copy this file, swap the animation class names,
 * and add a matching SCSS sprite definition.
 */
export const TERRY_CONFIG: CharacterConfig = {
  animations: {
    idle:          'terry-idle',
    forward:       'terry-forward',
    backwards:     'terry-backwards',
    crouch:        'terry-crouch',
    crouchStill:   'terry-crouch-still',
    crouchForward: 'terry-crouch-forward',
    jumpForward:   'terry-jump-forward',
    jumpBackward:  'terry-jump-backward',
    jumpUp:        'terry-jump-up',
    jumpFall:      'terry-jump-fall',
    jumpGround:    'terry-jump-ground',
  },
  voices: {
    // Wire up when sprite rows for combat moves are cropped:
    // jab:   '/assets/sfx/terry-ok.mp3',
    // taunt: '/assets/sfx/terry-taunt.mp3',
  },
};
