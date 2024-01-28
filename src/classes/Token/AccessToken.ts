import Token from "./Token.js";

export default class AccessToken extends Token {
    constructor(expiresAt : Date, scope: "LQ" = "LQ") {
        super("access", expiresAt, scope);
    }
}