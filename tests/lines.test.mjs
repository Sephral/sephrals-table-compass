import assert from "node:assert/strict";
import {mock, test} from "node:test";

mock.timers.enable({apis: ["setTimeout", "setInterval", "Date"], now: 1_700_000_000_000});

const {notes, sent, sentOf, settle, storage, users, values} = await import("./fake-foundry.mjs");
const tracker = await import("../scripts/tracker.mjs");
const lines = await import("../scripts/lines.mjs");
const {publicState} = await import("../scripts/state.mjs");
const {itemKey} = await import("../scripts/lines-rules.mjs");

const tick = async ms => {
  mock.timers.tick(ms);
  await settle();
};
const published = () => lines.sharedItems().map(i => i.topic ?? i.text);

/** The player's side of one user: switch the browser to that user. */
function as(user) {
  game.user = user;
  lines.__test__.resetMine();
}

test("the active GM starts with an empty list", async () => {
  await tracker.startTracking();
  await settle();
  assert.deepEqual(lines.sharedItems(), []);
});

test("a player sets a line and a veil, the list shows them after the wait, without any name", async () => {
  values.set("updateDelay", "short");
  as(users.p1);
  const first = lines.toggleOwn({kind: "line", topic: "spiders"});
  const second = lines.toggleOwn({kind: "veil", text: "  A death of a child  "});
  assert.deepEqual([first.ok, first.on, first.delivered], [true, true, true]);
  assert.equal(second.on, true);
  const messages = sentOf("lv");
  assert.equal(messages.length, 2);
  assert.deepEqual(messages.map(m => m.to), [[users.gm.id], [users.gm.id]]);
  assert.ok(messages.every(m => !("userId" in m.message) && !("user" in m.message)));
  as(users.gm);
  messages.forEach(m => tracker.receive(m.message));
  // Nothing yet: the batch waits
  assert.deepEqual(published(), []);
  await tick(46 * 1000);
  assert.deepEqual(published(), ["spiders", "A death of a child"]);
  assert.equal(JSON.stringify(values.get("lv")).includes(users.p1.id), false);
  values.set("updateDelay", "off");
});

test("two players with the same entry make one entry, and it stays until both took it back", async () => {
  as(users.p2);
  lines.toggleOwn({kind: "line", topic: "spiders"});
  const message = sentOf("lv").at(-1).message;
  as(users.gm);
  tracker.receive(message);
  await tick(0);
  assert.deepEqual(published(), ["spiders", "A death of a child"]);
  as(users.p2);
  lines.toggleOwn({kind: "line", topic: "spiders"});
  const off = sentOf("lv").at(-1).message;
  assert.equal(off.on, false);
  as(users.gm);
  tracker.receive(off);
  await tick(0);
  assert.deepEqual(published(), ["spiders", "A death of a child"], "player one still holds it");
  as(users.p1);
  lines.toggleOwn({kind: "line", topic: "spiders"});
  as(users.gm);
  tracker.receive(sentOf("lv").at(-1).message);
  await tick(0);
  assert.deepEqual(published(), ["A death of a child"]);
});

test("broken messages and unknown entries are dropped, free text can be switched off", async () => {
  as(users.gm);
  const before = JSON.stringify(values.get("lv"));
  tracker.receive({type: "lv", token: "x", kind: "line", topic: "gore", on: true});
  tracker.receive({type: "lv", token: "AbCdEfGh12345678", kind: "line", topic: "nonsense", on: true});
  tracker.receive({type: "lv", token: "AbCdEfGh12345678", kind: "other", text: "x", on: true});
  values.set("linesFreeText", false);
  tracker.receive({type: "lv", token: "AbCdEfGh12345678", kind: "line", text: "Clowns", on: true});
  await tick(0);
  assert.equal(JSON.stringify(values.get("lv")), before);
  values.set("linesFreeText", true);
  as(users.p1);
  values.set("linesFreeText", false);
  assert.deepEqual(lines.toggleOwn({kind: "line", text: "Clowns"}), {ok: false, reason: "invalid"});
  values.set("linesFreeText", true);
});

