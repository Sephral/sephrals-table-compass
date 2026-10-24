/**
 * The result of a feedback round for the GM: stars, tempo, highlights, more and less, the free texts in a random
 * order and the wishes of the evening. The GM can keep it in a journal entry only GMs can see.
 */

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

import {TOPICS} from "./catalog.mjs";
import {MODULE_ID, TEMPLATES, decimal, esc, locale, setting, t} from "./config.mjs";
import {results} from "./tracker.mjs";

export class FeedbackResults extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "stc-results",
    classes: ["stc", "stc-results"],
    window: {title: "STC.Results.title", icon: "fa-solid fa-square-poll-vertical", resizable: true},
    position: {width: 720, height: "auto"},
    actions: {
      journal: FeedbackResults.#onJournal
    }
  };

  /** @override */
  static PARTS = {
    body: {template: `${TEMPLATES}/results.hbs`}
  };

  /** The id of the result shown; the newest by default. */
  resultId = null;

  /** @override */
  get title() {
    return t("STC.Results.title");
  }

  /**
   * The result shown.
   * @returns {object|null}
   */
  get result() {
    const list = results();
    return list.find(r => r.id === this.resultId) ?? list.at(-1) ?? null;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const list = results();
    const r = this.result;
    context.choices = list.map(x => ({id: x.id, label: dateLabel(x.closed), selected: x.id === r?.id})).reverse();
    context.result = r ? describe(r) : null;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.stcTheme = setting("theme");
    this.element.querySelector("select[name='result']")?.addEventListener("change", event => {
      this.resultId = event.target.value;
      this.render();
    });
  }

  static async #onJournal() {
    const r = this.result;
    if ( !r ) return;
    const page = await saveToJournal(r);
    if ( page ) {
      ui.notifications.info(t("STC.Results.saved"));
      page.parent?.sheet?.render(true, {pageId: page.id});
    }
  }
}

/**
 * A date and time for a result.
 * @param {number} ms
 * @returns {string}
 */
function dateLabel(ms) {
  return new Date(ms).toLocaleString(locale(), {dateStyle: "medium", timeStyle: "short"});
}

/**
 * What the window shows of a result.
 * @param {object} r
 * @returns {object}
 */
function describe(r) {
  const max = Math.max(r.count, 1);
  const bar = count => Math.round((count / max) * 100);
  const topics = counts => TOPICS.filter(id => counts?.[id]).map(id => ({label: t(`STC.Topic.${id}`), count: counts[id], width: bar(counts[id])}))
    .sort((a, b) => b.count - a.count);
  const tempoTotal = Math.max(r.tempo.slow + r.tempo.fine + r.tempo.fast, 1);
  const wishName = id => t(`STC.Wish.${id}`);
  return {
    date: dateLabel(r.closed),
    count: r.count, online: r.online, shown: r.shown,
    few: t("STC.Results.few", {count: r.count, min: setting("minVotes")}),
    stars: r.stars.count ? {avg: decimal(r.stars.avg), full: Math.round(r.stars.avg),
      dist: [5, 4, 3, 2, 1].map(n => ({n, count: r.stars.dist[n - 1], width: bar(r.stars.dist[n - 1])}))} : null,
    tempo: (r.tempo.slow + r.tempo.fine + r.tempo.fast) ? ["slow", "fine", "fast"].map(k => ({k, count: r.tempo[k],
      width: Math.round((r.tempo[k] / tempoTotal) * 100), label: t(`STC.Results.tempo.${k}`)})).filter(x => x.count) : null,
    highlights: topics(r.highlights),
    nextTime: TOPICS.filter(id => r.more?.[id] || r.less?.[id]).map(id => ({label: t(`STC.Topic.${id}`),
      more: r.more?.[id] ?? 0, less: r.less?.[id] ?? 0, moreWidth: bar(r.more?.[id] ?? 0), lessWidth: bar(r.less?.[id] ?? 0)})),
    texts: (r.texts ?? []).map(x => ({kind: x.kind, label: t(`STC.Results.kind.${x.kind}`), text: x.text})),
    wishes: [
      ...(r.wishes?.fulfilled ?? []).map(id => ({label: t("STC.Results.wishFulfilled", {wish: wishName(id)}), kind: "done"})),
      ...(r.wishes?.soon ?? []).map(id => ({label: t("STC.Results.wishSoon", {wish: wishName(id)}), kind: "soon"})),
      ...Object.entries(r.wishes?.open ?? {}).filter(([id]) => !(r.wishes?.soon ?? []).includes(id))
        .map(([id, n]) => ({label: t("STC.Results.wishOpen", {wish: wishName(id), count: n}), kind: "open"}))
    ]
  };
}

