import express from 'express';
import Auth from "../../../util/Auth.js";

const router = express.Router({
    mergeParams: true
});

/**
 * Get all roles in a quark
 */
router.get('/', Auth, (req, res) => {
    res.send(`Hello World! ${req.params.quarkId}`);
});

/**
 *
 */
router.post('/', Auth, (req, res) => {
    res.send('Hello World!');
});

router.get('/:id', Auth, (req, res) => {
    res.send(`Hello World! ${req.params.id}`);
});

router.patch('/:id', Auth, (req, res) => {
    res.send('Hello World!');
});

router.delete('/:id', Auth, (req, res) => {
    res.send('Hello World!');
});

export default router;