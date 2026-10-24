/**
 * What everyone may know, kept in a world setting the GM writes: the session, which wishes the GM announced or
 * fulfilled, which signals the GM ticked off, the last acknowledged X card and a running scene check or feedback
 * round. Votes never go in here. Also the scales, signals and wishes the GM chose for the table.
 */

import {AXES, DEFAULT_AXES, DEFAULT_WISHES, SIGNALS, WISHES, knownIds} from "./catalog.mjs";
import {MODULE_ID, setting} from "./config.mjs";

/**
 * @typedef PublicState
 * @property {{id: string, started: number, active: number}|null} session
 * @property {string[]} soon                     Wishes the GM announced ("coming soon")
 * @property {Record<string, number>} fulfilled  Wish id -> how often the GM marked it fulfilled
 * @property {Record<string, number>} cleared    Signal id -> how often the GM ticked it off
 * @property {number} xAck                       How often the GM acknowledged an X card
 * @property {{id: string, seconds: number}|null} poll
 * @property {{id: string, count: number}|null} round
 *
 * Counters instead of timestamps: the clocks of the players' computers may differ from the GM's, a count does not.
 */

/** @type {PublicState} */
const DEFAULTS = {session: null, soon: [], fulfilled: {}, cleared: {}, xAck: 0, poll: null, round: null};

/** Writes in order, so two quick changes do not overwrite each other. */
let writing = Promise.resolve();

/**
 * The public state.
 * @returns {PublicState}
 */
export function publicState() {
  const value = setting("public");
  return {...DEFAULTS, ...((value && (typeof value === "object")) ? value : {})};
}

/**
 * Change the public state (GM).
 * @param {Partial<PublicState>|((state: PublicState) => Partial<PublicState>)} changes
 * @returns {Promise<void>}
 */
export function updatePublic(changes) {
  if ( !game.user.isGM ) return Promise.resolve();
  writing = writing.then(async () => {
    const current = publicState();
    const delta = (typeof changes === "function") ? changes(current) : changes;
    await game.settings.set(MODULE_ID, "public", {...current, ...delta});
  }).catch(err => console.error(`${MODULE_ID} | Could not save the public state`, err));
  return writing;
}

/**
 * The scales, signals and wishes the GM chose for the table, in catalog order.
 * @returns {{axes: string[], signals: string[], wishes: string[]}}
 */
export function choices() {
  const value = setting("choices") ?? {};
  return {
    axes: knownIds(value.axes, AXES, DEFAULT_AXES),
    signals: knownIds(value.signals, SIGNALS, SIGNALS),
    wishes: knownIds(value.wishes, WISHES, DEFAULT_WISHES)
  };
}
