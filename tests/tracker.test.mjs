import assert from "node:assert/strict";
import {mock, test} from "node:test";

mock.timers.enable({apis: ["setTimeout", "setInterval", "Date"], now: 1_700_000_000_000});

const {notes, sent, sentOf, settle, users, values} = await import("./fake-foundry.mjs");
const tracker = await import("../scripts/tracker.mjs");
const {publicState} = await import("../scripts/state.mjs");

let n = 0;
/** A fresh vote token. */
const token = () => `Token${String(++n).padStart(11, "0")}`;
const axis = id => tracker.view().axes.find(a => a.id === id);

/**
 * Advance the clock in steps of the prune interval and let the setting writes finish after each step. Node's mock
 * timers move the clock to the end of a tick before they fire, so long spans go step by step.
 * @param {number} ms
 */
async function tick(ms) {
  if ( !ms ) mock.timers.tick(0);
  for ( let left = ms; left > 0; left -= 20000 ) {
    mock.timers.tick(Math.min(left, 20000));
    await settle();
  }
  await settle();
}

test("the active GM takes over: a new session and a call to the players to send again", async () => {
  await tracker.startTracking();
  await settle();
  assert.ok(publicState().session?.id);
  const resync = sentOf("resync");
  assert.equal(resync.length, 1);
  assert.deepEqual(resync[0].to, [users.p1.id, users.p2.id]);
});

test("new votes wait for their batch, an X card shows at once and does not reveal them", async () => {
  values.set("updateDelay", "short");
  tracker.receive({type: "axis", token: token(), id: "pace", value: -1});
  tracker.receive({type: "axis", token: token(), id: "pace", value: -2});
  assert.equal(axis("pace").count, 0);
  const card = token();
  tracker.receive({type: "xcard", token: card});
  assert.equal(tracker.view().xcards, 1);
  assert.equal(axis("pace").count, 0);
  // The same card sent again after a reload counts once
  tracker.receive({type: "xcard", token: card});
  assert.equal(tracker.view().xcards, 1);
  await tracker.acknowledgeXCard();
  assert.equal(tracker.view().xcards, 0);
  assert.equal(publicState().xAck, 1);
  assert.equal(axis("pace").count, 0);
  await tick(45000);
  assert.equal(axis("pace").count, 2);
  assert.equal(axis("pace").shown, true);
  values.set("updateDelay", "off");
});

test("a signal ticked off or a wish fulfilled goes, also when it still waited for its batch", async () => {
  tracker.receive({type: "signal", token: token(), id: "pause", on: true});
  await tick(0);
  values.set("updateDelay", "short");
  tracker.receive({type: "signal", token: token(), id: "pause", on: true});
  assert.equal(tracker.view().signals[0].count, 1);
  await tracker.clearSignal("pause");
  assert.equal(tracker.view().signals.length, 0);
  await tick(45000);
  assert.equal(tracker.view().signals.length, 0);
  assert.equal(publicState().cleared.pause, 1);

  values.set("updateDelay", "off");
  tracker.receive({type: "wish", token: token(), id: "combat", on: true});
  await tick(0);
  await tracker.toggleSoon("combat");
  assert.deepEqual(publicState().soon, ["combat"]);
  assert.equal(tracker.view().wishes[0].soon, true);
  await tracker.fulfillWish("combat");
  assert.equal(tracker.view().wishes.length, 0);
  assert.equal(publicState().fulfilled.combat, 1);
  assert.deepEqual(publicState().soon, []);
});

test("another GM asks the active GM instead of acting alone", async () => {
  game.user = users.assistant;
  const from = sent.length;
  await tracker.acknowledgeXCard();
  await tracker.clearSignal("lost");
  await tracker.toggleSoon("loot");
  await tracker.fulfillWish("loot");
  await tracker.newSession();
  const actions = sentOf("action", from);
  assert.deepEqual(actions.map(a => [a.message.action, a.message.id ?? null]),
    [["ackX", null], ["clearSignal", "lost"], ["toggleSoon", "loot"], ["fulfillWish", "loot"], ["newSession", null]]);
  assert.ok(actions.every(a => a.to.length === 1 && a.to[0] === users.gm.id));
  // Nothing changed on the assistant's side
  assert.equal(publicState().cleared.lost, undefined);
  game.user = users.gm;

  // The active GM runs known actions with known ids only
  const before = JSON.stringify(publicState());
  tracker.runAction({action: "clearSignal", id: "dance"});
  tracker.runAction({action: "__proto__"});
  tracker.runAction({action: "constructor"});
  tracker.runAction({action: "startRound"});
  await settle();
  assert.equal(JSON.stringify(publicState()), before);
  tracker.runAction({action: "clearSignal", id: "lost"});
  await settle();
  assert.equal(publicState().cleared.lost, 1);
});

