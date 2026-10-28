import {MODULE_ID, isShown, t} from "./config.mjs";
import {openChoices} from "./choices-app.mjs";
import {registerDebug} from "./debug.mjs";
import {saveDebugFile} from "./debug-file.mjs";
import {openFeedback, syncFeedback} from "./feedback-app.mjs";
import {openCompass, refreshCompass, showOrb} from "./gm-app.mjs";
import {applyModuleLanguage} from "./language.mjs";
import {registerSocket} from "./net.mjs";
import {myState, onMineChange, resendAll} from "./player.mjs";
import {openPlayerCompass, refreshPlayerCompass} from "./player-app.mjs";
import {syncPoll} from "./poll-app.mjs";
import {openResults} from "./results-app.mjs";
import {noticeNewVersions, runSelfTest} from "./selftest.mjs";
import {changeLanguage, registerSettings} from "./settings.mjs";
import {choices, publicState} from "./state.mjs";
import * as tracker from "./tracker.mjs";
import {registerUsage} from "./usage.mjs";

/** The tool in the token controls. */
const TOOL = "stc-compass";

/** The last X card acknowledgement this client announced. */
let lastXAck = 0;

Hooks.once("init", () => {
  registerSettings({
    language: value => changeLanguage(value, redraw),
    redraw,
    flush: () => {
      if ( game.user.isActiveGM ) tracker.refresh();
      redraw();
    },
    publicChanged: onPublicChanged,
    choicesChanged: () => {
      if ( game.user.isActiveGM ) tracker.refresh();
      refreshPlayerCompass();
    }
  });
  registerDebug();
  // Only what the GM starts or opens counts, never the X card, signals, votes, wishes or ratings of the players
  registerUsage(MODULE_ID, {
    features: ["sceneCheck", "feedbackRound", "newSession", "tableChoices", "pastResults", "compassPanel",
      "historyPanel"],
    settings: ["gmView", "theme", "updateDelay"]
  });
  game.keybindings.register(MODULE_ID, "open", {
    name: "STC.Keybinding.open",
    hint: "STC.Keybinding.openHint",
    editable: [],
    onDown: () => {
      open();
      return true;
    }
  });
  Hooks.on("getSceneControlButtons", onGetSceneControlButtons);
  game.modules.get(MODULE_ID).api = {
    /** Open the window of this user: the GM's view for a GM, the players' window for a player. */
    open,
    /** Start a scene check (active GM). */
    startPoll: tracker.startPoll,
    /** Start and close the feedback round (active GM). */
    startRound: tracker.startRound,
    closeRound: tracker.closeRound,
    /** Start a new session (active GM). */
    newSession: tracker.newSession,
    /** What the GM's window shows: summaries only, no names. */
    view: tracker.view,
    /** The results of the feedback rounds kept on this GM client, and the window for them. */
    results: tracker.results,
    openResults,
    /** The history of the session on this GM client. */
    history: tracker.history,
    /** The scales, signals and wishes of the table, and the window to choose them (GM). */
    choices,
    openChoices,
    /** What everyone may know. */
    publicState,
    /** What this player said (kept in this browser). */
    myState,
    /** Open the form of a running feedback round again (player). */
    openFeedback,
    /** What the active GM holds, without tokens, for tests. */
    debugState: tracker.debugState,
    /** Check the module (GM). */
    runSelfTest,
    /** Save the debug file of Sephral's modules (GM): about one chat message, or without an id the latest picture. */
    saveDebugFile: messageId => saveDebugFile(messageId ?? null, {moduleId: MODULE_ID})
  };
});

/** Applying a fixed module language loads its file; the rest of "ready" waits for it. */
let languageReady = Promise.resolve();

Hooks.once("i18nInit", () => {
  languageReady = applyModuleLanguage(game.settings.get(MODULE_ID, "uiLanguage"));
});

Hooks.once("ready", async () => {
  await languageReady;
  registerSocket({fromPlayer: tracker.receive, fromGM: onGMMessage});
  tracker.onViewChange(refreshCompass);
  onMineChange(refreshPlayerCompass);
  lastXAck = publicState().xAck ?? 0;
  Hooks.on("userConnected", onUserConnected);
  if ( game.user.isGM ) {
    if ( game.user.isActiveGM ) await tracker.startTracking();
    else game.socket.emit(`module.${MODULE_ID}`, {type: "snapshot-request"}, {recipients: [game.users.activeGM?.id].filter(Boolean)});
    const mode = game.settings.get(MODULE_ID, "gmView");
    if ( mode === "window" ) openCompass();
    else if ( mode === "orb" ) showOrb();
  }
  else {
    if ( game.users.activeGM ) resendAll();
    syncPoll();
    syncFeedback();
  }
  noticeNewVersions();
});

/**
 * Open the window of this user.
 * @returns {Promise<ApplicationV2>}
 */
function open() {
  return game.user.isGM ? openCompass() : openPlayerCompass();
}

/** Redraw every window of the module. */
function redraw() {
  refreshCompass();
  refreshPlayerCompass();
  for ( const id of ["stc-poll", "stc-feedback", "stc-results"] ) {
    const app = foundry.applications.instances.get(id);
    if ( isShown(app) ) app.render();
  }
}

/**
 * The public state changed: redraw, open or close the scene check and the feedback round, and tell the players
 * when the GM acknowledged an X card.
 * @param {object} value
 */
function onPublicChanged(value) {
  refreshCompass();
  refreshPlayerCompass();
  syncPoll();
  syncFeedback();
  const ack = value?.xAck ?? 0;
  if ( ack > lastXAck ) {
    if ( !game.user.isGM ) ui.notifications.info(t("STC.XCard.acknowledged"));
    lastXAck = ack;
  }
}

/**
 * A message of a GM.
 * @param {object} message
 */
function onGMMessage(message) {
  if ( message.type === "resync" ) {
    if ( !game.user.isGM ) resendAll();
  }
  else if ( message.type === "snapshot-request" ) {
    if ( game.user.isActiveGM ) tracker.refresh();
  }
  else if ( message.type === "action" ) tracker.runAction(message);
  else tracker.receiveFromGM(message);
}

/**
 * Hook "userConnected": the players' window says whether a GM is there, a new active GM takes over, a GM who is no
 * longer the active one stops collecting, and the GM's count of players stays right.
 */
function onUserConnected() {
  refreshPlayerCompass();
  if ( !game.user.isGM ) return;
  if ( !game.user.isActiveGM ) return tracker.stopTracking();
  tracker.startTracking();
  tracker.refresh();
}

/**
 * Hook "getSceneControlButtons": the compass in the token controls, for everyone.
 * @param {Record<string, object>|object[]} controls
 */
function onGetSceneControlButtons(controls) {
  const tokens = controls?.tokens ?? (Array.isArray(controls) ? controls.find(c => c.name === "token") : null);
  if ( !tokens ) return;
  const tool = {name: TOOL, title: "STC.Title", icon: "fa-solid fa-compass", button: true, visible: true,
    onChange: () => open()};
  if ( Array.isArray(tokens.tools) ) tokens.tools.push({...tool, onClick: tool.onChange});
  else {
    tool.order = Object.keys(tokens.tools ?? {}).length;
    tokens.tools[TOOL] = tool;
  }
}

