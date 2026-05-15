// The world. Owns the stage backdrop, train, and misc parallax layer; tracks
// edge limits and scrolls the train when a character bumps against them.
// Characters do not know the stage exists — the Stage queries them each
// tick and writes blocked-direction flags back.
export class Stage {
  constructor({ el, train, trainImg, miscLayer, scrollRates = { walking: 20, crouching: 10 } }) {
    this.el = el;
    this.train = train;
    this.trainImg = trainImg;
    this.miscLayer = miscLayer;
    this.scrollRates = scrollRates;
    this.rightLimit = el.getBoundingClientRect().right;
    this.leftLimit = el.getBoundingClientRect().left;

    el.classList.add("stage-translate");
    if (miscLayer) miscLayer.classList.add("misc-translate");
    if (train) train.classList.add("train-bump");
  }

  // World data a character action needs at trigger time. Combines stage
  // width with the character's own leap percentage.
  computeJumpStep(character) {
    return (this.el.getBoundingClientRect().width * character.config.jumpDistancePct) /
           character.config.jumpTicks;
  }

  // Called each tick before the character's own tick. Updates the
  // character's blocked-direction flags and scrolls the train if the
  // character is pressed against an edge.
  update(character) {
    const cur = character.getX();
    const w = character.getWidth();
    const blockedRight = cur >= this.rightLimit - w;
    const blockedLeft  = cur < this.leftLimit;

    character.setBlocked({ right: blockedRight, left: blockedLeft });

    // Train scrolls at the character's effective ground speed — crouch is
    // half walk, so the world scrolls half-speed to match.
    const rate = character.downKey ? this.scrollRates.crouching : this.scrollRates.walking;
    if (blockedRight && this.trainImg.scrollWidth > cur) this.train.scrollLeft += rate;
    if (blockedLeft  && this.train.scrollLeft > 0)       this.train.scrollLeft -= rate;
  }
}
