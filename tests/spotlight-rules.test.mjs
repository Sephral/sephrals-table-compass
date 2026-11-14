import assert from "node:assert/strict";
import test from "node:test";
import {
  HALF_LIFE, MIN_GAP, agePhrase, classifyMessage, currentScore, forgetUnknown, median, quietOnes, record, spotlightRows, touch
} from "../scripts/spotlight-rules.mjs";

const MIN = 60 * 1000;
const T0 = 1_700_000_000_000;

test("a strong signal sets the time of last activity, table talk only warms the bar", () => {
  const players = {};
  assert.equal(record(players, "a", "chat", T0), true);
  assert.equal(players.a.last, null);
  assert.ok(players.a.score > 0);
  assert.equal(record(players, "a", "roll", T0 + MIN), true);
  assert.equal(players.a.last, T0 + MIN);
  assert.equal(record(players, "a", "unknown", T0), false);
});

test("the same kind of signal counts once in a short gap, the GM's mark always counts", () => {
  const players = {};
  assert.equal(record(players, "a", "move", T0), true);
  assert.equal(record(players, "a", "move", T0 + MIN_GAP - 1), false);
  assert.equal(record(players, "a", "move", T0 + MIN_GAP), true);
  assert.equal(record(players, "a", "mark", T0 + MIN_GAP), true);
  assert.equal(record(players, "a", "mark", T0 + MIN_GAP + 1), true);
});

test("the score halves after the half-life", () => {
  const players = {};
  record(players, "a", "roll", T0);
  const fresh = currentScore(players.a, T0);
  assert.ok(Math.abs(currentScore(players.a, T0 + HALF_LIFE) - (fresh / 2)) < 1e-9);
});

test("messages: rolls and in-character count, table talk is soft, whispers and GMs do not count", () => {
  assert.equal(classifyMessage({isRoll: true}), "roll");
  assert.equal(classifyMessage({isRoll: true, whispers: 1}), "roll");
  assert.equal(classifyMessage({style: 2, actor: true}), "ic");
  assert.equal(classifyMessage({style: 0, actor: true}), "ic");
  assert.equal(classifyMessage({style: 1, actor: true}), "chat");
  assert.equal(classifyMessage({style: 1}), "chat");
  assert.equal(classifyMessage({style: 2}), "ic");
  assert.equal(classifyMessage({style: 0}), "chat");
  assert.equal(classifyMessage({style: 2, actor: true, whispers: 2}), null);
  assert.equal(classifyMessage({isRoll: true, gm: true}), null);
});

test("a clock that went back never shows negative minutes", () => {
  const players = {};
  touch(players, "a", T0);
  record(players, "a", "roll", T0 + (30 * MIN));
  assert.equal(spotlightRows(players, [{id: "a", name: "A"}], T0).rows[0].minutes, 0);
});

test("median", () => {
  assert.equal(median([]), 0);
  assert.equal(median([5]), 5);
  assert.equal(median([1, 9, 3]), 3);
  assert.equal(median([1, 2, 3, 10]), 2.5);
});

test("quiet ones: long quiet, twice the others, and only while somebody else played", () => {
  const quiet = 20 * MIN;
  assert.deepEqual(quietOnes([{id: "a", age: 40 * MIN}, {id: "b", age: 3 * MIN}, {id: "c", age: 5 * MIN}], quiet), ["a"]);
  // Everybody quiet: the table is on a break
  assert.deepEqual(quietOnes([{id: "a", age: 50 * MIN}, {id: "b", age: 40 * MIN}, {id: "c", age: 45 * MIN}], quiet), []);
  // Long, but not twice as long as the others
  assert.deepEqual(quietOnes([{id: "a", age: 25 * MIN}, {id: "b", age: 15 * MIN}, {id: "c", age: 14 * MIN}], quiet), []);
  // One player alone cannot be quiet compared with anybody
  assert.deepEqual(quietOnes([{id: "a", age: 90 * MIN}], quiet), []);
  // At most two hints, the quietest first
  const many = quietOnes([{id: "a", age: 30 * MIN}, {id: "b", age: 60 * MIN}, {id: "c", age: 50 * MIN}, {id: "d", age: MIN},
    {id: "e", age: MIN}, {id: "f", age: MIN}], quiet);
  assert.deepEqual(many, ["b", "c"]);
});

test("rows: minutes, states and a soft bar", () => {
  const players = {};
  const roster = [{id: "a", name: "Anna", character: "Mira"}, {id: "b", name: "Ben"}, {id: "c", name: "Cleo"}, {id: "d", name: "Dan"}];
  for ( const p of roster ) touch(players, p.id, T0);
  record(players, "a", "roll", T0 + (50 * MIN));
  record(players, "b", "ic", T0 + (45 * MIN));
  record(players, "c", "chat", T0 + (49 * MIN));
  const now = T0 + (55 * MIN);
  const {rows, quiet} = spotlightRows(players, roster, now, {quietMinutes: 20});
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  // Cleo only talked, Dan did nothing: both were there for 55 minutes, the others played 5 and 10 minutes ago
  assert.deepEqual([...quiet].sort(), ["c", "d"]);
  assert.equal(by.a.minutes, 5);
  assert.equal(by.a.state, "ok");
  assert.equal(by.a.character, "Mira");
  assert.equal(by.b.minutes, 10);
  assert.equal(by.c.minutes, null);
  assert.equal(by.d.minutes, null);
  assert.equal(by.d.bar, 0);
  assert.ok(by.a.bar <= 100 && by.a.bar > by.c.bar);
  assert.ok(by.c.bar >= 6, "soft warmth stays visible");
  assert.equal(by.c.state, "quiet");
});

test("rows: a player who just arrived is not quiet, nothing shows for nobody", () => {
  const players = {};
  const roster = [{id: "a", name: "Anna"}, {id: "b", name: "Ben"}];
  touch(players, "a", T0);
  record(players, "a", "roll", T0 + (60 * MIN));
  touch(players, "b", T0 + (59 * MIN));
  const {rows, quiet} = spotlightRows(players, roster, T0 + (60 * MIN), {quietMinutes: 20});
  assert.deepEqual(quiet, []);
  assert.equal(rows[1].state, "none");
  assert.deepEqual(spotlightRows({}, [], T0), {rows: [], quiet: []});
});

test("fresh within a quarter of the limit, ok afterwards", () => {
  const players = {};
  touch(players, "a", T0);
  record(players, "a", "roll", T0);
  assert.equal(spotlightRows(players, [{id: "a", name: "A"}], T0 + (2 * MIN), {quietMinutes: 20}).rows[0].state, "fresh");
  assert.equal(spotlightRows(players, [{id: "a", name: "A"}], T0 + (8 * MIN), {quietMinutes: 20}).rows[0].state, "ok");
});

test("age phrase and forgetting unknown users", () => {
  assert.deepEqual(agePhrase(0), {kind: "now", minutes: 0, hours: 0});
  assert.deepEqual(agePhrase(12), {kind: "minutes", minutes: 12, hours: 0});
  assert.deepEqual(agePhrase(65), {kind: "hours", minutes: 5, hours: 1});
  const players = {a: {}, b: {}};
  forgetUnknown(players, ["a"]);
  assert.deepEqual(Object.keys(players), ["a"]);
});
