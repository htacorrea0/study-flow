import type { Server } from 'node:http';
import { networkInterfaces } from 'node:os';

import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

/**
 * Ponto de entrada da API.
 *
 * Responsabilidades: subir o servidor HTTP e desligá-lo com ordem. Nenhuma
 * rota, nenhum middleware e nenhuma regra de negócio moram aqui.
 *
 * As migrations NÃO são aplicadas por este arquivo: quem faz isso é o script
 * `npm run dev:api`, que roda `prisma migrate deploy` antes de iniciar o
 * processo. Manter a infraestrutura fora do runtime deixa o comportamento
 * previsível e não atrapalha os testes.
 */

/**
 * IP da máquina na rede local.
 *
 * O Expo Go roda no celular: ele precisa do IP da LAN, não de `localhost`.
 * Imprimir isso no boot poupa o time de descobrir o IP na mão.
 */
function findLanAddress(): string | null {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return null;
}

const app = createApp();

const server: Server = app.listen(env.PORT, env.HOST, () => {
  const host = env.HOST === '0.0.0.0' ? 'localhost' : env.HOST;

  console.log(`\n  Study Flow API — ambiente: ${env.NODE_ENV}`);
  console.log(`  Local:    http://${host}:${env.PORT}`);
  console.log(`  Saúde:    http://${host}:${env.PORT}/health`);

  if (env.HOST === '0.0.0.0') {
    const lan = findLanAddress();
    console.log(
      lan
        ? `  Celular:  http://${lan}:${env.PORT}`
        : `  Celular:  IP da LAN não encontrado — veja o README`,
    );
  }
  console.log('');
});

/**
 * Desligamento gracioso: para de aceitar conexões novas, deixa as em curso
 * terminarem e só então fecha o pool do Prisma. Sem isso, cada reinício do
 * `tsx watch` deixaria conexões penduradas no PostgreSQL.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} recebido, encerrando...`);

  server.close(() => {
    void prisma
      .$disconnect()
      .then(() => {
        console.log('Encerrado.');
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error('Falha ao desconectar do banco:', error);
        process.exit(1);
      });
  });

  // Rede de segurança: se algo travar, não fica preso para sempre.
  setTimeout(() => {
    console.error('Encerramento demorou demais, forçando saída.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
