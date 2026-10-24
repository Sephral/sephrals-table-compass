/**
 * The compass on the GM's side. Only the active GM's client collects: votes, signals and wishes by random tokens,
 * never by user. It shows them in batches after a random wait (the X card at once), lets votes fade, keeps a history
 * of the session on this client and runs the scene check and the feedback round. Other GMs get a copy of what the
 * active GM sees and ask the active GM when they act.
 */

import {SIGNALS, WISHES} from "./catalog.mjs";
import {MODULE_ID, POLL_SECONDS, onlinePlayers, setting, t} from "./config.mjs";
import {sendToUsers} from "./net.mjs";
import {activeEntries, batchDelay, cleanMessage, summarizeAxis, summarizeFeedback, summarizePoll} from "./rules.mjs";
import {choices, publicState, updatePublic} from "./state.mjs";

/** A new session starts when the compass was quiet this long. */
const SESSION_GAP = 6 * 3600 * 1000;

/** How often the history takes a sample. */
const HISTORY_STEP = 2 * 60 * 1000;

/** Samples kept per session (eight hours). */
const HISTORY_LIMIT = 240;

/** Votes, signals and wishes by token, on the active GM's client. */
const live = {
  axes: new Map(),
  signals: new Map(),
  wishes: new Map(),
  /** @type {Map<string, {at: number}>} X cards not yet acknowledged, by token, so a card sent again counts once */
  xcards: new Map(),
  /** @type {{id: string, endsAt: number, votes: Map<string, number>}|null} */
  poll: null,
  /** @type {{id: string, started: number, answers: Map<string, object>}|null} */
  round: null
};

/**
 * The votes, signals and wishes of the last batch. The GM's window is drawn from this copy, so an X card, an action
 * of the GM or a player joining never reveals votes still waiting for their batch.
 */
const shown = {axes: new Map(), signals: new Map(), wishes: new Map()};

/** What the GM's window shows: the last batch. */
let snapshot = null;

/** The copy another GM's client got from the active GM. */
let remote = null;

/** Called whenever the GM's view changes. */
const listeners = new Set();

let flushTimer = null;

/** Whether this client collects right now. */
let tracking = false;

/** The intervals of pruning and sampling, started once. */
let timers = null;

/* -------------------------------------------- */
/*  Reading                                     */
/* -------------------------------------------- */

/**
 * What the GM's window shows on this client.
 * @returns {object}
 */
export function view() {
  if ( game.user.isActiveGM ) return snapshot ?? buildSnapshot();
  return remote ?? buildSnapshot();
}

/**
 * Be told when the view changes.
 * @param {() => void} fn
 */
export function onViewChange(fn) {
  listeners.add(fn);
}

/** Tell everyone who listens. */
function changed() {
  for ( const fn of listeners ) {
    try {
      fn();
    } catch(err) {
      console.error(`${MODULE_ID} | View update failed`, err);
    }
  }
}

/**
 * The history of the current session on this GM client.
 * @returns {{session: string|null, points: {t: number, axes: Record<string, number|null>}[], marks: {t: number, kind: string, value?: number}[]}}
 */
export function history() {
  const value = game.settings.get(MODULE_ID, "history");
  const session = publicState().session?.id ?? null;
  if ( !value || (value.session !== session) ) return {session, points: [], marks: []};
  return {session, points: value.points ?? [], marks: value.marks ?? []};
}

/**
 * The feedback rounds this GM client keeps, newest last.
 * @returns {object[]}
 */
export function results() {
  const value = game.settings.get(MODULE_ID, "results");
  return Array.isArray(value) ? value : [];
}

/* -------------------------------------------- */
/*  Collecting                                  */
/* -------------------------------------------- */

/**
 * Was the compass quiet for so long that a new session begins?
 * @param {{started?: number, active?: number}|null} session
 * @returns {boolean}
 */
function sessionOver(session) {
  return !session || ((Date.now() - (session.active ?? session.started ?? 0)) > SESSION_GAP);
}

