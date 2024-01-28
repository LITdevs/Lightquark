/**
 * Feed in raw user document, get out user object safe to send to client (email and such removed)
 * @param user
 */
export function safeUser(user) {
    return {
        username: user.username,
        _id: user._id,
        admin: user.admin,
        isBot: user.isBot,
        avatarUri: user.avatarUri,
        status: user.status
    }
}