/**
 * Keep a result in the journal entry of the module, which only GMs can see.
 * @param {object} r
 * @returns {Promise<JournalEntryPage|null>}
 */
export async function saveToJournal(r) {
  if ( !game.user.isGM ) return null;
  const name = t("STC.Journal.name");
  let entry = game.journal.find(j => j.getFlag(MODULE_ID, "archive"));
  entry ??= await JournalEntry.implementation.create({name, ownership: {default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE},
    flags: {[MODULE_ID]: {archive: true}}});
  const existing = entry.pages.find(p => p.getFlag(MODULE_ID, "result") === r.id);
  const data = {name: t("STC.Journal.page", {date: dateLabel(r.closed)}), type: "text",
    text: {content: resultHtml(describe(r))}, flags: {[MODULE_ID]: {result: r.id}}};
  if ( existing ) {
    await existing.update(data);
    return existing;
  }
  const [page] = await entry.createEmbeddedDocuments("JournalEntryPage", [data]);
  return page;
}

/**
 * The result as HTML for the journal, readable without the module.
 * @param {object} d   A described result
 * @returns {string}
 */
function resultHtml(d) {
  const parts = [`<p>${esc(t("STC.Results.answers", {count: d.count, online: d.online}))}</p>`];
  if ( !d.shown ) return `${parts.join("")}<p>${esc(d.few)}</p>`;
  if ( d.stars ) parts.push(`<h3>${esc(t("STC.Results.evening"))}</h3><p>${esc(t("STC.Results.starsLine", {avg: d.stars.avg}))}</p>`);
  if ( d.tempo ) parts.push(`<h3>${esc(t("STC.Results.tempoTitle"))}</h3><ul>${d.tempo.map(x => `<li>${esc(x.label)}: ${x.count}</li>`).join("")}</ul>`);
  if ( d.highlights.length ) parts.push(`<h3>${esc(t("STC.Results.highlights"))}</h3><ul>${d.highlights.map(x => `<li>${esc(x.label)}: ${x.count}</li>`).join("")}</ul>`);
  if ( d.nextTime.length ) parts.push(`<h3>${esc(t("STC.Results.nextTime"))}</h3><ul>${d.nextTime.map(x => `<li>${esc(x.label)}: ${esc(t("STC.Results.moreLess", {more: x.more, less: x.less}))}</li>`).join("")}</ul>`);
  if ( d.texts.length ) parts.push(`<h3>${esc(t("STC.Results.ownWords"))}</h3>${d.texts.map(x => `<p><strong>${esc(x.label)}:</strong> ${esc(x.text)}</p>`).join("")}`);
  if ( d.wishes.length ) parts.push(`<h3>${esc(t("STC.Results.wishes"))}</h3><ul>${d.wishes.map(x => `<li>${esc(x.label)}</li>`).join("")}</ul>`);
  return parts.join("");
}

/**
 * Open the results, at a given result or the newest.
 * @param {object} [result]
 * @returns {Promise<FeedbackResults>}
 */
export async function openResults(result) {
  const app = foundry.applications.instances.get(FeedbackResults.DEFAULT_OPTIONS.id) ?? new FeedbackResults();
  app.resultId = result?.id ?? null;
  await app.render({force: true});
  app.bringToFront?.();
  return app;
}
