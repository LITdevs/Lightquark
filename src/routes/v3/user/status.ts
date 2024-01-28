import networkInformation from "../../../networkInformation.js";

/**
 * Turn status into a status without _id and userId, replace images with links to real images :tm:
 * @param status
 */
export function plainStatus(status) {
    if (!status) return undefined;
    status = status.toJSON();
    status.primaryImage = `${networkInformation.baseUrl}/v3/user/${status.userId}/status/primaryImage`
    status.secondaryImage = `${networkInformation.baseUrl}/v3/user/${status.userId}/status/secondaryImage`
    status._id = undefined;
    status.userId = undefined;
    status.__v = undefined;
    return status
}
