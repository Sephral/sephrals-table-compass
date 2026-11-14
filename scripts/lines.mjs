/**
 * Lines and veils. Players say what never happens in this game (lines) and what may happen but off screen (veils),
 * anonymously. A player's entry travels like every vote of the compass: with a random token, over the socket to the
 * active GM only. The active GM's client keeps the shared list in a world setting that everyone reads and nobody but
 * a GM writes. New entries reach the list after the same random wait as the votes, in a fixed order, so the list
 * tells nothing about who wrote what or when. The GM can add entries of their own, marked as the GM's.
 *
 * The entries of a player live in this browser for the whole campaign (not only one session), so a player can
 * change their mind at any time and a reload of the GM's client loses nothing.
 */

import {MODULE_ID, setting} from "./config.mjs";
import {sendToGM, sendToUsers} from "./net.mjs";
import {
  LV_MAX_OWN, cleanItem, cleanLinesMessage, itemKey, itemsFromStore, sortItems, withItem, withoutKey
} from "./lines-rules.mjs";
import {batchDelay, makeToken} from "./rules.mjs";
import {countFeature} from "./usage.mjs";

/* -------------------------------------------- */
/*  The shared list                             */
/* -------------------------------------------- */

/**
 * The shared list, as everyone reads it.
 * @returns {import("./lines-rules.mjs").LinesItem[]}
 */
export function sharedItems() {
  return itemsFromStore(game.settings.get(MODULE_ID, "lv"));
}

/** Whether free texts are allowed. */
function freeTextAllowed() {
  return setting("linesFreeText") !== false;
}

/* -------------------------------------------- */
/*  The active GM                               */
/* -------------------------------------------- */

/** Entry token -> key of the entry, on the active GM's client. */
let tokens = new Map();

/** The entries of the players the next publication holds (null while this client does not collect). */
let staged = null;

let publishTimer = null;

let saveTimer = null;

/** Called when the shared list was published (the window of the GM redraws through the setting itself). */
export function startLines() {
  const saved = game.settings.get(MODULE_ID, "lvTokens");
  tokens = new Map(Object.entries((saved && (typeof saved === "object")) ? saved : {}));
  staged = sharedItems().filter(i => !i.gm);
}

/** Another GM took over: forget what this client held. */
export function stopLines() {
  clearTimeout(publishTimer);
  clearTimeout(saveTimer);
  publishTimer = null;
  saveTimer = null;
  tokens = new Map();
  staged = null;
}

/** Keep the tokens on this client, so a reload remembers which entry belongs to which token. */
function saveTokens() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => game.settings.set(MODULE_ID, "lvTokens", Object.fromEntries(tokens)), 3000);
}

/**
 * The list to publish: the GM's entries and the players' entries, each once.
 * @returns {import("./lines-rules.mjs").LinesItem[]}
 */
function compose() {
  const mine = sharedItems().filter(i => i.gm);
  const keys = new Set(mine.map(itemKey));
  return sortItems([...mine, ...(staged ?? []).filter(i => !keys.has(itemKey(i)))]);
}

/** Write the list when it changed. */
async function publish() {
  publishTimer = null;
  if ( !staged ) return;
  const items = compose();
  if ( JSON.stringify(items) === JSON.stringify(sharedItems()) ) return;
  await game.settings.set(MODULE_ID, "lv", {items});
}

/** Publish after the wait the GM chose for new votes. */
function schedulePublish() {
  if ( publishTimer ) return;
  publishTimer = setTimeout(publish, batchDelay(setting("updateDelay")));
}

/**
 * A message of a player about their lines and veils, on the active GM's client. It comes without a name.
 * @param {object} message
 * @returns {boolean}  Whether it was one of ours (valid or not)
 */
export function receiveLines(message) {
  if ( message?.type !== "lv" ) return false;
  const clean = cleanLinesMessage(message, {freeText: freeTextAllowed()});
  if ( !clean || !staged ) return true;
  const key = itemKey(clean.item);
  if ( clean.on ) {
    tokens.set(clean.token, key);
    staged = withItem(staged, clean.item);
  }
  else {
    tokens.delete(clean.token);
    if ( ![...tokens.values()].includes(key) ) staged = withoutKey(staged, key);
  }
  saveTokens();
  schedulePublish();
  return true;
}

