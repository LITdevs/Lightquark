import Reply from "./Reply.js";

class NotFoundReply extends Reply {
    constructor(message? : string) {
        super(404, false, {message: message ? message : "Not Found"});
    }
}

export default NotFoundReply;