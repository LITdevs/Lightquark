import express from 'express';
import path from "path";

const router = express.Router();

router.get("/", (req, res) => {
	res.sendFile("public/index.html", {root: path.resolve()});
})

router.get("/developers/interoperability", (req, res) => {
	res.sendFile("public/interop.html", {root: path.resolve()});
})

router.get("/developers/interoperability/clientAttributeSearch", (req, res) => {
	res.sendFile("public/clientAttributeSearch.html", {root: path.resolve()});
})

router.get("/developers/interoperability/api/attributes", async (req, res) => {
	const Messages = db.getMessages();

	// Perform black magic to find all keys in clientAttributes

	let keys = await Messages.aggregate([
		{ $unwind: "$specialAttributes" },
		{ $match: { "specialAttributes.type": "clientAttributes" } },
		{ $project: { _id: 0, keys: { $objectToArray: "$specialAttributes" } } },
		{ $unwind: "$keys" },
		{ $match: { "keys.k": { $ne: "type" } } },
		{
			$group: {
				_id: "$keys.k",
				count: { $sum: 1 }
			}
		},
		{ $project: { _id: 0, key: "$_id", count: 1 } }
	]);

	res.json(keys);
})

router.get("/v1/ping", (req, res ) => {
	res.contentType("text/plain");
	res.send("pong");
})

router.get("/d/:linkType/*", (req, res) => {
	req.params.relevantIds = req.originalUrl.split(`/d/${req.params.linkType}`)[1]
	console.log(req.params.relevantIds)
	let lqLink = `web+lq://${networkInformation.linkBase}:${req.params.linkType}:${req.params.relevantIds}`
	res.redirect(lqLink)
	// TODO: Show a page explaining what LQ is and redirect with JS
})

router.get("/features", (req, res) => {
	res.sendFile("public/features.html", {root: path.resolve()});
})


import fs from "fs";
const knownClients = JSON.parse(fs.readFileSync("src/util/knownClients.json").toString());
import CapabilityParser from "../util/CapabilityParser.js";
import ServerErrorReply from "../classes/reply/ServerErrorReply.js";
import db from "../db.js";
import {networkInformation} from "../index.js";

router.get("/features/:clientName", async (req, res) => {
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

router.get("/v*/stats", (req, res ) => {
	let Messages = db.getMessages();
	let Quarks = db.getQuarks();
	let Channels = db.getChannels();

	let messageCount
	let quarkCount
	let channelCount

	let earliestMessage
	let latestMessage

	let messageCountPromise = Messages.countDocuments().then(count => {
		messageCount = count
	});
	let quarkCountPromise = Quarks.countDocuments().then(count => {
		quarkCount = count
	});

	let channelCountPromise = Channels.countDocuments().then(count => {
		channelCount = count
	});

	let earliestMessagePromise = Messages.findOne().sort({timestamp: 1}).then(message => {
		earliestMessage = message.timestamp
	});

	let latestMessagePromise = Messages.findOne().sort({timestamp: -1}).then(message => {
		latestMessage = message.timestamp
	});

	Promise.all([messageCountPromise, quarkCountPromise, channelCountPromise, earliestMessagePromise, latestMessagePromise]).then(() => {
		res.json({
			messageCount,
			quarkCount,
			channelCount,
			earliestMessage,
			latestMessage
		})
	})
})

export default router;