var x = document.getElementById('bg-music');
var terryStage = document.getElementById("terry-stage-base-layer")
var miscLayer = document.getElementById("misc-layer")
var train = document.getElementById("terry-train")
var terry = document.getElementById("terry-animation");

var terry_position = terry.getBoundingClientRect().x;
var limit = terryStage.getBoundingClientRect().right;
var reachedLimit = false;
var accumulated = 4;

var rightKey = false;
var leftKey = false;

setInterval(checkKeys, 30);
console.log(terryStage.getBoundingClientRect())

function playAudio() {
    x.volume = 0.20;
    x.play();
    terryStage.classList.add("stage-translate");
    miscLayer.classList.add("misc-translate");
    train.classList.add("train-bump")

    window.addEventListener("keydown", (event) => {
        if (event.key == "ArrowRight") {
            if (terry.getBoundingClientRect().x >= limit - 140) {
                reachedLimit = true;
                return;
            }
            terry.classList.remove("terry-idle")
            terry.classList.add("terry-forward")
            terry.classList.add("translate-animation")
            rightKey = true;
        }
    })

    window.addEventListener("keyup", (event) => {
        if (event.key == "ArrowRight") {
            terry.style.transform = `translateX(${terry.getBoundingClientRect().x - terry_position}px)`
            terry.classList.remove("terry-forward")
            terry.classList.remove("translate-animation")
            terry.classList.add("terry-idle")
            rightKey = false;
        }
    })
}

function checkKeys() {
    if (rightKey && !reachedLimit) {
        terry.style.transform = `translateX(${accumulated}px)`
        accumulated += 4;
    }
}