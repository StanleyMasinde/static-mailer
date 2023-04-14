import koaRouter from "@koa/router"
import { ping } from "../actions/ping"
import { deliverEmail } from "../actions/deliver"
import { validate } from "../actions/validate"

const router = new koaRouter()

router.post('/api/v1/deliver/:apiKey',
    validate({
        email: 'required|email',
        message: 'required'
    }),
    deliverEmail)

export const publicApiRoutes = () => router.routes()
export const allowedPublicApiMethods = () => router.allowedMethods()
