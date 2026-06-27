import { env } from './env';
import { createApp } from './app';
import { prisma } from './prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🍝  Backend Lasanharia ouvindo em http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} recebido, encerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
