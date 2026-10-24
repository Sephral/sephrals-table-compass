/**
 * Settings of the module. Like in every Sephral module, all options appear in Foundry's settings dialog under this
 * module, starting with the module language. The scales, signals and wishes of the table have their own window.
 */

import {MODULE_ID, isShown} from "./config.mjs";
import {FOLLOW_FOUNDRY, applyModuleLanguage} from "./language.mjs";
import {TableChoices} from "./choices-app.mjs";
import {runSelfTest} from "./selftest.mjs";

/**
 * The settings of the module, in the order they appear in the settings dialog.
 * @type {Record<string, object>}
 */
export const SETTINGS = {
  uiLanguage: {type: String, default: FOLLOW_FOUNDRY, scope: "client", onChange: "language", choices: {
    [FOLLOW_FOUNDRY]: "STC.LANGUAGE.default", de: "STC.LANGUAGE.de", en: "STC.LANGUAGE.en"}},
  theme: {type: String, default: "signature", scope: "client", onChange: "redraw", choices: {
    signature: "STC.SETTINGS.theme.signature", foundry: "STC.SETTINGS.theme.foundry"}},
  minVotes: {type: Number, default: 2, range: {min: 1, max: 5, step: 1}, onChange: "flush"},
  updateDelay: {type: String, default: "short", choices: {
    off: "STC.SETTINGS.updateDelay.off", short: "STC.SETTINGS.updateDelay.short", normal: "STC.SETTINGS.updateDelay.normal"}},
  fadeMinutes: {type: Number, default: 20, range: {min: 5, max: 60, step: 5}, onChange: "flush"},
  signalMinutes: {type: Number, default: 5, range: {min: 1, max: 30, step: 1}, onChange: "flush"},
  freeText: {type: Boolean, default: true},
  xcardSound: {type: Boolean, default: true}
};

/**
 * Register all settings of the module and its menus.
 * @param {{language: Function, redraw: Function, flush: Function, publicChanged: Function, choicesChanged: Function}} handlers
 */
export function registerSettings(handlers) {
  for ( const [key, def] of Object.entries(SETTINGS) ) {
    game.settings.register(MODULE_ID, key, {
      name: `STC.SETTINGS.${key}.name`,
      hint: `STC.SETTINGS.${key}.hint`,
      scope: def.scope ?? "world",
      config: true,
      type: def.range ? new foundry.data.fields.NumberField({...def.range, initial: def.default}) : def.type,
      choices: def.choices,
      default: def.default,
      onChange: def.onChange ? value => handlers[def.onChange]?.(value) : undefined
    });
  }

  // What everyone may know (written by the GM) and what the GM chose for the table
  game.settings.register(MODULE_ID, "public", {scope: "world", config: false, type: Object, default: {},
    onChange: value => handlers.publicChanged?.(value)});
  game.settings.register(MODULE_ID, "choices", {scope: "world", config: false, type: Object, default: {},
    onChange: value => handlers.choicesChanged?.(value)});

  // Kept on the GM's own client: the history of the session and the results of the feedback rounds
  game.settings.register(MODULE_ID, "history", {scope: "client", config: false, type: Object, default: {}});
  game.settings.register(MODULE_ID, "results", {scope: "client", config: false, type: Array, default: []});
  game.settings.register(MODULE_ID, "gmView", {scope: "client", config: false, type: String, default: "orb"});
  game.settings.register(MODULE_ID, "orbPosition", {scope: "client", config: false, type: Object, default: {}});
  game.settings.register(MODULE_ID, "acknowledgedVersions", {scope: "client", config: false, type: String, default: ""});

  game.settings.registerMenu(MODULE_ID, "choices", {
    name: "STC.Choices.title",
    label: "STC.Choices.menuLabel",
    hint: "STC.Choices.menuHint",
    icon: "fa-solid fa-sliders",
    type: TableChoices,
    restricted: true
  });
  game.settings.registerMenu(MODULE_ID, "selfTest", {
    name: "STC.SELFTEST.Title",
    label: "STC.SELFTEST.Run",
    hint: "STC.SELFTEST.Hint",
    icon: "fa-solid fa-stethoscope",
    type: CompassSelfTestMenu,
    restricted: true
  });
}

/** The menu button which runs the self-test. Foundry only accepts application classes as menus. */
class CompassSelfTestMenu extends foundry.applications.api.ApplicationV2 {
  /** @override */
  async render() {
    if ( game.user.isGM ) await runSelfTest();
    return this;
  }
}

/**
 * Switch the module strings when the user picks another module language, then redraw.
 * @param {string} value
 * @param {Function} redraw
 */
export function changeLanguage(value, redraw) {
  applyModuleLanguage(value).then(() => {
    for ( const id of ["stc-gm", "stc-player", "stc-poll", "stc-feedback", "stc-results"] ) {
      const app = foundry.applications.instances.get(id);
      if ( isShown(app) ) app.render({window: {title: app.title}});
    }
    redraw();
    ui.controls?.render({reset: true});
    if ( game.settings.sheet?.rendered ) game.settings.sheet.render();
  });
}

