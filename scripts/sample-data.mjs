/**
 * Made-up data for the sample windows (api.samples): votes, signals, wishes, a history, the spotlight, feedback results
 * and the lists of Lines and Veils of the shared cast (Lena, Tom, Sam and Jo play Ari, Mira, Tovin and Sela). Pure
 * functions without Foundry, so Node can test them. Nothing here is sent, saved or counted.
 */

import {AXES, SIGNALS, WISHES} from "./catalog.mjs";
import {LV_MAX_OWN, itemsFromStore} from "./lines-rules.mjs";
import {summarizeAxis, summarizeFeedback} from "./rules.mjs";
import {spotlightRows} from "./spotlight-rules.mjs";

const MINUTE = 60 * 1000;

/** The players of the sample table, with the characters they play. */
export const SAMPLE_PLAYERS = [
  {id: "sample-lena", name: "Lena", character: "Ari"},
  {id: "sample-tom", name: "Tom", character: "Mira"},
  {id: "sample-sam", name: "Sam", character: "Tovin"},
  {id: "sample-jo", name: "Jo", character: "Sela"}
];

/** What the four players voted per scale (Lena, Tom, Sam, Jo), from -2 to 2. Some scales show every state. */
const VOTES = {
  pace: [-1, -1, -2, 0],
  tension: [0, 0, 1, 0],
  roleplay: [-1, 0, -1, -1],
  combat: [2, -2, 1, -1],
  challenge: [1, 1, 2, 1],
  exploration: [0, 0, -1, 0],
  description: [-1],
  humor: [1, 0, 1, 0],
  rules: []
};

/** Signals and wishes the table sent. */
const SIGNAL_COUNTS = {pause: 1, lost: 1, spotlight: 2, more: 1, tech: 1};
const WISH_COUNTS = {combat: 3, exploration: 2, character: 2, npc: 1, trade: 1};

/**
 * The summaries of the scales, like the GM's window gets them.
 * @param {number} [minVotes]
 * @returns {object[]}
 */
export function sampleAxes(minVotes=2) {
  return AXES.map(id => ({id, ...summarizeAxis(VOTES[id] ?? [], minVotes)}));
}

/**
 * What the GM's window shows (the shape of tracker.view()).
 * @param {object} [options]
 * @param {number} [options.now]
 * @param {number} [options.online]
 * @param {number} [options.minVotes]
 * @param {number} [options.xcards]
 * @param {boolean} [options.poll]      A scene check is running
 * @param {boolean} [options.round]     A feedback round is running
 * @param {"none"|"shown"|"few"} [options.lastPoll]
 * @param {string[]} [options.soon]     Wishes announced as coming soon
 * @returns {object}
 */
export function sampleView({now=Date.now(), online=4, minVotes=2, xcards=0, poll=false, round=false, lastPoll="none",
  soon=["exploration"]}={}) {
  return {
    at: now,
    online,
    axes: sampleAxes(minVotes),
    signals: SIGNALS.map(id => ({id, count: SIGNAL_COUNTS[id] ?? 0})).filter(s => s.count),
    wishes: WISHES.map(id => ({id, count: WISH_COUNTS[id] ?? 0, soon: soon.includes(id)}))
      .filter(w => w.count).sort((a, b) => b.count - a.count),
    xcards,
    poll: poll ? {id: "sample", endsAt: now + (18 * 1000), count: 3} : null,
    lastPoll: lastPoll === "shown" ? {count: 4, shown: true, avg: 3.8, faces: [0, 0, 1, 2, 1], at: now - (2 * MINUTE)}
      : lastPoll === "few" ? {count: 1, shown: false, avg: 0, faces: [0, 0, 0, 1, 0], at: now - (2 * MINUTE)} : null,
    round: round ? {id: "sample", count: 3} : null
  };
}

/**
 * A history of the last two hours: the scales drift towards today's votes, with the moments the GM marked.
 * @param {number} [now]
 * @returns {{session: string, points: object[], marks: object[]}}
 */
export function sampleHistory(now=Date.now()) {
  const axes = sampleAxes();
  const count = 13;
  const step = 10 * MINUTE;
  const points = Array.from({length: count}, (_, i) => {
    const frac = i / (count - 1);
    const values = {};
    axes.forEach((axis, k) => {
      if ( !axis.shown ) return values[axis.id] = null;
      const start = ((k % 3) - 1) * 0.8;
      const value = (axis.avg * frac) + (start * (1 - frac)) + (0.25 * Math.sin((i * 1.7) + k));
      values[axis.id] = Math.round(Math.min(2, Math.max(-2, value)) * 100) / 100;
    });
    return {t: now - ((count - 1 - i) * step), axes: values};
  });
  const marks = [
    {t: now - (95 * MINUTE), kind: "poll", value: 3.6},
    {t: now - (70 * MINUTE), kind: "xcard"},
    {t: now - (40 * MINUTE), kind: "wish", id: "campfire"},
    {t: now - (8 * MINUTE), kind: "round"}
  ];
  return {session: "sample", points, marks};
}

/**
 * The spotlight view: who was in the spotlight how long ago, and one player who has been quiet much longer.
 * @param {number} [now]
 * @param {number} [quietMinutes]
 * @returns {{rows: object[], quiet: string[], names: string[]}}
 */
