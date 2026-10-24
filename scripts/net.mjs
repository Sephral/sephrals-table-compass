/**
 * The module socket. Players send their votes only to the active GM, never to everyone, so other players' clients
 * never see them. The server adds the sender's id to every socket message: here it is only used to tell players from
 * GMs and then dropped, so no vote is ever stored or shown with a name.
 */

import {SOCKET} from "./config.mjs";

/**
 * @typedef SocketHandlers
 * @property {(message: object) => void} fromPlayer        A player's message, on the active GM's client
 * @property {(message: object, gmId: string) => void} fromGM   A GM's message, on any client
 */

/**
 * Install the socket listener. Call once in "ready".
 * @param {SocketHandlers} handlers
 */
export function registerSocket({fromPlayer, fromGM}) {
  game.socket.on(SOCKET, (message, senderId) => {
    const sender = game.users.get(senderId);
    if ( !sender || !message || (typeof message !== "object") ) return;
    if ( sender.isGM ) return fromGM(message, sender.id);
    if ( game.user.isActiveGM ) fromPlayer(message);
  });
}

/**
 * Send a player's message to the active GM.
 * @param {object} message
 * @returns {boolean}  Whether a GM was there to receive it
 */
export function sendToGM(message) {
  const gm = game.users.activeGM;
  if ( !gm ) return false;
  game.socket.emit(SOCKET, message, {recipients: [gm.id]});
  return true;
}

/**
 * Send a GM's message to some users.
 * @param {object} message
 * @param {string[]} recipients
 */
export function sendToUsers(message, recipients) {
  if ( recipients.length ) game.socket.emit(SOCKET, message, {recipients});
}
