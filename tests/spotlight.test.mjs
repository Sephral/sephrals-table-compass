import assert from "node:assert/strict";
import {mock, test} from "node:test";

mock.timers.enable({apis: ["setTimeout", "setInterval", "Date"], now: 1_700_000_000_000});

const {hooks, sent, sentOf, settle, users, values} = await import("./fake-foundry.mjs");
const tracker = await import("../scripts/tracker.mjs");
const {__test__: spot, markSpotlight, spotlightSnapshot} = await import("../scripts/spotlight.mjs");

const MIN = 60 * 1000;
const advance = async ms => {
  mock.timers.tick(ms);
  await settle();
};
const row = id => tracker.spotlightView().rows.find(r => r.id === id);

test("starting to track starts the spotlight and registers its two hooks once", async () => {
  await tracker.startTracking();
  await settle();
  assert.equal(hooks.get("createChatMessage").length, 1);
  assert.equal(hooks.get("updateToken").length, 1);
  tracker.stopTracking();
  await tracker.startTracking();
  assert.equal(hooks.get("createChatMessage").length, 1);
});

test("rolls and in-character messages of players count, whispers and GM messages do not", async () => {
  tracker.refresh();
  assert.equal(row(users.p1.id).minutes, null);
  spot.onMessage({author: users.p1, isRoll: true, rolls: [{}], whisper: [], speaker: {}});
  await advance(20 * 1000);
  tracker.refresh();
  assert.equal(row(users.p1.id).minutes, 0);
  assert.equal(row(users.p2.id).minutes, null);
  spot.onMessage({author: users.p2, whisper: [users.gm.id], style: 2, speaker: {actor: "x"}});
  spot.onMessage({author: users.gm, isRoll: true, whisper: [], speaker: {}});
  tracker.refresh();
  assert.equal(row(users.p2.id).minutes, null);
  spot.onMessage({author: users.p2, whisper: [], style: 2, speaker: {actor: "x"}});
  tracker.refresh();
  assert.equal(row(users.p2.id).minutes, 0);
});

test("token moves count only for players in a running combat", async () => {
  const token = {id: "tok1"};
  await advance(MIN);
  spot.onToken(token, {x: 100}, {}, users.p1.id);
  tracker.refresh();
  assert.equal(row(users.p1.id).minutes, 1, "no combat, no move");
  game.combat = {started: true, combatants: [{tokenId: "tok1"}]};
  spot.onToken(token, {name: "x"}, {}, users.p1.id);
  spot.onToken(token, {x: 100}, {}, users.gm.id);
  tracker.refresh();
  assert.equal(row(users.p1.id).minutes, 1);
  spot.onToken(token, {x: 100}, {}, users.p1.id);
  tracker.refresh();
  assert.equal(row(users.p1.id).minutes, 0);
  game.combat = null;
});

test("someone quiet much longer than the others gets a gentle hint, and the GM's mark takes it away", async () => {
  await advance(30 * MIN);
  spot.onMessage({author: users.p1, isRoll: true, rolls: [{}], whisper: []});
  tracker.refresh();
  const snap = tracker.spotlightView();
  assert.deepEqual(snap.quiet, [users.p2.id]);
  assert.deepEqual(snap.names, ["Ben"]);
  assert.equal(row(users.p2.id).state, "quiet");
  assert.equal(markSpotlight(users.p2.id), true);
  tracker.refresh();
  assert.deepEqual(tracker.spotlightView().quiet, []);
  assert.equal(row(users.p2.id).minutes, 0);
  // A GM is no player
  assert.equal(markSpotlight(users.gm.id), false);
  assert.equal(markSpotlight("nobody"), false);
});

test("the view carries no text and no roll, only names, minutes and bars", () => {
  const snap = tracker.spotlightView();
  for ( const r of snap.rows ) assert.deepEqual(Object.keys(r).sort(), ["bar", "character", "id", "minutes", "name", "state"]);
  assert.ok(!JSON.stringify(sent.map(s => s.message)).includes("rolls"));
});

test("the view of the votes stays free of names, the spotlight is kept apart", () => {
  tracker.refresh();
  const stored = JSON.stringify([tracker.view(), tracker.debugState()]);
  assert.ok(!stored.includes(users.p1.id) && !stored.includes(users.p2.id));
  assert.ok(!stored.includes("Anna") && !stored.includes("Ben"));
});

test("another GM gets the spotlight as its own message, and the copy shows without collecting", () => {
  const to = users.assistant.id;
  const copies = sent.filter(s => s.message?.type === "spotlight" && s.to?.includes(to));
  assert.ok(copies.length > 0);
  game.user = users.assistant;
  tracker.receiveFromGM(copies.at(-1).message);
  const copy = tracker.spotlightView();
  assert.deepEqual(copy.rows.map(r => r.name), ["Anna", "Ben"]);
  game.user = users.gm;
});

test("nothing of the spotlight is sent to a player", () => {
  const toPlayers = sent.filter(s => s.to?.some(id => [users.p1.id, users.p2.id].includes(id)));
  assert.ok(toPlayers.length > 0);
  assert.ok(toPlayers.every(s => !("spotlight" in s.message) && !("snapshot" in s.message)));
});

test("a GM who does not collect asks the active GM to mark a player", async () => {
  game.user = users.assistant;
  const from = sent.length;
  tracker.markSpot(users.p1.id);
  const actions = sentOf("action", from);
  assert.deepEqual(actions.map(a => [a.message.action, a.message.id]), [["spotlightMark", users.p1.id]]);
  assert.deepEqual(actions[0].to, [users.gm.id]);
  game.user = users.gm;
  // The active GM runs it, with a known user only
  await advance(5 * MIN);
  tracker.runAction({action: "spotlightMark", id: users.p1.id});
  tracker.runAction({action: "spotlightMark", id: {bad: true}});
  tracker.runAction({action: "spotlightMark", id: users.gm.id});
  tracker.refresh();
  assert.equal(row(users.p1.id).minutes, 0);
});

test("switched off, the snapshot has no spotlight", () => {
  values.set("spotlight", false);
  assert.equal(spotlightSnapshot(), null);
  tracker.refresh();
  assert.equal(tracker.spotlightView(), null);
  values.set("spotlight", true);
});

test("a new session starts the view from nothing", async () => {
  await tracker.newSession({quiet: true});
  await settle();
  tracker.refresh();
  assert.equal(row(users.p1.id).minutes, null);
  assert.equal(row(users.p2.id).minutes, null);
});

test("what the active GM stored comes back after a reload of the same session", async () => {
  spot.onMessage({author: users.p1, isRoll: true, rolls: [{}], whisper: []});
  await advance(6000);
  assert.ok(values.get("spotlightBook")?.players?.[users.p1.id]?.last);
  spot.reset();
  spot.activate();
  tracker.refresh();
  assert.equal(row(users.p1.id).minutes, 0);
});
