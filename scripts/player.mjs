/**
 * The compass on a player's side: what this player said, kept in this browser only, with a random token per scale,
 * signal and wish, so the player can change or take back a vote without the GM learning who it was. When the GM
 * starts a new session the tokens start fresh, and when the GM's client loads it asks every player to send the state
 * again.
 */

import {MODULE_ID, setting} from "./config.mjs";
import {sendToGM} from "./net.mjs";
import {cleanAnswers, makeToken} from "./rules.mjs";
import {publicState} from "./state.mjs";

/**
 * @typedef PlayerState
 * @property {string|null} session
 * @property {Record<string, {token: string, value: number, at: number}>} axes
 * @property {Record<string, {token: string, at: number, gen: number}>} signals   gen: the GM's tick-off count then
 * @property {Record<string, {token: string, at: number, gen: number}>} wishes    gen: the GM's fulfilled count then
 * @property {Record<string, {token: string, value: number}>} polls     By scene check id
 * @property {Record<string, {token: string, answers: object}>} rounds   By feedback round id
 * @property {{at: number, ack: number, token: string}|null} xcard   The X card this player showed, with the GM's
 *   acknowledgements then
 */

/** @type {PlayerState|null} */
let mine = null;

/** Called whenever the player's state changes. */
const listeners = new Set();

/**
 * The storage key of this world.
 * @returns {string}
 */
function storageKey() {
  return `${MODULE_ID}.${game.world.id}.${game.user.id}`;
}

/**
 * An empty state for a session.
 * @param {string|null} session
 * @returns {PlayerState}
 */
function emptyState(session) {
  return {session, axes: {}, signals: {}, wishes: {}, polls: {}, rounds: {}, xcard: null};
}

/**
 * This player's state, for the current session.
 * @returns {PlayerState}
 */
export function myState() {
  const session = publicState().session?.id ?? null;
  if ( !mine ) {
    try {
      mine = JSON.parse(localStorage.getItem(storageKey()) ?? "null");
    } catch {
      mine = null;
    }
  }
  if ( !mine || (mine.session !== session) ) {
    mine = emptyState(session);
    save();
  }
  return mine;
}

/** Keep the state in this browser. */
function save() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(mine));
  } catch {
    // Private windows may refuse storage: the state then lives until the page reloads
  }
  for ( const fn of listeners ) fn();
}

/**
 * Be told when the player's state changes.
 * @param {() => void} fn
 */
export function onMineChange(fn) {
  listeners.add(fn);
}

/**
 * Is a scale vote still active (not faded)?
 * @param {{at: number}|undefined} entry
 * @returns {boolean}
 */
export function axisActive(entry) {
  const fade = setting("fadeMinutes") * 60 * 1000;
  return !!entry && (!fade || ((Date.now() - entry.at) < fade));
}

/**
 * Is a signal still active: not too old and not ticked off by the GM since?
 * @param {string} id
 * @param {{at: number, gen?: number}|undefined} entry
 * @returns {boolean}
 */
export function signalActive(id, entry) {
  if ( !entry ) return false;
  const age = setting("signalMinutes") * 60 * 1000;
  return (!age || ((Date.now() - entry.at) < age)) && ((entry.gen ?? 0) === (publicState().cleared?.[id] ?? 0));
}

/**
 * Is a wish still open: not fulfilled since?
 * @param {string} id
 * @param {{gen?: number}|undefined} entry
 * @returns {boolean}
 */
export function wishActive(id, entry) {
  return !!entry && ((entry.gen ?? 0) === (publicState().fulfilled?.[id] ?? 0));
}

/**
 * Is this player's X card still waiting for the GM?
 * @returns {boolean}
 */
export function xcardWaiting() {
  const x = myState().xcard;
  return !!x && (x.ack === (publicState().xAck ?? 0));
}

/* -------------------------------------------- */
/*  Saying something                            */
/* -------------------------------------------- */

/**
 * Vote on a scale, or take the vote back with null.
 * @param {string} id
 * @param {number|null} value
 * @returns {boolean}  Whether a GM received it
 */
