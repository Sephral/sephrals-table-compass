/**
 * The window "Lines and veils", for the session zero and any time later. A player sets lines and veils with one click
 * on a suggestion or in their own words and sees the shared list below, without names. The GM sees the same list,
 * adds entries of their own and can ask the table to say theirs.
 */

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

import {ICONS, LV_TOPICS} from "./catalog.mjs";
import {MODULE_ID, TEMPLATES, addSettingsGear, isShown, setting, t} from "./config.mjs";
import {addGMItem, myLines, removeGMItem, sharedItems, toggleOwn} from "./lines.mjs";
import {LV_KINDS, LV_MAX_OWN, LV_TEXT_LIMIT, itemKey} from "./lines-rules.mjs";
import {callLines} from "./tracker.mjs";
import {sampleBlocked} from "./samples.mjs";
import {countFeature, markUsed} from "./usage.mjs";

export class LinesWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options={}) {
    super(foundry.utils.mergeObject({position: {left: Math.max(window.innerWidth - 1040, 120), top: 70}}, options));
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "stc-lines",
    classes: ["stc", "stc-lines"],
    window: {title: "STC.Lines.title", icon: "fa-solid fa-ban", resizable: false},
    position: {width: 400, height: "auto"},
    actions: {
      topic: LinesWindow.#onTopic,
      addText: LinesWindow.#onAddText,
      removeText: LinesWindow.#onRemoveText,
      call: LinesWindow.#onCall
    }
  };

  /** @override */
  static PARTS = {
    body: {template: `${TEMPLATES}/lines.hbs`, scrollable: [""]}
  };

  /** What is typed in the text fields, by kind, so a redraw does not wipe it. */
  drafts = {line: "", veil: ""};

  /** The line under the title after the last action. */
  toast = "";

  /** Sample windows read what they show from here (see sample-windows.mjs) instead of from the live state. */
  src = null;

  /** @override */
  get title() {
    return t("STC.Lines.title");
  }

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    addSettingsGear(frame);
    return frame;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const gm = this.src ? this.src.isGM : game.user.isGM;
    const shared = this.src ? this.src.shared : sharedItems();
    const own = gm ? shared.filter(i => i.gm) : Object.values(this.src ? this.src.own : myLines().entries);
    const ownKeys = new Set(own.map(itemKey));
    const freeText = setting("linesFreeText") !== false;
    context.icons = ICONS;
    context.isGM = gm;
    context.freeText = freeText;
    context.intro = t(gm ? "STC.Lines.introGM" : "STC.Lines.introPlayer");
    context.kinds = LV_KINDS.map(kind => ({
      kind, title: t(`STC.Lines.${kind}.title`), hint: t(`STC.Lines.${kind}.hint`),
      placeholder: t(`STC.Lines.${kind}.placeholder`), draft: this.drafts[kind] ?? "", limit: LV_TEXT_LIMIT,
      chips: LV_TOPICS.map(topic => ({topic, label: t(`STC.Lines.topic.${topic}`),
        on: ownKeys.has(itemKey({kind, topic}))})),
      texts: own.filter(i => (i.kind === kind) && i.text).map(i => ({text: i.text}))
    }));
    context.shared = LV_KINDS.map(kind => ({
      kind, title: t(`STC.Lines.${kind}.shared`),
      items: shared.filter(i => i.kind === kind).map(i => ({label: i.topic ? t(`STC.Lines.topic.${i.topic}`) : i.text, gm: !!i.gm}))
    }));
    context.sharedEmpty = !shared.length;
    context.full = !gm && (Object.keys(this.src ? this.src.own : myLines().entries).length >= LV_MAX_OWN);
    context.fullText = t("STC.Lines.full", {max: LV_MAX_OWN});
    context.toast = this.toast ? t(this.toast) : "";
    context.noGM = this.src ? !!this.src.noGM : (!game.user.isGM && !game.users.activeGM);
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.stcTheme = setting("theme");
    // A redraw (another player's entry arrives) puts the focus back into the field, the cursor goes to the end
    const focused = this.element.querySelector("input[data-draft]:focus");
    if ( focused ) focused.setSelectionRange(focused.value.length, focused.value.length);
    for ( const input of this.element.querySelectorAll("input[data-draft]") ) {
      input.addEventListener("input", () => {
        this.drafts[input.dataset.draft] = input.value;
      });
      input.addEventListener("keydown", event => {
        if ( event.key !== "Enter" ) return;
        event.preventDefault();
        this.#addText(input.dataset.draft);
      });
    }
  }

  /**
   * Set or take back an entry of this user.
   * @param {{kind: string, topic?: string, text?: string}} value
   * @param {boolean} [forceOff]   Take it back whatever its state
   */
  async #change(value, forceOff=false) {
    if ( this.src ) return sampleBlocked();
    if ( game.user.isGM ) {
      const key = itemKey(value);
      const on = sharedItems().some(i => i.gm && (itemKey(i) === key));
      if ( on || forceOff ) await removeGMItem(key);
      else await addGMItem(value);
      this.toast = "";
    }
    else {
      const result = toggleOwn(value);
      this.toast = !result.ok ? (result.reason === "full" ? "STC.Lines.fullToast" : "STC.Lines.invalid")
        : (result.delivered ? (result.on ? "STC.Lines.sent" : "STC.Player.withdrawn") : "STC.Player.queued");
    }
    this.render();
  }

  /**
   * Add the text of a field.
   * @param {string} kind
   */
  async #addText(kind) {
    const text = String(this.drafts[kind] ?? "").trim();
    if ( !text ) return;
    this.drafts[kind] = "";
    await this.#change({kind, text});
  }

  static async #onTopic(event, target) {
    await this.#change({kind: target.dataset.kind, topic: target.dataset.topic});
  }

  static async #onAddText(event, target) {
    await this.#addText(target.dataset.kind);
  }

  static async #onRemoveText(event, target) {
    await this.#change({kind: target.dataset.kind, text: target.dataset.text}, true);
  }

  static async #onCall() {
    await callLines();
    ui.notifications.info(t("STC.Lines.called"));
  }
}

/**
 * Open the window.
 * @returns {Promise<LinesWindow>}
 */
export async function openLines() {
  const app = foundry.applications.instances.get(LinesWindow.DEFAULT_OPTIONS.id) ?? new LinesWindow();
  await app.render({force: true});
  app.bringToFront?.();
  if ( game.user.isGM ) {
    countFeature(MODULE_ID, "linesWindow");
    markUsed(MODULE_ID);
  }
  return app;
}

/** Redraw the window if it is open. */
export function refreshLines() {
  const app = foundry.applications.instances.get(LinesWindow.DEFAULT_OPTIONS.id);
  if ( isShown(app) ) app.render();
}
