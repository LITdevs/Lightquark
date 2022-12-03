import Reply from "./Reply.js";

class ServerErrorReply extends Reply {
    constructor() {
        super(500, false, {message: "Internal Server Error"});
    }
}


export default ServerErrorReply;