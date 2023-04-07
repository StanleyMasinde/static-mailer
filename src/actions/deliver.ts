import { Context } from "koa";
import { EmailRequest } from "../types";
import { mailer } from "../config/mailer";

/**
 * Receive an email and deliver it the use user's mailbox
 * @param ctx 
 */
export const deliverEmail = (ctx: Context) => {
    const body = ctx.request.body as EmailRequest
    if(!body) {
        ctx.status = 400
        ctx.body = {
            message: 'Body required'
        }
        return
    }
    ctx.status = 200
    ctx.body = {
        message: "Messege on it's way"
    }
    mailer(body.subject, body.email, body.message)
}
