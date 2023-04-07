import { Context } from "koa";

/**
 * Ping the API
 * @param context Koa context
 */
export const ping = (context: Context) => {
    context.status = 200
    context.body = {
        message: "Pong"
    }
}