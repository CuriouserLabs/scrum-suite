export const PEER_PREFIX = 'sprint-poker-room-';

export function roomPeerId(roomId) {
  return `${PEER_PREFIX}${roomId}`;
}

export function send(conn, msg) {
  if (conn && conn.open) {
    conn.send(msg);
  }
}

export function broadcast(connections, msg) {
  Object.values(connections).forEach((conn) => send(conn, msg));
}
