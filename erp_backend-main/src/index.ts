import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
} from 'fastify-type-provider-zod';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyWebsocket from '@fastify/websocket';
import fastifySensible from '@fastify/sensible';
import { ENV } from './env.js';
import { authHandler } from './modules/auth/auth.handler.js';
import { userHandler } from './modules/user/user.handler.js';
import { projectHandler } from './modules/project/project.handler.js';
import { taskHandler } from './modules/task/task.hanlder.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { rolePlugin } from './plugins/role.plugin.js';
import { prismaPlugin } from './plugins/prisma.plugin.js';
import { websocketHanlder } from './modules/websocket/websocket.handler.js';
import { workSegmentHandler } from './modules/worksegment/worksegment.handler.js';
import fastifyCookie from '@fastify/cookie';
import { authWebsocketPlugin } from './plugins/auth-websocket.plugin.js';
import fastifyCors from '@fastify/cors';
import fastifyRedis from '@fastify/redis';
import { loggerOptions } from './lib/logger-options.js';

const app = Fastify({
  logger:
    ENV.ENV === 'dev'
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
        }
      : loggerOptions,
});

let shuttingDown = false;

app.get('/health', async () => {
  return { ok: true };
});

// Sensible setup
await app.register(fastifySensible);

// Cookies setup
await app.register(fastifyCookie);

// CORS setup
await app.register(fastifyCors, {
  origin: ['http://localhost', ENV.FRONTEND_URL],
  credentials: true,
});

// Redis setup
await app.register(fastifyRedis, { url: ENV.REDIS_URL });

// Prisma setup
await app.register(prismaPlugin);

// Websocket setup
await app.register(fastifyWebsocket);

// Auth setup
await app.register(authPlugin);
await app.register(rolePlugin);
await app.register(authWebsocketPlugin);

// Zod setup
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Swagger setup
await app
  .register(fastifySwagger, {
    openapi: {
      info: {
        title: 'ERP API',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  })
  .register(fastifySwaggerUi, {
    routePrefix: '/swagger',
  });

// Handlers setup
await app
  .register(authHandler)
  .register(userHandler)
  .register(projectHandler)
  .register(taskHandler)
  .register(workSegmentHandler)
  .register(websocketHanlder);

async function run() {
  await app.ready();
  await app.listen({ port: ENV.PORT, host: '0.0.0.0' });
  if (process.send) {
    process.send('ready');
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'Shutting down server');

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ error, signal }, 'Failed to shut down gracefully');
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

run().catch((error) => {
  app.log.error({ error }, 'Failed to start server');
  process.exit(1);
});
