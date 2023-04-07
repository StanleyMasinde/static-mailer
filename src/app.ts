import dotEnv from 'dotenv'
import Koa from 'koa'
import { indexRoutes, allowedIndexMethods } from './routes'

// Configure dotenv
dotEnv.config()


const app = new Koa()

app.use(indexRoutes())
app.use(allowedIndexMethods())

export default app
