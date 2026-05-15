import { Stage } from "./stage.js";
import { Terry } from "./terry.js";
import { InputController } from "./input.js";

const bgMusic = document.getElementById("bg-music");
const musicBtn = document.getElementById("music-btn");

const stage = new Stage({
  el: document.getElementById("terry-stage-base-layer"),
  train: document.getElementById("terry-train"),
  trainImg: document.getElementById("terry-train-img"),
  miscLayer: document.getElementById("misc-layer"),
});

const terry = new Terry({ el: document.getElementById("terry-animation") });

new InputController({ character: terry, stage });

setInterval(() => {
  stage.update(terry);
  terry.tick();
}, 30);

musicBtn.addEventListener("click", () => {
  bgMusic.volume = 0.2;
  bgMusic.play();
});
