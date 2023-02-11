interface IReply {
    request: {
        status_code: number,
        success: boolean
    },
    response: any
}

class Reply implements IReply {
    request: { status_code: number; success: boolean };
    response: any;

    constructor(statusCode: number, success: boolean, response: object) {
        this.request = {
            status_code: statusCode,
            success: success
        };
        this.response = response;
        this.response.cat = `https://http.cat/${statusCode}`;
    }
}

export {Reply as default, IReply}
