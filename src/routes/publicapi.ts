import koaRouter from "@koa/router"
import { ping } from "../actions/ping"
import { deliverEmail } from "../actions/deliver"

const router = new koaRouter()

router.post('/api/v1/deliver', deliverEmail)

export const publicApiRoutes = () => router.routes()
export const allowedPublicApiMethods = () => router.allowedMethods()