/**
 * Take over as the collecting GM: start a new session after a long pause, ask the players to send their state again
 * and keep the timers running. Call on "ready" and when the active GM changes.
 */
export async function startTracking() {
  if ( !game.user.isActiveGM || tracking ) return;
  tracking = true;
  timers ??= [setInterval(prune, 20 * 1000), setInterval(sample, HISTORY_STEP)];
  if ( sessionOver(publicState().session) ) await newSession({quiet: true});
  else {
    // A scene check left over cannot take answers any more. A feedback round goes on: the players send their answers again.
    const {poll, round} = publicState();
    if ( round ) live.round = {id: round.id, started: Date.now(), answers: new Map()};
    if ( poll ) await updatePublic({poll: null});
  }
  sendToUsers({type: "resync"}, onlinePlayers().map(u => u.id));
  flush();
}

/** Another GM took over: this client stops collecting and forgets what it held, the players send it to the new GM. */
export function stopTracking() {
  if ( !tracking ) return;
  tracking = false;
  clearTimeout(flushTimer);
  flushTimer = null;
  for ( const map of [live.axes, live.signals, live.wishes, live.xcards, shown.axes, shown.signals, shown.wishes] ) map.clear();
  live.poll = null;
  live.round = null;
  snapshot = null;
  changed();
}

/**
 * A message of a player, on the active GM's client. It comes without a name.
 * @param {object} message
 */
export function receive(message) {
  const clean = cleanMessage(message, {...choices(), freeText: setting("freeText")});
  if ( !clean ) return;
  const time = Date.now();
  // A vote sent again after a reload keeps its age
  const cast = time - ((clean.age ?? 0) * 60 * 1000);
  switch ( clean.type ) {
    case "axis":
      if ( clean.value === null ) live.axes.delete(clean.token);
      else live.axes.set(clean.token, {id: clean.id, value: clean.value, at: cast});
      break;
    case "signal":
      if ( clean.on ) live.signals.set(clean.token, {id: clean.id, at: cast});
      else live.signals.delete(clean.token);
      break;
    case "wish":
      if ( clean.on ) live.wishes.set(clean.token, {id: clean.id, at: time});
      else live.wishes.delete(clean.token);
      break;
    case "xcard":
      if ( live.xcards.has(clean.token) ) return;
      live.xcards.set(clean.token, {at: time});
      mark("xcard");
      refresh();
      alertXCard();
      return;
    case "poll":
      if ( !live.poll || (live.poll.id !== clean.poll) || (time > live.poll.endsAt + 2000) ) return;
      if ( clean.value === null ) live.poll.votes.delete(clean.token);
      else live.poll.votes.set(clean.token, clean.value);
      break;
    case "feedback":
      if ( !live.round || (live.round.id !== clean.round) ) return;
      live.round.answers.set(clean.token, clean.answers);
      countRound();
      break;
  }
  schedule();
}

/** Show new votes after the wait the GM chose. */
function schedule() {
  if ( flushTimer ) return;
  flushTimer = setTimeout(flush, batchDelay(setting("updateDelay")));
}

/** Show what was collected: the batch of new votes. */
function flush() {
  clearTimeout(flushTimer);
  flushTimer = null;
  for ( const key of ["axes", "signals", "wishes"] ) shown[key] = new Map(live[key]);
  refresh();
}

/**
 * Redraw the GM's view from the last batch, without revealing votes still waiting: after an X card, an action of
 * the GM, a player joining or a change of the settings.
 */
export function refresh() {
  if ( !game.user.isActiveGM ) return changed();
  snapshot = buildSnapshot();
  touchSession();
  sendToUsers({type: "snapshot", snapshot}, game.users.filter(u => u.isGM && u.active && (u !== game.user)).map(u => u.id));
  changed();
}