export function vote(id, value) {
  const state = myState();
  const token = state.axes[id]?.token ?? makeToken();
  if ( value === null ) delete state.axes[id];
  else state.axes[id] = {token, value, at: Date.now()};
  save();
  return sendToGM({type: "axis", token, id, value});
}

/**
 * Send a signal or take it back.
 * @param {string} id
 * @returns {boolean}
 */
export function toggleSignal(id) {
  const state = myState();
  const on = !signalActive(id, state.signals[id]);
  const token = state.signals[id]?.token ?? makeToken();
  if ( on ) state.signals[id] = {token, at: Date.now(), gen: publicState().cleared?.[id] ?? 0};
  else delete state.signals[id];
  save();
  return sendToGM({type: "signal", token, id, on});
}

/**
 * Wish for something or take the wish back.
 * @param {string} id
 * @returns {boolean}
 */
export function toggleWish(id) {
  const state = myState();
  const on = !wishActive(id, state.wishes[id]);
  // A fulfilled wish gets a new token, so a new wish counts again
  const token = (on && state.wishes[id]) ? makeToken() : (state.wishes[id]?.token ?? makeToken());
  if ( on ) state.wishes[id] = {token, at: Date.now(), gen: publicState().fulfilled?.[id] ?? 0};
  else delete state.wishes[id];
  save();
  return sendToGM({type: "wish", token, id, on});
}

/**
 * Show the X card.
 * @returns {boolean}
 */
export function showXCard() {
  const state = myState();
  const token = makeToken();
  state.xcard = {at: Date.now(), ack: publicState().xAck ?? 0, token};
  save();
  return sendToGM({type: "xcard", token});
}

/**
 * Answer the scene check, or take the answer back with null.
 * @param {string} poll
 * @param {number|null} value
 * @returns {boolean}
 */
export function answerPoll(poll, value) {
  const state = myState();
  const token = state.polls[poll]?.token ?? makeToken();
  if ( value === null ) delete state.polls[poll];
  else state.polls[poll] = {token, value};
  save();
  return sendToGM({type: "poll", token, poll, value});
}

/**
 * Send the answers of the feedback round. Sending again replaces them.
 * @param {string} round
 * @param {object} answers
 * @returns {boolean}
 */
export function submitFeedback(round, answers) {
  const state = myState();
  const token = state.rounds[round]?.token ?? makeToken();
  const clean = cleanAnswers(answers, setting("freeText"));
  state.rounds[round] = {token, answers: clean, sent: Date.now()};
  save();
  return sendToGM({type: "feedback", token, round, answers: clean});
}

/**
 * Send everything still active again, after the GM's client loaded or when a GM joins. An X card the GM has not seen
 * yet goes out at once, the rest is shuffled and spread over a few seconds, so the GM cannot tell from the order which
 * votes belong together.
 */
export function resendAll() {
  if ( game.user.isGM ) return;
  const state = myState();
  if ( xcardWaiting() && state.xcard.token ) sendToGM({type: "xcard", token: state.xcard.token});
  const age = entry => Math.max(0, Math.floor((Date.now() - entry.at) / 60000));
  const messages = [];
  for ( const [id, entry] of Object.entries(state.axes) ) {
    if ( axisActive(entry) ) messages.push({type: "axis", token: entry.token, id, value: entry.value, age: age(entry)});
  }
  for ( const [id, entry] of Object.entries(state.signals) ) {
    if ( signalActive(id, entry) ) messages.push({type: "signal", token: entry.token, id, on: true, age: age(entry)});
  }
  for ( const [id, entry] of Object.entries(state.wishes) ) {
    if ( wishActive(id, entry) ) messages.push({type: "wish", token: entry.token, id, on: true});
  }
  const round = publicState().round;
  const sent = round ? state.rounds[round.id] : null;
  if ( sent ) messages.push({type: "feedback", token: sent.token, round: round.id, answers: sent.answers});
  for ( const message of messages ) setTimeout(() => sendToGM(message), Math.random() * 8000);
}
