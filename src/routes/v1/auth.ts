import express from 'express';

const router = express.Router();

router.all("*", (req, res) => {
    res.redirect(req.originalUrl.replace("/v1", "/v2"));
})

export default router;
import { Auth } from "../v2/auth.js"; // V1 auth does not exist anymore. export v2 auth instead, so I don't need to update all the imports
import { WsAuth } from "../../util/Auth.js";

export { Auth, WsAuth };