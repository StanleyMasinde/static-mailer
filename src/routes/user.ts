import koaRouter from "@koa/router"
import { validate } from "../actions/validate"
import { createApiKey, getUserApiKeys } from "../actions/apiKey"
import { authorize } from "../actions/auth"

const router = new koaRouter({ prefix: '/v1' })

router
    .post('/apiKeys', authorize, validate({ name: 'required' }), createApiKey)
    .get('/apiKeys', authorize, getUserApiKeys)
    .delete('/apiKeys/')

export const userRoutes = () => router.routes()
export const allowedUserMethods = () => router.allowedMethods()