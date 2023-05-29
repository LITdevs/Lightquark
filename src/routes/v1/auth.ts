import { Auth } from "../v2/auth.js"; // V1 auth does not exist anymore. export v2 auth instead, so I don't need to update all the imports
import { WsAuth } from "../../util/Auth.js";

export { Auth, WsAuth };