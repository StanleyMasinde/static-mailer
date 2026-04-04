import koaRouter from '@koa/router'
import { ping } from '../actions/ping.js'
import { dashboard } from '../actions/dashboard.js'
import { serveOpenApiSpec } from '../actions/openapi.js'
import { docs } from '../actions/docs.js'

const router = new koaRouter()

router.get('/ping', ping)
router.get('/dashboard', dashboard)
router.get('/openapi.yaml', serveOpenApiSpec)
router.get('/docs', docs)

export const indexRoutes = () => router.routes()
export const allowedIndexMethods = () => router.allowedMethods({ throw: true })
