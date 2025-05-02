import koaRouter from '@koa/router'
import { ping } from '../actions/ping.js'

const router = new koaRouter()

router.get('/ping', ping)

export const indexRoutes = () => router.routes()
export const allowedIndexMethods = () => router.allowedMethods()
