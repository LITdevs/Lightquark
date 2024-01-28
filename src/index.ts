import * as Sentry from "@sentry/node";
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import fs from "fs";
import { initialize } from 'unleash-client';
import {kitty} from "./util/kitty.js";
import networkInformation from "./networkInformation.js";
export {networkInformation}
export const pjson = JSON.parse(fs.readFileSync("package.json").toString());
const app = express();

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
        // enable HTTP calls tracing
        new Sentry.Integrations.Http({ tracing: true }),
        // enable Express.js middleware tracing
        new Sentry.Integrations.Express({ app }),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0,
    environment: process.env.SENTRY_ENV || "unknown"
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

export const unleash = initialize({
    url: 'https://feature-gacha.litdevs.org/api',
    appName: 'Lightquark',
    environment: networkInformation.environment === "dev" ? "development" : "production",
    // @ts-ignore
    customHeaders: { Authorization: process.env.UNLEASH_TOKEN },
});

const permissionManager = new PermissionManager();
export { permissionManager };

// Parse JSON bodies
app.use(express.json({ limit: '250mb' }));
// Parse binary bodies
app.use(express.raw({type: 'image/*', limit: '10mb'}));

// Allow CORS usage
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*,Authorization");
    res.header("Access-Control-Allow-Methods", "*");

    // Define reply method, to set status code accordingly
    res.reply = (reply) => {
        res.status(reply.request.status_code).json(reply);
    }

    next();
})

app.use("/", express.static("public"));

import authv3 from './routes/v3/auth.js';
import userv3 from './routes/v3/user.js';
import channelv3 from './routes/v3/channel.js'
app.use("/v3/auth", authv3);
app.use("/v3/user", userv3);
app.use("/v3/channel", channelv3);
app.use("/v3/channel", channelv3);

import home from './routes/home.js';
app.use("/", home)

app.all("*", (req, res) => {
    res.reply(new NotFoundReply("Endpoint not found"));
})

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Optional fallthrough error handler
app.use((err, req, res, next) => {
    console.error(err);
    Sentry.addBreadcrumb({
        message: "Unhandled server error"
    })
    res.reply(new ServerErrorReply());
});

import gateway from './routes/v1/gateway.js';
import PermissionManager from "./classes/permissions/PermissionManager.js";
import NotFoundReply from "./classes/reply/NotFoundReply.js";
import DefaultRole from "./migrations/DefaultRole.js";
import ServerErrorReply from "./classes/reply/ServerErrorReply.js";
import Database from "./db.js";

const database = new Database();


let port = process.env.LQ_PORT || 10000;
let dbReady = false;
let unleashReady = false;

database.events.on("ready", () => {
    dbReady = true;
    startServer();
});

unleash.on('synchronized', () => {
    console.debug("Unleash ready")
    unleashReady = true;
    startServer();
});

async function startServer() {
    if (!dbReady) return;
    if (!unleashReady) return;
    // Start migrations
    await DefaultRole();

    // Misc
    const grants = PermissionManager.permissions.OWNER.permission.grants("WRITE_MESSAGE");
    console.debug(`Owner grants WRITE_MESSAGE? ${grants ? "yes" : "no"}`)
    if (!grants) {
        console.error("HUH??? Exiting before things explode")
        return process.exit(1111)
    }

    // Run server and gateway
    const server = app.listen(port, () => {
        console.info(`App listening on ${port}`);
        kitty()
    })
    gateway(server);
}