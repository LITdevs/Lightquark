import InvalidReply from "./InvalidReply.js";

class InvalidReplyMessage extends InvalidReply {
    constructor(message: string) {
        super({message: message});
    }
}

export default InvalidReplyMessage