const ARROW_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"]);

// Keyboard → Character translator. Holds a Stage reference only so it can
// hand the character a stage-width-derived jump step at takeoff — the
// character itself never sees the stage.
export class InputController {
  constructor({ character, stage }) {
    this.character = character;
    this.stage = stage;
    window.addEventListener("keydown", (e) => this._onKeyDown(e));
    window.addEventListener("keyup",   (e) => this._onKeyUp(e));
  }

  setCharacter(character) {
    this.character = character;
  }

  _onKeyDown(event) {
    const c = this.character;
    if (ARROW_KEYS.has(event.key)) event.preventDefault();

    // `lastDir` is the source of truth for active direction — it's the most
    // recently pressed horizontal arrow and survives keyup of the opposite.
    if (event.key === "ArrowRight") {
      c.rightKey = true;
      if (!event.repeat) c.lastDir = "right";
    } else if (event.key === "ArrowLeft") {
      c.leftKey = true;
      if (!event.repeat) c.lastDir = "left";
    } else if (event.key === "ArrowDown") {
      c.downKey = true;
    }

    if (c.upKey) return;

    if (c.downKey && event.key !== "ArrowUp") {
      c.startCrouch();
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      if (c.lastDir === "right") c.startMoveRight();
      else c.startMoveLeft();
    } else if (event.key === "ArrowUp") {
      c.jump(this.stage.computeJumpStep(c));
    }
  }

  _onKeyUp(event) {
    const c = this.character;
    if (event.key === "ArrowRight") {
      c.rightKey = false;
      if (c.lastDir === "right") c.lastDir = c.leftKey ? "left" : null;
      // Mid-jump: leave the jump animation and transform alone — touching
      // the transform here drops the Y offset and overlapping classes flicker.
      if (c.upKey) return;
      c.stopMove("right");
    } else if (event.key === "ArrowLeft") {
      c.leftKey = false;
      if (c.lastDir === "left") c.lastDir = c.rightKey ? "right" : null;
      if (c.upKey) return;
      c.stopMove("left");
    } else if (event.key === "ArrowDown") {
      c.downKey = false;
      c.stopCrouch();
    }
  }
}
