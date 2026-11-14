/**
 * The spotlight view on the active GM's client: per player how long ago their character was last in the spotlight.
 * It listens to the rolls, the in-character messages and the token moves in combat of the players, and to the GM's
 * own "spotlight" mark. It keeps one time and one fading score per player and nothing else: no text, no roll, no
 * message. The book stays on this GM client (and in the copy of the window other GMs get), the players never see it.
 */

import {MODULE_ID, onlinePlayers, setting} from "./config.mjs";
import {classifyMessage, forgetUnknown, record, spotlightRows, touch} from "./spotlight-rules.mjs";
import {publicState} from "./state.mjs";

/** Whether this client collects (the active GM). */
let active = false;

/** The hooks are registered once. */
let hooked = false;

/** @type {{session: string|null, players: Record<string, object>}|null} */
let book = null;

/** Called when something changed that the window should show. */
let onChange = () => {};

/** Saves wait a moment, so a burst of rolls writes once. */
let saveLater = null;

/**
 * Is the spotlight view switched on?
 * @returns {boolean}
 */
export function spotlightEnabled() {
  return setting("spotlight") !== false;
}

/**
 * The book of this session, restored from this client's storage when it belongs to the session.
 * @returns {{session: string|null, players: Record<string, object>}}
 */
function ensureBook() {
  const session = publicState().session?.id ?? null;
  if ( book && (book.session === session) ) return book;
  const saved = game.settings.get(MODULE_ID, "spotlightBook");
  book = (saved && (saved.session === session) && saved.players && (typeof saved.players === "object"))
    ? {session, players: foundry.utils.deepClone ? foundry.utils.deepClone(saved.players) : structuredClone(saved.players)}
    : {session, players: {}};
  forgetUnknown(book.players, game.users.filter(() => true).map(u => u.id));
  return book;
}

/** Write the book to this client's storage soon. */
function persist() {
  saveLater ??= foundry.utils.debounce(() => {
    if ( book ) game.settings.set(MODULE_ID, "spotlightBook", book);
  }, 5000);
  saveLater();
}

/**
 * Start collecting. Call on the active GM's client.
 * @param {() => void} notify   Called when the view changes
 */
export function startSpotlight(notify) {
  active = true;
  onChange = notify ?? (() => {});
  ensureBook();
  if ( hooked || (typeof Hooks === "undefined") ) return;
  hooked = true;
  Hooks.on("createChatMessage", onMessage);
  Hooks.on("updateToken", onToken);
}

/** Stop collecting (another GM took over). */
export function stopSpotlight() {
  active = false;
  book = null;
}

/** A new session: everybody starts from nothing. The caller redraws, a redraw of ours would keep an idle session alive. */
export function resetSpotlight() {
  book = {session: publicState().session?.id ?? null, players: {}};
  if ( game.settings.set ) game.settings.set(MODULE_ID, "spotlightBook", book);
}

/**
 * Count a signal of a user.
 * @param {string} userId
 * @param {string} kind
 */
function count(userId, kind) {
  if ( !record(ensureBook().players, userId, kind, Date.now()) ) return;
  persist();
  onChange();
}

/**
 * Hook "createChatMessage": a roll, an in-character message or table talk of a player.
 * @param {ChatMessage} message
 */
function onMessage(message) {
  if ( !active || !spotlightEnabled() ) return;
  const author = message.author ?? game.users.get(message.user);
  if ( !author || author.isGM ) return;
  const kind = classifyMessage({
    isRoll: !!message.isRoll || (message.rolls?.length > 0),
    whispers: message.whisper?.length ?? 0,
    style: message.style ?? null,
    actor: !!message.speaker?.actor,
    gm: author.isGM
  });
  if ( kind ) count(author.id, kind);
}

/**
 * Hook "updateToken": a player moved a token in a running combat.
 * @param {TokenDocument} token
 * @param {object} changes
 * @param {object} options
 * @param {string} userId
 */
function onToken(token, changes, options, userId) {
  if ( !active || !spotlightEnabled() ) return;
  if ( !("x" in (changes ?? {})) && !("y" in (changes ?? {})) ) return;
  const user = game.users.get(userId);
  if ( !user || user.isGM ) return;
  const combat = game.combat;
  if ( !combat?.started || !combat.combatants.some(c => c.tokenId === token.id) ) return;
  count(user.id, "move");
}

/**
 * The GM marks a player as having had the spotlight just now.
 * @param {string} userId
 * @returns {boolean}  Whether the mark counted
 */
export function markSpotlight(userId) {
  const user = game.users.get(userId);
  if ( !user || user.isGM ) return false;
  count(userId, "mark");
  return true;
}

/**
 * What the GM's window shows: the rows of the players online and the quiet ones. Null while the view is off.
 * @returns {{rows: object[], quiet: string[], names: string[]}|null}
 */
export function spotlightSnapshot() {
  if ( !spotlightEnabled() ) return null;
  const now = Date.now();
  const players = ensureBook().players;
  const roster = onlinePlayers()
    .map(u => ({id: u.id, name: u.name, character: u.character?.name ?? ""}))
    .sort((a, b) => a.name.localeCompare(b.name));
  // A player seen for the first time is kept too, so a reload of the GM does not restart the quiet clock
  const fresh = roster.some(p => !players[p.id]);
  for ( const p of roster ) touch(players, p.id, now);
  if ( fresh ) persist();
  const {rows, quiet} = spotlightRows(players, roster, now, {quietMinutes: setting("spotlightMinutes")});
  return {rows, quiet, names: quiet.map(id => rows.find(r => r.id === id)?.name).filter(Boolean)};
}

export const __test__ = {onMessage, onToken, ensureBook, reset: () => {
  active = false;
  book = null;
}, activate: notify => {
  active = true;
  onChange = notify ?? (() => {});
}};
