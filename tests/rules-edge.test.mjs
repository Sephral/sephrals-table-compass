import assert from "node:assert/strict";
import test from "node:test";
import {AXES, SIGNALS, TOPICS, WISHES, knownIds} from "../scripts/catalog.mjs";
import {
  TEXT_LIMIT, batchDelay, cleanAnswers, cleanMessage, compassCorners, makeToken, sparkline, summarizeAxis,
  summarizeFeedback, summarizePoll
} from "../scripts/rules.mjs";

test("the borders between fine, a bit off, far off and split", () => {
  // An average of 0.4 is a bit off, just below is fine
  assert.equal(summarizeAxis([0, 0, 0, 0, 2]).status, "high");
  assert.equal(summarizeAxis([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]).status, "high");
  assert.equal(summarizeAxis([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]).status, "fine");
  assert.equal(summarizeAxis([0, 0, 0, 1]).status, "fine");
  // From 1.2 on far off, below a bit
  assert.equal(summarizeAxis([1, 1, 1, 1, 2]).strength, 2);
  assert.equal(summarizeAxis([1, 1, 1, 1, 1, 2]).strength, 1);
  // A spread of 1.2 and more is split, whatever the average says
  assert.equal(summarizeAxis([-2, 2]).status, "split");
  assert.equal(summarizeAxis([-2, -2, -2, 1]).status, "split");
  assert.equal(summarizeAxis([-1, 1]).status, "fine");
  // A minimum of 0 or less counts as 1
  assert.equal(summarizeAxis([1], 0).shown, true);
  assert.equal(summarizeAxis([1], -3).shown, true);
  assert.equal(summarizePoll([4], 0).shown, true);
  assert.equal(summarizePoll([], 0).shown, false);
});

test("only whole steps of the scale count", () => {
  const summary = summarizeAxis([1.5, "2", null, undefined, NaN, Infinity, -0, 2], 1);
  assert.equal(summary.count, 2);
  assert.deepEqual(summary.steps, [0, 0, 1, 0, 1]);
});

test("ids that could reach object internals are never accepted", () => {
  const token = makeToken();
  for ( const id of ["__proto__", "constructor", "toString", "hasOwnProperty", "prototype", "", null, 1, {}, []] ) {
    assert.equal(cleanMessage({type: "axis", token, id, value: 0}), null, String(id));
    assert.equal(cleanMessage({type: "signal", token, id, on: true}), null, String(id));
    assert.equal(cleanMessage({type: "wish", token, id, on: true}), null, String(id));
  }
  assert.equal(cleanMessage({type: "poll", token, poll: "__proto__", value: 3}), null);
  assert.equal(cleanMessage({type: "poll", token, poll: 12345678, value: 3}), null);
  assert.equal(cleanMessage({type: "feedback", token, round: ["Round12345"], answers: {}}), null);
});

test("tokens: letters and digits, 8 to 32 of them", () => {
  const ok = id => cleanMessage({type: "xcard", token: id}) !== null;
  assert.equal(ok("a".repeat(8)), true);
  assert.equal(ok("a".repeat(32)), true);
  assert.equal(ok("a".repeat(7)), false);
  assert.equal(ok("a".repeat(33)), false);
  assert.equal(ok("abc-defgh"), false);
  assert.equal(ok("abcdefgh\n"), false);
  assert.equal(ok(12345678), true);
  for ( let i = 0; i < 1000; i++ ) assert.equal(ok(makeToken()), true);
});

test("values of the wrong kind are dropped, signals and wishes are on only with true", () => {
  const token = makeToken();
  assert.equal(cleanMessage({type: "axis", token, id: "pace", value: "1"}), null);
  assert.equal(cleanMessage({type: "axis", token, id: "pace", value: 1.5}), null);
  assert.equal(cleanMessage({type: "axis", token, id: "pace"}), null);
  assert.equal(cleanMessage({type: "poll", token, poll: "Poll12345", value: 0}), null);
  assert.equal(cleanMessage({type: "poll", token, poll: "Poll12345", value: "5"}), null);
  for ( const on of [1, "true", {}, [true]] ) assert.equal(cleanMessage({type: "signal", token, id: "pause", on}).on, false);
  // Extra fields never pass
  const message = cleanMessage({type: "wish", token, id: "loot", on: true, user: "Gamemaster", name: "x"});
  assert.deepEqual(Object.keys(message).sort(), ["id", "on", "token", "type"]);
});

test("a vote sent again keeps its age in whole minutes, anything else is dropped", () => {
  const token = makeToken();
  assert.equal(cleanMessage({type: "axis", token, id: "pace", value: 1, age: 19}).age, 19);
  assert.equal(cleanMessage({type: "signal", token, id: "pause", on: true, age: 0}).age, 0);
  for ( const age of [-1, 1.5, "3", 1441, null, {}] ) {
    assert.equal("age" in cleanMessage({type: "axis", token, id: "pace", value: 1, age}), false, String(age));
  }
  assert.equal("age" in cleanMessage({type: "wish", token, id: "loot", on: true, age: 3}), false);
});

