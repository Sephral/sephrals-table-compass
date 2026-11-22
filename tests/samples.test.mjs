import assert from "node:assert/strict";
import test from "node:test";
import {AXES, WISHES} from "../scripts/catalog.mjs";
import {LV_MAX_OWN, itemKey} from "../scripts/lines-rules.mjs";
import {
  SAMPLE_PLAYERS, sampleAnswers, sampleAxes, sampleHistory, sampleOwnLines, samplePlayerState, sampleResults,
  sampleSharedLines, sampleSpotlight, sampleView
} from "../scripts/sample-data.mjs";

const tr = key => `text ${key}`;
const NOW = Date.UTC(2026, 10, 22, 20, 0, 0);

test("the sample scales show every state: fine, low, high, split, too few", () => {
  const axes = sampleAxes(2);
  assert.equal(axes.length, AXES.length);
  const status = Object.fromEntries(axes.map(a => [a.id, a.status]));
  assert.equal(status.tension, "fine");
  assert.equal(status.pace, "low");
  assert.equal(status.challenge, "high");
  assert.equal(status.combat, "split");
  assert.equal(status.description, "few");
  assert.equal(status.rules, "few");
});

test("the sample view has signals, wishes and the running states on demand", () => {
  const calm = sampleView({now: NOW});
  assert.equal(calm.poll, null);
  assert.equal(calm.round, null);
  assert.equal(calm.xcards, 0);
  assert.ok(calm.signals.length >= 3);
  assert.ok(calm.wishes.length > 3, "more wishes than the window lists");
  assert.ok(calm.wishes.every((w, i, list) => !i || list[i - 1].count >= w.count), "wishes sorted by count");
  const busy = sampleView({now: NOW, xcards: 1, poll: true, round: true, lastPoll: "few", online: 1});
  assert.ok(busy.poll.endsAt > NOW);
  assert.equal(busy.round.count, 3);
  assert.equal(busy.lastPoll.shown, false);
  assert.equal(sampleView({now: NOW, lastPoll: "shown"}).lastPoll.shown, true);
});

test("the sample history covers two hours with all four marks and no points for scales without votes", () => {
  const h = sampleHistory(NOW);
  assert.equal(h.points.length, 13);
  assert.equal(NOW - h.points[0].t, 120 * 60 * 1000);
  assert.deepEqual(h.marks.map(m => m.kind).sort(), ["poll", "round", "wish", "xcard"]);
  assert.ok(h.marks.every(m => m.t >= h.points[0].t && m.t <= NOW));
  assert.equal(h.points[5].axes.rules, null);
  assert.ok(h.points.every(p => p.axes.pace >= -2 && p.axes.pace <= 2));
});

test("the sample spotlight names one quiet player and one without a turn yet", () => {
  const s = sampleSpotlight(NOW);
  assert.equal(s.rows.length, SAMPLE_PLAYERS.length);
  assert.deepEqual(s.names, ["Jo"]);
  assert.equal(s.rows.find(r => r.name === "Lena").minutes, 2);
  assert.equal(s.rows.find(r => r.name === "Jo").minutes, null);
  assert.ok(s.rows.some(r => r.state === "fresh"));
});

test("the sample results have one round with enough answers and one with too few", () => {
  const [few, full] = sampleResults(tr, NOW);
  assert.equal(full.shown, true);
  assert.equal(full.count, 4);
  assert.equal(full.texts.length, 5);
  assert.equal(few.shown, false);
  assert.equal(few.texts.length, 0);
  assert.ok(full.closed > few.closed);
  assert.deepEqual(sampleResults(tr, NOW), sampleResults(tr, NOW), "the same every time");
  assert.equal(sampleAnswers(tr).length, 4);
});

test("the sample lists of lines and veils are clean, and a full list has the most entries", () => {
  const shared = sampleSharedLines(tr);
  assert.equal(new Set(shared.map(itemKey)).size, shared.length);
  assert.ok(shared.some(i => i.gm));
  assert.ok(shared.some(i => i.kind === "line") && shared.some(i => i.kind === "veil"));
  assert.ok(sampleOwnLines(tr).length < LV_MAX_OWN);
  const full = sampleOwnLines(tr, true);
  assert.equal(full.length, LV_MAX_OWN);
  assert.equal(new Set(full.map(itemKey)).size, full.length);
});

test("the sample player state follows the GM's counts, so its signals and wishes show as set", () => {
  const state = samplePlayerState({now: NOW, cleared: {pause: 2}, fulfilled: {npc: 1}});
  assert.equal(state.signals.pause.gen, 2);
  assert.equal(state.wishes.npc.gen, 1);
  assert.equal(state.wishes.exploration.gen, 0);
  assert.ok(WISHES.includes("exploration"));
  assert.deepEqual(samplePlayerState({answeredRound: true}).rounds.sample.answers, {});
  assert.deepEqual(samplePlayerState().rounds, {});
});
