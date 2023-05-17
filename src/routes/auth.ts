import koaRouter from "@koa/router"
import { authorize, login, me, register, socialAuth } from "../actions/auth"
import { validate } from "../actions/validate"

const router = new koaRouter({ prefix: '/v1' })

router.post('/register',
    validate({
        name: 'required',
        email: 'required|email',
        password: 'required',
    }),
    register)

router.post('/login',
    validate({
        email: 'required|email',
        password: 'required'
    }),
    login)

router.get('/me', authorize, me)

router.post('/social-auth/:provider', socialAuth)

export const authRoutes = () => router.routes()
export const allowedAuthMethods = () => router.allowedMethods()