export function sampleSpotlight(now=Date.now(), quietMinutes=20) {
  const last = {"sample-lena": 2, "sample-tom": 6, "sample-sam": 14, "sample-jo": null};
  const score = {"sample-lena": 6, "sample-tom": 4, "sample-sam": 2, "sample-jo": 0};
  const players = Object.fromEntries(SAMPLE_PLAYERS.map(p => [p.id, {
    since: now - (48 * MINUTE), last: last[p.id] === null ? null : now - (last[p.id] * MINUTE),
    score: score[p.id], scoreAt: now, gaps: {}
  }]));
  const {rows, quiet} = spotlightRows(players, SAMPLE_PLAYERS, now, {quietMinutes});
  return {rows, quiet, names: quiet.map(id => rows.find(r => r.id === id)?.name).filter(Boolean)};
}

/** A small deterministic random generator, so the free texts of a sample come in the same order every time. */
function seeded(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * The answers of the four players to the feedback round.
 * @param {(key: string) => string} tr   Sample texts by short name
 * @returns {object[]}
 */
export function sampleAnswers(tr) {
  return [
    {stars: 5, tempo: 0, highlights: ["combat", "story"], more: ["exploration"], less: ["puzzle"], rose: tr("rose1"), thorn: "", bud: tr("bud1")},
    {stars: 4, tempo: -1, highlights: ["roleplay", "combat"], more: ["roleplay"], less: ["exploration"], rose: tr("rose2"), thorn: tr("thorn1"), bud: ""},
    {stars: 4, tempo: 0, highlights: ["humor"], more: ["combat", "character"], less: [], rose: "", thorn: "", bud: tr("bud2")},
    {stars: 3, tempo: 1, highlights: ["story", "character"], more: ["puzzle"], less: ["combat"], rose: "", thorn: "", bud: ""}
  ];
}

/**
 * Two kept feedback rounds, the newest first in the list order of the window (oldest first here): one with enough
 * answers, one with too few to show.
 * @param {(key: string) => string} tr
 * @param {number} [now]
 * @returns {object[]}
 */
export function sampleResults(tr, now=Date.now()) {
  const full = summarizeFeedback(sampleAnswers(tr), {minAnswers: 2, rng: seeded(7)});
  const few = summarizeFeedback(sampleAnswers(tr).slice(0, 1), {minAnswers: 2, rng: seeded(3)});
  return [
    {id: "sample-b", session: "sample-b", started: now - (9 * 24 * 60 * MINUTE), closed: now - ((9 * 24 * 60 - 200) * MINUTE),
      online: 4, ...few, wishes: {fulfilled: [], soon: [], open: {combat: 1}}},
    {id: "sample-a", session: "sample-a", started: now - (2 * 24 * 60 * MINUTE), closed: now - ((2 * 24 * 60 - 210) * MINUTE),
      online: 4, ...full, wishes: {fulfilled: ["campfire"], soon: ["combat"], open: {combat: 2, exploration: 2, character: 1}}}
  ];
}

/**
 * The shared list of Lines and Veils, as the windows read it.
 * @param {(key: string) => string} tr
 * @returns {object[]}
 */
export function sampleSharedLines(tr) {
  return itemsFromStore({items: [
    {kind: "line", topic: "violenceChildren"},
    {kind: "line", topic: "torture"},
    {kind: "line", topic: "spiders"},
    {kind: "line", text: tr("linePets")},
    {kind: "veil", topic: "sexualViolence"},
    {kind: "veil", topic: "gore", gm: true},
    {kind: "veil", topic: "drowning"},
    {kind: "veil", text: tr("veilRomance")}
  ]});
}

/**
 * What one player set in Lines and Veils.
 * @param {(key: string) => string} tr
 * @param {boolean} [full]   The player reached the most entries
 * @returns {object[]}
 */
export function sampleOwnLines(tr, full=false) {
  const own = [
    {kind: "line", topic: "torture"},
    {kind: "line", topic: "spiders"},
    {kind: "line", text: tr("linePets")},
    {kind: "veil", topic: "drowning"}
  ];
  if ( !full ) return own;
  const more = ["violenceChildren", "abuse", "slavery", "snakes", "insects", "needles", "trapped", "illness"];
  return [...own, ...more.slice(0, LV_MAX_OWN - own.length).map(topic => ({kind: "veil", topic}))];
}

/**
 * What a player said, in the shape of the players' window (the shape of player.myState()).
 * @param {object} [options]
 * @param {number} [options.now]
 * @param {Record<string, number>} [options.cleared]    The GM's tick-off counts now (signals)
 * @param {Record<string, number>} [options.fulfilled]  The GM's fulfilled counts now (wishes)
 * @param {boolean} [options.answeredRound]
 * @returns {object}
 */
export function samplePlayerState({now=Date.now(), cleared={}, fulfilled={}, answeredRound=false}={}) {
  const entry = extra => ({token: "SampleToken0001", at: now, ...extra});
  return {
    session: "sample",
    axes: {pace: entry({value: -1}), tension: entry({value: 0}), roleplay: entry({value: 1}), challenge: entry({value: 2})},
    signals: {pause: entry({gen: cleared.pause ?? 0}), spotlight: entry({gen: cleared.spotlight ?? 0})},
    wishes: {exploration: entry({gen: fulfilled.exploration ?? 0}), npc: entry({gen: fulfilled.npc ?? 0})},
    polls: {},
    rounds: answeredRound ? {sample: {token: "SampleToken0002", answers: {}}} : {},
    xcard: null
  };
}
