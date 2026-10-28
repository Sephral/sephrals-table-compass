import assert from "node:assert/strict";
import {mock, test} from "node:test";

// The tracker runs intervals, the mocked clock keeps them from holding the test process open
mock.timers.enable({apis: ["setTimeout", "setInterval", "Date"], now: 1_700_000_000_000});

const {settle, values} = await import("./fake-foundry.mjs");
const menus = new Map();
const hooks = new Map();
game.settings.registerMenu = (module, key, data) => menus.set(`${module}.${key}`, data);
game.settings.settings = new Map();
globalThis.foundry.applications = {api: {ApplicationV2: class {}}};
globalThis.Hooks = {on: (name, fn) => hooks.set(name, fn), once: () => {}, callAll: () => {}};

const {MODULE_ID} = await import("../scripts/config.mjs");
const tracker = await import("../scripts/tracker.mjs");
const {describeState, registerDebug} = await import("../scripts/debug.mjs");

test("the menu button and the part of the debug file are registered", () => {
  registerDebug();
  const menu = menus.get(`${MODULE_ID}.debugFile`);
  assert.equal(menu.restricted, true);
  assert.equal(menu.label, "STC.DEBUG.Save");
  const provider = globalThis.sephralsDebugFiles.providers.get(MODULE_ID);
  assert.deepEqual(provider.omitSettings, ["history", "results"]);
  // The compass reads no chat messages
  assert.equal(provider.message, undefined);
  assert.equal(typeof hooks.get("getChatMessageContextOptions"), "function");
});

test("the state holds counts only: no values, tokens, wishes or ratings", async () => {
  await tracker.startTracking();
  await settle();
  values.set("updateDelay", "off");
  tracker.receive({type: "axis", token: "TokenSecret00001", id: "pace", value: -1});
  tracker.receive({type: "wish", token: "TokenSecret00002", id: "trade", on: true});
  tracker.receive({type: "xcard", token: "TokenSecret00003"});
  await settle();
  const state = describeState();
  assert.equal(state.thisClientIsActiveGM, true);
  assert.ok(state.session?.id);
  assert.equal(state.live.axes, 1);
  assert.equal(state.live.wishes, 1);
  assert.equal(state.live.xcards, 1);
  const text = JSON.stringify(state);
  for ( const secret of ["TokenSecret", "pace", "trade", "-1"] ) assert.equal(text.includes(secret), false, secret);
  tracker.stopTracking();
});
