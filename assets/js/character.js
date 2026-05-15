// Base class for all stage characters. Self-contained — knows nothing about
// the stage, train, or world boundaries. The Stage queries the character for
// intent/position and writes blocked-direction flags back via setBlocked().
//
// To add a new character: extend Character, pass an `animations` map of CSS
// class names matching that character's strip layout in styles.css, and
// optionally override `walkSpeed`, `jab()`, etc. for character-specific feel.
export class Character {
  constructor({ el, animations, voices = {}, config = {} }) {
    this.el = el;
    this.animations = animations;
    this.voices = voices;
    this.config = {
      walkSpeed: 10,
      crouchSpeed: 5,
      // Fraction of the surrounding world width the character leaps in a
      // forward/back jump. The world multiplies this by its own width at
      // takeoff and hands back a px step via `jump(jumpXStep)`.
      jumpDistancePct: 0.30,
      jumpTicks: 33,
      jumpDurationMs: 1000,
      jumpApexMs: 500,
      jumpVerticalStep: 5,
      jumpYScale: 0.3,
      voiceVolume: 0.5,
      ...config,
    };

    this.rightKey = false;
    this.leftKey = false;
    this.upKey = false;
    this.downKey = false;
    this.lastDir = null;

    this.jumpingUp = false;
    this.falling = false;
    this.forwardJump = false;
    this.backwardJump = false;

    this.accumulated = 4;
    this.accumulatedY = 0;
    this.jumpXStep = 0;

    // Set externally by the world each tick — character physics consult
    // these instead of holding world limits directly.
    this.blockedRight = false;
    this.blockedLeft = false;

    this.initialX = el.getBoundingClientRect().x;

    this._allAnimClasses = Object.values(animations).filter(Boolean);
    this.setAnim("idle");
  }

  // ---- World ↔ character interface ----
  getX() { return this.el.getBoundingClientRect().x; }
  getWidth() { return this.el.clientWidth; }
  setBlocked({ right, left }) {
    this.blockedRight = right;
    this.blockedLeft = left;
  }

  // ---- Animation ----
  setAnim(name) {
    const cls = this.animations[name];
    if (!cls) return;
    for (const c of this._allAnimClasses) this.el.classList.remove(c);
    this.el.classList.add(cls);
  }

  hasAnim(name) {
    const cls = this.animations[name];
    return !!cls && this.el.classList.contains(cls);
  }

  playVoice(name) {
    const src = this.voices[name];
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = this.config.voiceVolume;
    audio.play().catch(() => {});
  }

  // ---- Combat / character actions — override in subclasses. ----
  jab()   { this.playVoice("jab"); }
  punch() { this.playVoice("punch"); }
  kick()  { this.playVoice("kick"); }
  taunt() { this.playVoice("taunt"); }

  // ---- Movement orchestration ----
  startMoveRight() {
    if (this.upKey) return;
    if (this.downKey) { this._applyCrouchAnim(); return; }
    this.setAnim("forward");
  }

  startMoveLeft() {
    if (this.upKey) return;
    if (this.downKey) { this._applyCrouchAnim(); return; }
    this.setAnim("backwards");
  }

  startCrouch() {
    if (this.upKey) return;
    this._applyCrouchAnim();
  }

  _applyCrouchAnim() {
    const alreadyCrouched =
      this.hasAnim("crouch") ||
      this.hasAnim("crouchStill") ||
      this.hasAnim("crouchForward");
    if (this.lastDir === "right") this.setAnim("crouchForward");
    else if (alreadyCrouched) this.setAnim("crouchStill");
    else this.setAnim("crouch");
  }

  stopMove(dir) {
    if (this.upKey) return;
    if (this.downKey) {
      if (dir === "right") {
        // No backwards-crouch animation exists — pin to static frame.
        this.setAnim("crouchStill");
      } else if (this.lastDir === "right") {
        this.setAnim("crouchForward");
      }
      return;
    }
    if (this.lastDir === "right") {
      this.setAnim("forward");
    } else if (this.lastDir === "left") {
      this.setAnim("backwards");
    } else {
      this._pinTransformToCurrentPos();
      this.setAnim("idle");
    }
  }

  stopCrouch() {
    if (this.upKey) return;
    this._pinTransformToCurrentPos();
    this.setAnim(
      this.lastDir === "right" ? "forward" :
      this.lastDir === "left"  ? "backwards" : "idle"
    );
  }

  _pinTransformToCurrentPos() {
    this.el.style.transform = `translateX(${this.el.getBoundingClientRect().x - this.initialX}px)`;
  }

  // `jumpXStep` is computed by the world (it knows the stage width) and
  // passed in at takeoff — keeps the character ignorant of world geometry.
  jump(jumpXStep = 0) {
    if (this.upKey) return;
    this.upKey = true;
    this.jumpingUp = true;
    this.jumpXStep = jumpXStep;

    if (this.lastDir === "right") this._beginForwardJump();
    else if (this.lastDir === "left") this._beginBackwardJump();
    else this._beginVerticalJump();
  }

  _beginForwardJump() {
    this.forwardJump = true;
    this.setAnim("jumpForward");
    this._scheduleApex();
    this._scheduleLand();
  }

  _beginBackwardJump() {
    this.backwardJump = true;
    this.setAnim("jumpBackward");
    this._scheduleApex();
    this._scheduleLand();
  }

  _beginVerticalJump() {
    this.setAnim("jumpUp");
    setTimeout(() => {
      this.falling = true;
      this.jumpingUp = false;
      this.setAnim("jumpFall");
    }, this.config.jumpApexMs);
    this._scheduleLand();
  }

  _scheduleApex() {
    setTimeout(() => {
      this.falling = true;
      this.jumpingUp = false;
    }, this.config.jumpApexMs);
  }

  _scheduleLand() {
    setTimeout(() => {
      const landName =
        this.lastDir === "right" ? "forward" :
        this.lastDir === "left"  ? "backwards" : "idle";
      this.setAnim(landName);
      this.upKey = false;
      this.falling = false;
      this.forwardJump = false;
      this.backwardJump = false;
      this.accumulatedY = 0;
      // Reset transform to translateX only — leftover Y would leave the
      // character hovering above the baseline.
      this.el.style.transform = `translateX(${this.accumulated}px)`;
    }, this.config.jumpDurationMs);
  }

  // Per-tick physics update. The world is expected to have already updated
  // blockedRight/blockedLeft for this frame.
  tick() {
    if (this.jumpingUp || this.falling) {
      if (this.forwardJump  && !this.blockedRight) this.accumulated += this.jumpXStep;
      if (this.backwardJump && !this.blockedLeft)  this.accumulated -= this.jumpXStep;
      if (this.jumpingUp) this.accumulatedY -= this.config.jumpVerticalStep;
      if (this.falling)   this.accumulatedY += this.config.jumpVerticalStep;
      this.el.style.transform = `translate(${this.accumulated}px,${this.accumulatedY * this.config.jumpYScale}cqw)`;
    }
    if (this.upKey) return;
    if (this.downKey) {
      if (this.lastDir === "right" && !this.blockedRight) {
        this.el.style.transform = `translateX(${this.accumulated}px)`;
        this.accumulated += this.config.crouchSpeed;
      }
      return;
    }
    if (this.lastDir === "right" && !this.blockedRight) {
      this.el.style.transform = `translateX(${this.accumulated}px)`;
      this.accumulated += this.config.walkSpeed;
    } else if (this.lastDir === "left" && !this.blockedLeft) {
      this.el.style.transform = `translateX(${this.accumulated}px)`;
      this.accumulated -= this.config.walkSpeed;
    }
  }
}
