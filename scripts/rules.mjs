/**
 * Rules of the compass, without Foundry: how the votes of a scale add up, when they fade, when the GM may see them,
 * how a message from a player is checked, and what the scene check and the feedback round show. Kept pure so Node
 * can test them.
 */

import {AXES, FACES, SIGNALS, STEPS, TOPICS, WISHES} from "./catalog.mjs";

/** A vote token: random letters and digits, the same for one scale, signal or wish of one player. */
const TOKEN = /^[A-Za-z0-9]{8,32}$/;

/** Longest free text of the feedback round. */
export const TEXT_LIMIT = 500;

/** Highest age in minutes a vote sent again may carry. */
const MAX_AGE = 24 * 60;

/**
 * A random token.
 * @param {() => number} [rng]
 * @returns {string}
 */
export function makeToken(rng=Math.random) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({length: 16}, () => chars[Math.floor(rng() * chars.length) % chars.length]).join("");
}

/**
 * Shuffle a copy of a list.
 * @template T
 * @param {T[]} list
 * @param {() => number} [rng]
 * @returns {T[]}
 */
export function shuffle(list, rng=Math.random) {
  const copy = [...list];
  for ( let i = copy.length - 1; i > 0; i-- ) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * How often each id occurs.
 * @param {string[]} ids
 * @returns {Record<string, number>}
 */
export function countIds(ids) {
  const counts = {};
  for ( const id of ids ) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/* -------------------------------------------- */
/*  Scales                                      */
/* -------------------------------------------- */

/**
 * @typedef AxisSummary
 * @property {number} count        Votes
 * @property {boolean} shown       Enough votes to show them
 * @property {number} avg          Average from -2 to 2
 * @property {number} spread       Standard deviation
 * @property {"few"|"fine"|"split"|"low"|"high"} status
 * @property {0|1|2} strength      0 fine, 1 a bit off, 2 far off
 * @property {number[]} steps      Votes per step from -2 to 2
 */

/**
 * Add up the votes of one scale. Below the minimum nothing is shown, so a single vote cannot be told apart.
 * @param {number[]} values      Votes from -2 to 2
 * @param {number} [minVotes=2]
 * @returns {AxisSummary}
 */
export function summarizeAxis(values, minVotes=2) {
  const votes = values.filter(v => STEPS.includes(v));
  const count = votes.length;
  const steps = STEPS.map(step => votes.filter(v => v === step).length);
  if ( !count || (count < Math.max(1, minVotes)) ) return {count, shown: false, avg: 0, spread: 0, status: "few", strength: 0, steps};
  const avg = votes.reduce((sum, v) => sum + v, 0) / count;
  const spread = Math.sqrt(votes.reduce((sum, v) => sum + ((v - avg) ** 2), 0) / count);
  let status;
  if ( spread >= 1.2 ) status = "split";
  else if ( Math.abs(avg) < 0.4 ) status = "fine";
  else status = avg < 0 ? "low" : "high";
  const strength = (status === "fine") ? 0 : (Math.abs(avg) < 1.2 ? 1 : 2);
  return {count, shown: true, avg, spread, status, strength, steps};
}

/**
 * The entries which have not faded yet.
 * @template {{at: number}} T
 * @param {Iterable<T>} entries
 * @param {number} now
 * @param {number} maxAgeMs        0 or less: entries never fade
 * @returns {T[]}
 */
export function activeEntries(entries, now, maxAgeMs) {
  const list = [...entries];
  if ( !(maxAgeMs > 0) ) return list;
  return list.filter(entry => (now - entry.at) < maxAgeMs);
}

/**
 * How long the GM's view waits before it shows new votes. The random wait keeps a click from being matched to the
 * player who just moved the mouse.
 * @param {"off"|"short"|"normal"} mode
 * @param {() => number} [rng]
 * @returns {number}  Milliseconds
 */
export function batchDelay(mode, rng=Math.random) {
  if ( mode === "off" ) return 0;
  if ( mode === "normal" ) return Math.round(30000 + (rng() * 60000));
  return Math.round(15000 + (rng() * 30000));
}

/* -------------------------------------------- */
/*  Drawings                                    */
/* -------------------------------------------- */

/**
 * The corners of the compass rose. Each spoke points where the table wants more: a scale whose votes say "too
 * little" pushes its corner outwards, "too much" pulls it in. The middle ring is "fine".
 * @param {number[]} wants          Per spoke from -2 (much less) to 2 (much more)
 * @param {{cx: number, cy: number, ring: number, outer: number, inner?: number}} geometry
 * @returns {{x: number, y: number, angle: number}[]}
 */
export function compassCorners(wants, {cx, cy, ring, outer, inner=4}) {
  const n = wants.length;
  const unit = (outer - ring) / 2;
  return wants.map((want, i) => {
    const angle = (-90 + ((360 / Math.max(n, 1)) * i)) * (Math.PI / 180);
    const r = Math.min(outer, Math.max(inner, ring + ((Number(want) || 0) * unit)));
    return {x: round(cx + (Math.cos(angle) * r)), y: round(cy + (Math.sin(angle) * r)), angle};
  });
}

/**
 * The points of a line in the history: time on x, the average of a scale on y (fine in the middle).
 * @param {{t: number, v: number|null}[]} samples
 * @param {{from: number, to: number, width: number, height: number}} box
 * @returns {string}  "x,y x,y ..." with gaps left out
 */
export function sparkline(samples, {from, to, width, height}) {
  const span = Math.max(to - from, 1);
  const mid = height / 2;
  const unit = (height / 2) / 2.2;
  return samples
    .filter(s => (s.v !== null) && Number.isFinite(s.v) && (s.t >= from) && (s.t <= to))
    .map(s => `${round(((s.t - from) / span) * width)},${round(mid - (s.v * unit))}`)
    .join(" ");
}

/**
 * Round to one decimal for SVG coordinates.
 * @param {number} value
 * @returns {number}
 */
function round(value) {
  return Math.round(value * 10) / 10;
}

/* -------------------------------------------- */
/*  Scene check and feedback round              */
/* -------------------------------------------- */

/**
 * Add up a scene check.
 * @param {number[]} values      Faces from 1 to 5
 * @param {number} [minVotes=2]
 * @returns {{count: number, shown: boolean, avg: number, faces: number[]}}
 */
export function summarizePoll(values, minVotes=2) {
  const votes = values.filter(v => FACES.includes(v));
  const count = votes.length;
  const faces = FACES.map(face => votes.filter(v => v === face).length);
  const shown = (count > 0) && (count >= Math.max(1, minVotes));
  return {count, shown, avg: shown ? votes.reduce((s, v) => s + v, 0) / count : 0, faces};
}

/**
 * @typedef FeedbackAnswers
 * @property {number|null} stars       1 to 5
 * @property {number|null} tempo       -1 too slow, 0 just right, 1 too fast
 * @property {string[]} highlights
 * @property {string[]} more
 * @property {string[]} less
 * @property {string} rose
 * @property {string} thorn
 * @property {string} bud
 */

/**
 * Add up a feedback round. The free texts come back in a random order, so the order of the answers tells nothing.
 * @param {FeedbackAnswers[]} answers
 * @param {object} [options]
 * @param {number} [options.minAnswers=2]
 * @param {() => number} [options.rng]
 * @returns {object}
 */
export function summarizeFeedback(answers, {minAnswers=2, rng=Math.random}={}) {
  const count = answers.length;
  const shown = (count > 0) && (count >= Math.max(1, minAnswers));
  const stars = answers.map(a => a.stars).filter(s => FACES.includes(s));
  const tempo = answers.map(a => a.tempo).filter(v => [-1, 0, 1].includes(v));
  const texts = [];
  for ( const a of answers ) {
    for ( const kind of ["rose", "thorn", "bud"] ) {
      const text = String(a[kind] ?? "").trim();
      if ( text ) texts.push({kind, text});
    }
  }
  return {
    count, shown,
    stars: {count: stars.length, avg: stars.length ? stars.reduce((s, v) => s + v, 0) / stars.length : 0,
      dist: FACES.map(face => stars.filter(s => s === face).length)},
    tempo: {slow: tempo.filter(v => v === -1).length, fine: tempo.filter(v => v === 0).length,
      fast: tempo.filter(v => v === 1).length},
    highlights: countIds(answers.flatMap(a => a.highlights ?? [])),
    more: countIds(answers.flatMap(a => a.more ?? [])),
    less: countIds(answers.flatMap(a => a.less ?? [])),
    texts: shown ? shuffle(texts, rng) : []
  };
}

/* -------------------------------------------- */
/*  Messages                                    */
/* -------------------------------------------- */

/**
 * Check a message from a player and bring it into a known shape. Anything unknown is dropped.
 * @param {object} message
 * @param {{axes?: string[], signals?: string[], wishes?: string[], freeText?: boolean}} [allowed]
 * @returns {object|null}
 */
export function cleanMessage(message, {axes=AXES, signals=SIGNALS, wishes=WISHES, freeText=true}={}) {
  if ( !message || (typeof message !== "object") ) return null;
  const token = String(message.token ?? "");
  if ( !TOKEN.test(token) ) return null;
  switch ( message.type ) {
    case "axis":
      if ( !axes.includes(message.id) ) return null;
      if ( (message.value !== null) && !STEPS.includes(message.value) ) return null;
      return {type: "axis", token, id: message.id, value: message.value, ...age(message.age)};
    case "signal":
      if ( !signals.includes(message.id) ) return null;
      return {type: "signal", token, id: message.id, on: message.on === true, ...age(message.age)};
    case "wish":
      if ( !wishes.includes(message.id) ) return null;
      return {type: "wish", token, id: message.id, on: message.on === true};
    case "xcard":
      return {type: "xcard", token};
    case "poll":
      if ( !isId(message.poll) ) return null;
      if ( (message.value !== null) && !FACES.includes(message.value) ) return null;
      return {type: "poll", token, poll: message.poll, value: message.value};
    case "feedback":
      if ( !isId(message.round) ) return null;
      return {type: "feedback", token, round: message.round, answers: cleanAnswers(message.answers, freeText)};
    default:
      return null;
  }
}

/**
 * The age of a vote sent again, in whole minutes: a vote keeps fading from when it was cast, not from when the GM's
 * client got it again. Whole minutes tell the GM no more than the window showed when the vote first came.
 * @param {*} value
 * @returns {{age?: number}}
 */
function age(value) {
  return (Number.isInteger(value) && (value >= 0) && (value <= MAX_AGE)) ? {age: value} : {};
}

/**
 * Is this a document style id?
 * @param {*} value
 * @returns {boolean}
 */
function isId(value) {
  return (typeof value === "string") && /^[A-Za-z0-9]{8,32}$/.test(value);
}

/**
 * Bring the answers of a feedback form into shape.
 * @param {object} answers
 * @param {boolean} freeText    Whether free texts are allowed
 * @returns {FeedbackAnswers}
 */
export function cleanAnswers(answers, freeText=true) {
  const a = answers ?? {};
  const topics = list => (Array.isArray(list) ? [...new Set(list)].filter(id => TOPICS.includes(id)) : []);
  const text = value => (freeText ? String(value ?? "").trim().slice(0, TEXT_LIMIT) : "");
  return {
    stars: FACES.includes(a.stars) ? a.stars : null,
    tempo: [-1, 0, 1].includes(a.tempo) ? a.tempo : null,
    highlights: topics(a.highlights),
    more: topics(a.more),
    less: topics(a.less),
    rose: text(a.rose),
    thorn: text(a.thorn),
    bud: text(a.bud)
  };
}
