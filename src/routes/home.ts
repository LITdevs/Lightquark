import express, {Request, Response, Router} from 'express';
import path from "path";

const router: Router = express.Router();

router.get('/', (req: Request, res: Response) => {
    res.send('Hello World!');
});

router.get("/v1/ping", (req : Request, res : Response) => {
	res.contentType("text/plain");
	res.send("pong");
})

router.get("/d/:quarkId/:channelId?/:messageId?", (req: Request, res: Response) => {
	let lqLink = `lightquark://${req.params.quarkId}${req.params.channelId ? `/${req.params.channelId}`: ""}${req.params.messageId ? `/${req.params.messageId}`: ""}`
	res.redirect(lqLink)
})

router.get("/features", (req: Request, res: Response) => {
	res.sendFile("public/features.html", {root: path.resolve()});
})


import fs from "fs";
const knownClients = JSON.parse(fs.readFileSync("src/util/knownClients.json").toString());
import CapabilityParser from "../util/CapabilityParser.js";
import ServerErrorReply from "../classes/reply/ServerErrorReply.js";

router.get("/features/:clientName", async (req: Request, res: Response) => {
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

export default router;