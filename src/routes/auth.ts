import koaRouter from "@koa/router"
import { login, register } from "../actions/auth"

const router = new koaRouter({ prefix: '/auth' })

router.post('/register', register)
router.post('/login', login)

export const authRoutes = () => router.routes()
export const allowedAuthMethods = () => router.allowedMethods()
