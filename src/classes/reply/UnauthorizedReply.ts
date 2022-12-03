import Reply from "./Reply.js";

class UnauthorizedReply extends Reply {
    constructor(message? : string) {
        super(401, false, { message: message ? message : "Unauthorized" });
    }
}

export default UnauthorizedReply;