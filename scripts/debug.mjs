/**
 * Table Compass in the debug file of Sephral's modules: who runs the compass, the public state, the table choices and
 * how many signals, votes and answers the active GM holds right now. Only counts: no values, no tokens, no wishes or
 * ratings of a player, and the history and results of the feedback rounds stay out of the file.
 */

import {MODULE_ID, t} from "./config.mjs";
import {registerDebugMenu, registerDebugProvider} from "./debug-file.mjs";
import {choices, publicState} from "./state.mjs";
import * as tracker from "./tracker.mjs";

/**
 * Run a reader that may fail before "ready" and keep the error instead.
 * @param {Function} fn
 * @returns {*}
 */
function attempt(fn) {
  try {
    return fn();
  } catch(err) {
    return {error: String(err?.message ?? err)};
  }
}

/**
 * The state of the compass, counts only.
 * @returns {object}
 */
export function describeState() {
  const state = publicState();
  const live = attempt(() => tracker.debugState());
  const picked = choices();
  return {
    activeGM: game.users?.activeGM?.id ?? null,
    thisClientIsActiveGM: !!game.user?.isActiveGM,
    session: state.session ? {id: state.session.id, started: state.session.started, active: state.session.active} : null,
    poll: state.poll ? {id: state.poll.id, seconds: state.poll.seconds} : null,
    round: state.round ? {id: state.round.id, count: state.round.count} : null,
    xAck: state.xAck,
    announcedWishes: state.soon.length,
    choices: {axes: picked.axes.length, signals: picked.signals.length, wishes: picked.wishes.length},
    live: live?.error ? live : {
      axes: live.axes.length,
      signals: live.signals.length,
      wishes: live.wishes.length,
      xcards: live.xcards,
      pollVotes: live.poll?.votes ?? null,
      roundAnswers: live.round?.answers ?? null
    },
    storedResults: attempt(() => tracker.results().length),
    historyPoints: attempt(() => tracker.history().points.length)
  };
}

/**
 * Register the menu button and the part of the debug file. Call in "init". t() follows a fixed module language.
 */
export function registerDebug() {
  registerDebugMenu(MODULE_ID, {name: "STC.DEBUG.Title", label: "STC.DEBUG.Save", hint: "STC.DEBUG.Hint"});
  registerDebugProvider({
    moduleId: MODULE_ID,
    label: () => t("STC.DEBUG.Entry"),
    notice: file => t("STC.DEBUG.Saved", {file}),
    recent: () => ({details: describeState()}),
    // What the players said, even summed up, stays with the GM
    omitSettings: ["history", "results"]
  });
}
