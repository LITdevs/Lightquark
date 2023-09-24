import express from "express";
import Auth from "../../../util/Auth.js";
import FeatureFlag from "../../../util/FeatureFlagMiddleware.js";
import db from "../../../db.js";
import Reply from "../../../classes/reply/Reply.js";

const router = express.Router({
    mergeParams: true
});

// Kill switch
router.use(FeatureFlag("LQ_Preferences"));
router.use(async (req, res, next) => {
    req.params.key = req.params.key.toLowerCase();
})

router.get("/", Auth, async (req, res) => {
    let Preferences = db.getPreferences();
    let preferences = await Preferences.find({userId: res.locals.user._id});
    res.reply(new Reply(200, true, {
        message: "Preferences retrieved",
        preferences
    }))
})

router.put("/:key", Auth, async (req, res) => {
    let Preferences = db.getPreferences();

    // Upsert preference
    let preferenceData = {userId: res.locals.user._id, key: req.params.key, value: req.body.value};
    let preference = await Preferences.findOneAndUpdate(
        {userId: res.locals.user._id, key: req.params.key}, // Query
        preferenceData, // New value
        {upsert: true});

    res.reply(new Reply(200, true, {
        message: "Preference saved",
        oldPreference: preference,
        newPreference: preferenceData
    }))
})

router.delete("/:key", Auth, async (req, res) => {
    let Preferences = db.getPreferences();
    let preference = await Preferences.findOneAndDelete({userId: res.locals.user._id, key: req.params.key});
    res.reply(new Reply(200, true, {
        message: "Preference deleted",
        preference
    }))
})

export default router;