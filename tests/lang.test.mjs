import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {AXES, FACES, ICONS, SIGNALS, TOPICS, WISHES, DEFAULT_AXES, DEFAULT_WISHES} from "../scripts/catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * All keys of a nested translation object, dotted.
 * @param {object} object
 * @param {string} [prefix]
 * @returns {string[]}
 */
function keysOf(object, prefix="") {
  return Object.entries(object).flatMap(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    return (value && (typeof value === "object")) ? keysOf(value, full) : [full];
  });
}

/**
 * All files of a folder, recursively.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function files(dir) {
  const list = await readdir(dir, {withFileTypes: true});
  return (await Promise.all(list.map(e => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)])))).flat();
}

const en = JSON.parse(await readFile(path.join(root, "lang/en.json"), "utf8"));
const de = JSON.parse(await readFile(path.join(root, "lang/de.json"), "utf8"));
const enKeys = new Set(keysOf(en));

test("English and German have the same keys", () => {
  assert.deepEqual([...keysOf(de)].sort(), [...enKeys].sort());
});

test("no key is both a text and a group", () => {
  for ( const key of enKeys ) assert.ok(![...enKeys].some(other => other.startsWith(`${key}.`)), key);
});

test("placeholders match between English and German", () => {
  const get = (obj, key) => key.split(".").reduce((o, k) => o?.[k], obj);
  const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for ( const key of enKeys ) assert.deepEqual(holes(get(de, key)), holes(get(en, key)), key);
});

test("every key used by scripts and templates exists, and every entry of the catalog has its texts", async () => {
  const sources = [...await files(path.join(root, "scripts")), ...await files(path.join(root, "templates"))];
  const used = new Set();
  for ( const file of sources ) {
    const text = await readFile(file, "utf8");
    for ( const match of text.matchAll(/["'`](STC\.[A-Za-z0-9_.]+)["'`]/g) ) used.add(match[1]);
  }
  for ( const key of Object.keys(en.STC.SETTINGS) ) {
    used.add(`STC.SETTINGS.${key}.name`);
    used.add(`STC.SETTINGS.${key}.hint`);
  }
  // Keys built from parts
  for ( const id of AXES ) for ( const part of ["name", "low", "high", "more"] ) used.add(`STC.Axis.${id}.${part}`);
  for ( const id of SIGNALS ) used.add(`STC.Signal.${id}.name`);
  for ( const id of WISHES ) used.add(`STC.Wish.${id}`);
  for ( const id of TOPICS ) used.add(`STC.Topic.${id}`);
  for ( const face of FACES ) used.add(`STC.Poll.face.${face}`);
  for ( const v of [0, 1, 2] ) used.add(`STC.Feedback.tempo.${v}`);
  for ( const k of ["slow", "fine", "fast"] ) used.add(`STC.Results.tempo.${k}`);
  for ( const k of ["rose", "thorn", "bud"] ) {
    used.add(`STC.Results.kind.${k}`);
    used.add(`STC.Feedback.${k}`);
  }
  for ( const k of ["scale", "compass", "history"] ) used.add(`STC.GM.view.${k}`);
  for ( const k of ["fine", "split", "few"] ) used.add(`STC.GM.status.${k}`);
  for ( const k of ["xcard", "poll", "wish", "round"] ) used.add(`STC.GM.mark.${k}`);
  for ( const k of ["now", "mood", "wish"] ) used.add(`STC.Player.tab.${k}`);
  for ( const key of used ) if ( key.endsWith(".") ) used.delete(key);
  const missing = [...used].filter(key => !enKeys.has(key) && ![...enKeys].some(k => k.startsWith(`${key}.`)));
  assert.deepEqual(missing, []);
});

test("every signal, wish and topic has an icon, and the defaults come from the catalog", () => {
  for ( const id of [...SIGNALS, ...WISHES, ...TOPICS] ) assert.ok(ICONS[id], id);
  for ( const id of DEFAULT_AXES ) assert.ok(AXES.includes(id), id);
  for ( const id of DEFAULT_WISHES ) assert.ok(WISHES.includes(id), id);
});

test("public texts use no semicolons", () => {
  for ( const key of enKeys ) {
    const get = (obj, k) => k.split(".").reduce((o, part) => o?.[part], obj);
    assert.ok(!String(get(en, key)).includes(";"), key);
    assert.ok(!String(get(de, key)).includes(";"), key);
  }
});
