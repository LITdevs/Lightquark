import express, {Request, Response, Router} from 'express';
import { Auth } from './auth.js';
import InvalidReplyMessage from "../../classes/reply/InvalidReplyMessage.js";
import Reply from "../../classes/reply/Reply.js";

const router: Router = express.Router();

router.all("/", Auth, (req: Request, res: Response) => {
    res.status(400).json(new InvalidReplyMessage("Provide a user id"));
})

router.all("/:userId", Auth, (req: Request, res: Response) => {
    res.status(501).json(new Reply(501, false, {message: "Not implemented"}));
})

export default router;
