/**
 * Constants and small helpers shared by the scripts of the module. The module runs on Foundry 13 and 14, so it uses
 * game.i18n instead of the v14 global _loc.
 */

/** The id of this module. */
export const MODULE_ID = "sephrals-table-compass";

/** The socket event of this module (the manifest sets "socket": true). */
export const SOCKET = `module.${MODULE_ID}`;

/** The folder of the module's templates. */
export const TEMPLATES = `modules/${MODULE_ID}/templates`;

/** Seconds a scene check runs. */
export const POLL_SECONDS = 30;

/** The Foundry versions the module was verified against (see the self-test). */
export const TESTED_VERSIONS = {core: "14.369"};

/**
 * Read a setting of this module.
 * @param {string} key
 * @returns {*}
 */
export function setting(key) {
  return game.settings.get(MODULE_ID, key);
}

/**
 * Localize a key, with optional data.
 * @param {string} key
 * @param {object} [data]
 * @returns {string}
 */
export function t(key, data) {
  return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}

/**
 * The language the module speaks for this user: the module language when one is set, Foundry's otherwise.
 * @returns {string}
 */
export function locale() {
  const choice = game.settings.get(MODULE_ID, "uiLanguage");
  return ["en", "de"].includes(choice) ? choice : game.i18n.lang;
}

/**
 * A number with one decimal as the module's language writes it ("4.5" or "4,5").
 * @param {number} value
 * @returns {string}
 */
export function decimal(value) {
  return Number(value).toLocaleString(locale(), {minimumFractionDigits: 1, maximumFractionDigits: 1});
}

/**
 * Escape a value for HTML.
 * @param {*} value
 * @returns {string}
 */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;",
    "'": "&#39;"})[ch]);
}

/**
 * Is a window open or on its way? While an application renders, its "rendered" flag is false, and a redraw asked
 * for in that moment would be lost.
 * @param {ApplicationV2|undefined} app
 * @returns {boolean}
 */
export function isShown(app) {
  const states = foundry.applications.api.ApplicationV2.RENDER_STATES;
  return !!app && ((app.state === states.RENDERED) || (app.state === states.RENDERING));
}

/**
 * The players who can give feedback right now: connected users without GM rights.
 * @returns {User[]}
 */
export function onlinePlayers() {
  return game.users.filter(u => u.active && !u.isGM && (u.role >= CONST.USER_ROLES.PLAYER));
}

/**
 * Open Foundry's settings on the tab of this module.
 */
export async function openSettings() {
  const sheet = game.settings.sheet;
  await sheet.render({force: true});
  try {
    sheet.changeTab(MODULE_ID, "categories");
  } catch(err) {
    console.warn(`${MODULE_ID} | The settings have no tab for this module`, err);
  }
  sheet.bringToFront?.();
}

/**
 * Put a gear into the title bar of a window that opens the settings of this module. Players only get it when the
 * module has settings for them.
 * @param {HTMLElement} frame   The window frame
 */
export function addSettingsGear(frame) {
  const header = frame?.querySelector(".window-header");
  if ( !header || header.querySelector(".stc-settings") ) return;
  const own = s => (s.namespace === MODULE_ID) && s.config && (s.scope !== "world");
  if ( !game.user.isGM && !Array.from(game.settings.settings.values()).some(own) ) return;
  const gear = document.createElement("button");
  gear.type = "button";
  gear.className = "header-control icon fa-solid fa-gear stc-settings";
  gear.dataset.tooltip = t("STC.gear");
  gear.setAttribute("aria-label", t("STC.gear"));
  gear.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openSettings();
  });
  const anchor = header.querySelector("[data-action=toggleControls]") ?? header.querySelector("[data-action=close]");
  if ( anchor ) anchor.before(gear);
  else header.append(gear);
}
