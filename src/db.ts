import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import EventEmitter from "events";
import loginUserSchema from "./schemas/loginUserSchema.js";
import userAvatarSchema from "./schemas/userAvatarSchema.js";
import quarkSchema from "./schemas/quarkSchema.js";
import channelSchema from "./schemas/channelSchema.js";
import messageSchema from "./schemas/messageSchema.js";
import quarkOrderSchema from "./schemas/quarkOrderSchema.js";
import nicknameSchema from "./schemas/nicknameSchema.js";
import emoteSchema from "./schemas/emoteSchema.js";
import roleSchema from "./schemas/roleSchema.js";
import permissionAssignmentSchema from "./schemas/permissionAssignmentSchema.js";
import roleAssignmentSchema from "./schemas/roleAssignmentSchema.js";
import preferenceSchema from "./schemas/preferenceSchema.js";
import userStatusSchema from "./schemas/userStatusSchema.js";
import friendRequestSchema from "./schemas/friendRequestSchema.js";
import friendSchema from "./schemas/friendSchema.js";
import tokenSchema from "./schemas/tokenSchema.js";
export default class Database {

    private static _instance: Database;
    connected: boolean = false;

    db: any;
    events: EventEmitter = new EventEmitter();

    Token;
    LoginUsers;
    Avatars;
    Quarks;
    Channels;
    Messages;
    QuarkOrders;
    Nicks;
    Emotes;
    Roles;
    PermissionAssignments;
    RoleAssignments;
    Preferences;
    Statuses;
    FriendRequests;
    Friends;

    constructor() {
        if (typeof Database._instance === "object") return Database._instance;
        Database._instance = this;

        // Connect to the database
        const DB_URI : string | undefined = process.env.LQDB_URI
        if (typeof DB_URI === "undefined") {
            console.error("\nLQDB_URI not found, Exiting...");
            process.exit(2);
        }

        this.db = mongoose.createConnection(DB_URI);

        this.db.once("open", () => {
            this.#onOpen();
            this.connected = true;
        })
    }

    #onOpen() {
        console.log("Database connection established");
        this.Token = this.db.model('token', tokenSchema);
        this.LoginUsers = this.db.model('user', loginUserSchema)
        this.Avatars = this.db.model('avatar', userAvatarSchema);
        this.Quarks = this.db.model('quark', quarkSchema);
        this.Channels = this.db.model('channel', channelSchema);
        this.Messages = this.db.model('message', messageSchema);
        this.QuarkOrders = this.db.model('quarkOrder', quarkOrderSchema);
        this.Nicks = this.db.model('nick', nicknameSchema);
        this.Emotes = this.db.model('emote', emoteSchema);
        this.Roles = this.db.model('roles', roleSchema, 'roles');
        this.PermissionAssignments = this.db.model('permissionAssignments', permissionAssignmentSchema, 'permissionAssignments');
        this.RoleAssignments = this.db.model('roleAssignments', roleAssignmentSchema, 'roleAssignments');
        this.Preferences = this.db.model('preferences', preferenceSchema, 'preferences');
        this.Statuses = this.db.model('statuses', userStatusSchema, 'statuses');
        this.FriendRequests = this.db.model('friendRequests', friendRequestSchema, 'friendRequests');
        this.Friends = this.db.model('friends', friendSchema, 'friends');
        this.events.emit("ready");
    }
}