/** Drop faded votes and old signals, and begin a new session after a long quiet time. */
function prune() {
  if ( !tracking ) return;
  if ( sessionOver(publicState().session) ) {
    newSession({quiet: true});
    return;
  }
  const time = Date.now();
  let removed = false;
  const drop = (map, maxAge) => {
    for ( const [token, entry] of map ) if ( maxAge && ((time - entry.at) >= maxAge) ) {
      map.delete(token);
      removed = true;
    }
  };
  const fade = setting("fadeMinutes") * 60 * 1000;
  const signalAge = setting("signalMinutes") * 60 * 1000;
  for ( const map of [live.axes, shown.axes] ) drop(map, fade);
  for ( const map of [live.signals, shown.signals] ) drop(map, signalAge);
  if ( removed || (snapshot && (snapshot.online !== onlinePlayers().length)) ) refresh();
  // While players are online the session counts as in use
  else if ( onlinePlayers().length ) touchSession();
}

/**
 * Build what the GM's window shows from the last batch.
 * @returns {object}
 */
function buildSnapshot() {
  const time = Date.now();
  const {axes, signals, wishes} = choices();
  const state = publicState();
  const minVotes = setting("minVotes");
  const fade = setting("fadeMinutes") * 60 * 1000;
  const axisVotes = activeEntries(shown.axes.values(), time, fade);
  const signalVotes = [...shown.signals.values()];
  const wishVotes = [...shown.wishes.values()];
  return {
    at: time,
    online: onlinePlayers().length,
    axes: axes.map(id => ({id, ...summarizeAxis(axisVotes.filter(v => v.id === id).map(v => v.value), minVotes)})),
    signals: signals.map(id => ({id, count: signalVotes.filter(s => s.id === id).length})).filter(s => s.count),
    wishes: wishes.map(id => ({id, count: wishVotes.filter(w => w.id === id).length, soon: state.soon.includes(id)}))
      .filter(w => w.count).sort((a, b) => b.count - a.count),
    xcards: live.xcards.size,
    poll: live.poll ? {id: live.poll.id, endsAt: live.poll.endsAt, count: live.poll.votes.size} : null,
    lastPoll: snapshot?.lastPoll ?? null,
    round: live.round ? {id: live.round.id, count: live.round.answers.size} : null
  };
}

/* -------------------------------------------- */
/*  The GM acts                                 */
/* -------------------------------------------- */

/**
 * A GM who does not collect asks the active GM to act, so the window of every GM and the players agree.
 * @param {string} action
 * @param {string} [id]
 * @returns {boolean}  Whether this client is not the active GM (and the request went out)
 */
function forward(action, id) {
  if ( game.user.isActiveGM ) return false;
  const gm = game.users.activeGM;
  if ( gm ) sendToUsers({type: "action", action, ...(id ? {id} : {})}, [gm.id]);
  return true;
}

/** What another GM may ask the active GM for, with a check of the id. */
const ACTIONS = {
  ackX: () => acknowledgeXCard(),
  clearSignal: id => SIGNALS.includes(id) && clearSignal(id),
  toggleSoon: id => WISHES.includes(id) && toggleSoon(id),
  fulfillWish: id => WISHES.includes(id) && fulfillWish(id),
  newSession: () => newSession()
};

/**
 * Run what another GM asked for, on the active GM's client. Only GMs reach this (see net.mjs).
 * @param {{action?: string, id?: string}} message
 */
export function runAction(message) {
  if ( !game.user.isActiveGM || !Object.hasOwn(ACTIONS, message.action) ) return;
  ACTIONS[message.action](message.id);
}

/**
 * Start a new session: votes, signals, wishes and the history begin again.
 * @param {object} [options]
 * @param {boolean} [options.quiet]
 */
export async function newSession({quiet=false}={}) {
  if ( !game.user.isGM ) return;
  if ( forward("newSession") ) {
    if ( !quiet ) ui.notifications.info(t("STC.Notice.newSession"));
    return;
  }
  clearTimeout(flushTimer);
  flushTimer = null;
  for ( const map of [live.axes, live.signals, live.wishes, live.xcards, shown.axes, shown.signals, shown.wishes] ) map.clear();
  live.poll = null;
  live.round = null;
  const time = Date.now();
  await updatePublic({session: {id: foundry.utils.randomID(), started: time, active: time}, soon: [], fulfilled: {},
    cleared: {}, poll: null, round: null});
  await game.settings.set(MODULE_ID, "history", {session: publicState().session.id, points: [], marks: []});
  snapshot = null;
  refresh();
  if ( !quiet ) ui.notifications.info(t("STC.Notice.newSession"));
}

