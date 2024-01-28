import * as crypto from "crypto";

/**
 * Encrypts a password
 * @param password
 * @returns {hashedPassword: Buffer, salt: Buffer}}
 */
export function encryptPassword(password) : {hashedPassword: Buffer, salt: Buffer} {
    let salt : Buffer = crypto.randomBytes(32);
    let hashedPassword : Buffer = crypto.pbkdf2Sync(Buffer.from(password), salt, 310000, 32, 'sha256');
    return {
        hashedPassword,
        salt
    }
}

/**
 * Checks if a password is correct
 * @param password
 * @param hashedPassword
 * @param salt
 * @returns boolean
 */
export function checkPassword(password, hashedPassword, salt) : boolean {
    let passwordToCheck : Buffer = crypto.pbkdf2Sync(Buffer.from(password), salt, 310000, 32, 'sha256');
    return crypto.timingSafeEqual(passwordToCheck, hashedPassword);
}