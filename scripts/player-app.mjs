/**
 * The players' window: small, with three tabs. "Now" holds the quick signals and the X card, "Mood" the scales,
 * "Wishes" what the player would like next. Everything a player says can be taken back.
 */

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

import {ICONS, STEPS} from "./catalog.mjs";
import {TEMPLATES, isShown, onlinePlayers, setting, t} from "./config.mjs";
import {openFeedback} from "./feedback-app.mjs";
import {
  axisActive, myState, showXCard, signalActive, toggleSignal, toggleWish, vote, wishActive, xcardWaiting
} from "./player.mjs";
import {choices, publicState} from "./state.mjs";

export class PlayerCompass extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "stc-player",
    classes: ["stc", "stc-player"],
    window: {title: "STC.Title", icon: "fa-solid fa-compass", resizable: false},
    position: {width: 320, height: "auto"},
    actions: {
      pickTab: PlayerCompass.#onTab,
      step: PlayerCompass.#onStep,
      signal: PlayerCompass.#onSignal,
      xcard: PlayerCompass.#onXCard,
      wish: PlayerCompass.#onWish,
      openRound: PlayerCompass.#onOpenRound
    }
  };

  /** @override */
  static PARTS = {
    body: {template: `${TEMPLATES}/player.hbs`}
  };

  /** The open tab: "now", "mood" or "wish". */
  tab = "now";

  /** The line under the tabs after the last action. */
  toast = "";

  /** @override */
  get title() {
    return t("STC.Title");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = myState();
    const pub = publicState();
    const chosen = choices();
    context.icons = ICONS;
    context.tabs = ["now", "mood", "wish"].map(id => ({id, label: t(`STC.Player.tab.${id}`), active: this.tab === id}));
    context.tab = {now: this.tab === "now", mood: this.tab === "mood", wish: this.tab === "wish"};
    context.signals = chosen.signals.map(id => ({id, label: t(`STC.Signal.${id}.name`), icon: ICONS[id],
      on: signalActive(id, state.signals[id])}));
    const waiting = xcardWaiting();
    context.xcard = {waiting, label: t(waiting ? "STC.XCard.waiting" : "STC.XCard.button")};
    context.axes = chosen.axes.map(id => {
      const entry = axisActive(state.axes[id]) ? state.axes[id] : null;
      const name = t(`STC.Axis.${id}.name`);
      return {
        id, label: name,
        title: t("STC.Player.axisTitle", {axis: name, low: t(`STC.Axis.${id}.low`), high: t(`STC.Axis.${id}.high`)}),
        steps: STEPS.map(value => ({value, on: entry?.value === value, size: Math.abs(value),
          aria: `${name}: ${stepName(id, value)}`}))
      };
    });
    context.fade = setting("fadeMinutes");
    context.wishes = chosen.wishes.map(id => {
      const on = wishActive(id, state.wishes[id]);
      const soon = on && pub.soon.includes(id);
      return {id, label: t(`STC.Wish.${id}`), icon: ICONS[id], on, soon,
        title: soon ? t("STC.Player.wishSoon", {wish: t(`STC.Wish.${id}`)}) : t(`STC.Wish.${id}`)};
    });
    context.round = pub.round ? {label: t(state.rounds[pub.round.id] ? "STC.Player.roundChange" : "STC.Player.roundOpen")} : null;
    const players = onlinePlayers().length;
    context.warning = !game.users.activeGM ? t("STC.Player.noGM") : (players <= 1 ? t("STC.Player.single") : "");
    context.toast = this.toast ? t(this.toast) : "";
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.stcTheme = setting("theme");
  }

  /**
   * Show what happened to the last action.
   * @param {boolean} delivered   Whether a GM received it
   * @param {string} key          Text when it was delivered
   */
  #report(delivered, key) {
    this.toast = delivered ? key : "STC.Player.queued";
    this.render();
  }

  static #onTab(event, target) {
    this.tab = target.dataset.tab;
    this.toast = "";
    this.render();
  }

  static #onStep(event, target) {
    const id = target.dataset.axis;
    const value = Number(target.dataset.value);
    const current = axisActive(myState().axes[id]) ? myState().axes[id].value : null;
    const taken = current === value;
    this.#report(vote(id, taken ? null : value), taken ? "STC.Player.withdrawn" : "STC.Player.sent");
  }

  static #onSignal(event, target) {
    const id = target.dataset.id;
    const was = signalActive(id, myState().signals[id]);
    this.#report(toggleSignal(id), was ? "STC.Player.withdrawn" : "STC.Player.sent");
  }

  static #onXCard() {
    this.#report(showXCard(), "STC.XCard.sent");
  }

  static async #onOpenRound() {
    await openFeedback();
  }

  static #onWish(event, target) {
    const id = target.dataset.id;
    const was = wishActive(id, myState().wishes[id]);
    this.#report(toggleWish(id), was ? "STC.Player.wishWithdrawn" : "STC.Player.wishSent");
  }
}

/**
 * The name of a step of a scale.
 * @param {string} id
 * @param {number} value
 * @returns {string}
 */
function stepName(id, value) {
  if ( value === 0 ) return t("STC.Player.fine");
  const end = t(`STC.Axis.${id}.${value < 0 ? "low" : "high"}`);
  return t(Math.abs(value) === 2 ? "STC.Player.much" : "STC.Player.bit", {end});
}

/**
 * Open the players' window.
 * @returns {Promise<PlayerCompass>}
 */
export async function openPlayerCompass() {
  const app = foundry.applications.instances.get(PlayerCompass.DEFAULT_OPTIONS.id) ?? new PlayerCompass();
  await app.render({force: true});
  app.bringToFront?.();
  return app;
}

/** Redraw the players' window if it is open. */
export function refreshPlayerCompass() {
  const app = foundry.applications.instances.get(PlayerCompass.DEFAULT_OPTIONS.id);
  if ( isShown(app) ) app.render();
}
