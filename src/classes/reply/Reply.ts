interface IReply {
    request: {
        status_code: number,
        success: boolean,
        cat: string
    },
    response: any
}

class Reply implements IReply {
    request: { status_code: number; success: boolean; cat: string; };
    response: any;

    constructor(statusCode: number, success: boolean, response: object) {
        this.request = {
            status_code: statusCode,
            success: success,
            cat: `https://http.cat/${statusCode}`
        };
        this.response = response;
    }
}

export {Reply as default, IReply}
