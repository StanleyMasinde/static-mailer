import koaRouter from "@koa/router"
import { login, register } from "../actions/auth"
import { validate } from "../actions/validate"

const router = new koaRouter({ prefix: '/auth' })

router.post('/register', register)
router.post('/login',
    validate({
        email: 'required',
        password: 'required'
    }),
    login)

export const authRoutes = () => router.routes()
export const allowedAuthMethods = () => router.allowedMethods()