test("votes fade, signals age out, and a long quiet time begins a new session", async () => {
  tracker.receive({type: "axis", token: token(), id: "tension", value: 1});
  tracker.receive({type: "axis", token: token(), id: "tension", value: 2});
  tracker.receive({type: "signal", token: token(), id: "more", on: true});
  await tick(0);
  assert.equal(axis("tension").count, 2);
  await tick(6 * 60 * 1000);
  assert.equal(tracker.view().signals.length, 0);
  assert.equal(axis("tension").count, 2);
  await tick(15 * 60 * 1000);
  assert.equal(axis("tension").count, 0);

  // With players online the session stays in use
  const session = publicState().session.id;
  await tick(7 * 3600 * 1000);
  assert.equal(publicState().session.id, session);
  // Nobody online for more than six hours: a new session
  users.p1.active = false;
  users.p2.active = false;
  try {
    await tick(7 * 3600 * 1000);
    assert.notEqual(publicState().session.id, session);
  } finally {
    users.p1.active = true;
    users.p2.active = true;
  }
});

test("a vote sent again keeps fading from when it was cast", async () => {
  const again = token();
  tracker.receive({type: "axis", token: again, id: "roleplay", value: 1, age: 19});
  tracker.receive({type: "axis", token: token(), id: "pace", value: 1, age: 0});
  await tick(0);
  assert.deepEqual(tracker.debugState().axes.map(a => a.id).sort(), ["pace", "roleplay"]);
  await tick(80 * 1000);
  assert.deepEqual(tracker.debugState().axes.map(a => a.id), ["pace"]);
});

test("a feedback round goes on after the GM's client reloads, a scene check ends", async () => {
  await tracker.startPoll();
  await tracker.startRound();
  const round = publicState().round.id;
  assert.ok(publicState().poll);
  tracker.receive({type: "feedback", token: token(), round, answers: {stars: 5}});
  assert.equal(tracker.debugState().round.answers, 1);
  // The client goes away and comes back
  tracker.stopTracking();
  assert.equal(tracker.debugState().round, null);
  const from = sent.length;
  await tracker.startTracking();
  await settle();
  assert.equal(publicState().round.id, round);
  assert.equal(publicState().poll, null);
  assert.equal(sentOf("resync", from).length, 1);
  // The players send their answers again
  const again = token();
  tracker.receive({type: "feedback", token: again, round, answers: {stars: 4, rose: "Good"}});
  tracker.receive({type: "feedback", token: again, round, answers: {stars: 3, rose: "Fine"}});
  tracker.receive({type: "feedback", token: token(), round, answers: {stars: 5}});
  assert.equal(tracker.debugState().round.answers, 2);
  const result = await tracker.closeRound();
  assert.equal(result.count, 2);
  assert.equal(result.stars.avg, 4);
  assert.deepEqual(result.texts.map(x => x.text), ["Fine"]);
  assert.equal(publicState().round, null);
});

test("a GM who loses the lead forgets the votes and gets them sent again on taking over", async () => {
  tracker.receive({type: "axis", token: token(), id: "combat", value: 1});
  tracker.receive({type: "axis", token: token(), id: "combat", value: 1});
  await tick(0);
  assert.equal(axis("combat").count, 2);
  users.gm.active = false;
  tracker.stopTracking();
  assert.equal(tracker.debugState().axes.length, 0);
  users.gm.active = true;
  const from = sent.length;
  await tracker.startTracking();
  await settle();
  assert.equal(sentOf("resync", from).length, 1);
  assert.equal(axis("combat").count, 0);
});

test("the copy for another GM keeps the times of that GM's own clock", async () => {
  game.user = users.assistant;
  const at = Date.now() - (5 * 60 * 1000);
  const before = notes.length;
  tracker.receiveFromGM({type: "snapshot", snapshot: {at, online: 2, axes: [], signals: [], wishes: [], xcards: 1,
    poll: {id: "Poll12345", endsAt: at + 20000, count: 1}, lastPoll: {at: at - 1000, shown: true, avg: 4, count: 2}, round: null}});
  const copy = tracker.view();
  assert.equal(copy.poll.endsAt, Date.now() + 20000);
  assert.equal(copy.lastPoll.at, Date.now() - 1000);
  assert.ok(notes.slice(before).some(([kind]) => kind === "warn"));
  game.user = users.gm;
});

test("messages for an unknown scene check or round, and broken ones, are dropped", async () => {
  const before = JSON.stringify(tracker.debugState());
  for ( const message of [
    {type: "poll", token: token(), poll: "NoSuchPoll1", value: 3},
    {type: "feedback", token: token(), round: "NoSuchRound1", answers: {stars: 5}},
    {type: "axis", token: token(), id: "__proto__", value: 1},
    {type: "axis", token: "short", id: "pace", value: 1},
    {type: "snapshot", snapshot: {xcards: 3}},
    null, "text", 42
  ] ) tracker.receive(message);
  await tick(0);
  assert.equal(JSON.stringify(tracker.debugState()), before);
});
