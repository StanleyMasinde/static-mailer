import koaRouter from '@koa/router'
import { ping } from '../actions/ping.js'
import { dashboard } from '../actions/dashboard.js'

const router = new koaRouter()

router.get('/ping', ping)
router.get('/dashboard', dashboard)

export const indexRoutes = () => router.routes()
export const allowedIndexMethods = () => router.allowedMethods()
