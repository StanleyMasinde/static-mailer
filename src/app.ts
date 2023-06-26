import * as dotEnv from 'dotenv'
dotEnv.config()

import Koa, { Context } from 'koa'
import { koaBody } from 'koa-body'
import * as Sentry from "@sentry/node";
import { indexRoutes, allowedIndexMethods } from './routes'
import { publicApiRoutes, allowedPublicApiMethods } from './routes/publicapi'
import { authRoutes, allowedAuthMethods } from './routes/auth'
import { userRoutes, allowedUserMethods } from './routes/user'


const app = new Koa({ proxy: true })

Sentry.init({ dsn: "https://1c887bd73ffd4a8289ba59f77171e47d@o4505426541281280.ingest.sentry.io/4505426543837184" });

app.on("error", (err, ctx) => {
  Sentry.withScope(function (scope) {
    scope.addEventProcessor(function (event) {
      return Sentry.addRequestDataToEvent(event, ctx.request);
    });
    Sentry.captureException(err);
  });
});


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
