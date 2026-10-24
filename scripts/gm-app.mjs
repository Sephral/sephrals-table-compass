/**
 * The GM's window: small on purpose. Signals and the X card on top, the scales as balances (or the compass rose, or
 * the history), the wishes in one line and the scene check and feedback round at the bottom. Collapsed it becomes an
 * orb that glows green, amber or red.
 */

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

import {ICONS} from "./catalog.mjs";
import {MODULE_ID, TEMPLATES, addSettingsGear, decimal, isShown, locale, setting, t} from "./config.mjs";
import {compassCorners, sparkline} from "./rules.mjs";
import {publicState} from "./state.mjs";
import {
  acknowledgeXCard, clearSignal, closeRound, fulfillWish, history, newSession, startPoll, startRound, toggleSoon, view
} from "./tracker.mjs";
import {countFeature, markUsed} from "./usage.mjs";

/** Usage counters of the middle panel views; the scales are the default view and count nothing. */
const PANEL_FEATURES = {compass: "compassPanel", history: "historyPanel"};

/** Colors of the history lines, in the order of the scales. */
const LINE_COLORS = ["#b5512d", "#8c3e47", "#2d7753", "#9a5b13", "#4a6a8a", "#6b4f8a", "#3d7a7a", "#a0602a", "#5a5a5a"];

/** How many wishes the window lists before "+n". */
const WISHES_SHOWN = 3;

/** How long the result of a scene check stays in the window. */
const POLL_RESULT_MS = 10 * 60 * 1000;

