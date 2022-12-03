import Reply from "./Reply.js";

class InvalidReply extends Reply {
    constructor(response: object) {
        super(400, false, response);
    }
}

export default InvalidReply;