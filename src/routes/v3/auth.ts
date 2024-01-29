import express from 'express';
import InvalidReplyMessage from "../../classes/reply/InvalidReplyMessage.js";
import ServerErrorReply from "../../classes/reply/ServerErrorReply.js";
import Reply from "../../classes/reply/Reply.js";
import Auth from "../../util/Auth.js";
import RequiredProperties from "../../util/RequiredProperties.js";
import Database from "../../db.js";
import BadRequestReply from "../../classes/reply/BadRequestReply.js";
import {checkPassword, encryptPassword} from "../../util/Password.js";
import AccessToken from "../../classes/Token/AccessToken.js";
import RefreshToken from "../../classes/Token/RefreshToken.js";
import {Types} from "mongoose";
import Token from "../../classes/Token/Token.js";
import UnauthorizedReply from "../../classes/reply/UnauthorizedReply.js";

const router = express.Router();
const database = new Database()

router.post("/register", RequiredProperties([
    {
        property: "email",
        type: "string",
        regex: /^[^@]+@[^@]+$/  // a@a
    },
    {
        property: "password",
        type: "string"
    },
    {
        property: "username",
        type: "string",
        trim: true,
        minLength: 1,
        maxLength: 64
    }
]), async (req, res) => {
    try {
        if (await database.LoginUsers.findOne({email: req.body.email})) return res.reply(new InvalidReplyMessage("A user with this email already exists"));
        // FIXME Some limitations please? Email verification at least??
        let pwd = encryptPassword(req.body.password);
        let user = new database.LoginUsers({
            _id: new Types.ObjectId(),
            email: req.body.email,
            username: req.body.username.trim(),
            passwordHash: pwd.hashedPassword,
            salt: pwd.salt
        })
        await user.save();
        let token = new database.Token({
            access: new AccessToken(new Date(Date.now() + 1000 * 60 * 60 * 8)), // 8 hours
            refresh: new RefreshToken(),
            user: user._id
        })
        await token.save()
        return res.reply(new Reply(201, true, {
            message: "Account created",
            access_token: token.access,
            refresh_token: token.refresh
        }))
    } catch (e) {
        console.error(e);
        res.reply(new ServerErrorReply())
    }
})

router.post("/token", RequiredProperties([
    {
        property: "email",
        type: "string",
        regex: /^[^@]+@[^@]+$/  // a@a
    },
    {
        property: "password",
        type: "string"
    }
]), async (req, res) => {
    try {
        let user = await database.LoginUsers.findOne({email: req.body.email.trim()})
        if (!user) return res.reply(new BadRequestReply("Invalid email and password combination."))
        if (!user.passwordHash || !user.salt) return res.reply(new ServerErrorReply())
        if (!checkPassword(req.body.password, user.passwordHash, user.salt)) return res.reply(new BadRequestReply("Invalid email and password combination."))

        // Congratulations! The password is correct.
        let token = new database.Token({
            access: new AccessToken(new Date(Date.now() + 1000 * 60 * 60 * 8)), // 8 hours
            refresh: new RefreshToken(),
            user: user._id
        })
        await token.save();

        return res.json(new Reply(200, true, {
            message: "Here are your tokens!",
            token_type: "Bearer",
            access_token: token.access,
            refresh_token: token.refresh
        }))
    } catch (e) {
        console.error(e);
        res.reply(new ServerErrorReply())
    }
})

router.post("/refresh", RequiredProperties([
    {
        property: "accessToken",
        type: "string"
    },
    {
        property: "refreshToken",
        type: "string"
    }
]), async (req, res) => {
    try {
        let accessToken = Token.from(req.body.accessToken);
        let refreshToken = Token.from(req.body.refreshToken);
        if (accessToken.type !== "access") return res.reply(new BadRequestReply("accessToken is not access token"))
        if (refreshToken.type !== "refresh") return res.reply(new BadRequestReply("refreshToken is not refresh token"))

        let dToken = await refreshToken.isActive(); // This returns either token document or false
        if (!dToken) return res.reply(new UnauthorizedReply("Invalid token"))

        if (dToken.refresh !== refreshToken.token) return res.reply(new UnauthorizedReply("Invalid token"))
        if (dToken.access !== accessToken.token) return res.reply(new UnauthorizedReply("Invalid token"))

        dToken.access = new AccessToken(new Date(Date.now() + 1000 * 60 * 60 * 8), accessToken.scope); // Generate a new access token for 8 hours
        await dToken.save();
        return res.reply(new Reply(200, true, {
                message: "Token refreshed",
                accessToken: dToken.access,
                expiresInSec: 28800
            }));
    } catch (e: any) {
        if (e.message.startsWith("Invalid token:")) return res.reply(new BadRequestReply(e.message))
        console.error(e)
        return res.reply(new ServerErrorReply())
    }
})

export default router;
export { Auth };