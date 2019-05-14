let Rooms = require("../../models/rooms");

let { roomInfo } = require("../../models/schemas");

let { heartbeat } = require("../../helpers/websocket");
let logger = require("../../helpers/logger");

let onmessage = require("./onmessage");
let onclose = require("./onclose");
let sendTurn = require("./actions/turn");
let join = require("./actions/join");

// TODO: redis pub/sub for /api/deleteroom to remove from ROOMS and notify players
function setupConnection(ws, params, wss, ROOMS) {
    // Save user info to wss clients
    ws.userId = params.t;
    ws.roomId = params.r;
    ws.isAlive = true;
    ws.placed = false;

    if (ws.roomId in ROOMS) ROOMS[ws.roomId].players.push(ws);
    else ROOMS[ws.roomId] = new roomInfo(ws);

    const room = ROOMS[ws.roomId];

    // Turn might be reset after gameOver but room still exists
    if (!room.turn) {
        Rooms.getVal(ws.roomId, "turn")
            .then(turn => (room.turn = turn ? turn : ws.userId))
            .then(Rooms.delVal(ws.roomId, "turn"))
            .catch(err => logger.error(`Internal Server Error: ${err.stack || err}`))
            .then(() => sendTurn(null, ws, wss, room));
    } else {
        sendTurn(null, ws, wss, room);
    }

    join(null, ws, wss, room);

    ws.on("pong", heartbeat);

    ws.on("message", msg => onmessage(msg, ws, wss, room));

    ws.on("close", () => onclose(null, ws, wss, room, ROOMS));
}

module.exports = setupConnection;
