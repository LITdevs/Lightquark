import express, {Request, Response, Router} from 'express';

const router: any = express.Router();

router.get("/", (req: Request, res: Response) => {
    res.status(501).send("<img src='https://http.cat/501'>");
})

export default router;