/** Note in the public state that the compass is in use, at most every ten minutes. */
function touchSession() {
  if ( !tracking ) return;
  const session = publicState().session;
  if ( !session || ((Date.now() - (session.active ?? 0)) < 10 * 60 * 1000) ) return;
  updatePublic(state => ({session: {...state.session, active: Date.now()}}));
}

/**
 * Drop the entries of one id from the collected and the shown votes.
 * @param {"signals"|"wishes"} key
 * @param {string} id
 */
function dropId(key, id) {
  for ( const map of [live[key], shown[key]] ) {
    for ( const [token, entry] of map ) if ( entry.id === id ) map.delete(token);
  }
}

/** The GM saw the X card. */
export async function acknowledgeXCard() {
  if ( !game.user.isGM || forward("ackX") ) return;
  live.xcards.clear();
  await updatePublic(state => ({xAck: (state.xAck ?? 0) + 1}));
  refresh();
}

/**
 * The GM ticked off a signal: it goes for everyone who sent it.
 * @param {string} id
 */
export async function clearSignal(id) {
  if ( !game.user.isGM || forward("clearSignal", id) ) return;
  dropId("signals", id);
  await updatePublic(state => ({cleared: {...state.cleared, [id]: (state.cleared?.[id] ?? 0) + 1}}));
  refresh();
}

/**
 * Announce a wish ("coming soon") or take the announcement back.
 * @param {string} id
 */
export async function toggleSoon(id) {
  if ( !game.user.isGM || forward("toggleSoon", id) ) return;
  await updatePublic(state => ({soon: state.soon.includes(id) ? state.soon.filter(x => x !== id) : [...state.soon, id]}));
  refresh();
}

/**
 * A wish came true: it goes for everyone who had it.
 * @param {string} id
 */
export async function fulfillWish(id) {
  if ( !game.user.isGM || forward("fulfillWish", id) ) return;
  dropId("wishes", id);
  await updatePublic(state => ({fulfilled: {...state.fulfilled, [id]: (state.fulfilled?.[id] ?? 0) + 1},
    soon: state.soon.filter(x => x !== id)}));
  mark("wish", undefined, id);
  refresh();
}

/** Start a scene check. */
export async function startPoll() {
  if ( !game.user.isActiveGM || live.poll ) return;
  const id = foundry.utils.randomID();
  const endsAt = Date.now() + (POLL_SECONDS * 1000);
  live.poll = {id, endsAt, votes: new Map()};
  await updatePublic({poll: {id, seconds: POLL_SECONDS}});
  setTimeout(() => endPoll(id), (POLL_SECONDS * 1000) + 2500);
  refresh();
}

/**
 * End a scene check and show how the scene went.
 * @param {string} id
 */
async function endPoll(id) {
  if ( live.poll?.id !== id ) return;
  const summary = summarizePoll([...live.poll.votes.values()], setting("minVotes"));
  live.poll = null;
  snapshot = {...(snapshot ?? buildSnapshot()), lastPoll: {...summary, at: Date.now()}};
  if ( summary.shown ) mark("poll", Math.round(summary.avg * 10) / 10);
  await updatePublic({poll: null});
  refresh();
}

/** Start the feedback round. */
export async function startRound() {
  if ( !game.user.isActiveGM || live.round ) return;
  const id = foundry.utils.randomID();
  live.round = {id, started: Date.now(), answers: new Map()};
  await updatePublic({round: {id, count: 0}});
  refresh();
}

/** The number of answers in the public state, a moment after the last one came in. */
const countRound = foundry.utils.debounce(() => {
  if ( live.round ) updatePublic({round: {id: live.round.id, count: live.round.answers.size}});
}, 1500);

/**
 * Close the feedback round and keep its result on this client.
 * @returns {Promise<object|null>}  The result
 */
