 type PermissionType =
    "READ_CHANNEL" | // Read channel information, and receive new messages, be listed in channel members
    "WRITE_MESSAGE" | // Send, delete and edit own messages in a channel. Requires READ_CHANNEL
    "READ_CHANNEL_HISTORY" | // Read channel history. Requires READ_CHANNEL
    "WRITE_ATTACHMENT" | // Send attachments in a channel. Requires WRITE_MESSAGE
    "USE_EXTERNAL_EMOJI" | // Use emotes from other quarks. Requires READ_CHANNEL
    "DELETE_OTHER_MESSAGE" | // Delete other people's messages. Requires READ_CHANNEL
    "MESSAGE_ADMIN" | // Requires MESSAGE_NORMAL, WRITE_ATTACHMENT, DELETE_OTHER_MESSAGE

    "EDIT_CHANNEL_DESCRIPTION" | // Edit channel description. Requires READ_CHANNEL
    "EDIT_CHANNEL_NAME" | // Edit channel name. Requires READ_CHANNEL
    "EDIT_CHANNEL" | // Edit channel information. Requires EDIT_CHANNEL_DESCRIPTION, EDIT_CHANNEL_NAME
    "DELETE_CHANNEL" | // Delete a channel. Requires EDIT_CHANNEL
    "CREATE_CHANNEL" | // Create channel
    "CHANNEL_MANAGER" | // Edit, delete, create channel. Requires EDIT_CHANNEL, DELETE_CHANNEL, CREATE_CHANNEL
    "CHANNEL_ADMIN" | // Edit, delete, create channel. Requires CHANNEL_MANAGER, MESSAGE_ADMIN

    /*
    "BAN_USER_CHANNEL" | // Ban users from a channel. Requires READ_CHANNEL
    "BAN_USER_QUARK" | // Ban users from a quark. Requires READ_CHANNEL, BAN_USER_CHANNEL
    "UNBAN_USER_CHANNEL" | // Unban users from a channel. Requires READ_CHANNEL
    "UNBAN_USER_QUARK" | // Unban users from a quark. Requires READ_CHANNEL, UNBAN_USER_CHANNEL
    */

     "CREATE_EMOTE" |
     "EDIT_EMOTE" |
     "DELETE_EMOTE" |
     "MANAGE_EMOTE" |

    "EDIT_QUARK_ICON" | // Change quark icon
    "EDIT_QUARK_NAME" | // Change quark name
    "EDIT_QUARK_DESCRIPTION" | // Change quark description
    "EDIT_QUARK_INVITE" | // Change quark invite
    "EDIT_QUARK_ROLES" | // Change quark roles
    "ASSIGN_ROLE" | // Assign roles to users
    //"NICKNAME_OTHER" | // Change other people's nicknames
    "MANAGE_QUARK" | // Role management, etc. Requires EDIT_QUARK_BASIC, EDIT_QUARK_INVITE, EDIT_QUARK_ROLES, ASSIGN_ROLE
    "ADMIN" | // General admin. Requires MANAGE_QUARK, CHANNEL_ADMIN, MESSAGE_ADMIN, BAN_USER_QUARK, UNBAN_USER_QUARK, NICKNAME_OTHER
    "OWNER"; // Owner of the quark, all permissions including quark deletion. Requires ADMIN
