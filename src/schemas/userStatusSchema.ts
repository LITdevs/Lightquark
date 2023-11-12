import * as Mongoose from "mongoose";

export const STATUS_TYPES = ["playing", "watching", "listening", "plain"]

export default new Mongoose.Schema({
    _id: Mongoose.Types.ObjectId,
    userId: {type: Mongoose.Types.ObjectId, unique: true, required: true}, // Who
    type: {type: String, enum: STATUS_TYPES, required: true}, // Type of status, this can be used by clients for special rendering
    content: {type: String, required: true}, // Song name/Video name/Game name/Plaintext status text
    primaryImage: {type: String}, // Base64 representation of the cover art/game icon etc
    primaryLink: {type: String}, // Primary link, to the song/game etc
    secondaryImage: {type: String}, // Base64 representation of the secondary image, music platform etc.
    secondaryLink: {type: String}, // Link of the secondary image, such as to the platform
    startTime: {type: Date}, // How long has the current activity lasted
    endTime: {type: Date}, // If end time is known (like a song) the client can provide this
    paused: {type: Boolean} // Mainly for video/music
});