import * as dotEnv from 'dotenv'
dotEnv.config()

import Koa, { Context } from 'koa'
import { koaBody } from 'koa-body'
import { indexRoutes, allowedIndexMethods } from './routes'
import { publicApiRoutes, allowedPublicApiMethods } from './routes/publicapi'
import { authRoutes, allowedAuthMethods } from './routes/auth'
import { userRoutes, allowedUserMethods } from './routes/user'


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
    .use((ctx) => {
        ctx.status = 404;
        ctx.body = {
            errors: [
                {
                    status: 404,
                    code: 'not-found',
                    title: 'Not Found',
                    detail: 'The requested resource could not be found.'
                }
            ]
        };
    })

export default app
