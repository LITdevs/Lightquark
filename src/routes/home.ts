import express from 'express';
import path from "path";
import Database from "../db.js";
const db = new Database()

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

router.get("/developers/interoperability/preferenceSearch", (req, res) => {
	res.sendFile("public/preferenceSearch.html", {root: path.resolve()});
})

router.get("/developers/interoperability/api/preferences", async (req, res) => {
	const Preferences = db.Preferences

	let keys = await Preferences.aggregate([
		{
			$match: {
				key: { $not: {$size: 0} }
			}
		},
		{ $unwind: "$key" },
		{
			$group: {
				_id: {$toLower: '$key'},
				count: { $sum: 1 }
			}
		}
	]);

	res.json(keys)
})

router.get("/developers/interoperability/api/attributes", async (req, res) => {
	const Messages = db.Messages;

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
	//console.log(req.params.relevantIds)
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
import {pjson, unleash} from "../index.js";
import networkInformation from "../networkInformation.js";

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
	let Messages = db.Messages;
	let Quarks = db.Quarks;
	let Channels = db.Channels;

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

router.get("/v*/network", (req, res) => {
	networkInformation.version = pjson.version;
	networkInformation.capabilities = {
	    base: true, // Everything before capabilities was added
		userStatus: unleash.isEnabled("LQ_Status", res.locals.unleashContext), // User statuses
		friends: unleash.isEnabled("LQ_Friends", res.locals.unleashContext) // Friends
	}
	res.json(networkInformation);
})

export default router;