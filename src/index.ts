import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import db from "./db.js";
import fs from "fs";
const networkInformation = JSON.parse(fs.readFileSync("network.json").toString());
const pjson = JSON.parse(fs.readFileSync("package.json").toString());
const app = express();
const permissionManager = new PermissionManager();
export { permissionManager };

// Parse JSON bodies
app.use(express.json({ limit: '250mb' }));
// Parse binary bodies
app.use(express.raw({type: 'image/*', limit: '10mb'}));

// Allow CORS usage
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "*");

    // Define reply method, to set status code accordingly
    res.reply = (reply) => {
        res.status(reply.request.status_code).json(reply);
    }

    next();
})

import auth from './routes/v1/auth.js';
import user from './routes/v1/user.js';
import quark from './routes/v1/quark.js';
import channel from './routes/v1/channel.js';
app.use("/v1/auth", auth);
app.use("/v1/user", user);
app.use("/v1/quark", quark);
app.use("/v1/channel", channel);
app.use("/", express.static("public"));
import authv2 from './routes/v2/auth.js';
import userv2 from './routes/v2/user.js';
import quarkv2 from './routes/v2/quark.js';
import channelv2 from './routes/v2/channel.js';
import dmv2 from './routes/v2/dm.js';
app.use("/v2/auth", authv2);
app.use("/v2/user", userv2);
app.use("/v2/quark", quarkv2);
app.use("/v2/channel", channelv2);
app.use("/v2/dm", dmv2);

import home from './routes/home.js';
app.use("/", home)

app.get("/v*/network", (req, res) => {
    networkInformation.version = pjson.version;
    res.json(networkInformation);
})

app.get("*", (req, res) => {
    res.status(403).end();
})
app.post("*", (req, res) => {
    res.status(403).end();
})
app.put("*", (req, res) => {
    res.status(403).end();
})
app.patch("*", (req, res) => {
    res.status(403).end();
})

import gateway from './routes/v1/gateway.js';
import PermissionManager from "./classes/permissions/PermissionManager.js";
let port = process.env.LQ_PORT || 10000;
db.dbEvents.on("login_ready", () => {
    const server = app.listen(port, () => {
        console.info(`App listening on ${port}`);
    })
    gateway(server);
    console.log(`Owner grants WRITE_MESSAGE? ${PermissionManager.permissions.OWNER.permission.grants("WRITE_MESSAGE")}`);
})