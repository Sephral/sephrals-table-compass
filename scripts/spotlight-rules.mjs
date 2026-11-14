/**
 * Rules of the spotlight view, without Foundry: which signals count, how a soft score fades, who has been quiet much
 * longer than the others and what the GM's window says about it. Kept pure so Node can test them.
 *
 * The view is a rough picture for the GM, not a log: it keeps one time and one fading score per player, never what
 * was said or rolled, and nothing of it reaches the players.
 */

/**
 * The kinds of signals. A strong signal puts the player "in the spotlight" (it sets the time of last activity), a soft
 * one only warms the bar: table talk is not the spotlight.
 */
export const KINDS = {
  roll: {weight: 3, strong: true},
  ic: {weight: 3, strong: true},
  move: {weight: 2, strong: true},
  mark: {weight: 4, strong: true},
  chat: {weight: 1, strong: false}
};

/** Half-life of the bar's score in milliseconds. */
export const HALF_LIFE = 20 * 60 * 1000;

/** The same kind of signal from the same player counts once in this time (a token moved square by square). */
export const MIN_GAP = 8000;

/** A player counts as "fresh" while the last strong signal is younger than this share of the quiet limit. */
const FRESH_SHARE = 0.25;

/** At most this many players get the gentle hint at once. */
export const MAX_HINTS = 2;

/**
 * @typedef PlayerEntry
 * @property {number} since     When the player was first seen online in this session
 * @property {number|null} last Time of the last strong signal
 * @property {number} score     Fading score at "scoreAt"
 * @property {number} scoreAt
 * @property {Record<string, number>} gaps   Last time per kind, for the minimum gap
 */

/**
 * The score of a player now.
 * @param {PlayerEntry} entry
 * @param {number} now
 * @returns {number}
 */
export function currentScore(entry, now) {
  const age = Math.max(now - (entry.scoreAt ?? now), 0);
  return (entry.score ?? 0) * (0.5 ** (age / HALF_LIFE));
}

/**
 * Note that a player was seen online.
 * @param {Record<string, PlayerEntry>} players   Changed in place
 * @param {string} id
 * @param {number} now
 * @returns {PlayerEntry}
 */
export function touch(players, id, now) {
  players[id] ??= {since: now, last: null, score: 0, scoreAt: now, gaps: {}};
  return players[id];
}

/**
 * Record a signal of a player.
 * @param {Record<string, PlayerEntry>} players   Changed in place
 * @param {string} id
 * @param {string} kind
 * @param {number} now
 * @returns {boolean}   Whether the signal counted
 */
export function record(players, id, kind, now) {
  const def = KINDS[kind];
  if ( !def ) return false;
  const entry = touch(players, id, now);
  const before = entry.gaps?.[kind];
  // The GM's own mark always counts
  if ( (kind !== "mark") && (before !== undefined) && ((now - before) < MIN_GAP) ) return false;
  entry.gaps = {...(entry.gaps ?? {}), [kind]: now};
  entry.score = currentScore(entry, now) + def.weight;
  entry.scoreAt = now;
  if ( def.strong ) entry.last = Math.max(entry.last ?? 0, now);
  return true;
}

/**
 * What a chat message is, for the spotlight. Whispers are private and do not count unless they carry a roll.
 * @param {object} message
 * @param {boolean} message.isRoll      The message holds a roll
 * @param {number} message.whispers     Number of recipients of a whisper
 * @param {number|null} message.style   Foundry's chat message style: 0 other, 1 out of character, 2 in character
 * @param {boolean} message.actor       A character speaks
 * @param {boolean} message.gm          The author is a GM
 * @returns {"roll"|"ic"|"chat"|null}
 */
export function classifyMessage({isRoll, whispers=0, style=null, actor=false, gm=false}) {
  if ( gm ) return null;
  if ( isRoll ) return "roll";
  if ( whispers > 0 ) return null;
  if ( style === 1 ) return "chat";
  // In character, or a card of a character (an item used, a spell cast)
  return ((style === 2) || actor) ? "ic" : "chat";
}

