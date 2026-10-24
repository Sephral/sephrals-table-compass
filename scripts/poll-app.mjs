/**
 * The scene check on a player's screen: "How was the scene?" with five faces, for as long as the GM's check runs.
 * The answer can be changed until the time is up.
 */

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

import {FACES, FACE_MOUTHS} from "./catalog.mjs";
import {POLL_SECONDS, TEMPLATES, isShown, setting, t} from "./config.mjs";
import {answerPoll, myState} from "./player.mjs";
import {publicState} from "./state.mjs";

export class ScenePoll extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "stc-poll",
    classes: ["stc", "stc-poll"],
    window: {title: "STC.Poll.title", icon: "fa-solid fa-stopwatch", resizable: false, minimizable: false},
    position: {width: 340, height: "auto", top: 90},
    actions: {face: ScenePoll.#onFace}
  };

  /** @override */
  static PARTS = {
    body: {template: `${TEMPLATES}/poll.hbs`}
  };

  #ticker = null;

  /** @override */
  get title() {
    return t("STC.Poll.title");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const poll = publicState().poll;
    const answer = poll ? myState().polls[poll.id]?.value : null;
    const left = poll ? secondsLeft(poll) : 0;
    context.left = left;
    context.progress = poll ? Math.min(100, Math.max(0, (left / (poll.seconds ?? POLL_SECONDS)) * 100)) : 0;
    context.faces = FACES.map(face => ({face, label: t(`STC.Poll.face.${face}`), mouth: FACE_MOUTHS[face], on: answer === face}));
    context.answered = answer !== null && answer !== undefined;
    return context;
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    arrange();
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.stcTheme = setting("theme");
    if ( !this.#ticker ) this.#ticker = setInterval(() => {
      const poll = publicState().poll;
      if ( !poll || (secondsLeft(poll) <= 0) ) this.close();
      else this.render({parts: ["body"]});
    }, 1000);
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    clearInterval(this.#ticker);
    this.#ticker = null;
  }

  static #onFace(event, target) {
    const poll = publicState().poll;
    if ( !poll ) return this.close();
    const face = Number(target.dataset.face);
    const current = myState().polls[poll.id]?.value;
    answerPoll(poll.id, current === face ? null : face);
    this.render();
  }
}

/**
 * The scene check and the feedback form side by side when both are open, the scene check in front: it runs for a few
 * seconds only and must not hide behind the form.
 */
export function arrange() {
  setTimeout(() => {
    const poll = foundry.applications.instances.get(ScenePoll.DEFAULT_OPTIONS.id);
    const form = foundry.applications.instances.get("stc-feedback");
    if ( !poll?.rendered || !form?.rendered ) return;
    const gap = 10;
    const {left, top, width} = form.position;
    const right = left + width + gap;
    const x = (right + poll.position.width <= window.innerWidth) ? right : Math.max(left - poll.position.width - gap, 0);
    poll.setPosition({left: x, top});
    poll.bringToFront();
  }, 0);
}

/** When this client first saw each scene check: the clocks of the computers may differ, so each counts for itself. */
const seen = new Map();

/**
 * Seconds left of a scene check on this client.
 * @param {{id: string, seconds: number}} poll
 * @returns {number}
 */
function secondsLeft(poll) {
  if ( !seen.has(poll.id) ) seen.set(poll.id, Date.now());
  const total = (poll.seconds ?? POLL_SECONDS) * 1000;
  return Math.max(Math.ceil((total - (Date.now() - seen.get(poll.id))) / 1000), 0);
}

/** Open or close the scene check after a change of the public state (players only). */
export function syncPoll() {
  if ( game.user.isGM ) return;
  const poll = publicState().poll;
  const app = foundry.applications.instances.get(ScenePoll.DEFAULT_OPTIONS.id);
  if ( poll && (secondsLeft(poll) > 0) ) {
    if ( !isShown(app) ) (app ?? new ScenePoll()).render({force: true});
  }
  else if ( isShown(app) ) app.close();
}
