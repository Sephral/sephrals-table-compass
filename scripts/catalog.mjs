/**
 * What the players can say: the scales (axes), the quick signals, the wishes, the topics of the feedback round and
 * the faces of the scene check. Every entry has an id; its texts live in the language files under STC.Axis.<id>,
 * STC.Signal.<id>, STC.Wish.<id> and STC.Topic.<id>. The icons are SVG paths on a 24 by 24 grid, drawn with a stroke.
 */

/** Scales with "fine" in the middle: -2 much too little, -1 a bit too little, 0 fine, 1 a bit too much, 2 much too much. */
export const AXES = ["pace", "tension", "roleplay", "combat", "challenge", "exploration", "description", "humor", "rules"];

/** The scales a new world shows. */
export const DEFAULT_AXES = ["pace", "tension", "roleplay", "combat", "challenge"];

/** Quick signals for the moment. The X card is separate: it reaches the GM at once and stays until acknowledged. */
export const SIGNALS = ["pause", "lost", "spotlight", "more", "tech"];

/** Wishes for the next scenes. */
export const WISHES = ["combat", "puzzle", "exploration", "character", "npc", "trade", "campfire", "loot", "journey",
  "drama", "humor", "intrigue", "heist", "romance"];

/** The wishes a new world offers. */
export const DEFAULT_WISHES = WISHES.slice(0, 12);

/** Topics of the feedback round (highlight, more of, less of). */
export const TOPICS = ["combat", "roleplay", "exploration", "puzzle", "story", "humor", "character"];

/** Answers of the scene check, from "not my thing" (1) to "great" (5). */
export const FACES = [1, 2, 3, 4, 5];

/** The steps of a scale. */
export const STEPS = [-2, -1, 0, 1, 2];

/** Icons as SVG paths (stroke, 24 by 24). */
export const ICONS = {
  compass: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM15.5 8.5 13 13l-4.5 2.5L11 11z",
  xcard: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 9l6 6M15 9l-6 6",
  lock: "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V7a4 4 0 0 1 8 0v4",
  scale: "M4 12h16M7 8v8M17 8v8M12 5v14",
  history: "M3 17l5-5 4 3 8-8M3 21h18",
  timer: "M12 5a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM12 9v4l2 2M9 2h6",
  feedback: "M4 5h16v11H9l-5 4z",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  // Signals
  pause: "M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2",
  lost: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01",
  spotlight: "M12 11a3 3 0 1 0 0-6a3 3 0 1 0 0 6zM6 20a6 6 0 0 1 12 0M4 4l3 3M20 4l-3 3",
  more: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  tech: "M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.5-2.8M19 13a10 10 0 0 0-2.4-1.6M12 20h.01",
  // Wishes and topics
  combat: "M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2",
  puzzle: "M4 7h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H4v-4a2 2 0 1 0 0-4z",
  exploration: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM15.5 8.5 13 13l-4.5 2.5L11 11z",
  character: "M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8zM4 21a8 8 0 0 1 16 0",
  npc: "M4 5h16v11H9l-5 4z",
  trade: "M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5",
  campfire: "M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-4 0-7zM5 21l14-3M19 21 5 18",
  loot: "M6 4h12l3 5-9 11L3 9zM3 9h18",
  journey: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  drama: "M5 4h14v7a7 7 0 0 1-14 0zM9 9h.01M15 9h.01M9 14c1.5 1.3 4.5 1.3 6 0",
  humor: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8.5 14c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01",
  intrigue: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z",
  heist: "M7 14a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM10 15l9-9M16 9l3 3M14 7l3 3",
  romance: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM9.5 10.5l2 2 3-3",
  roleplay: "M5 4h14v7a7 7 0 0 1-14 0zM9 9h.01M15 9h.01M9 14c1.5 1.3 4.5 1.3 6 0",
  story: "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h6M8 11h6"
};

/** The mouths of the five faces of the scene check (40 by 40 grid). */
export const FACE_MOUTHS = {
  1: "M13 29c3-4 11-4 14 0",
  2: "M13 27c3-2 11-2 14 0",
  3: "M13 26h14",
  4: "M13 25c3 3 11 3 14 0",
  5: "M12 24c3 6 13 6 16 0"
};

/**
 * Keep only known ids, in catalog order, without duplicates.
 * @param {*} ids
 * @param {string[]} known
 * @param {string[]} fallback   Used when the list is not an array
 * @returns {string[]}
 */
export function knownIds(ids, known, fallback) {
  if ( !Array.isArray(ids) ) return [...fallback];
  const wanted = new Set(ids);
  return known.filter(id => wanted.has(id));
}
