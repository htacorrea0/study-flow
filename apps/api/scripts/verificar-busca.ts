import { env } from '../src/config/env';
import type { ResourceSearchProvider } from '../src/providers/ResourceSearchProvider';
import { youTubeSearchProvider } from '../src/providers/YouTubeSearchProvider';

/**
 * Confere se as chaves de busca estão valendo, sem gravar nada no banco.
 *
 * Roda o mesmo provedor que a API usa, com uma consulta de exemplo, e mostra
 * os primeiros resultados. A chave nunca é impressa: o que aparece é se o
 * provedor está configurado e se a busca voltou com material.
 */

const CONSULTA = process.argv.slice(2).join(' ') || 'matemática logaritmos aula';
const PROVEDORES: readonly ResourceSearchProvider[] = [youTubeSearchProvider];

async function main(): Promise<void> {
  console.log(`Consulta: ${CONSULTA}\n`);

  if (!env.temBuscaDeMaterial) {
    console.log('Nenhuma chave configurada em apps/api/.env.');
    console.log('A API sobe assim mesmo e a tela de sessão avisa que não há sugestão.');
    console.log('O passo a passo de onde tirar cada chave está em apps/api/.env.example.');
    return;
  }

  for (const provedor of PROVEDORES) {
    if (!provedor.configurado) {
      console.log(`${provedor.nome}: sem chave, ignorado.`);
      continue;
    }

    const achados = await provedor.buscar(CONSULTA, 5);
    if (achados.length === 0) {
      console.log(`${provedor.nome}: respondeu, mas sem resultado. Chave inválida, cota estourada`);
      console.log('  ou API não habilitada no projeto do Google Cloud.');
      continue;
    }

    console.log(`${provedor.nome}: ${achados.length} resultados`);
    for (const achado of achados) {
      console.log(`  [${achado.type}] ${achado.title}`);
      console.log(`         ${achado.url}`);
    }
  }
}

void main();
