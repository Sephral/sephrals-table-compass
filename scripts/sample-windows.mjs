// Sample windows (api.samples, contract in samples.mjs): the real windows of the module filled with made-up votes of
// the shared table (Lena, Tom, Sam and Jo), so translators and testers see every text in its place without a session
// of players first. Nothing here writes or sends: the windows read from `src` (data in memory) instead of the live
// state, buttons that would change something only say that they do nothing, no usage counter counts.
import {AXES, SIGNALS, WISHES} from "./catalog.mjs";
import {MODULE_ID, esc, t} from "./config.mjs";
import {CompassWindow} from "./gm-app.mjs";
import {FeedbackForm} from "./feedback-app.mjs";
import {LinesWindow} from "./lines-app.mjs";
import {PlayerCompass} from "./player-app.mjs";
import {ScenePoll} from "./poll-app.mjs";
import {FeedbackResults, dateLabel, describe, resultHtml} from "./results-app.mjs";
import {cleanAnswers} from "./rules.mjs";
import {
  SAMPLE_PLAYERS, sampleAnswers, sampleHistory, sampleOwnLines, samplePlayerState, sampleResults, sampleSharedLines,
  sampleSpotlight, sampleView
} from "./sample-data.mjs";
import {publicState} from "./state.mjs";
import {closeSample, markSample, openSampleHtml, sampleActions, sampleId} from "./samples.mjs";

/** Free texts of the sample table (feedback, lines and veils), in the language of the user. */
const tr = key => game.i18n.localize(`STC.Sample.text.${key}`);

/** Actions that only change what the window itself shows. */
const LOOKING = {
  gm: ["view", "wish"],
  player: ["pickTab"],
  feedback: ["star", "tempo", "topic", "edit"],
  none: []
};

/**
 * Open a real window of the module over sample data.
 * @param {Function} App                   The window class
 * @param {string} id                      Id of the sample
 * @param {object} src                     What the window reads instead of the live state
 * @param {object} [options]
 * @param {string[]} [options.allowed]     Actions of the window that stay as they are
 * @param {Record<string, Function>} [options.actions]   Actions that change the sample in memory only
 * @param {(app: ApplicationV2) => void} [options.prepare]   Set the state of the window before it renders
 * @returns {Promise<ApplicationV2>}
 */
async function openOver(App, id, src, {allowed=[], actions={}, prepare}={}) {
  const windowId = sampleId(MODULE_ID, id);
  await closeSample(windowId);
  const app = new App({id: windowId, actions: {...sampleActions(App, allowed), ...actions}});
  app.src = src;
  markSample(app);
  prepare?.(app);
  await app.render({force: true});
  return app;
}

/** Say something in the line under the tabs and draw again. */
function say(app, key) {
  app.toast = key;
  app.render();
}

/* -------------------------------------------- */
/*  The players' window                         */
/* -------------------------------------------- */

/**
 * What the players' window reads.
 * @param {object} [options]
 * @param {boolean} [options.waiting]       The player's X card waits for the GM
 * @param {boolean} [options.gm]            A GM is online
 * @param {boolean} [options.answeredRound] The player already answered the feedback round
 * @param {number} [options.players]
 * @returns {object}
 */
function playerSource({waiting=false, gm=true, answeredRound=false, players=SAMPLE_PLAYERS.length}={}) {
  const live = publicState();
  return {
    state: samplePlayerState({cleared: live.cleared, fulfilled: live.fulfilled, answeredRound}),
    pub: {soon: ["exploration"], round: {id: "sample", count: 2}},
    choices: {axes: [...AXES], signals: [...SIGNALS], wishes: [...WISHES]},
    waiting, gm, players
  };
}

/** The buttons of the players' window change the sample in memory and show the same line as the real window. */
const PLAYER_ACTIONS = {
  signal(event, target) {
    const id = target.dataset.id;
    const signals = this.src.state.signals;
    const was = !!signals[id];
    if ( was ) delete signals[id];
    else signals[id] = {token: "SampleToken0003", at: Date.now(), gen: publicState().cleared?.[id] ?? 0};
    say(this, was ? "STC.Player.withdrawn" : "STC.Player.sent");
  },
  step(event, target) {
    const id = target.dataset.axis;
    const value = Number(target.dataset.value);
    const axes = this.src.state.axes;
    const taken = axes[id]?.value === value;
    if ( taken ) delete axes[id];
    else axes[id] = {token: "SampleToken0004", value, at: Date.now()};
    say(this, taken ? "STC.Player.withdrawn" : "STC.Player.sent");
  },
  wish(event, target) {
    const id = target.dataset.id;
    const wishes = this.src.state.wishes;
    const was = !!wishes[id];
    if ( was ) delete wishes[id];
    else wishes[id] = {token: "SampleToken0005", at: Date.now(), gen: publicState().fulfilled?.[id] ?? 0};
    say(this, was ? "STC.Player.wishWithdrawn" : "STC.Player.wishSent");
  },
  xcard() {
    this.src.waiting = true;
    say(this, "STC.XCard.sent");
  }
};

/**
 * The players' window on one tab.
 * @param {string} id
 * @param {"now"|"mood"|"wish"} tab
 * @param {string} toast
 * @param {object} [source]
 */
function playerWindow(id, tab, toast, source) {
  return () => openOver(PlayerCompass, id, playerSource(source), {
    allowed: LOOKING.player, actions: PLAYER_ACTIONS,
    prepare: app => {
      app.tab = tab;
      app.toast = toast;
    }
  });
}

/* -------------------------------------------- */
/*  The GM's window                             */
/* -------------------------------------------- */