test("feedback answers of every odd shape come out clean", () => {
  const empty = {stars: null, tempo: null, highlights: [], more: [], less: [], rose: "", thorn: "", bud: ""};
  assert.deepEqual(cleanAnswers(null), empty);
  assert.deepEqual(cleanAnswers("text"), empty);
  assert.deepEqual(cleanAnswers({stars: "5", tempo: "0", highlights: "combat", more: {combat: true}, less: [["combat"]]}), empty);
  const odd = cleanAnswers({stars: 5, tempo: -1, rose: 42, thorn: {a: 1}, bud: ["x"], highlights: [...TOPICS, "nope", "combat"]});
  assert.equal(odd.rose, "42");
  assert.equal(odd.thorn, "[object Object]");
  assert.equal(odd.bud, "x");
  assert.deepEqual(odd.highlights, TOPICS);
  assert.equal(cleanAnswers({rose: "   \n  "}).rose, "");
  assert.equal(cleanAnswers({rose: "ä".repeat(TEXT_LIMIT + 5)}).rose.length, TEXT_LIMIT);
  // A whole message with answers missing still works
  assert.deepEqual(cleanMessage({type: "feedback", token: makeToken(), round: "Round12345"}).answers, empty);
});

test("a feedback round without answers or with odd answers adds up to nothing", () => {
  const none = summarizeFeedback([], {minAnswers: 2});
  assert.equal(none.count, 0);
  assert.equal(none.shown, false);
  assert.equal(none.stars.avg, 0);
  assert.deepEqual(none.tempo, {slow: 0, fine: 0, fast: 0});
  const odd = summarizeFeedback([cleanAnswers({stars: 9, tempo: 3}), cleanAnswers({stars: 2})], {minAnswers: 1});
  assert.equal(odd.stars.count, 1);
  assert.equal(odd.stars.avg, 2);
  assert.deepEqual(odd.tempo, {slow: 0, fine: 0, fast: 0});
  // Free texts keep their kind and their text, in any order
  const texts = summarizeFeedback([cleanAnswers({rose: "A", thorn: "B"}), cleanAnswers({bud: "C"})], {minAnswers: 2}).texts;
  assert.deepEqual(texts.map(x => `${x.kind}:${x.text}`).sort(), ["bud:C", "rose:A", "thorn:B"]);
});

test("the free texts really come back in different orders", () => {
  const answers = ["One", "Two", "Three", "Four"].map(rose => cleanAnswers({rose}));
  const orders = new Set();
  for ( let i = 0; i < 50; i++ ) orders.add(summarizeFeedback(answers).texts.map(x => x.text).join());
  assert.ok(orders.size > 5, orders.size);
});

test("the random wait stays within its range", () => {
  for ( let i = 0; i < 500; i++ ) {
    const short = batchDelay("short");
    const normal = batchDelay("normal");
    assert.ok(short >= 15000 && short <= 45000, short);
    assert.ok(normal >= 30000 && normal <= 90000, normal);
  }
});

test("drawings survive empty and broken input", () => {
  const geometry = {cx: 141, cy: 63, ring: 25, outer: 46};
  assert.deepEqual(compassCorners([], geometry), []);
  const [corner] = compassCorners([NaN], geometry);
  assert.deepEqual([corner.x, corner.y], [141, 38]);
  // Nine spokes all stay inside the drawing of 282 by 122
  for ( const c of compassCorners(Array(9).fill(2), geometry) ) {
    assert.ok(c.x >= 0 && c.x <= 282 && c.y >= 0 && c.y <= 122, JSON.stringify(c));
  }
  assert.equal(sparkline([], {from: 0, to: 0, width: 10, height: 10}), "");
  assert.equal(sparkline([{t: 5, v: 0}], {from: 5, to: 5, width: 10, height: 10}), "0,5");
  assert.equal(sparkline([{t: 1, v: null}, {t: 2, v: NaN}, {t: 3, v: Infinity}], {from: 0, to: 4, width: 10, height: 10}), "");
});

test("the choice keeps only known ids in catalog order", () => {
  assert.deepEqual(knownIds(["rules", "pace", "pace", "nope", "__proto__"], AXES, []), ["pace", "rules"]);
  assert.deepEqual(knownIds("pace", AXES, ["x"]), ["x"]);
  assert.deepEqual(knownIds([], SIGNALS, SIGNALS), []);
  assert.deepEqual(knownIds(undefined, WISHES, ["combat"]), ["combat"]);
});
