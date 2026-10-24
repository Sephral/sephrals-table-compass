/**
 * The GM chooses what the table can say: which scales, signals and wishes the players' window offers.
 */

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

import {AXES, ICONS, SIGNALS, WISHES} from "./catalog.mjs";
import {MODULE_ID, TEMPLATES, t} from "./config.mjs";
import {choices} from "./state.mjs";
import {countFeature} from "./usage.mjs";

/**
 * The checked ids of one group of the form, in catalog order.
 * @param {Record<string, boolean>} checked
 * @param {string[]} known
 * @returns {string[]}
 */
export function checkedIds(checked, known) {
  return known.filter(id => checked?.[id]);
}

export class TableChoices extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "stc-choices",
    tag: "form",
    classes: ["stc-choices"],
    window: {title: "STC.Choices.title", icon: "fa-solid fa-sliders", contentClasses: ["standard-form"]},
    position: {width: 520},
    form: {handler: TableChoices.#onSubmit, closeOnSubmit: true}
  };

  /** @override */
  static PARTS = {
    form: {template: `${TEMPLATES}/choices.hbs`},
    footer: {template: "templates/generic/form-footer.hbs"}
  };

  /** @override */
  get title() {
    return t("STC.Choices.title");
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const chosen = choices();
    context.axes = AXES.map(id => ({id, checked: chosen.axes.includes(id), label: t(`STC.Axis.${id}.name`),
      hint: `${t(`STC.Axis.${id}.low`)} · ${t(`STC.Axis.${id}.high`)}`}));
    context.signals = SIGNALS.map(id => ({id, checked: chosen.signals.includes(id), label: t(`STC.Signal.${id}.name`),
      icon: ICONS[id]}));
    context.wishes = WISHES.map(id => ({id, checked: chosen.wishes.includes(id), label: t(`STC.Wish.${id}`), icon: ICONS[id]}));
    context.buttons = [{type: "submit", icon: "fa-solid fa-floppy-disk", label: "STC.Choices.save"}];
    return context;
  }

  /**
   * Save the choice.
   * @this {TableChoices}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit(event, form, formData) {
    if ( !game.user.isGM ) return;
    const data = foundry.utils.expandObject(formData.object);
    await game.settings.set(MODULE_ID, "choices", {
      axes: checkedIds(data.axes, AXES),
      signals: checkedIds(data.signals, SIGNALS),
      wishes: checkedIds(data.wishes, WISHES)
    });
    countFeature(MODULE_ID, "tableChoices");
  }
}

/**
 * Open the choice of scales, signals and wishes.
 * @returns {Promise<TableChoices>}
 */
export async function openChoices() {
  const app = foundry.applications.instances.get(TableChoices.DEFAULT_OPTIONS.id) ?? new TableChoices();
  await app.render({force: true});
  app.bringToFront?.();
  return app;
}
