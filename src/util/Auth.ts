import UnauthorizedReply from "../classes/reply/UnauthorizedReply.js";
import * as jose from "jose";
import db from "../db.js";
import ServerErrorReply from "../classes/reply/ServerErrorReply.js";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export default async function Auth(req, res, next) {
    if (!req.headers?.authorization) return res.status(401).json(new UnauthorizedReply())
    let jwt = req.headers.authorization.split("Bearer ")[1];

    // Verify Jason Webb Telescope
    // jose.jwtVerify throws an error if the JWT is not valid so try {...} catch (e) it
    try {
        const { payload } = await jose.jwtVerify(jwt, secret, {
            issuer: 'Lightquark',
            audience: 'Lightquark-client',
        })
        // Store the data in locals
        res.locals.user = payload;

        // Update avatar from database
        let Avatars = db.getAvatars();
        try {
            let avatar = await Avatars.findOne({userId: payload._id});
            let avatarUri = avatar?.avatarUri;
            if (avatarUri) res.locals.user.avatar = avatarUri;
            res.locals.unleashContext = {
              userId: res.locals.user._id,
              remoteAddress: req.headers["cf-connecting-ip"],
            }

            return next();
        } catch (err) {
            console.error(err);
            return res.status(500).json(new ServerErrorReply());
        }
    } catch (e : any) {
        if (["ERR_JWT_CLAIM_VALIDATION_FAILED", "ERR_JWS_INVALID", "ERR_JWS_SIGNATURE_VERIFICATION_FAILED", "ERR_JWT_EXPIRED"].includes(e.code)) {
            return res.status(401).json(new UnauthorizedReply(e.code));
        } else {
            console.error(e)
            return res.status(500).json(new ServerErrorReply());
        }
    }
}