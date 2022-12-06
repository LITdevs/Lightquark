import express, {Request, Response} from 'express';
import dotenv from 'dotenv';
dotenv.config();
import db from "./db.js";
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

import auth from './routes/auth.js';
import user from './routes/user.js';
import quark from './routes/quark.js';
import channel from './routes/channel.js';
import gateway from './routes/gateway.js';
app.use("/v1/auth", auth);
app.use("/v1/user", user);
app.use("/v1/quark", quark);
app.use("/v1/channel", channel);
app.use("/v1/gateway", gateway);
app.use("/", express.static("public"));

app.get("/v1/ping", (req : Request, res : Response) => {
    res.contentType("text/plain");
    res.send("pong");
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

let port = process.env.LQ_PORT || 10000;
db.dbEvents.on("login_ready", () => {
    app.listen(port, () => {
        console.info(`App listening on ${port}`);
    })
})