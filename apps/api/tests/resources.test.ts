import { describe, expect, it } from 'vitest';

import {
  fatiarPorPassada,
  normalizarUrl,
  ordenarAcervo,
  SUGESTOES_POR_SESSAO,
} from '../src/domain/resources/suggestionPool';
import type { RawResource } from '../src/domain/resources/suggestionPool';

function bruto(url: string, type: RawResource['type'] = 'VIDEO'): RawResource {
  return { title: url, url, type, source: 'teste' };
}

describe('normalizarUrl', () => {
  it('ignora www, barra final e parâmetro de campanha', () => {
    expect(normalizarUrl('https://www.khanacademy.org/aula/?utm_source=x')).toBe(
      normalizarUrl('https://khanacademy.org/aula'),
    );
  });

  it('ignora a ordem dos parâmetros que importam', () => {
    expect(normalizarUrl('https://x.com/a?b=2&a=1')).toBe(normalizarUrl('https://x.com/a?a=1&b=2'));
  });

  it('não confunde páginas diferentes do mesmo site', () => {
    expect(normalizarUrl('https://x.com/a')).not.toBe(normalizarUrl('https://x.com/b'));
  });
});

describe('ordenarAcervo', () => {
  it('descarta o mesmo link vindo duas vezes com rastreio diferente', () => {
    const acervo = ordenarAcervo([
      bruto('https://www.youtube.com/watch?v=1&utm_source=busca'),
      bruto('https://youtube.com/watch?v=1'),
    ]);

    expect(acervo).toHaveLength(1);
  });

  it('alterna os tipos para que qualquer fatia tenha material variado', () => {
    const acervo = ordenarAcervo([
      bruto('https://v.com/1', 'VIDEO'),
      bruto('https://v.com/2', 'VIDEO'),
      bruto('https://a.com/1', 'ARTICLE'),
      bruto('https://e.com/1', 'EXERCISE_LIST'),
    ]);

    expect(acervo.map((item) => item.type)).toEqual([
      'VIDEO',
      'ARTICLE',
      'EXERCISE_LIST',
      'VIDEO',
    ]);
  });

  it('numera o rank em sequência, que é o que torna a fatia estável', () => {
    const acervo = ordenarAcervo([bruto('https://v.com/1'), bruto('https://v.com/2')]);

    expect(acervo.map((item) => item.rank)).toEqual([0, 1]);
  });
});

describe('fatiarPorPassada', () => {
  const acervo = Array.from({ length: 18 }, (_, i) => `link-${i}`);

  it('dá fatias sem link repetido nas três passadas de um conteúdo', () => {
    const fatias = [0, 1, 2].map((passada) => fatiarPorPassada(acervo, passada));
    const todos = fatias.flat();

    expect(todos).toHaveLength(3 * SUGESTOES_POR_SESSAO);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('dá a volta quando o acervo é menor do que a janela pediria', () => {
    const fatia = fatiarPorPassada(['a', 'b'], 3);

    expect(fatia).toHaveLength(2);
    expect([...fatia].sort()).toEqual(['a', 'b']);
  });

  it('devolve sempre a mesma fatia para a mesma passada', () => {
    expect(fatiarPorPassada(acervo, 2)).toEqual(fatiarPorPassada(acervo, 2));
  });

  it('devolve lista vazia quando não há acervo', () => {
    expect(fatiarPorPassada([], 0)).toEqual([]);
  });
});
