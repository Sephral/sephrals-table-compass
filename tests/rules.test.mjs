import assert from "node:assert/strict";
import test from "node:test";
import {
  activeEntries, batchDelay, cleanAnswers, cleanMessage, compassCorners, countIds, makeToken, shuffle, sparkline,
  summarizeAxis, summarizeFeedback, summarizePoll
} from "../scripts/rules.mjs";

/** A seeded random source, so shuffles and tokens are repeatable. */
function seeded(seed=1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

test("a scale shows nothing below the minimum, so a single vote cannot be told apart", () => {
  assert.deepEqual(summarizeAxis([-1], 2), {count: 1, shown: false, avg: 0, spread: 0, status: "few", strength: 0, steps: [0, 1, 0, 0, 0]});
  assert.equal(summarizeAxis([], 1).status, "few");
  assert.equal(summarizeAxis([-1], 1).shown, true);
});

test("a scale reads fine, a direction, how far off, or split", () => {
  assert.equal(summarizeAxis([0, 0, 1, 0]).status, "fine");
  assert.equal(summarizeAxis([0, 0, 1, 0]).strength, 0);
  const slow = summarizeAxis([-1, -1, -2, 0]);
  assert.equal(slow.status, "low");
  assert.equal(slow.strength, 1);
  assert.equal(slow.avg, -1);
  assert.deepEqual(slow.steps, [1, 2, 1, 0, 0]);
  const far = summarizeAxis([2, 2, 1]);
  assert.equal(far.status, "high");
  assert.equal(far.strength, 2);
  // Two want less, two want more: the average says fine, the spread says split
  const split = summarizeAxis([-2, -1, 2, 1]);
  assert.equal(split.avg, 0);
  assert.equal(split.status, "split");
  // Values outside the scale do not count
  assert.equal(summarizeAxis([0, 7, "1", -1], 2).count, 2);
});

test("votes fade after the set time, 0 keeps them", () => {
  const entries = [{id: "a", at: 1000}, {id: "b", at: 5000}];
  assert.deepEqual(activeEntries(entries, 6000, 2000).map(e => e.id), ["b"]);
  assert.deepEqual(activeEntries(entries, 6000, 0).map(e => e.id), ["a", "b"]);
  assert.deepEqual(activeEntries(new Map([["x", {at: 1}]]).values(), 10, 100).length, 1);
});

test("the GM's view waits a random time, not at all when the GM turned it off", () => {
  assert.equal(batchDelay("off"), 0);
  assert.equal(batchDelay("short", () => 0), 15000);
  assert.equal(batchDelay("short", () => 1), 45000);
  assert.equal(batchDelay("normal", () => 0.5), 60000);
  assert.equal(batchDelay("anything", () => 0), 15000);
});

test("the compass rose pushes a corner out where the table wants more", () => {
  const geometry = {cx: 100, cy: 100, ring: 30, outer: 50};
  const [top, right] = compassCorners([2, -2], geometry);
  // Two spokes: the first points up, the second down
  assert.deepEqual([top.x, top.y], [100, 50]);
  assert.deepEqual([right.x, right.y], [100, 110]);
  const [fine] = compassCorners([0], geometry);
  assert.deepEqual([fine.x, fine.y], [100, 70]);
  // Never outside the outer ring, never into the middle
  const [wild] = compassCorners([9], geometry);
  assert.equal(wild.y, 50);
  assert.equal(compassCorners([-9], geometry)[0].y, 96);
});

test("a history line leaves out gaps and points outside the time span", () => {
  const box = {from: 0, to: 100, width: 200, height: 100};
  const line = sparkline([{t: 0, v: 0}, {t: 50, v: null}, {t: 100, v: 2.2}, {t: 150, v: 1}], box);
  assert.equal(line, "0,50 200,0");
});

test("the scene check counts the faces and shows from the minimum on", () => {
  assert.deepEqual(summarizePoll([5, 4, 4, 9], 2), {count: 3, shown: true, avg: 13 / 3, faces: [0, 0, 0, 2, 1]});
  assert.equal(summarizePoll([3], 2).shown, false);
  assert.equal(summarizePoll([3], 2).avg, 0);
});

test("the feedback round adds up the answers and mixes the free texts", () => {
  const answers = [
    cleanAnswers({stars: 5, tempo: 0, highlights: ["combat"], more: ["puzzle"], less: [], rose: "The bridge fight", thorn: "", bud: "The letter"}),
    cleanAnswers({stars: 4, tempo: -1, highlights: ["combat", "story"], more: ["puzzle", "roleplay"], less: ["combat"], rose: "", thorn: "Rules talk", bud: ""}),
    cleanAnswers({stars: 3, tempo: 0, highlights: [], more: [], less: [], rose: "", thorn: "", bud: ""})
  ];
  const result = summarizeFeedback(answers, {minAnswers: 2, rng: seeded(3)});
  assert.equal(result.count, 3);
  assert.equal(result.shown, true);
  assert.equal(result.stars.avg, 4);
  assert.deepEqual(result.stars.dist, [0, 0, 1, 1, 1]);
  assert.deepEqual(result.tempo, {slow: 1, fine: 2, fast: 0});
  assert.deepEqual(result.highlights, {combat: 2, story: 1});
  assert.deepEqual(result.more, {puzzle: 2, roleplay: 1});
  assert.deepEqual(result.less, {combat: 1});
  assert.deepEqual(result.texts.map(x => x.text).sort(), ["Rules talk", "The bridge fight", "The letter"]);
  // Too few answers: the texts stay hidden
  assert.deepEqual(summarizeFeedback(answers.slice(0, 1), {minAnswers: 2}).texts, []);
  assert.equal(summarizeFeedback(answers.slice(0, 1), {minAnswers: 2}).shown, false);
});

test("shuffle keeps every entry, tokens are letters and digits", () => {
  const list = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(shuffle(list, seeded(7)).sort(), list);
  assert.notDeepEqual(shuffle(list, seeded(7)), list);
  assert.match(makeToken(seeded(2)), /^[A-Za-z0-9]{16}$/);
  assert.deepEqual(countIds(["a", "b", "a"]), {a: 2, b: 1});
});

test("messages from players are checked and anything unknown is dropped", () => {
  const token = "abcDEF123456";
  assert.deepEqual(cleanMessage({type: "axis", token, id: "pace", value: -2, user: "someone"}),
    {type: "axis", token, id: "pace", value: -2});
  assert.deepEqual(cleanMessage({type: "axis", token, id: "pace", value: null}), {type: "axis", token, id: "pace", value: null});
  assert.equal(cleanMessage({type: "axis", token, id: "pace", value: 3}), null);
  assert.equal(cleanMessage({type: "axis", token, id: "nope", value: 0}), null);
  assert.equal(cleanMessage({type: "axis", token, id: "humor", value: 0}, {axes: ["pace"]}), null);
  assert.equal(cleanMessage({type: "axis", token: "short", id: "pace", value: 0}), null);
  assert.equal(cleanMessage({type: "axis", token: "has space 12345", id: "pace", value: 0}), null);
  assert.deepEqual(cleanMessage({type: "signal", token, id: "pause", on: "yes"}), {type: "signal", token, id: "pause", on: false});
  assert.deepEqual(cleanMessage({type: "wish", token, id: "combat", on: true}), {type: "wish", token, id: "combat", on: true});
  assert.equal(cleanMessage({type: "wish", token, id: "romance", on: true}, {wishes: ["combat"]}), null);
  assert.deepEqual(cleanMessage({type: "xcard", token, id: "anything"}), {type: "xcard", token});
  assert.deepEqual(cleanMessage({type: "poll", token, poll: "Poll12345", value: 4}), {type: "poll", token, poll: "Poll12345", value: 4});
  assert.equal(cleanMessage({type: "poll", token, poll: "Poll12345", value: 6}), null);
  assert.equal(cleanMessage({type: "poll", token, poll: "x", value: 3}), null);
  assert.equal(cleanMessage({type: "unknown", token}), null);
  assert.equal(cleanMessage(null), null);
});

test("feedback answers are trimmed, limited and free text can be switched off", () => {
  const answers = cleanAnswers({stars: 9, tempo: 1, highlights: ["combat", "combat", "nope"], rose: "  hi  ", thorn: "x".repeat(900)});
  assert.equal(answers.stars, null);
  assert.equal(answers.tempo, 1);
  assert.deepEqual(answers.highlights, ["combat"]);
  assert.equal(answers.rose, "hi");
  assert.equal(answers.thorn.length, 500);
  assert.equal(cleanAnswers({rose: "secret"}, false).rose, "");
  const message = cleanMessage({type: "feedback", token: "abcDEF123456", round: "Round1234", answers: {rose: "text"}}, {freeText: false});
  assert.equal(message.answers.rose, "");
});