/**
 * The GM's window on one view of the middle panel.
 * @param {string} id
 * @param {object} view            Options of sampleView()
 * @param {object} [options]
 * @param {string} [options.panel]
 * @param {string} [options.wishMenu]
 */
function gmWindow(id, view, {panel="scale", wishMenu=null}={}) {
  return () => openOver(CompassWindow, id, {
    view: () => sampleView(view),
    spotlight: () => sampleSpotlight(),
    history: () => sampleHistory()
  }, {
    allowed: LOOKING.gm,
    prepare: app => {
      app.panel = panel;
      app.wishMenu = wishMenu;
    }
  });
}

/* -------------------------------------------- */
/*  Scene check, feedback round, results        */
/* -------------------------------------------- */

/**
 * The scene check on a player's screen.
 * @param {string} id
 * @param {number|null} answer   The face the player chose
 */
function pollWindow(id, answer) {
  return () => openOver(ScenePoll, id, {poll: {id: "sample", seconds: 30}, answer, left: 18}, {
    actions: {
      face(event, target) {
        const face = Number(target.dataset.face);
        this.src.answer = this.src.answer === face ? null : face;
        this.render();
      }
    }
  });
}

/**
 * The feedback form on a player's screen.
 * @param {string} id
 * @param {boolean} sent   Show the thanks of an answered round
 */
function feedbackWindow(id, sent) {
  return () => openOver(FeedbackForm, id, {round: {id: "sample", count: 3}, earlier: sent ? {answers: sampleAnswers(tr)[0]} : null}, {
    allowed: LOOKING.feedback,
    actions: {
      send() {
        this.sent = true;
        this.render();
      }
    },
    prepare: app => {
      // The first render would set these from the (missing) earlier answer: a half filled form to look at
      if ( !sent ) {
        app.round = "sample";
        app.draft = cleanAnswers(sampleAnswers(tr)[1]);
      }
    }
  });
}

/* -------------------------------------------- */
/*  Lines and Veils                             */
/* -------------------------------------------- */

/**
 * The window "Lines and veils".
 * @param {string} id
 * @param {object} options
 * @param {boolean} options.isGM
 * @param {boolean} [options.full]
 * @param {string} [options.toast]
 */
function linesWindow(id, {isGM, full=false, toast=""}) {
  return () => openOver(LinesWindow, id, {
    isGM, noGM: false, shared: sampleSharedLines(tr), own: isGM ? [] : sampleOwnLines(tr, full)
  }, {prepare: app => {
    app.toast = toast;
  }});
}

/* -------------------------------------------- */
/*  The list                                    */
/* -------------------------------------------- */

/**
 * The sample windows of this module.
 * @returns {{id: string, label: string, group: string, open: () => Promise<ApplicationV2>}[]}
 */
export function sampleWindows() {
  const group = key => t(`STC.Sample.group.${key}`);
  const entry = (id, groupKey, open) => ({id, label: t(`STC.Sample.label.${id}`), group: group(groupKey), open});
  return [
    entry("gm", "gm", gmWindow("gm", {lastPoll: "shown"})),
    entry("gmRunning", "gm", gmWindow("gmRunning", {online: 1, xcards: 1, poll: true, round: true, lastPoll: "few"})),
    entry("gmWish", "gm", gmWindow("gmWish", {lastPoll: "shown"}, {wishMenu: "exploration"})),
    entry("gmCompass", "gm", gmWindow("gmCompass", {}, {panel: "compass"})),
    entry("gmHistory", "gm", gmWindow("gmHistory", {}, {panel: "history"})),
    entry("gmSpotlight", "gm", gmWindow("gmSpotlight", {}, {panel: "spotlight"})),
    entry("playerNow", "player", playerWindow("playerNow", "now", "STC.XCard.sent", {waiting: true})),
    entry("playerNoGM", "player", playerWindow("playerNoGM", "now", "STC.Player.queued", {gm: false, answeredRound: true})),
    entry("playerMood", "player", playerWindow("playerMood", "mood", "STC.Player.sent")),
    entry("playerWishes", "player", playerWindow("playerWishes", "wish", "STC.Player.wishSent", {players: 1})),
    entry("poll", "round", pollWindow("poll", null)),
    entry("pollAnswered", "round", pollWindow("pollAnswered", 4)),
    entry("feedback", "round", feedbackWindow("feedback", false)),
    entry("feedbackSent", "round", feedbackWindow("feedbackSent", true)),
    entry("results", "round", () => openOver(FeedbackResults, "results", {results: () => sampleResults(tr)})),
    entry("resultsNone", "round", () => openOver(FeedbackResults, "resultsNone", {results: () => []})),
    entry("resultsJournal", "round", () => {
      const result = sampleResults(tr).at(-1);
      return openSampleHtml({moduleId: MODULE_ID, id: "resultsJournal", title: t("STC.Journal.page", {date: dateLabel(result.closed)}),
        body: () => resultHtml(describe(result)), width: 460});
    }),
    entry("linesPlayer", "lines", linesWindow("linesPlayer", {isGM: false, toast: "STC.Lines.sent"})),
    entry("linesFull", "lines", linesWindow("linesFull", {isGM: false, full: true, toast: "STC.Lines.fullToast"})),
    entry("linesInvalid", "lines", linesWindow("linesInvalid", {isGM: false, toast: "STC.Lines.invalid"})),
    entry("linesGM", "lines", linesWindow("linesGM", {isGM: true, toast: "STC.Lines.called"})),
    entry("newSession", "question", () => openSampleHtml({moduleId: MODULE_ID, id: "newSession", title: t("STC.GM.newSession"),
      body: () => `<p>${esc(t("STC.GM.newSessionConfirm"))}</p>`, width: 380}))
  ];
}

export const __test__ = {LOOKING};
