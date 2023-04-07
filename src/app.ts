import dotEnv from 'dotenv'
import Koa from 'koa'
import { koaBody } from 'koa-body'
import { indexRoutes, allowedIndexMethods } from './routes'
import { publicApiRoutes, allowedPublicApiMethods } from './routes/publicapi'

// Configure dotenv
dotEnv.config()


const app = new Koa()

// Middlewares
app.use(koaBody())
// Routes 
app.use(indexRoutes())
.use(allowedIndexMethods())
.use(publicApiRoutes())
.use(allowedPublicApiMethods())


export default app
