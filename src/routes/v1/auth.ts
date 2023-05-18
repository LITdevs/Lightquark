import express from 'express';
import InvalidReplyMessage from "../../classes/reply/InvalidReplyMessage.js";
import db from "../../db.js";
import ServerErrorReply from "../../classes/reply/ServerErrorReply.js";
import NotFoundReply from "../../classes/reply/NotFoundReply.js";
import crypto from 'crypto';
import Reply from "../../classes/reply/Reply.js";
import * as jose from "jose";
import UnauthorizedReply from "../../classes/reply/UnauthorizedReply.js";
import {getNick} from "../../util/getNickname.js";

const router = express.Router();
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

router.all("*", (req, res) => {
    res.redirect(req.originalUrl.replace("/v1", "/v2"));
})

// TODO: Move to separate util file, or v2 auth
async function WsAuth(jwt) : Promise<false | object> {
    try {
         const { payload } = await jose.jwtVerify(jwt, secret, {
            issuer: 'Lightquark',
            audience: 'Lightquark-client',
        })
        return payload;
    } catch (e : any) {
        if (["ERR_JWT_CLAIM_VALIDATION_FAILED", "ERR_JWS_INVALID", "ERR_JWS_SIGNATURE_VERIFICATION_FAILED", "ERR_JWT_EXPIRED"].includes(e.code)) {
            return false;
        } else {
            console.error(e)
            return false;
        }
    }
}

export default router;
import { Auth } from "../v2/auth.js"; // V1 auth does not exist anymore. export v2 auth instead, so I don't need to update all the imports
export { Auth, WsAuth };