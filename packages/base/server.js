const PgDb = require('./lib/pgdb')
const express = require('express')
const cors = require('cors')
const { createServer } = require('http')
const checkEnv = require('check-env')
const compression = require('compression')
const timeout = require('connect-timeout')

const DEV = process.env.NODE_ENV && process.env.NODE_ENV !== 'production'

checkEnv([
  'DATABASE_URL',
  'SESSION_SECRET'
])

const {
  PORT,
  CORS_WHITELIST_URL,
  SESSION_SECRET,
  COOKIE_DOMAIN,
  COOKIE_NAME,
  ENGINE_API_KEY,
  IGNORE_SSL_HOSTNAME,
  REQ_TIMEOUT
} = process.env

// middlewares
const { express: { auth } } = require('@orbiting/backend-modules-auth')
const requestLog = require('./express/requestLog')

let pgdb
let server
let httpServer
let subscriptionServer
let engineLauncher

// if engine is part of the game, it will listen on PORT
// (clustered) workers thus must listen on another port (PORT-1).
const getWorkersPort = () => {
  if (ENGINE_API_KEY) {
    return PORT - 1
  }
  return PORT
}

// it's best to run this after start(), otherwise you might see connection error logs from
// the engine trying to connect to workers, which are not there yet (see startupTimeout below)
const runOnce = () => {
  // init apollo engine
  // https://www.apollographql.com/docs/engine/setup-standalone.html#apollo-engine-launcher
  // https://github.com/apollographql/apollo-engine-js#middleware-configuration
  // https://www.apollographql.com/docs/engine/proto-doc.html
  if (ENGINE_API_KEY) {
    const { ApolloEngineLauncher } = require('apollo-engine')
    engineLauncher = new ApolloEngineLauncher({
      apiKey: ENGINE_API_KEY,
      origins: [{
        requestTimeout: '60m',
        http: {
          // The URL that the Proxy should use to connect to your GraphQL server.
          url: `http://localhost:${getWorkersPort()}/graphql`
        }
      }],
      // Tell the Proxy on what port to listen, and which paths should
      // be treated as GraphQL instead of transparently proxied as raw HTTP.
      frontends: [{
        port: parseInt(PORT),
        endpoints: ['/graphql']
      }],
      logging: {
        level: 'INFO'
      }
    })

    // Start the Proxy; crash on errors.
    engineLauncher.start({
      startupTimeout: 20 * 1000 // give the worker(s) 20s to start up
    })
      .then(() => {
        console.log(`apollo-engine is running on http://localhost:${PORT}`)
      })
      .catch(err => {
        throw err
      })
  }
}

const start = async (
  executableSchema,
  middlewares,
  t,
  createGraphqlContext,
  workerId
) => {
  // connect to db
  pgdb = await PgDb.connect()

  server = express()
  httpServer = createServer(server)

  // prod only
  if (!DEV) {
    // enable compression
    server.use(compression())
    // trust first proxy
    server.enable('trust proxy')
    // redirect to https
    server.use((req, res, next) => {
      if (!req.secure && (!IGNORE_SSL_HOSTNAME || req.hostname !== IGNORE_SSL_HOSTNAME)) {
        res.redirect(`https://${req.hostname}${req.url}`)
      } else {
        next()
      }
    })
  }

  // add req._log()
  server.use(requestLog)

  // monitor timeouts
  if (REQ_TIMEOUT) {
    server.use(
      timeout(REQ_TIMEOUT, { respond: false }),
      (req, res, next) => {
        req.on('timeout', () => {
          console.log('request timedout:', req._log())
        })
        next()
      }
    )
  }

  // Once DB is available, setup sessions and routes for authentication
  auth.configure({
    server: server,
    secret: SESSION_SECRET,
    domain: COOKIE_DOMAIN || undefined,
    cookieName: COOKIE_NAME,
    dev: DEV,
    pgdb: pgdb
  })

  if (CORS_WHITELIST_URL) {
    const corsOptions = {
      origin: CORS_WHITELIST_URL.split(','),
      credentials: true,
      optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
    }
    server.use('*', cors(corsOptions))
  }

  if (executableSchema) {
    const graphql = require('./express/graphql')
    subscriptionServer = graphql(server, pgdb, httpServer, executableSchema, createGraphqlContext)
  }

  for (let middleware of middlewares) {
    await middleware(server, pgdb, t)
  }

  const port = getWorkersPort()
  const callback = () => {
    if (workerId) {
      console.info(`server (${workerId}) is running on http://localhost:${port}`)
    } else {
      console.info(`server is running on http://localhost:${port}`)
    }
  }
  return httpServer.listen(port, callback)
}

const close = () => {
  const { pubsub } = require('./lib/RedisPubSub')
  pubsub.getSubscriber().quit()
  pubsub.getPublisher().quit()
  subscriptionServer && subscriptionServer.close()
  httpServer && httpServer.close()
  engineLauncher && engineLauncher.stop()
  pgdb && pgdb.close()
  require('./lib/redis').quit()
  pgdb = null
  server = null
  httpServer = null
  subscriptionServer = null
  // TODO server leaks timers, force teardown for now
  console.info('forced server shutdown in 15s max')
  setTimeout(() => {
    process.exit(0)
  }, 15000)
}

module.exports = {
  runOnce,
  start,
  close
}