test("a player has a limit, and what they set survives a new session and a reload", async () => {
  as(users.p1);
  const before = Object.keys(lines.myLines().entries).length;
  for ( let i = 0; i < 20; i++ ) lines.toggleOwn({kind: "line", text: `thing ${i}`});
  assert.equal(Object.keys(lines.myLines().entries).length, 12);
  assert.deepEqual(lines.toggleOwn({kind: "line", text: "one too many"}), {ok: false, reason: "full"});
  assert.ok(before < 12);
  // A new session does not reset them
  as(users.gm);
  await tracker.newSession({quiet: true});
  await settle();
  as(users.p1);
  assert.equal(Object.keys(lines.myLines().entries).length, 12);
  assert.ok([...storage.keys()].some(key => key.endsWith(".lines")));
  // The active GM asks for everything again: the messages go out with the same tokens
  const messages = lines.linesMessages();
  assert.equal(messages.length, 12);
  assert.ok(messages.every(m => m.on === true));
  as(users.gm);
  assert.deepEqual(lines.linesMessages(), []);
});

test("the GM adds and removes entries of their own, an assistant GM asks the active GM", async () => {
  as(users.gm);
  assert.equal(await lines.addGMItem({kind: "line", topic: "torture"}), true);
  assert.ok(lines.sharedItems().some(i => i.topic === "torture" && i.gm));
  assert.equal(await lines.addGMItem({kind: "line", topic: "bogus"}), false);
  // A GM entry is not a player's entry
  assert.equal(lines.sharedItems().find(i => i.topic === "torture").gm, true);
  game.user = users.assistant;
  const from = sent.length;
  await lines.addGMItem({kind: "veil", text: "Rats"});
  await lines.removeGMItem(itemKey({kind: "line", topic: "torture"}));
  const actions = sentOf("action", from);
  assert.deepEqual(actions.map(a => a.message.action), ["lvAdd", "lvRemove"]);
  assert.ok(actions.every(a => a.to.length === 1 && a.to[0] === users.gm.id));
  assert.ok(!lines.sharedItems().some(i => i.text === "Rats"), "nothing changed on the assistant's side");
  game.user = users.gm;
  actions.forEach(a => tracker.runAction(a.message));
  await settle();
  assert.ok(lines.sharedItems().some(i => i.text === "Rats" && i.gm));
  assert.ok(!lines.sharedItems().some(i => i.topic === "torture"));
  // Players cannot add GM entries
  as(users.p1);
  assert.equal(await lines.addGMItem({kind: "line", topic: "gore"}), false);
  as(users.gm);
});

test("a GM entry and a player entry of the same thing are one entry, and the list is not lost by the next batch", async () => {
  as(users.p2);
  lines.toggleOwn({kind: "veil", text: "rats"});
  const message = sentOf("lv").at(-1).message;
  as(users.gm);
  tracker.receive(message);
  await tick(0);
  assert.equal(lines.sharedItems().filter(i => itemKey(i) === itemKey({kind: "veil", text: "Rats"})).length, 1);
  assert.ok(lines.sharedItems().some(i => i.text === "A death of a child"), "the earlier entry is still there");
});

test("asking the table raises a counter the players' windows follow", async () => {
  as(users.gm);
  const before = publicState().lvCall;
  await tracker.callLines();
  await settle();
  assert.equal(publicState().lvCall, before + 1);
  game.user = users.assistant;
  const from = sent.length;
  await tracker.callLines();
  assert.deepEqual(sentOf("action", from).map(a => a.message.action), ["lvCall"]);
  game.user = users.gm;
  assert.equal(publicState().lvCall, before + 1);
  assert.equal(notes.length >= 0, true);
});

test("a GM who loses the lead forgets the staged entries, and the list stays as published", async () => {
  as(users.gm);
  const list = JSON.stringify(values.get("lv"));
  tracker.stopTracking();
  assert.equal(lines.__test__.staged(), null);
  assert.equal(JSON.stringify(values.get("lv")), list);
  // Not collecting: a message is dropped without error
  tracker.receive({type: "lv", token: "AbCdEfGh12345678", kind: "line", topic: "gore", on: true});
  await tick(0);
  assert.equal(JSON.stringify(values.get("lv")), list);
});