export class CompassWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options={}) {
    const left = Math.max(window.innerWidth - 680, 120);
    super(foundry.utils.mergeObject({position: {left, top: 70}}, options));
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "stc-gm",
    classes: ["stc", "stc-gm"],
    window: {title: "STC.Title", icon: "fa-solid fa-compass", resizable: false, minimizable: false, controls: [
      {action: "newSession", icon: "fa-solid fa-rotate", label: "STC.GM.newSession"},
      {action: "lastResults", icon: "fa-solid fa-square-poll-vertical", label: "STC.GM.lastResults"},
      {action: "openSettings", icon: "fa-solid fa-sliders", label: "STC.GM.settings"}
    ]},
    position: {width: 320, height: "auto"},
    actions: {
      view: CompassWindow.#onView,
      ackX: CompassWindow.#onAckX,
      clearSignal: CompassWindow.#onClearSignal,
      wish: CompassWindow.#onWish,
      wishSoon: CompassWindow.#onWishSoon,
      wishDone: CompassWindow.#onWishDone,
      startPoll: CompassWindow.#onStartPoll,
      startRound: CompassWindow.#onStartRound,
      closeRound: CompassWindow.#onCloseRound,
      collapse: CompassWindow.#onCollapse,
      newSession: CompassWindow.#onNewSession,
      lastResults: CompassWindow.#onLastResults,
      openSettings: CompassWindow.#onOpenSettings
    }
  };

  /** @override */
  static PARTS = {
    body: {template: `${TEMPLATES}/gm.hbs`}
  };

  /** The view of the middle panel: "scale", "compass" or "history". */
  panel = "scale";

  /** The wish whose actions are open. */
  wishMenu = null;

  /** Ticks while a scene check runs. */
  #ticker = null;

  /** @override */
  get title() {
    return t("STC.Title");
  }

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    addSettingsGear(frame);
    const close = frame.querySelector(".window-header [data-action='close']");
    if ( close ) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "header-control icon fa-solid fa-minus";
      button.dataset.action = "collapse";
      button.dataset.tooltip = t("STC.GM.collapse");
      button.setAttribute("aria-label", t("STC.GM.collapse"));
      close.before(button);
    }
    return frame;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const data = view();
    const time = Date.now();
    context.theme = setting("theme");
    context.online = data.online;
    context.single = data.online === 1;
    context.nobody = data.online === 0;
    context.xcards = data.xcards;
    context.icons = ICONS;
    context.signals = data.signals.map(s => ({...s, label: t(`STC.Signal.${s.id}.name`), icon: ICONS[s.id],
      title: t("STC.GM.signalTitle", {signal: t(`STC.Signal.${s.id}.name`), count: s.count})}));
    context.panels = ["scale", "compass", "history"].map(id => ({id, icon: ICONS[id], label: t(`STC.GM.view.${id}`),
      active: this.panel === id}));
    context.panel = {scale: this.panel === "scale", compass: this.panel === "compass", history: this.panel === "history"};
    context.axes = data.axes.map(a => this.#axisContext(a));
    context.empty = !data.axes.some(a => a.count);
    if ( this.panel === "compass" ) context.compass = this.#compassContext(data.axes);
    if ( this.panel === "history" ) context.history = this.#historyContext(data.axes);
    context.wishes = data.wishes.slice(0, WISHES_SHOWN).map(w => ({...w, label: t(`STC.Wish.${w.id}`),
      open: this.wishMenu === w.id, title: t(w.soon ? "STC.GM.wishSoonTitle" : "STC.GM.wishTitle", {wish: t(`STC.Wish.${w.id}`), count: w.count})}));
    context.moreWishes = Math.max(data.wishes.length - WISHES_SHOWN, 0);
    context.moreWishesTitle = data.wishes.slice(WISHES_SHOWN).map(w => `${t(`STC.Wish.${w.id}`)} ${w.count}`).join(", ");
    const menu = data.wishes.find(w => w.id === this.wishMenu);
    context.wishMenu = menu ? {id: menu.id, label: t(`STC.Wish.${menu.id}`), soon: menu.soon} : null;
    context.poll = data.poll ? {count: data.poll.count, seconds: Math.max(Math.ceil((data.poll.endsAt - time) / 1000), 0)} : null;
    const last = data.lastPoll && ((time - data.lastPoll.at) < POLL_RESULT_MS) ? data.lastPoll : null;
    context.lastPoll = last ? {shown: last.shown, count: last.count,
      text: last.shown ? t("STC.GM.pollResult", {avg: decimal(last.avg), count: last.count}) : t("STC.GM.pollFew", {count: last.count})} : null;
    context.round = data.round;
    context.isActiveGM = game.user.isActiveGM;
    this.#tick(!!data.poll);
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.stcTheme = setting("theme");
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this.#tick(false);
  }

  /**
   * Keep the countdown of a scene check moving.
   * @param {boolean} on
   */
  #tick(on) {
    if ( on && !this.#ticker ) this.#ticker = setInterval(() => this.render(), 1000);
    else if ( !on && this.#ticker ) {
      clearInterval(this.#ticker);
      this.#ticker = null;
    }
  }

  /**
   * The balance of one scale.
   * @param {object} axis
   * @returns {object}
   */
  #axisContext(axis) {
    const pct = v => ((v + 2) / 4) * 100;
    const low = t(`STC.Axis.${axis.id}.low`);
    const high = t(`STC.Axis.${axis.id}.high`);
    const dots = [];
    if ( axis.shown ) {
      axis.steps.forEach((count, i) => {
        for ( let k = 0; k < count; k++ ) dots.push({left: pct(i - 2), shift: k * 3, top: k % 2 ? 1 : 4});
      });
    }
    const status = axis.status === "low" ? low : axis.status === "high" ? high : t(`STC.GM.status.${axis.status}`);
    return {
      id: axis.id, label: t(`STC.Axis.${axis.id}.name`), shown: axis.shown, status, dots,
      tone: axis.status === "split" ? "split" : axis.status === "few" ? "few" : ["fine", "off", "far"][axis.strength],
      marker: pct(axis.avg),
      title: axis.shown
        ? t("STC.GM.axisTitle", {axis: t(`STC.Axis.${axis.id}.name`), count: axis.count, low, high})
        : t("STC.GM.axisFew", {axis: t(`STC.Axis.${axis.id}.name`), min: setting("minVotes")})
    };
  }

  /**
   * The compass rose: where the table wants more.
   * @param {object[]} axes
   * @returns {object}
   */
  #compassContext(axes) {
    const geometry = {cx: 141, cy: 63, ring: 25, outer: 46};
    const wants = axes.map(a => (a.shown ? -a.avg : 0));
    const corners = compassCorners(wants, geometry);
    const ends = compassCorners(axes.map(() => 2), geometry);
    return {
      ...geometry,
      polygon: corners.map(c => `${c.x},${c.y}`).join(" "),
      spokes: axes.map((a, i) => {
        const angle = ends[i].angle;
        const cos = Math.cos(angle);
        return {
          x2: ends[i].x, y2: ends[i].y,
          lx: Math.round((geometry.cx + (cos * 54)) * 10) / 10,
          ly: Math.round((geometry.cy + (Math.sin(angle) * 54) + 3) * 10) / 10,
          anchor: Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end",
          label: t(`STC.Axis.${a.id}.more`), shown: a.shown
        };
      })
    };
  }

  /**
   * The history of the session.
   * @param {object[]} axes
   * @returns {object}
   */
  #historyContext(axes) {
    const h = history();
    const time = Date.now();
    const from = h.points[0]?.t ?? (publicState().session?.started ?? time - 3600 * 1000);
    const box = {from, to: time, width: 282, height: 110};
    const lines = axes.map((a, i) => ({id: a.id, label: t(`STC.Axis.${a.id}.name`), color: LINE_COLORS[i % LINE_COLORS.length],
      points: sparkline(h.points.map(p => ({t: p.t, v: p.axes?.[a.id] ?? null})), box)})).filter(l => l.points);
    const span = Math.max(time - from, 1);
    const marks = h.marks.filter(m => m.t >= from).map(m => ({x: Math.round(((m.t - from) / span) * 282 * 10) / 10,
      kind: m.kind, title: t(`STC.GM.mark.${m.kind}`)}));
    const clock = ms => new Date(ms).toLocaleTimeString(locale(), {hour: "2-digit", minute: "2-digit"});
    return {lines, marks, from: clock(from), empty: !lines.length};
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static #onView(event, target) {
    const feature = PANEL_FEATURES[target.dataset.view];
    if ( feature && (target.dataset.view !== this.panel) ) countFeature(MODULE_ID, feature);
    this.panel = target.dataset.view;
    this.render();
  }

  static async #onAckX() {
    await acknowledgeXCard();
  }

  static async #onClearSignal(event, target) {
    await clearSignal(target.dataset.id);
  }

  static #onWish(event, target) {
    this.wishMenu = (this.wishMenu === target.dataset.id) ? null : target.dataset.id;
    this.render();
  }

  static async #onWishSoon(event, target) {
    await toggleSoon(target.dataset.id);
    this.wishMenu = null;
    this.render();
  }

  static async #onWishDone(event, target) {
    await fulfillWish(target.dataset.id);
    this.wishMenu = null;
    this.render();
  }

  static async #onStartPoll() {
    await startPoll();
  }

  static async #onStartRound() {
    await startRound();
  }

  static async #onCloseRound() {
    const result = await closeRound();
    if ( result ) {
      const {openResults} = await import("./results-app.mjs");
      openResults(result);
    }
  }

  static async #onCollapse() {
    await game.settings.set(MODULE_ID, "gmView", "orb");
    await this.close();
    showOrb();
  }

  static async #onNewSession() {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: {title: t("STC.GM.newSession")},
      content: `<p>${t("STC.GM.newSessionConfirm")}</p>`
    });
    if ( ok ) await newSession();
  }

  static async #onLastResults() {
    const {openResults} = await import("./results-app.mjs");
    countFeature(MODULE_ID, "pastResults");
    openResults();
  }

  static async #onOpenSettings() {
    const {openChoices} = await import("./choices-app.mjs");
    openChoices();
  }
}

