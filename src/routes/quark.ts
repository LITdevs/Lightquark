import express, {Request, Response, Router} from 'express';
import Reply from "../classes/reply/Reply.js";
import { Auth } from './auth.js';

const router: Router = express.Router();

/**
 * Get users quarks
 */
router.get("/me", Auth, (req, res) => {
    //res.send(new Reply(200, true, {message: "Here is the data from your JWT, it is valid", jwtData: res.locals.user}));
});

export default router;