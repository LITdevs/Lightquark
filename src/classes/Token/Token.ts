// "why not a JWT"
// There is literally no good reason for all of this
// Why did I do this
import * as crypto from "crypto";
import Database from "../../db.js";

export default class Token {
    token: string;
    type: "access"|"refresh";
    expiresAt: Date;
    createdAt: Date;
    scope: "LQ";

    constructor(type: "access"|"refresh", expiry: Date = new Date(0), scope : string = "LQ") {
        let prefixPart = scope;
        // "Why is this a switch" For no good reason.
        switch (scope) {
            case "LQ":
                this.scope = "LQ";
                break;
            default:
                throw new Error(`Unknown token scope ${scope}`)
        }
        let typePart;
        switch (type) {
            case "access":
                typePart = "AC";
                break;
            case "refresh":
                typePart = "RE";
                break;
            default:
                throw new Error(`Unknown token type ${type}`)
        }
        let randomPart = crypto.randomBytes(48).toString("base64url");
        let currentTimePart = Date.now().toString(36);
        let expiryTimePart = expiry.getTime().toString(36);
        this.token = [prefixPart, typePart, randomPart, currentTimePart, expiryTimePart].join(".");
        this.expiresAt = expiry;
        this.type = type;
        this.createdAt = new Date(parseInt(currentTimePart, 36));
    }

    get expired() : boolean {
        if (this.type === "refresh") return true;
        return Date.now() > this.expiresAt.getTime()
    }

    /**
     * Invalidate token-refresh token pair
     * @returns {Promise<any>}
     */
    async invalidate() {
        let database;
        switch (this.scope) {
            default:
                database = new Database();
                break;
        }
        return await database.Token.deleteOne({$or: [{refresh: this.token}, {access: this.token}]});
    }

    async isActive() : Promise<any> {
        let database;
        let tokenDocument;
        switch (this.scope) {
            default:
                database = new Database();
                tokenDocument = await database.Token.findOne({$or: [{refresh: this.token}, {access: this.token}]}).populate("user");
                break;
        }

        if (!tokenDocument) return false;
        if (this.type === "refresh") return tokenDocument;
        return !this.expired ? tokenDocument : false;
    }

    /**
     * Get a Token from an existing token
     * @param token
     * @returns {Token}
     */
    static from(token: string) {
        let tokenInformation = Token.parse(token);
        let oToken = new Token(tokenInformation.type, tokenInformation.expiresAt, tokenInformation.scope);
        oToken.token = token;
        oToken.createdAt = tokenInformation.createdAt;
        return oToken;
    }

    toString() {
        return this.token;
    }

    static parse(token: string|Token) {
        // LQ.RE.fz_z_MVQj8UQ3lY_UmrUjekE_2U4dn8d4WIkfHqJ7ZQRN-O1BNu6xfKINhKCrv1I.ljlioshm.ljlirzu1
        // LQ.AC.fz_z_MVQj8UQ3lY_UmrUjekE_2U4dn8d4WIkfHqJ7ZQRN-O1BNu6xfKINhKCrv1I.ljlioshm.ljlirzu1
        // XX.YY.ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ.CCCCCCCC.EEEEEEEE
        // XX = LQ for scope Lightquark
        // YY = REfresh or ACcess?
        // ZZ = 64 randomly generated characters from 48 random baseurl encoded bytes
        // CC = Current timestamp milliseconds encoded in base36
        // EE = Expiry timestamp milliseconds encoded in base36
        // Length without timestamps: 70
        token = token.toString();
        let tokenParts = token.split(".");
        if (tokenParts.length !== 5) throw new Error(`Invalid token: should have 5 parts but has ${tokenParts.length}`);
        let [prefixPart, typePart, randomPart, creationTimePart, expiryTimePart] = tokenParts;

        if (!["LQ"].includes(prefixPart)) throw new Error(`Invalid token: prefix should be LQ but is ${prefixPart}`);

        if (!["RE", "AC"].includes(typePart)) throw new Error(`Invalid token: type should be RE or AC but is ${typePart}`);
        let type;
        if (typePart === "RE") type = "refresh";
        if (typePart === "AC") type = "access";

        let createdAt = new Date(parseInt(creationTimePart, 36));
        if (createdAt.toString() === "Invalid Date") throw new Error("Invalid token: invalid creation date");

        let expiresAt = new Date(parseInt(expiryTimePart, 36));
        if (expiresAt.toString() === "Invalid Date") throw new Error("Invalid token: invalid expiry date");
        if (type === "refresh" && expiryTimePart !== "0") throw new Error("Invalid token: refresh token cannot have expiry date")

        return {
            type,
            createdAt,
            expiresAt,
            scope: prefixPart
        }
    }
}