/* -------------------------------------------- */
/*  Opening and the orb                         */
/* -------------------------------------------- */

/**
 * Open the GM's window.
 * @returns {Promise<CompassWindow>}
 */
export async function openCompass() {
  hideOrb();
  if ( game.settings.get(MODULE_ID, "gmView") !== "window" ) await game.settings.set(MODULE_ID, "gmView", "window");
  const app = foundry.applications.instances.get(CompassWindow.DEFAULT_OPTIONS.id) ?? new CompassWindow();
  await app.render({force: true});
  app.bringToFront?.();
  markUsed(MODULE_ID);
  return app;
}

/** Redraw the GM's window and the orb. */
export function refreshCompass() {
  const app = foundry.applications.instances.get(CompassWindow.DEFAULT_OPTIONS.id);
  if ( isShown(app) ) app.render();
  updateOrb();
}

/**
 * The orb's mood: red for an X card, amber for signals, wishes or scales far off, green otherwise.
 * @param {object} data
 * @returns {{mood: string, count: number}}
 */
export function orbMood(data) {
  if ( data.xcards ) return {mood: "alarm", count: data.xcards};
  const signals = data.signals.reduce((sum, s) => sum + s.count, 0);
  const far = data.axes.filter(a => a.shown && ((a.strength === 2) || (a.status === "split"))).length;
  const count = signals + far;
  return {mood: count ? "notice" : "calm", count};
}

