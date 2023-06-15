var x = document.getElementById('bg-music');
var terryStage = document.getElementById("terry-stage-base-layer")
var miscLayer = document.getElementById("misc-layer")
var train = document.getElementById("terry-train")
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
var falling = false;

setInterval(checkPosition, 30);
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
            terry.classList.remove("terry-idle")
            terry.classList.add("terry-forward")
            rightKey = true;
        }
        else if (event.key == "ArrowLeft") {
            terry.classList.remove("terry-idle")
            terry.classList.add("terry-backwards")
            leftKey = true;
        }
        else if (event.key == "ArrowUp") {
            terry.classList.remove("terry-idle")
            terry.classList.add("terry-jump")
            upKey = true;
            setTimeout(() => {
                falling = true;
            }, 750)
            setTimeout(() => {
                terry.classList.remove("terry-jump")
                terry.classList.add("terry-idle")
                upKey = false
                falling = false;
            }, 1500)
        }
    })

    window.addEventListener("keyup", (event) => {
        if (event.key == "ArrowRight") {
            terry.style.transform = `translateX(${terry.getBoundingClientRect().x - terry_position}px)`
            terry.classList.remove("terry-forward")
            terry.classList.add("terry-idle")
            rightKey = false;
        } else if (event.key == "ArrowLeft") {
            terry.style.transform = `translateX(${terry.getBoundingClientRect().x - terry_position}px)`
            terry.classList.remove("terry-backwards")
            terry.classList.add("terry-idle")
            leftKey = false;
        }
    })
}

function checkKeys() {
    if (falling) {
        terry.style.transform = `translate(${accumulated}px,${accumulatedY}%)`
        accumulatedY += 6
    }
    if (upKey) {
        terry.style.transform = `translate(${accumulated}px,${accumulatedY}%)`
        accumulatedY -= 3
        return;
    }
    if (rightKey && !reachedRightLimit) {
        terry.style.transform = `translateX(${accumulated}px)`
        accumulated += 4;
    }
    if (leftKey && !reachedLeftLimit) {
        terry.style.transform = `translateX(${accumulated}px)`
        accumulated -= 4;
    }
}

function checkPosition() {
    if (terry.getBoundingClientRect().x >= limit - 140) {
        reachedRightLimit = true;
    } else {
        reachedRightLimit = false;
    }
    if (terry.getBoundingClientRect().x < leftLimit) {
        reachedLeftLimit = true;
    } else {
        reachedLeftLimit = false;
    }
}