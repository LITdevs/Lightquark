import {isValidObjectId} from "mongoose";
import db from "../db.js";

let realEvents = [
    "quark",
    "channel"
]
/**
 * channel_channelId
 *  -> messageCreate (message object, author object) X
 *  -> messageDelete (message object) X
 *  -> messageUpdate (message object) X
 *
 * quark_quarkId
 * -> quarkUpdate (quark object) X
 * -> quarkDelete (quark object) X
 * -> channelCreate (channel object, quark object) X
 * -> channelDelete (channel object, quark object) X
 * -> channelUpdate (channel object, quark object) X
 * -> memberUpdate (user object, quark object) X
 * -> memberLeave (user object, quark object) X
 * -> memberJoin (user object, quark object) X
 */

export default class SubscriptionManager {
    private subscriptions: { [key: string]: { callback: Function, userId: string, socketId: string }[] };
    clients: { socketId: string, lastHeartbeat: number }[];
    constructor() {
        this.subscriptions = {};
        this.clients = [];
    }

    subscribe(event : string, callback : Function, user, socketId) {
        let validEvent = this.validEvent(event);
        if (validEvent !== 1) return validEvent;

        if (!this.subscriptions[event]) {
            this.subscriptions[event] = [];
        }

        if (this.subscriptions[event].some(sub => sub.socketId === socketId)) return 5; // Already subscribed
        this.subscriptions[event].push({ callback, userId: user._id, socketId });

        return 1
    }

    /**
     * Check if an event is valid
     * 1 = Valid event
     * 2 = Invalid event
     * 3 = Nonexistent event
     * 4 = Invalid ID
     * @param event
     * @returns {int}
     */
    validEvent(event) {
        let props = event.split("_");
        if (!props || props.length < 2) return 2;
        let eventTag = props[0];
        let eventId = props[1];
        if (!realEvents.includes(eventTag)) return 3;
        if (!isValidObjectId(eventId)) return 4;
        return 1;
    }

    unsubscribe(event : string, socketId) {
        if (this.validEvent(event) !== 1) return;
        if (!this.subscriptions[event]) return;
        this.subscriptions[event] = this.subscriptions[event].filter(sub => sub.socketId !== socketId);
    }
    unsubscribeAll(socketId) {
        for (let event in this.subscriptions) {
            if (!this.subscriptions[event]) return;
            this.subscriptions[event] = this.subscriptions[event].filter(sub => sub.socketId !== socketId);
        }
    }

    event(event : string, data) {
        if (this.validEvent(event) !== 1) return;
        if (!this.subscriptions[event]) return;
        this.subscriptions[event].forEach(sub => {
            try {
                sub.callback(data);
            } catch (e) {
                console.error(e);
            }
        });
        // Clean up subscriptions that would break permissions
        if (data.eventId === "memberLeave") {
            let quark = data.quark;
            if (this.subscriptions[`quark_${quark._id}`]) this.subscriptions[`quark_${quark._id}`] = this.subscriptions[`quark_${quark._id}`].filter(sub => sub.userId !== data.user._id);
            quark.channels.forEach(channel => {
                if (this.subscriptions[`channel_${channel._id}`]) this.subscriptions[`channel_${channel._id}`] = this.subscriptions[`channel_${channel._id}`].filter(sub => sub.userId !== data.user._id);
            })
        }
    }

    /**
     * Drop a client
     * @param socketId
     */
    clientDisconnect(socketId) {
        this.unsubscribeAll(socketId);
        this.clients = this.clients.filter(client => client.socketId !== socketId);
    }

    /**
     * Update the last heartbeat of a client
     * If the client doesn't exist, add it
     * @param socketId
     */
    clientHeartbeat(socketId) {
        let client = this.clients.find(client => client.socketId === socketId);
        if (!client) {
            this.clients.push({socketId, lastHeartbeat: Date.now()});
        } else {
            client.lastHeartbeat = Date.now();
        }
    }

    /**
     * Drop all clients that haven't sent a heartbeat in 60 seconds
     */
    clientHeartbeatCheck() {
        this.clients = this.clients.filter(client => {
            let drop : boolean = (Date.now() - client.lastHeartbeat > 60000);
            if (drop) console.log("Dropping client", client.socketId, drop);
            if (drop) this.unsubscribeAll(client.socketId);
            return !drop;
        });
    }
    wtf() {
        return {clients: this.clients, subcriptions: this.subscriptions};
    }
}