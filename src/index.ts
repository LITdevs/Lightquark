import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import db from "./db.js";
import fs from "fs";
import { initialize } from 'unleash-client';
export const networkInformation = JSON.parse(fs.readFileSync("network.json").toString());
const pjson = JSON.parse(fs.readFileSync("package.json").toString());
const app = express();

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
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "*");

    // Define reply method, to set status code accordingly
    res.reply = (reply) => {
        res.status(reply.request.status_code).json(reply);
    }

    next();
})

app.use("/v1/auth", authv2);
app.use("/v1/user", userv2);
app.use("/v1/quark", quarkv2);
app.use("/v1/channel", channelv2);
app.use("/", express.static("public"));
import authv2 from './routes/v2/auth.js';
import userv2 from './routes/v2/user.js';
import quarkv2 from './routes/v2/quark.js';
import channelv2 from './routes/v2/channel.js';
app.use("/v2/auth", authv2);
app.use("/v2/user", userv2);
app.use("/v2/quark", quarkv2);
app.use("/v2/channel", channelv2);

import home from './routes/home.js';
app.use("/", home)

app.get("/v*/network", (req, res) => {
    networkInformation.version = pjson.version;
    res.json(networkInformation);
})
/*
app.post("/roleCreateTest", async (req, res) => {
    let Role = db.getRoles();
    let role = new Role({
        name: "Test Role",
        color: "#000000",
        quark: "643aa2e550c913775aec2058",
        description: "This is a test role",
        createdBy: "646893a40ca841fd8e8f953e",
        priority: 0
    })
    await role.save();
    res.json(role);
})

app.get("/roleGetTest", async (req, res) => {
    let Role = db.getRoles();
    console.time("roleGetTest")
    // Find role 646894100df66a3fc81e0919 and populate permissionAssignments
    let role = await Role.findById("646897a40644cbd91f00d400").populate("permissionAssignments").populate("roleAssignments");
    console.timeEnd("roleGetTest")
    res.json(role);
})

app.get("/paGetTest", async (req, res) => {
    let PA = db.getPermissionAssignments();
    console.time("paGetTest")
    // Find role 646894100df66a3fc81e0919 and populate permissionAssignments
    let pa = await PA.findById("646898dbefcff8c704e31f19").populate("role");
    console.timeEnd("paGetTest");
    res.json(pa);
})


app.post("/permissionCreateTest", async (req, res) => {
    let PermissionAssignment = db.getPermissionAssignments();
    let pa = new PermissionAssignment({
        role: "646897a40644cbd91f00d400",
        permission: "ADMIN",
        type: "allow",
        scopeType: "quark",
        scopeId: "643aa2e550c913775aec2058"
    })
    await pa.save();
    res.json(pa);
})
app.post("/raCreateTest", async (req, res) => {
    let RoleAssignment = db.getRoleAssignments();
    let ra = new RoleAssignment({
        role: "646897a40644cbd91f00d400",
        user: "646893a40ca841fd8e8f953e"
    })
    await ra.save();
    res.json(ra);
})
*/

app.get("/pmTest", async (req, res) => {
    res.json({message: await PermissionManager.isPermitted("READ_CHANNEL", "62b3515989cdb45c9e06e010", {scopeType: "channel", scopeId: "643aa2e550c913775aec2057"})});
})

app.all("*", (req, res) => {
    res.reply(new NotFoundReply("Endpoint not found"));
})

import gateway from './routes/v1/gateway.js';
import PermissionManager from "./classes/permissions/PermissionManager.js";
import NotFoundReply from "./classes/reply/NotFoundReply.js";
import DefaultRole from "./migrations/DefaultRole.js";

let port = process.env.LQ_PORT || 10000;
let dbReady = false;
let loginReady = false;
let unleashReady = false;
db.dbEvents.on("login_ready", () => {
    console.debug("Login database ready")
    loginReady = true;
    if (unleashReady && dbReady) startServer();
});

db.dbEvents.on("lq_ready", () => {
    console.debug("Database ready")
    dbReady = true;
    if (loginReady && dbReady) startServer();
});

unleash.on('synchronized', () => {
    console.debug("Unleash ready")
    unleashReady = true;
    if (dbReady && loginReady) startServer();
});

function startServer() {
    // Start migrations
    DefaultRole();

    // Misc
    const grants = PermissionManager.permissions.OWNER.permission.grants("WRITE_MESSAGE");
    console.debug(`Owner grants WRITE_MESSAGE? ${grants ? "yes" : "no"}`)

    // Run server and gateway
    const server = app.listen(port, () => {
        console.info(`App listening on ${port}`);
    })
    gateway(server);;
}