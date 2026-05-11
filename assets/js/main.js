var x = document.getElementById("bg-music");
var terryStage = document.getElementById("terry-stage-base-layer");
var miscLayer = document.getElementById("misc-layer");
var train = document.getElementById("terry-train");
var terryTrainImg = document.getElementById("terry-train-img");
var terry = document.getElementById("terry-animation");

var terry_position = terry.getBoundingClientRect().x;
var limit = terryStage.getBoundingClientRect().right;
var leftLimit = terryStage.getBoundingClientRect().left;
var reachedRightLimit = false;
var reachedLeftLimit = false;
var accumulated = 4;
var accumulatedY = 0;

var rightKey = false;
var leftKey = false;
var upKey = false;
var downKey = false;
var falling = false;
var jumpUp = false;
var forwardJump = false;
var backwardJump = false;
// Most-recently pressed horizontal arrow — drives movement direction when
// both right and left are physically held at the same time.
var lastDir = null;
// Pixel step per checkKeys tick during a forward/backward jump. Recomputed
// at takeoff so the total leap is a fixed % of the stage at the current
// viewport size.
const JUMP_DISTANCE_PCT = 0.30;
const JUMP_TICKS = 33; // jump duration (1000ms) / tick interval (30ms)
var jumpXStep = 0;

setInterval(checkPosition, 30);
setInterval(checkKeys, 30);
console.log(terryStage.getBoundingClientRect());

function playAudio() {
  x.volume = 0.2;
  x.play();
}

terryStage.classList.add("stage-translate");
miscLayer.classList.add("misc-translate");
train.classList.add("train-bump");

const ARROW_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"]);

window.addEventListener("keydown", (event) => {
  if (ARROW_KEYS.has(event.key)) event.preventDefault();
  // Track key state even during a jump so the landing animation picks up
  // a still-held direction. `lastDir` records the most recently pressed
  // horizontal arrow — it's the source of truth for active direction.
  if (event.key == "ArrowRight") {
    rightKey = true;
    if (!event.repeat) lastDir = "right";
  } else if (event.key == "ArrowLeft") {
    leftKey = true;
    if (!event.repeat) lastDir = "left";
  } else if (event.key == "ArrowDown") downKey = true;

  if (upKey) {
    return;
  }

  // While crouching, any non-jump input keeps Terry crouched. lastDir==='right'
  // adds forward-crouch (paired with half-speed X movement in checkKeys).
  if (downKey && event.key !== "ArrowUp") {
    const alreadyCrouched =
      terry.classList.contains("terry-crouch") ||
      terry.classList.contains("terry-crouch-still") ||
      terry.classList.contains("terry-crouch-forward");
    terry.classList.remove(
      "terry-idle",
      "terry-forward",
      "terry-backwards",
      "terry-crouch",
      "terry-crouch-still",
      "terry-crouch-forward",
    );
    if (lastDir === "right") terry.classList.add("terry-crouch-forward");
    else if (alreadyCrouched) terry.classList.add("terry-crouch-still");
    else terry.classList.add("terry-crouch");
    return;
  }

  if (event.key == "ArrowRight" || event.key == "ArrowLeft") {
    terry.classList.remove("terry-idle", "terry-forward", "terry-backwards");
    terry.classList.add(
      lastDir === "right" ? "terry-forward" : "terry-backwards",
    );
  } else if (event.key == "ArrowUp") {
    terry.classList.remove(
      "terry-idle",
      "terry-forward",
      "terry-backwards",
      "terry-crouch",
      "terry-crouch-still",
      "terry-crouch-forward",
    );
    upKey = true;
    jumpUp = true;
    jumpXStep =
      (terryStage.getBoundingClientRect().width * JUMP_DISTANCE_PCT) /
      JUMP_TICKS;
    const landingClass = () =>
      lastDir === "right"
        ? "terry-forward"
        : lastDir === "left"
          ? "terry-backwards"
          : "terry-idle";
    if (lastDir === "right") {
      // Forward jump — single 8-step animation, carries X momentum.
      forwardJump = true;
      terry.classList.add("terry-jump-forward");
      setTimeout(() => {
        falling = true;
        jumpUp = false;
      }, 500);
      setTimeout(() => {
        terry.classList.remove("terry-jump-forward");
        terry.classList.add(landingClass());
        upKey = false;
        falling = false;
        forwardJump = false;
        accumulatedY = 0;
        terry.style.transform = `translateX(${accumulated}px)`;
      }, 1000);
    } else if (lastDir === "left") {
      // Backward jump — 6-step animation, carries leftward momentum.
      backwardJump = true;
      terry.classList.add("terry-jump-backward");
      setTimeout(() => {
        falling = true;
        jumpUp = false;
      }, 500);
      setTimeout(() => {
        terry.classList.remove("terry-jump-backward");
        terry.classList.add(landingClass());
        upKey = false;
        falling = false;
        backwardJump = false;
        accumulatedY = 0;
        terry.style.transform = `translateX(${accumulated}px)`;
      }, 1000);
    } else {
      // Vertical jump.
      terry.classList.add("terry-jump-up");
      setTimeout(() => {
        falling = true;
        jumpUp = false;
        terry.classList.remove("terry-jump-up");
        terry.classList.add("terry-jump-fall");
      }, 500);
      setTimeout(() => {
        terry.classList.remove("terry-jump-fall");
        terry.classList.add(landingClass());
        upKey = false;
        falling = false;
        accumulatedY = 0;
        terry.style.transform = `translateX(${accumulated}px)`;
      }, 1000);
    }
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key == "ArrowRight") {
    rightKey = false;
    if (lastDir === "right") lastDir = leftKey ? "left" : null;
    // During a jump, leave the jump animation and transform alone —
    // touching the transform here drops the Y offset and overlapping
    // classes cause flicker.
    if (upKey) return;
    if (downKey) {
      // Still crouched — drop forward-crouch. If left is still held the
      // active direction is now left, but we don't have a backward-crouch
      // animation, so hold the static crouch frame either way.
      terry.classList.remove("terry-crouch-forward", "terry-crouch");
      terry.classList.add("terry-crouch-still");
    } else if (lastDir === "left") {
      // Left still held — switch to backwards walk.
      terry.classList.remove("terry-forward", "terry-idle");
      terry.classList.add("terry-backwards");
    } else {
      terry.style.transform = `translateX(${terry.getBoundingClientRect().x - terry_position}px)`;
      terry.classList.remove("terry-forward");
      terry.classList.add("terry-idle");
    }
  } else if (event.key == "ArrowLeft") {
    leftKey = false;
    if (lastDir === "left") lastDir = rightKey ? "right" : null;
    if (upKey) return;
    if (downKey) {
      // If right is still held, resume forward-crouch movement.
      if (lastDir === "right") {
        terry.classList.remove("terry-crouch", "terry-crouch-still");
        terry.classList.add("terry-crouch-forward");
      }
      return;
    }
    if (lastDir === "right") {
      // Right still held — switch to forward walk.
      terry.classList.remove("terry-backwards", "terry-idle");
      terry.classList.add("terry-forward");
    } else {
      terry.style.transform = `translateX(${terry.getBoundingClientRect().x - terry_position}px)`;
      terry.classList.remove("terry-backwards");
      terry.classList.add("terry-idle");
    }
  } else if (event.key == "ArrowDown") {
    downKey = false;
    if (upKey) return;
    terry.classList.remove(
      "terry-crouch",
      "terry-crouch-still",
      "terry-crouch-forward",
    );
    terry.style.transform = `translateX(${terry.getBoundingClientRect().x - terry_position}px)`;
    terry.classList.add(
      lastDir === "right"
        ? "terry-forward"
        : lastDir === "left"
          ? "terry-backwards"
          : "terry-idle",
    );
  }
});

