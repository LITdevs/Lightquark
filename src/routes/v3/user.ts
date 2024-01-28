import express from 'express';
import Reply from "../../classes/reply/Reply.js";


const router = express.Router();

router.get("/", (req, res) => {
    res.reply(new Reply(200, true, {
        message: "Hello! This is V3"
    }))
})

export default router;
