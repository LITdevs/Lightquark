import {unleash} from "../index.js";
import ForbiddenReply from "../classes/reply/ForbiddenReply.js";

export default function FeatureFlag (flagName : string) {
    return function (req, res, next) {
        if (unleash.isEnabled(flagName, res.locals.unleashContext)) return next();
        res.reply(new ForbiddenReply("You are not permitted to access this endpoint"))
    }
}