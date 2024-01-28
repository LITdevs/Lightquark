import Token from "./Token.js";

export default class RefreshToken extends Token {
    constructor(scope: "LQ" = "LQ") {
        super("refresh", new Date(0), scope);
    }
}