export async function closeRound() {
  if ( !game.user.isActiveGM || !live.round ) return null;
  const round = live.round;
  live.round = null;
  const summary = summarizeFeedback([...round.answers.values()], {minAnswers: setting("minVotes")});
  const state = publicState();
  const wishCounts = {};
  for ( const entry of live.wishes.values() ) wishCounts[entry.id] = (wishCounts[entry.id] ?? 0) + 1;
  const result = {
    id: round.id, session: state.session?.id ?? null, started: state.session?.started ?? round.started, closed: Date.now(),
    online: onlinePlayers().length, ...summary,
    wishes: {fulfilled: Object.keys(state.fulfilled ?? {}), soon: [...state.soon], open: wishCounts},
    history: history()
  };
  await game.settings.set(MODULE_ID, "results", [...results(), result].slice(-10));
  mark("round");
  await updatePublic({round: null});
  refresh();
  return result;
}

/* -------------------------------------------- */
/*  History                                     */
/* -------------------------------------------- */

/** Take a sample of the scales for the history. */
function sample() {
  if ( !tracking ) return;
  const shown = snapshot ?? buildSnapshot();
  const axes = Object.fromEntries(shown.axes.map(a => [a.id, a.shown ? Math.round(a.avg * 100) / 100 : null]));
  if ( !Object.values(axes).some(v => v !== null) ) return;
  const h = history();
  h.points = [...h.points, {t: Date.now(), axes}].slice(-HISTORY_LIMIT);
  game.settings.set(MODULE_ID, "history", h);
}

/**
 * Mark a moment in the history: an X card, a scene check, a fulfilled wish, the feedback round.
 * @param {string} kind
 * @param {number} [value]
 * @param {string} [id]
 */
function mark(kind, value, id) {
  if ( !game.user.isActiveGM ) return;
  const h = history();
  h.marks = [...h.marks, {t: Date.now(), kind, ...(value !== undefined ? {value} : {}), ...(id ? {id} : {})}].slice(-100);
  game.settings.set(MODULE_ID, "history", h);
}

/* -------------------------------------------- */
/*  Other GMs and alerts                        */
/* -------------------------------------------- */

/**
 * A message of a GM: the copy of the view for another GM.
 * @param {object} message
 */
export function receiveFromGM(message) {
  if ( !game.user.isGM || game.user.isActiveGM ) return;
  if ( (message.type === "snapshot") && message.snapshot ) {
    const previous = remote?.xcards ?? 0;
    // The clocks of two computers may differ: the times of the copy count from when it arrived here
    const copy = message.snapshot;
    const offset = Date.now() - (copy.at ?? Date.now());
    remote = {...copy, at: Date.now(),
      poll: copy.poll ? {...copy.poll, endsAt: copy.poll.endsAt + offset} : null,
      lastPoll: copy.lastPoll ? {...copy.lastPoll, at: copy.lastPoll.at + offset} : null};
    changed();
    if ( remote.xcards > previous ) alertXCard();
  }
}

/** Tell the GM about an X card, also when the window is closed. */
function alertXCard() {
  ui.notifications.warn(t("STC.XCard.alert"));
  if ( setting("xcardSound") ) {
    const sound = "sounds/notify.wav";
    try {
      foundry.audio.AudioHelper.play({src: sound, volume: 0.6, autoplay: true, loop: false}, false);
    } catch(err) {
      console.warn(`${MODULE_ID} | Could not play the X card sound`, err);
    }
  }
  changed();
}

/** For tests in the running game: what the active GM holds, without the tokens. */
export function debugState() {
  return {
    axes: [...live.axes.values()].map(({id, value}) => ({id, value})),
    signals: [...live.signals.values()].map(({id}) => ({id})),
    wishes: [...live.wishes.values()].map(({id}) => ({id})),
    xcards: live.xcards.size,
    poll: live.poll ? {id: live.poll.id, votes: live.poll.votes.size} : null,
    round: live.round ? {id: live.round.id, answers: live.round.answers.size} : null
  };
}
