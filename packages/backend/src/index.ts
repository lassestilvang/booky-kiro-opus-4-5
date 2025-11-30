import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { buildApp } from './app.js';

async function main() {
  try {
    const app = await buildApp();

    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    logger.info(`Server running at http://${env.HOST}:${env.PORT}`);
    logger.info(`API documentation available at http://${env.HOST}:${env.PORT}/docs`);
  } catch (error) {
    logger.fatal(error, 'Failed to start server');
    process.exit(1);
  }
}

main();
