import express, {Request, Response} from 'express';
import dotenv from 'dotenv';
dotenv.config();
import db from "./db.js";
import path from "path";
const app = express();

// Parse JSON bodies
app.use(express.json({ limit: '250mb' }));
// Parse binary bodies
app.use(express.raw({type: 'image/*', limit: '10mb'}));

// Allow CORS usage
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "*");
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


app.get("/v1/ping", (req : Request, res : Response) => {
    res.contentType("text/plain");
    res.send("pong");
})

app.get("/d/:quarkId/:channelId?/:messageId?", (req: Request, res: Response) => {
    let lqLink = `lightquark://${req.params.quarkId}${req.params.channelId ? `/${req.params.channelId}`: ""}${req.params.messageId ? `/${req.params.messageId}`: ""}`
    res.redirect(lqLink)
})

app.get("/features", (req: Request, res: Response) => {
    res.sendFile("public/features.html", {root: path.resolve()});
})

import fs from "fs";
const knownClients = JSON.parse(fs.readFileSync("src/util/knownClients.json").toString());
import CapabilityParser from "./util/CapabilityParser.js";

console.log(knownClients);
app.get("/features/:clientName", async (req: Request, res: Response) => {
    try {
        let client = knownClients.knownClients.find(client => client.name === req.params.clientName);
        if (!client) {
            res.status(404).end();
            return;
        }
        let clientCapabilities = await CapabilityParser(client.capabilityUrl);
        res.json(clientCapabilities);

    } catch (e) {
        console.error(e);
        res.status(500).json(new ServerErrorReply())
    }
})

app.get("*", (req : Request, res : Response) => {
    res.status(403).end();
})
app.post("*", (req : Request, res : Response) => {
    res.status(403).end();
})
app.put("*", (req : Request, res : Response) => {
    res.status(403).end();
})
app.patch("*", (req : Request, res : Response) => {
    res.status(403).end();
})

import gateway from './routes/v1/gateway.js';
import ServerErrorReply from "./classes/reply/ServerErrorReply.js";
let port = process.env.LQ_PORT || 10000;
db.dbEvents.on("login_ready", () => {
    const server = app.listen(port, () => {
        console.info(`App listening on ${port}`);
    })
    gateway(server);
})