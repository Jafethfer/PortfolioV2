import { Character } from "./character.js";

// Terry Bogard (Fatal Fury / KOF). Uses sprite strips cropped from
// terry-sheet.png via sprite-tool.mjs — see CLAUDE.md for the row table.
export class Terry extends Character {
  constructor({ el, config }) {
    super({
      el,
      config,
      animations: {
        idle:          "terry-idle",
        forward:       "terry-forward",
        backwards:     "terry-backwards",
        crouch:        "terry-crouch",
        crouchStill:   "terry-crouch-still",
        crouchForward: "terry-crouch-forward",
        jumpForward:   "terry-jump-forward",
        jumpBackward:  "terry-jump-backward",
        jumpUp:        "terry-jump-up",
        jumpFall:      "terry-jump-fall",
        jumpGround:    "terry-jump-ground",
      },
      voices: {
        // Voice files live in assets/sfx/. Wire them up by action name, e.g.:
        // jab:   "./assets/sfx/terry-ok.mp3",
        // taunt: "./assets/sfx/terry-taunt.mp3",
      },
    });
  }

  // Override here when Terry's jab / punch / kick get their own sprite rows
  // and SFX. For now the base no-op-with-voice behavior is fine.
}
