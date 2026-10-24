/**
 * Self-test: the socket, an active GM, the storage, the texts of every scale, signal and wish, and a vote that goes
 * through the same checks as a player's.
 */

import {AXES, SIGNALS, TOPICS, WISHES} from "./catalog.mjs";
import {MODULE_ID, TESTED_VERSIONS, esc, onlinePlayers, t} from "./config.mjs";
import {cleanMessage, makeToken, summarizeAxis} from "./rules.mjs";

/**
 * Run all checks.
 * @returns {{problems: string[], checks: number}}
 */
function checkAll() {
  const problems = [];
  let checks = 0;
  const check = (ok, key, data) => {
    checks++;
    if ( !ok ) problems.push(game.i18n.has(key) ? t(key, data) : key);
  };
  check(typeof game.socket?.emit === "function", "STC.SELFTEST.Socket");
  check(!!game.users.activeGM, "STC.SELFTEST.NoGM");
  check(game.settings.settings.has(`${MODULE_ID}.public`), "STC.SELFTEST.Storage");
  const keys = [
    ...AXES.flatMap(id => ["name", "low", "high", "more"].map(k => `STC.Axis.${id}.${k}`)),
    ...SIGNALS.map(id => `STC.Signal.${id}.name`),
    ...WISHES.map(id => `STC.Wish.${id}`),
    ...TOPICS.map(id => `STC.Topic.${id}`)
  ];
  const missing = keys.filter(key => !game.i18n.has(key));
  check(!missing.length, "STC.SELFTEST.Texts", {keys: missing.slice(0, 5).join(", ")});
  const vote = cleanMessage({type: "axis", token: makeToken(), id: AXES[0], value: -1});
  check(!!vote && summarizeAxis([vote.value, 1], 2).shown, "STC.SELFTEST.Vote");
  check(onlinePlayers().length !== 1, "STC.SELFTEST.Single");
  return {problems, checks};
}

/**
 * Run the self-test and report the result.
 * @param {object} [options]
 * @param {boolean} [options.report=true]
 * @returns {Promise<{problems: string[], checks: number}>}
 */
export async function runSelfTest({report=true}={}) {
  const {problems, checks} = checkAll();
  const summary = problems.length ? t("STC.SELFTEST.Problems", {problems: problems.length, checks})
    : t("STC.SELFTEST.Passed", {checks});
  if ( problems.length ) ui.notifications.warn(summary, {permanent: true});
  else ui.notifications.info(summary);
  if ( report ) {
    let content = `<h3>${esc(t("STC.SELFTEST.Title"))}</h3><p>${esc(summary)}</p>`;
    if ( problems.length ) content += `<ul>${problems.map(p => `<li>${esc(p)}</li>`).join("")}</ul>`;
    await ChatMessage.implementation.create({content, whisper: [game.user.id], speaker: {alias: game.modules.get(MODULE_ID).title}});
  }
  return {problems, checks};
}

/**
 * Tell the GM once when Foundry is newer than the version the module was verified against.
 */
export function noticeNewVersions() {
  if ( !game.user.isGM ) return;
  if ( !foundry.utils.isNewerVersion(game.version, TESTED_VERSIONS.core) ) return;
  const signature = `core ${game.version}`;
  if ( game.settings.get(MODULE_ID, "acknowledgedVersions") === signature ) return;
  game.settings.set(MODULE_ID, "acknowledgedVersions", signature);
  ui.notifications.info(t("STC.SELFTEST.NewVersions", {versions: signature}), {permanent: true});
}
