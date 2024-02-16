import UnauthorizedReply from "../classes/reply/UnauthorizedReply.js";
import Database from "../db.js";
const database = new Database()
import ServerErrorReply from "../classes/reply/ServerErrorReply.js";
import Reply from "../classes/reply/Reply.js";
import Token from "../classes/Token/Token.js";

export default async function Auth(req, res, next) {
    if (!req.headers.authorization) return res.reply(new UnauthorizedReply("Missing Authorization header with Bearer token"))
    if (!req.headers.authorization.startsWith("Bearer")) return res.reply(new UnauthorizedReply("Authorization header does not contain Bearer token"))
    let splitHeader = req.headers.authorization.split(" ");
    if (!splitHeader[1]) return res.reply(new UnauthorizedReply("Authorization header does not contain Bearer token"))
    let token = splitHeader[1]
    try {
        let oToken = Token.from(token);
        if (oToken.scope !== "LQ") return res.reply(new Reply(418, // lul
            false,
            {message: "Bearer token is not for this service"}))
        if (oToken.type !== "access") return res.reply(new UnauthorizedReply("Bearer token is not access token"))

        // Wowie! We made it through all those checks... surely this token is real?
        let dToken = await oToken.isActive(); // This returns either token document or false
        if (!dToken) return res.reply(new UnauthorizedReply("Invalid token"))
        dToken.user.populate()
        res.locals.user = dToken.user;
        req.user = dToken.user;
        res.locals.dToken = dToken
        next();

    } catch (e : any) {
        if (e.message.startsWith("Invalid token:")) return res.reply(new UnauthorizedReply(e.message))
        console.error(e)
        return res.reply(new ServerErrorReply())
    }
}

export async function WsAuth(token : string) : Promise<false | object> {
    try {
        let oToken = Token.from(token);
        if (oToken.scope !== "LQ") return false;
        if (oToken.type !== "access") return false;

        // Wowie! We made it through all those checks... surely this token is real?
        let dToken = await oToken.isActive(); // This returns either token document or false
        if (!dToken) return false;
        dToken.user.populate()
        return dToken.user

    } catch (e : any) {
        if (!e.message.startsWith("Invalid token:")) console.error(e)
        return false;
    }
}