/**
 * The median of a list of numbers.
 * @param {number[]} list
 * @returns {number}
 */
export function median(list) {
  if ( !list.length ) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return (sorted.length % 2) ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Who has been quiet much longer than the others: at or beyond the quiet limit, at least twice as long as the median
 * of the others, and only while somebody else has been in the spotlight within the limit (otherwise the table is
 * simply on a break).
 * @param {{id: string, age: number}[]} ages   Milliseconds since the last strong signal, or since the player arrived
 * @param {number} quietMs
 * @returns {string[]}  Ids, the quietest first, at most MAX_HINTS
 */
export function quietOnes(ages, quietMs) {
  if ( ages.length < 2 ) return [];
  const flagged = [];
  for ( const {id, age} of ages ) {
    const others = ages.filter(a => a.id !== id).map(a => a.age);
    if ( (age >= quietMs) && (age >= (2 * median(others))) && others.some(a => a < quietMs) ) flagged.push({id, age});
  }
  return flagged.sort((a, b) => b.age - a.age).slice(0, MAX_HINTS).map(f => f.id);
}

/**
 * @typedef SpotlightRow
 * @property {string} id
 * @property {string} name
 * @property {string} character
 * @property {number|null} minutes   Whole minutes since the last strong signal, null when there was none
 * @property {"fresh"|"ok"|"quiet"|"none"} state
 * @property {number} bar            Soft bar from 0 to 100
 */

/**
 * The rows of the spotlight view.
 * @param {Record<string, PlayerEntry>} players
 * @param {{id: string, name: string, character?: string}[]} roster   The players online, in the order to show
 * @param {number} now
 * @param {object} [options]
 * @param {number} [options.quietMinutes=20]
 * @returns {{rows: SpotlightRow[], quiet: string[]}}
 */
export function spotlightRows(players, roster, now, {quietMinutes=20}={}) {
  const quietMs = quietMinutes * 60 * 1000;
  const ages = roster.map(p => {
    const entry = players[p.id];
    return {id: p.id, age: Math.max(now - (entry?.last ?? entry?.since ?? now), 0)};
  });
  const quiet = quietOnes(ages, quietMs);
  const scores = roster.map(p => (players[p.id] ? currentScore(players[p.id], now) : 0));
  const top = Math.max(...scores, 0);
  const rows = roster.map((p, i) => {
    const entry = players[p.id];
    const last = entry?.last ?? null;
    const age = ages[i].age;
    let state = "ok";
    if ( quiet.includes(p.id) ) state = "quiet";
    else if ( last === null ) state = "none";
    else if ( age < (quietMs * FRESH_SHARE) ) state = "fresh";
    const bar = top >= 0.05 ? Math.round((scores[i] / top) * 100) : 0;
    return {id: p.id, name: p.name, character: p.character ?? "", state,
      minutes: last === null ? null : Math.max(Math.floor((now - last) / 60000), 0),
      bar: (scores[i] >= 0.05) ? Math.max(bar, 6) : 0};
  });
  return {rows, quiet};
}

/**
 * How to say a number of minutes: "just now", "12 min" or "1 h 5 min".
 * @param {number} minutes
 * @returns {{kind: "now"|"minutes"|"hours", minutes: number, hours: number}}
 */
export function agePhrase(minutes) {
  if ( minutes < 1 ) return {kind: "now", minutes: 0, hours: 0};
  if ( minutes < 60 ) return {kind: "minutes", minutes, hours: 0};
  return {kind: "hours", minutes: minutes % 60, hours: Math.floor(minutes / 60)};
}

/**
 * Drop players who are no longer users of the world, so a book never grows.
 * @param {Record<string, PlayerEntry>} players   Changed in place
 * @param {string[]} keep   Ids of the known users
 */
export function forgetUnknown(players, keep) {
  for ( const id of Object.keys(players) ) if ( !keep.includes(id) ) delete players[id];
}
