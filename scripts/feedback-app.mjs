/**
 * The feedback round on a player's screen. The GM opens it at the end of the session; the answers go to the GM
 * without a name and can be changed until the GM closes the round.
 */

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

import {ICONS, TOPICS} from "./catalog.mjs";
import {TEMPLATES, isShown, setting, t} from "./config.mjs";
import {myState, submitFeedback} from "./player.mjs";
import {arrange} from "./poll-app.mjs";
import {cleanAnswers} from "./rules.mjs";
import {publicState} from "./state.mjs";

/** Rounds this player skipped, so the form does not open again. */
const skipped = new Set();

export class FeedbackForm extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "stc-feedback",
    classes: ["stc", "stc-feedback"],
    window: {title: "STC.Feedback.title", icon: "fa-solid fa-comment-dots", resizable: false},
    position: {width: 360, height: "auto", top: 70},
    actions: {
      star: FeedbackForm.#onStar,
      tempo: FeedbackForm.#onTempo,
      topic: FeedbackForm.#onTopic,
      send: FeedbackForm.#onSend,
      skip: FeedbackForm.#onSkip,
      edit: FeedbackForm.#onEdit
    }
  };

  /** @override */
  static PARTS = {
    body: {template: `${TEMPLATES}/feedback.hbs`, scrollable: [""]}
  };

  /** The answers being written. */
  draft = cleanAnswers({});

  /** The round this form belongs to. */
  round = null;

  /** Whether the answers of this round were sent and the form shows the thanks. */
  sent = false;

  /** @override */
  get title() {
    return t("STC.Feedback.title");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const round = publicState().round;
    if ( round && (round.id !== this.round) ) {
      this.round = round.id;
      const earlier = myState().rounds[round.id];
      this.draft = cleanAnswers(earlier?.answers ?? {});
      this.sent = !!earlier;
    }
    const d = this.draft;
    context.icons = ICONS;
    context.sent = this.sent;
    context.count = round?.count ?? 0;
    context.stars = [1, 2, 3, 4, 5].map(n => ({n, on: (d.stars ?? 0) >= n, label: t("STC.Feedback.starLabel", {n})}));
    context.tempo = [-1, 0, 1].map(v => ({v, on: d.tempo === v, label: t(`STC.Feedback.tempo.${v + 1}`)}));
    const marks = {highlights: "★", more: "+", less: "−"};
    context.topics = TOPICS.map(id => ({id, label: t(`STC.Topic.${id}`), cells: ["highlights", "more", "less"].map(group => ({
      group, mark: marks[group], on: d[group].includes(id),
      aria: `${t(`STC.Topic.${id}`)}: ${t(`STC.Feedback.col.${group}`)}`
    }))}));
    context.freeText = setting("freeText");
    context.texts = ["rose", "thorn", "bud"].map(kind => ({kind, label: t(`STC.Feedback.${kind}`), value: d[kind]}));
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
    for ( const area of this.element.querySelectorAll("textarea[data-kind]") ) {
      area.addEventListener("input", () => {
        this.draft[area.dataset.kind] = area.value;
      });
    }
  }

  static #onStar(event, target) {
    const n = Number(target.dataset.n);
    this.draft.stars = this.draft.stars === n ? null : n;
    this.render();
  }

  static #onTempo(event, target) {
    const v = Number(target.dataset.v);
    this.draft.tempo = this.draft.tempo === v ? null : v;
    this.render();
  }

  static #onTopic(event, target) {
    const {group, id} = target.dataset;
    const list = this.draft[group];
    const on = !list.includes(id);
    this.draft[group] = on ? [...list, id] : list.filter(x => x !== id);
    // More and less of the same topic exclude each other
    const other = {more: "less", less: "more"}[group];
    if ( on && other ) this.draft[other] = this.draft[other].filter(x => x !== id);
    this.render();
  }

  static #onSend() {
    const round = publicState().round;
    if ( !round ) return this.close();
    const delivered = submitFeedback(round.id, this.draft);
    if ( !delivered ) ui.notifications.warn(t("STC.Player.queued"));
    this.sent = true;
    this.render();
  }

  static #onSkip() {
    const round = publicState().round;
    if ( round ) skipped.add(round.id);
    this.close();
  }

  static #onEdit() {
    this.sent = false;
    this.render();
  }
}

/** Open or close the feedback form after a change of the public state (players only). */
export function syncFeedback() {
  if ( game.user.isGM ) return;
  const round = publicState().round;
  const app = foundry.applications.instances.get(FeedbackForm.DEFAULT_OPTIONS.id);
  if ( round ) {
    // The count of answers changes while players type: redraw only for another round
    if ( isShown(app) ) {
      if ( app.round !== round.id ) app.render();
    }
    else if ( !skipped.has(round.id) ) (app ?? new FeedbackForm()).render({force: true});
  }
  else if ( isShown(app) ) {
    app.close();
    ui.notifications.info(t("STC.Feedback.closed"));
  }
}

/**
 * Open the form of the running round, also after skipping it.
 * @returns {Promise<FeedbackForm|null>}
 */
export async function openFeedback() {
  const round = publicState().round;
  if ( !round || game.user.isGM ) return null;
  skipped.delete(round.id);
  const app = foundry.applications.instances.get(FeedbackForm.DEFAULT_OPTIONS.id) ?? new FeedbackForm();
  await app.render({force: true});
  app.bringToFront?.();
  return app;
}