function checkKeys() {
  if (jumpUp || falling) {
    if (forwardJump && !reachedRightLimit) accumulated += jumpXStep;
    if (backwardJump && !reachedLeftLimit) accumulated -= jumpXStep;
    if (jumpUp) accumulatedY -= 5;
    if (falling) accumulatedY += 5;
    // Use cqw (container-relative) so all jumps reach the same peak height
    // regardless of which animation's element height is active.
    terry.style.transform = `translate(${accumulated}px,${accumulatedY * 0.3}cqw)`;
  }
  if (upKey) {
    return;
  }
  if (downKey) {
    // Crouching: only forward movement, half walk speed. No backward crouch.
    if (lastDir === "right" && !reachedRightLimit) {
      terry.style.transform = `translateX(${accumulated}px)`;
      accumulated += 5;
    }
    return;
  }
  if (lastDir === "right" && !reachedRightLimit) {
    terry.style.transform = `translateX(${accumulated}px)`;
    accumulated += 10;
  } else if (lastDir === "left" && !reachedLeftLimit) {
    terry.style.transform = `translateX(${accumulated}px)`;
    accumulated -= 10;
  }
}

function checkPosition() {
  let terryCurrentPos = terry.getBoundingClientRect().x;
  // Mirror Terry's per-tick X step: crouch-forward moves at 5px/tick (half
  // walk), so the train scrolls half as fast when at the edge.
  const scrollRate = downKey ? 10 : 20;

  if (terryCurrentPos >= limit - terry.clientWidth) {
    if (terryTrainImg.scrollWidth > terryCurrentPos) {
      train.scrollLeft += scrollRate;
    }
    reachedRightLimit = true;
  } else {
    reachedRightLimit = false;
  }
  if (terryCurrentPos < leftLimit) {
    if (train.scrollLeft > 0) {
      train.scrollLeft -= scrollRate;
    }
    reachedLeftLimit = true;
  } else {
    reachedLeftLimit = false;
  }
}
