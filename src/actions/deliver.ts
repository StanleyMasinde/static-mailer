import { Context } from "koa";
import { ApiKeyTable, EmailRequest, UserTable } from "../types";
import { mailer } from "../config/mailer";
import { database } from "../config/database";

/**
 * Receive an email and deliver it the use user's mailbox
 * @param ctx 
 */
export const deliverEmail = async (ctx: Context) => {
    const body = ctx.request.body as EmailRequest
    const keyInDB = await database<ApiKeyTable>('api_keys')
    .where('key', ctx.params.apiKey)
    .innerJoin<UserTable>('users', 'users.id', 'api_keys.user_id')
    .first('email')
    if (keyInDB) {
        sendSuccessResponse();
        return await mailer(keyInDB.email , body.subject, body.email, body.message)
    }
    return sendNotFoundResponse();

    function sendSuccessResponse() {
        ctx.status = 200;
        ctx.body = {
            message: "Message on it's way"
        };
        return
    }

    function sendNotFoundResponse() {
        ctx.status = 404;
        ctx.body = {
            message: "The provided API key is invalid"
        };
        return;
    }
}
