import Reply from "./Reply.js";

class NotFoundReply extends Reply {
    constructor(message? : string, success : boolean = false) {
        super(404, success, {message: message ? message : "Not Found"});
    }
}

export default NotFoundReply;