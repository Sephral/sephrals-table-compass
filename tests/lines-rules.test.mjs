import assert from "node:assert/strict";
import test from "node:test";
import {LV_TOPICS} from "../scripts/catalog.mjs";
import {
  LV_MAX_ITEMS, LV_TEXT_LIMIT, cleanItem, cleanLinesMessage, cleanText, itemKey, itemsFromStore, sortItems, withItem, withoutKey
} from "../scripts/lines-rules.mjs";

const TOKEN = "AbCdEfGh12345678";

test("free texts become one short line without markup", () => {
  assert.equal(cleanText("  Spiders \n and   snakes  "), "Spiders and snakes");
  assert.equal(cleanText("<b>bold</b>"), "b bold /b");
  assert.ok(!/[<>]/.test(cleanText("<img src=x onerror=alert(1)>")));
  assert.equal(cleanText("x".repeat(500)).length, LV_TEXT_LIMIT);
  assert.equal(cleanText(null), "");
  assert.equal(cleanText({a: 1}), "", "an object is no text");
  assert.equal(cleanText(["x"]), "");
  assert.equal(cleanItem({kind: "line", text: {a: 1}}), null);
});

test("an entry is a known kind with a catalog topic or a free text", () => {
  assert.deepEqual(cleanItem({kind: "line", topic: "spiders"}), {kind: "line", topic: "spiders"});
  assert.deepEqual(cleanItem({kind: "veil", text: "  Clowns "}), {kind: "veil", text: "Clowns"});
  assert.equal(cleanItem({kind: "line", topic: "unknown"}), null);
  assert.equal(cleanItem({kind: "nope", topic: "spiders"}), null);
  assert.equal(cleanItem({kind: "line", text: "   "}), null);
  assert.equal(cleanItem({kind: "line", text: "Clowns"}, {freeText: false}), null);
  assert.deepEqual(cleanItem({kind: "line", topic: "spiders"}, {freeText: false}), {kind: "line", topic: "spiders"});
  assert.equal(cleanItem(null), null);
});

test("the same topic or text of the same kind is one entry, in any letter case", () => {
  assert.equal(itemKey({kind: "line", text: "Clowns"}), itemKey({kind: "line", text: "CLOWNS"}));
  assert.notEqual(itemKey({kind: "line", text: "Clowns"}), itemKey({kind: "veil", text: "Clowns"}));
  assert.notEqual(itemKey({kind: "line", topic: "gore"}), itemKey({kind: "line", text: "gore"}));
});

test("messages need a token and a valid entry", () => {
  const good = cleanLinesMessage({type: "lv", token: TOKEN, kind: "line", topic: "gore", on: true});
  assert.deepEqual(good, {type: "lv", token: TOKEN, on: true, item: {kind: "line", topic: "gore"}});
  assert.equal(cleanLinesMessage({type: "lv", token: TOKEN, kind: "line", topic: "gore"}).on, false);
  assert.equal(cleanLinesMessage({type: "lv", token: "short", kind: "line", topic: "gore", on: true}), null);
  assert.equal(cleanLinesMessage({type: "lv", token: TOKEN, kind: "line", topic: "dance", on: true}), null);
  assert.equal(cleanLinesMessage({type: "axis", token: TOKEN}), null);
  assert.equal(cleanLinesMessage(null), null);
});

test("the list has a fixed order that tells nothing about who wrote what", () => {
  const items = [{kind: "veil", text: "Zebras"}, {kind: "line", text: "Apples"}, {kind: "veil", topic: "torture"},
    {kind: "line", topic: "spiders"}, {kind: "line", topic: "violenceChildren"}, {kind: "line", text: "Bananas"}];
  const sorted = sortItems(items);
  assert.deepEqual(sorted.map(i => i.topic ?? i.text), ["violenceChildren", "spiders", "Apples", "Bananas", "torture", "Zebras"]);
  assert.deepEqual(sortItems([...items].reverse()), sorted);
});

test("the stored list keeps known entries once, with the GM mark, up to the limit", () => {
  const stored = {items: [{kind: "line", topic: "gore", gm: true}, {kind: "line", topic: "gore"}, {kind: "line", topic: "x"},
    {kind: "veil", text: "Rats"}, "junk", null]};
  assert.deepEqual(itemsFromStore(stored), [{kind: "line", topic: "gore", gm: true}, {kind: "veil", text: "Rats"}]);
  assert.deepEqual(itemsFromStore(undefined), []);
  assert.deepEqual(itemsFromStore({}), []);
  const many = {items: Array.from({length: LV_MAX_ITEMS + 10}, (_, i) => ({kind: "line", text: `entry ${i}`}))};
  assert.equal(itemsFromStore(many).length, LV_MAX_ITEMS);
});

test("adding and removing entries", () => {
  let items = [];
  items = withItem(items, {kind: "line", topic: "gore"});
  const same = withItem(items, {kind: "line", topic: "gore"});
  assert.equal(same, items);
  items = withItem(items, {kind: "veil", text: "Rats"});
  assert.equal(items.length, 2);
  items = withoutKey(items, itemKey({kind: "line", topic: "gore"}));
  assert.deepEqual(items, [{kind: "veil", text: "Rats"}]);
  const full = Array.from({length: LV_MAX_ITEMS}, (_, i) => ({kind: "line", text: `e${i}`}));
  assert.equal(withItem(full, {kind: "line", text: "one more"}), full);
});

test("the catalog has no duplicates", () => {
  assert.equal(new Set(LV_TOPICS).size, LV_TOPICS.length);
});
