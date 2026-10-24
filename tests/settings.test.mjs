import assert from "node:assert/strict";
import test from "node:test";

// settings.mjs and the modules it imports touch these Foundry APIs at import time
globalThis.foundry = {
  utils: {debounce: fn => fn, deepClone: value => structuredClone(value)},
  applications: {api: {ApplicationV2: class {}, HandlebarsApplicationMixin: Base => class extends Base {}, DialogV2: class {}}},
  data: {fields: {NumberField: class {
    constructor(options) {
      Object.assign(this, options);
    }
  }}}
};

const {MODULE_ID} = await import("../scripts/config.mjs");
const {FOLLOW_FOUNDRY} = await import("../scripts/language.mjs");
const {SETTINGS, registerSettings} = await import("../scripts/settings.mjs");
const {checkedIds} = await import("../scripts/choices-app.mjs");
const {AXES, DEFAULT_AXES, DEFAULT_WISHES, SIGNALS, WISHES} = await import("../scripts/catalog.mjs");

/**
 * Register the settings with a stub of game.settings which records every call.
 * @param {object} [handlers]
 * @returns {{settings: Map<string, object>, menus: Map<string, object>}}
 */
function register(handlers={}) {
  const settings = new Map();
  const menus = new Map();
  globalThis.game = {settings: {
    register: (module, key, data) => settings.set(`${module}.${key}`, data),
    registerMenu: (module, key, data) => menus.set(`${module}.${key}`, data)
  }};
  registerSettings(handlers);
  const strip = map => new Map([...map].map(([key, data]) => [key.replace(`${MODULE_ID}.`, ""), data]));
  return {settings: strip(settings), menus: strip(menus)};
}

test("the module language comes first and follows Foundry by default", () => {
  const {settings} = register();
  assert.equal([...settings.keys()][0], "uiLanguage");
  assert.equal(settings.get("uiLanguage").scope, "client");
  assert.equal(settings.get("uiLanguage").default, FOLLOW_FOUNDRY);
});

test("the anonymity settings are world settings with safe defaults", () => {
  const {settings} = register();
  assert.equal(settings.get("minVotes").scope, "world");
  assert.equal(settings.get("minVotes").default, 2);
  assert.equal(settings.get("updateDelay").default, "short");
  assert.equal(settings.get("fadeMinutes").default, 20);
  for ( const key of Object.keys(SETTINGS) ) assert.equal(settings.get(key).config, true, key);
});

test("the GM's history and results stay on the GM's own client, the public state is a world setting", () => {
  const {settings, menus} = register();
  assert.equal(settings.get("history").scope, "client");
  assert.equal(settings.get("results").scope, "client");
  assert.equal(settings.get("public").scope, "world");
  assert.equal(settings.get("public").config, false);
  assert.ok(menus.get("choices").restricted);
  assert.ok(menus.get("selfTest").restricted);
});

test("changes reach the handlers of the entry file", () => {
  const calls = [];
  const {settings} = register({publicChanged: v => calls.push(["public", v]), redraw: () => calls.push(["redraw"]),
    flush: () => calls.push(["flush"])});
  settings.get("public").onChange({xAck: 1});
  settings.get("theme").onChange("foundry");
  settings.get("minVotes").onChange(3);
  assert.deepEqual(calls, [["public", {xAck: 1}], ["redraw"], ["flush"]]);
});

test("the choice form keeps catalog order and only known ids", () => {
  assert.deepEqual(checkedIds({combat: true, pace: true, nope: true, tension: false}, AXES), ["pace", "combat"]);
  assert.deepEqual(checkedIds(undefined, SIGNALS), []);
  assert.ok(DEFAULT_AXES.every(id => AXES.includes(id)));
  assert.equal(DEFAULT_WISHES.length, 12);
  assert.ok(WISHES.includes("romance") && !DEFAULT_WISHES.includes("romance"));
});
