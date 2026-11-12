import type { FastifyLoggerOptions, FastifyRequest } from 'fastify';
import { PinoLoggerOptions } from 'fastify/types/logger.js';

const SENSITIVE_QUERY_PARAM_REGEX = /([?&](?:token|access_token)=)[^&]*/gi;

function redactSensitiveQueryParams(url: string): string {
  return url.replace(SENSITIVE_QUERY_PARAM_REGEX, '$1[redacted]');
}

type LoggerOptions = FastifyLoggerOptions & PinoLoggerOptions;

export const loggerOptions: LoggerOptions = {
  serializers: {
    req(req: FastifyRequest) {
      return {
        host: req.host,
        method: req.method,
        url: redactSensitiveQueryParams(req.url),
        remoteAddress: req.ip,
        remotePort: req.socket.remotePort,
      };
    },
  },
};
