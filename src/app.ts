import dotEnv from 'dotenv'
import Koa from 'koa'
import { koaBody } from 'koa-body'
import { indexRoutes, allowedIndexMethods } from './routes'
import { publicApiRoutes, allowedPublicApiMethods } from './routes/publicapi'
import { authRoutes, allowedAuthMethods } from './routes/auth'
import { userRoutes, allowedUserMethods } from './routes/user'

// Configure dotenv
dotEnv.config()


const app = new Koa({ proxy: true })

// Middlewares
app.use(koaBody())
// Routes 
app.use(indexRoutes())
    .use(allowedIndexMethods())
    .use(publicApiRoutes())
    .use(allowedPublicApiMethods())
    .use(authRoutes())
    .use(allowedAuthMethods())
    .use(userRoutes())
    .use(allowedUserMethods())


export default app
