import koaRouter from "@koa/router"
import { authorize, login, me, register } from "../actions/auth"
import { validate } from "../actions/validate"

const router = new koaRouter({ prefix: '/auth' })

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

export const authRoutes = () => router.routes()
export const allowedAuthMethods = () => router.allowedMethods()
