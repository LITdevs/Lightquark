import db from "../db.js";

/**
 * Get a user's nickname
 * @param userId User ID to get nickname for
 * @param quarkId Quark ID to get quark-specific nickname
 * @returns {Promise<string>} Nickname
 */
export async function getNick(userId, quarkId = null) {
    let Nick = db.getNicks();
    let nicks = await Nick.find({userId: userId});

    // Find global nick if present, or fallback to username
    let globalNick = nicks.find((nick) => nick.scope === "global");
    if (!globalNick) {
        let LoginUser = db.getLoginUsers();
        let user = await LoginUser.findOne({_id: userId})
        globalNick = {nickname: user.username}
    }
    if (!quarkId) return globalNick.nickname;

    // Find quark nick if present, or fallback to global nick
    let quarkNick = nicks.find((nick) => nick.scope.toString() === String(quarkId));
    if (!quarkNick) return globalNick.nickname;
    return quarkNick.nickname;
}