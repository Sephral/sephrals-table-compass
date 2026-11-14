/**
 * Rules of "Lines and veils", without Foundry: what a player may send, how entries are checked and kept, and how
 * the shared list is put together. Kept pure so Node can test them.
 *
 * A line is something that never happens in this game. A veil is something that may happen, but off screen: the
 * story moves on and nothing is shown or described.
 */

import {LV_TOPICS} from "./catalog.mjs";

/** The two kinds of entries. */
export const LV_KINDS = ["line", "veil"];

/** Longest free text of an entry. */
export const LV_TEXT_LIMIT = 80;

/** Most entries on the shared list. */
export const LV_MAX_ITEMS = 60;

/** Most entries one player can have. */
export const LV_MAX_OWN = 12;

/** A vote token, like the ones of the other votes. */
const TOKEN = /^[A-Za-z0-9]{8,32}$/;

/**
 * @typedef LinesItem
 * @property {"line"|"veil"} kind
 * @property {string} [topic]   Id from the catalog
 * @property {string} [text]    Free text
 * @property {boolean} [gm]     Added by the GM
 */

/**
 * Bring a free text into shape: one line, no markup, not too long.
 * @param {*} value
 * @returns {string}
 */
export function cleanText(value) {
  if ( typeof value !== "string" ) return "";
  return value.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, LV_TEXT_LIMIT).trim();
}

/**
 * The key of an entry: the same topic or text of the same kind is one entry.
 * @param {{kind: string, topic?: string, text?: string}} item
 * @returns {string}
 */
export function itemKey({kind, topic, text}) {
  return topic ? `${kind}:t:${topic}` : `${kind}:x:${String(text ?? "").toLocaleLowerCase()}`;
}

/**
 * Check what an entry says (a topic of the catalog or a free text) and bring it into shape.
 * @param {{kind?: string, topic?: string, text?: string}} value
 * @param {{topics?: string[], freeText?: boolean}} [allowed]
 * @returns {LinesItem|null}
 */
export function cleanItem(value, {topics=LV_TOPICS, freeText=true}={}) {
  if ( !value || (typeof value !== "object") || !LV_KINDS.includes(value.kind) ) return null;
  if ( value.topic !== undefined ) return topics.includes(value.topic) ? {kind: value.kind, topic: value.topic} : null;
  if ( !freeText ) return null;
  const text = cleanText(value.text);
  return text ? {kind: value.kind, text} : null;
}

/**
 * Check a message of a player about their lines and veils.
 * @param {object} message
 * @param {{topics?: string[], freeText?: boolean}} [allowed]
 * @returns {{type: "lv", token: string, on: boolean, item: LinesItem}|null}
 */
export function cleanLinesMessage(message, allowed) {
  if ( !message || (message.type !== "lv") ) return null;
  const token = String(message.token ?? "");
  if ( !TOKEN.test(token) ) return null;
  const item = cleanItem(message, allowed);
  return item ? {type: "lv", token, on: message.on === true, item} : null;
}

/**
 * The list in its shared order: lines before veils, topics in catalog order, then texts alphabetically.
 * The order tells nothing about who wrote what or when.
 * @param {LinesItem[]} items
 * @returns {LinesItem[]}
 */
export function sortItems(items) {
  const rank = item => (item.topic ? LV_TOPICS.indexOf(item.topic) : LV_TOPICS.length);
  return [...items].sort((a, b) => (LV_KINDS.indexOf(a.kind) - LV_KINDS.indexOf(b.kind)) || (rank(a) - rank(b))
    || String(a.text ?? "").localeCompare(String(b.text ?? "")));
}

/**
 * The stored list, checked: only known entries, without duplicates.
 * @param {*} value
 * @returns {LinesItem[]}
 */
export function itemsFromStore(value) {
  const seen = new Set();
  const items = [];
  for ( const raw of Array.isArray(value?.items) ? value.items : [] ) {
    const item = cleanItem(raw);
    if ( !item || seen.has(itemKey(item)) ) continue;
    seen.add(itemKey(item));
    items.push(raw.gm === true ? {...item, gm: true} : item);
  }
  return sortItems(items).slice(0, LV_MAX_ITEMS);
}

/**
 * Put an entry on a list, unless it is there or the list is full.
 * @param {LinesItem[]} items
 * @param {LinesItem} item
 * @returns {LinesItem[]}
 */
export function withItem(items, item) {
  const key = itemKey(item);
  if ( items.some(i => itemKey(i) === key) || (items.length >= LV_MAX_ITEMS) ) return items;
  return sortItems([...items, item]);
}

/**
 * Take an entry off a list.
 * @param {LinesItem[]} items
 * @param {string} key
 * @returns {LinesItem[]}
 */
export function withoutKey(items, key) {
  return items.filter(i => itemKey(i) !== key);
}
