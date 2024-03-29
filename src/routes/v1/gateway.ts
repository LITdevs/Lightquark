import { WebSocketServer } from "ws";
import {WsAuth} from "../../util/Auth.js";
import crypto from "crypto";
import SubscriptionManager from "../../classes/SubscriptionManager.js";
import EventEmitter from "events";
const database = new Database()
import {checkPermittedChannel} from "../../util/PermissionMiddleware.js";
import {ConstantID_DMvQuark, ConstantID_SystemUser} from "../../util/ConstantID.js";
import Database from "../../db.js";

// Create a new Subscription Manager and export it
const sm = new SubscriptionManager();

setInterval(() => {
    sm.clientHeartbeatCheck();
}, 10000)

// Create a new EventEmitter for listening to various events and export it
const subscriptionListener = new EventEmitter();
export { subscriptionListener }
subscriptionListener.on("event", (event, data) => {
    sm.event(event, data);
})

export default (server) => {
    const wss = new WebSocketServer({
        noServer: true,
        path: "/gateway",
    });

    server.on("upgrade", (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (websocket) => {
            wss.emit("connection", websocket, request);
        });
    });

    wss.on("connection", (ws, req) => {
        let socketId = crypto.randomUUID();
        if (!req.headers["sec-websocket-protocol"]) {
            console.log("Connection attempt missing security header to gateway");
            return ws.close(1008, "You are not permitted to connect to this gateway");
        }
        // Check if the user is authenticated
        WsAuth(req.headers["sec-websocket-protocol"]).then((user : any) => {
            if (!user) {
                ws.close(1008, "You are not permitted to connect to this gateway");
                console.log("Unauthorized connection attempt to gateway");
                return;
            }
            sm.clientHeartbeat(socketId);
            ws.on("message", (message) => {
                handleMessage(message, ws, user, socketId).catch(err => {
                    console.error(err);
                    // @ts-ignore
                    ws.send({message: "Internal Server Error", event: "error", code: 500});
                });
            });
            ws.once("close", () => {
                sm.clientDisconnect(socketId); // Remove the client from the subscription manager
            })
        })
    })

    return wss;
}

async function handleMessage(message, ws, user, socketId) {
    try {
        let data = JSON.parse(message);
        // Heartbeat event
        if (data.event === "heartbeat") {
            if (!data.message) return ws.send(JSON.stringify({eventId: "error", message: "Missing message body", code: 400, state: data?.state}));
            // Tell the subscription manager that the client is still alive and respond
            sm.clientHeartbeat(socketId);
            ws.send(JSON.stringify({eventId: "heartbeat", message: `Still alive -GLaDOS probably. Message hash: ${crypto.createHash("sha1").update(data.message).digest("base64").substring(2,10)}`, code: 200, state: data?.state}));
        }

        // Subscribe event
        if (data.event === "subscribe") {
            if (!data.message) return ws.send(JSON.stringify({
                eventId: "error",
                message: "Missing message body",
                code: 400, state: data?.state
            }));
            let event = data.message;
            let validEvent = sm.validEvent(event);
            if (validEvent !== 1) return ws.send(JSON.stringify({
                eventId: "error",
                message: "Invalid event",
                event,
                code: validEvent, state: data?.state
            }));

            // Check if the user is permitted to subscribe to the event
            if (event === "me") {
                // `me` doesn't need any checks
                /**
                 * Callback function for the subscription manager
                 * @param data
                 */
                const sub = (data) => {
                    ws.send(JSON.stringify(data));
                }
                await sm.subscribe(event, sub, user, socketId);
                ws.send(JSON.stringify({eventId: "subscribe", message: "Successfully subscribed to event", code: 200, state: data?.state}));

            } else if (event.split("_")[0] === "channel") {
                let permitted = await checkPermittedChannel("READ_CHANNEL", event.split("_")[1], user._id)
                if (permitted.permitted) {
                    const sub = (data) => {
                        ws.send(JSON.stringify(data));
                    }
                    await sm.subscribe(event, sub, user, socketId);
                    ws.send(JSON.stringify({eventId: "subscribe", message: "Successfully subscribed to event", code: 200, state: data?.state}));
                } else {
                    ws.send(JSON.stringify({eventId: "error", message: "You are not permitted to subscribe to this event", code: 403, event, state: data?.state}));
                }
            } else if (event.split("_")[0] === "quark") {
                let Quarks = database.Quarks;
                try {
                    let quark = await Quarks.findOne({_id: event.split("_")[1], members: user._id});
                    if (ConstantID_DMvQuark.equals(event.split("_")[1]) || event.split("_")[1] === "dm") {
                        quark = {
                            name: "Direct Messages",
                            _id: ConstantID_DMvQuark,
                            members: [user._id],
                            invite: "direct messages", // Impossible invite
                            owners: [ ConstantID_SystemUser ],
                            channels: []
                        }
                    }
                    if (!quark) return ws.send(JSON.stringify({eventId: "error", message: "You are not permitted to subscribe to this event", code: 403, event, state: data?.state}));
                    const sub = (data) => {
                        ws.send(JSON.stringify(data));
                    }
                    await sm.subscribe(event, sub, user, socketId);
                    ws.send(JSON.stringify({eventId: "subscribe", message: "Successfully subscribed to event", code: 200, state: data?.state}));

                } catch (err) {
                    console.error(err);
                    return ws.send(JSON.stringify({eventId: "error", message: "Internal Server Error", code: 500, state: data?.state}));
                }
            } else {
                return ws.send(JSON.stringify({eventId: "error", message: "Not implemented", code: 501, state: data?.state}));
            }
        }
        if (data.event === "unsubscribe") {
            if (!data.message) return ws.send(JSON.stringify({eventId: "error", message: "Missing message body", code: 400, state: data?.state}));
            sm.unsubscribe(data.message, socketId);
            ws.send(JSON.stringify({eventId: "unsubscribe", message: "Unsubscribed", code: 200, state: data?.state}));
        }
        if (data.event === "unsubscribeAll") {
            sm.unsubscribeAll(socketId);
            ws.send(JSON.stringify({eventId: "unsubscribeAll", message: "Unsubscribed from all events", code: 200, state: data?.state}));
        }
    } catch (e) {
        console.error(e);
        ws.send(JSON.stringify({eventId: "error", message: "Internal Server Error", code: 500, state: null}));
    }
}