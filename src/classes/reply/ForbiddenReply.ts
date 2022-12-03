import Reply from "./Reply.js";

class ForbiddenReply extends Reply {
    constructor(message? : string) {
        super(403, false, {message: message ? message : "Forbidden"});
    }
}

export default ForbiddenReply;