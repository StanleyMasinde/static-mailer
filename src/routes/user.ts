import koaRouter from "@koa/router"
import { validate } from "../actions/validate"
import { createApiKey } from "../actions/apiKey"
import { authorize } from "../actions/auth"

const router = new koaRouter()

router.prefix('/user')
    .post('/apiKeys', authorize, validate({ name: 'required' }), createApiKey)

export const userRoutes = () => router.routes()
export const allowedUserMethods = () => router.allowedMethods()