/**
 * Add an entry of the GM to the list. A GM who does not collect asks the active GM.
 * @param {{kind: string, topic?: string, text?: string}} value
 * @returns {Promise<boolean>}
 */
export async function addGMItem(value) {
  if ( !game.user.isGM ) return false;
  const item = cleanItem(value, {freeText: freeTextAllowed()});
  if ( !item ) return false;
  if ( !game.user.isActiveGM ) {
    const gm = game.users.activeGM;
    if ( gm ) sendToUsers({type: "action", action: "lvAdd", ...item}, [gm.id]);
    return !!gm;
  }
  const items = sharedItems();
  const next = withItem(items, {...item, gm: true});
  if ( next !== items ) await game.settings.set(MODULE_ID, "lv", {items: next});
  countFeature(MODULE_ID, "linesOwn");
  return true;
}

/**
 * Take an entry of the GM off the list.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function removeGMItem(key) {
  if ( !game.user.isGM || (typeof key !== "string") ) return false;
  if ( !game.user.isActiveGM ) {
    const gm = game.users.activeGM;
    if ( gm ) sendToUsers({type: "action", action: "lvRemove", id: key}, [gm.id]);
    return !!gm;
  }
  const items = sharedItems();
  const next = items.filter(i => !(i.gm && (itemKey(i) === key)));
  if ( next.length !== items.length ) await game.settings.set(MODULE_ID, "lv", {items: next});
  return true;
}

/* -------------------------------------------- */
/*  The player                                  */
/* -------------------------------------------- */

/**
 * @typedef OwnEntry
 * @property {string} token
 * @property {"line"|"veil"} kind
 * @property {string} [topic]
 * @property {string} [text]
 */

/** @type {{entries: Record<string, OwnEntry>}|null} */
let mine = null;

/**
 * The storage key of this user in this world. Unlike the votes it does not depend on the session.
 * @returns {string}
 */
function storageKey() {
  return `${MODULE_ID}.${game.world.id}.${game.user.id}.lines`;
}

/**
 * What this player sent, kept in this browser.
 * @returns {{entries: Record<string, OwnEntry>}}
 */
export function myLines() {
  if ( !mine ) {
    try {
      mine = JSON.parse(localStorage.getItem(storageKey()) ?? "null");
    } catch {
      mine = null;
    }
    if ( !mine || (typeof mine.entries !== "object") ) mine = {entries: {}};
  }
  return mine;
}

/** Keep the entries in this browser. */
function save() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(mine));
  } catch {
    // Private windows may refuse storage: the entries then live until the page reloads
  }
}

/**
 * The message for an entry.
 * @param {OwnEntry} entry
 * @param {boolean} on
 * @returns {object}
 */
function messageOf(entry, on) {
  return {type: "lv", token: entry.token, kind: entry.kind, ...(entry.topic ? {topic: entry.topic} : {text: entry.text}), on};
}

/**
 * Set a line or veil, or take it back when it is already set.
 * @param {{kind: string, topic?: string, text?: string}} value
 * @returns {{ok: boolean, on?: boolean, delivered?: boolean, reason?: string}}
 */
export function toggleOwn(value) {
  const item = cleanItem(value, {freeText: freeTextAllowed()});
  if ( !item ) return {ok: false, reason: "invalid"};
  const state = myLines();
  const key = itemKey(item);
  const old = state.entries[key];
  if ( old ) {
    delete state.entries[key];
    save();
    return {ok: true, on: false, delivered: sendToGM(messageOf(old, false))};
  }
  if ( Object.keys(state.entries).length >= LV_MAX_OWN ) return {ok: false, reason: "full"};
  const entry = {token: makeToken(), ...item};
  state.entries[key] = entry;
  save();
  return {ok: true, on: true, delivered: sendToGM(messageOf(entry, true))};
}

/**
 * Everything this player set, as messages, for a GM client that just started collecting.
 * @returns {object[]}
 */
export function linesMessages() {
  if ( game.user.isGM ) return [];
  return Object.values(myLines().entries).map(entry => messageOf(entry, true));
}

export const __test__ = {resetMine: () => {
  mine = null;
}, reset: () => {
  mine = null;
  tokens = new Map();
  staged = null;
  clearTimeout(publishTimer);
  clearTimeout(saveTimer);
  publishTimer = null;
  saveTimer = null;
}, tokens: () => tokens, staged: () => staged};
