/**
 * A small stand-in for the parts of Foundry the tracker and the player's side use: users with roles, world and
 * client settings in memory, a socket which records what is sent, notifications and local storage. Import it before
 * the scripts under test.
 */

/** Settings as Foundry registers them for the module, read when nothing was set. */
const DEFAULTS = {updateDelay: "off", minVotes: 2, fadeMinutes: 20, signalMinutes: 5, freeText: true, xcardSound: false,
  spotlight: true, spotlightMinutes: 20, spotlightBook: {}, linesFreeText: true, lv: {}, lvTokens: {},
  public: {}, choices: {}, history: {}, results: []};

export class FakeUser {
  constructor(id, role, active=true, name=id) {
    this.id = id;
    this.role = role;
    this.active = active;
    this.name = name;
    this.character = null;
  }

  get isGM() {
    return this.role >= 3;
  }

  get isActiveGM() {
    return game.users.activeGM === this;
  }

  get isSelf() {
    return game.user === this;
  }
}

export const users = {
  gm: new FakeUser("GameMaster000001", 4, true, "Gamemaster"),
  assistant: new FakeUser("AssistantGM00001", 3, true, "Assistant"),
  p1: new FakeUser("PlayerOne0000001", 1, true, "Anna"),
  p2: new FakeUser("PlayerTwo0000002", 2, true, "Ben")
};
const all = Object.values(users);

/** Setting values by key. */
export const values = new Map();

/** Socket messages sent, newest last. */
export const sent = [];

/** Notifications shown. */
export const notes = [];

/** Local storage of the browser. */
export const storage = new Map();

/** Hooks registered, by name. */
export const hooks = new Map();

globalThis.Hooks = {on: (name, fn) => hooks.set(name, [...(hooks.get(name) ?? []), fn])};

globalThis.game = {
  user: users.gm,
  combat: null,
  world: {id: "test"},
  users: {
    get activeGM() {
      return all.filter(u => u.active && u.isGM).sort((a, b) => b.role - a.role)[0] ?? null;
    },
    filter: fn => all.filter(fn),
    get: id => all.find(u => u.id === id)
  },
  settings: {
    get: (module, key) => structuredClone(values.has(key) ? values.get(key) : DEFAULTS[key]),
    set: async (module, key, value) => {
      values.set(key, structuredClone(value));
      return value;
    }
  },
  socket: {emit: (event, message, options) => sent.push({event, message, to: options?.recipients ?? null})},
  i18n: {localize: key => key, format: key => key}
};
globalThis.ui = {notifications: {info: text => notes.push(["info", text]), warn: text => notes.push(["warn", text])}};
globalThis.foundry = {
  utils: {debounce: fn => fn, deepClone: value => structuredClone(value), randomID: () => Array.from({length: 16}, () => "abcdefghijkmnopqrstuvwxyz23456789"[Math.floor(Math.random() * 33)]).join("")},
  audio: {AudioHelper: {play: () => {}}}
};
globalThis.CONST = {USER_ROLES: {PLAYER: 1}};
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value))
};

/** Let pending promises (setting writes) finish. */
export async function settle() {
  for ( let i = 0; i < 20; i++ ) await Promise.resolve();
}

/**
 * The messages of one type sent since an index.
 * @param {string} type
 * @param {number} [from=0]
 * @returns {object[]}
 */
export function sentOf(type, from=0) {
  return sent.slice(from).filter(s => s.message?.type === type);
}
