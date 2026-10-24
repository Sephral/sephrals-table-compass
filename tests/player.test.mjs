import assert from "node:assert/strict";
import {mock, test} from "node:test";

mock.timers.enable({apis: ["setTimeout", "Date"], now: 1_700_000_000_000});

const {sent, sentOf, storage, users, values} = await import("./fake-foundry.mjs");
game.user = users.p1;
values.set("public", {session: {id: "Session00001", started: Date.now(), active: Date.now()}, xAck: 0});
const player = await import("../scripts/player.mjs");

/** No GM online, or the GM back. */
const gmOnline = on => {
  users.gm.active = on;
  users.assistant.active = false;
};

test("everything a player says while no GM is there is kept and goes out when one joins", () => {
  gmOnline(false);
  assert.equal(player.vote("pace", -1), false);
  assert.equal(player.toggleWish("loot"), false);
  assert.equal(player.toggleSignal("lost"), false);
  assert.equal(player.showXCard(), false);
  assert.equal(sent.length, 0);
  assert.equal(player.xcardWaiting(), true);
  gmOnline(true);
  player.resendAll();
  // The X card goes out at once, the rest spread over a few seconds
  assert.equal(sentOf("xcard").length, 1);
  assert.equal(sent.length, 1);
  mock.timers.tick(8000);
  assert.deepEqual(sent.map(s => s.message.type).sort(), ["axis", "signal", "wish", "xcard"]);
  assert.ok(sent.every(s => s.to.length === 1 && s.to[0] === users.gm.id));
  const card = sentOf("xcard")[0].message.token;
  assert.equal(card, player.myState().xcard.token);
});

test("sending again uses the same tokens, so the GM counts nothing twice", () => {
  const first = Object.fromEntries(sent.map(s => [s.message.type, s.message.token]));
  sent.length = 0;
  player.resendAll();
  mock.timers.tick(8000);
  const second = Object.fromEntries(sent.map(s => [s.message.type, s.message.token]));
  assert.deepEqual(second, first);
  // Every scale, signal and wish has its own token
  assert.equal(new Set(Object.values(first)).size, 4);
});

test("votes and signals sent again carry their age in whole minutes", () => {
  mock.timers.tick(3 * 60 * 1000 + 5000);
  sent.length = 0;
  player.resendAll();
  mock.timers.tick(8000);
  assert.equal(sentOf("axis")[0].message.age, 3);
  assert.equal(sentOf("signal")[0].message.age, 3);
  assert.equal("age" in sentOf("wish")[0].message, false);
});

test("an X card the GM has seen is not sent again", () => {
  values.set("public", {...values.get("public"), xAck: 1});
  assert.equal(player.xcardWaiting(), false);
  sent.length = 0;
  player.resendAll();
  mock.timers.tick(8000);
  assert.equal(sentOf("xcard").length, 0);
});

test("the answers of a running feedback round go out again, those of a closed one do not", () => {
  values.set("public", {...values.get("public"), round: {id: "Round000001", count: 0}});
  player.submitFeedback("Round000001", {stars: 4, rose: "  The bridge  ", highlights: ["combat", "nope"]});
  const token = player.myState().rounds.Round000001.token;
  sent.length = 0;
  player.resendAll();
  mock.timers.tick(8000);
  const feedback = sentOf("feedback");
  assert.equal(feedback.length, 1);
  assert.equal(feedback[0].message.token, token);
  assert.deepEqual(feedback[0].message.answers.highlights, ["combat"]);
  assert.equal(feedback[0].message.answers.rose, "The bridge");
  values.set("public", {...values.get("public"), round: null});
  sent.length = 0;
  player.resendAll();
  mock.timers.tick(8000);
  assert.equal(sentOf("feedback").length, 0);
});

test("a signal ticked off or a wish fulfilled by the GM is off for the player", () => {
  assert.equal(player.signalActive("lost", player.myState().signals.lost), true);
  values.set("public", {...values.get("public"), cleared: {lost: 1}, fulfilled: {loot: 1}});
  assert.equal(player.signalActive("lost", player.myState().signals.lost), false);
  assert.equal(player.wishActive("loot", player.myState().wishes.loot), false);
  // Wished again, the wish counts again with a new token
  const old = player.myState().wishes.loot.token;
  player.toggleWish("loot");
  assert.equal(player.wishActive("loot", player.myState().wishes.loot), true);
  assert.notEqual(player.myState().wishes.loot.token, old);
});

test("votes and signals fade on the player's side too", () => {
  mock.timers.tick(6 * 60 * 1000);
  player.toggleSignal("pause");
  assert.equal(player.axisActive(player.myState().axes.pace), true);
  mock.timers.tick(15 * 60 * 1000);
  assert.equal(player.axisActive(player.myState().axes.pace), false);
  assert.equal(player.signalActive("pause", player.myState().signals.pause), false);
  sent.length = 0;
  player.resendAll();
  mock.timers.tick(8000);
  assert.ok(!sent.some(s => ["axis", "signal"].includes(s.message.type)));
});

test("a new session starts the player's state fresh, kept per world and user", () => {
  values.set("public", {...values.get("public"), session: {id: "Session00002", started: Date.now(), active: Date.now()}});
  const state = player.myState();
  assert.equal(state.session, "Session00002");
  assert.deepEqual([state.axes, state.signals, state.wishes], [{}, {}, {}]);
  assert.deepEqual([...storage.keys()], [`sephrals-table-compass.test.${users.p1.id}`]);
});