/** Show the orb in place of the window. */
export function showOrb() {
  if ( !game.user.isGM ) return;
  let orb = document.getElementById("stc-orb");
  if ( !orb ) {
    orb = document.createElement("button");
    orb.id = "stc-orb";
    orb.type = "button";
    orb.setAttribute("aria-label", t("STC.GM.open"));
    orb.dataset.tooltip = t("STC.GM.open");
    orb.innerHTML = '<span class="stc-orb-count"></span>';
    const position = game.settings.get(MODULE_ID, "orbPosition");
    if ( position?.left !== undefined ) {
      orb.style.left = `${position.left}px`;
      orb.style.top = `${position.top}px`;
    }
    makeDraggable(orb);
    document.body.append(orb);
  }
  updateOrb();
}

/** Remove the orb. */
export function hideOrb() {
  document.getElementById("stc-orb")?.remove();
}

/** Color and count of the orb. */
function updateOrb() {
  const orb = document.getElementById("stc-orb");
  if ( !orb ) return;
  const {mood, count} = orbMood(view());
  orb.dataset.mood = mood;
  orb.querySelector(".stc-orb-count").textContent = count ? String(count) : "";
}

/**
 * Drag the orb, click opens the window.
 * @param {HTMLElement} orb
 */
function makeDraggable(orb) {
  let start = null;
  orb.addEventListener("pointerdown", event => {
    const rect = orb.getBoundingClientRect();
    start = {x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false};
    orb.setPointerCapture(event.pointerId);
  });
  orb.addEventListener("pointermove", event => {
    if ( !start ) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if ( !start.moved && (Math.hypot(dx, dy) < 4) ) return;
    start.moved = true;
    orb.style.left = `${Math.clamp(start.left + dx, 0, window.innerWidth - 48)}px`;
    orb.style.top = `${Math.clamp(start.top + dy, 0, window.innerHeight - 48)}px`;
    orb.style.right = "auto";
    orb.style.bottom = "auto";
  });
  orb.addEventListener("pointerup", event => {
    const moved = start?.moved;
    start = null;
    orb.releasePointerCapture(event.pointerId);
    if ( moved ) {
      const left = Math.round(parseFloat(orb.style.left));
      const top = Math.round(parseFloat(orb.style.top));
      game.settings.set(MODULE_ID, "orbPosition", {left, top});
    }
    else openCompass();
  });
}
