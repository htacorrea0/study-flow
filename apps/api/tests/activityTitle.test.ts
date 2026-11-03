import { describe, expect, it } from 'vitest';

import { tituloComNomeAtual, tituloDaPassada } from '../src/domain/planning/activityTitle';

describe('tituloDaPassada', () => {
  it('chama a primeira passada de estudo e as seguintes de revisão', () => {
    expect(tituloDaPassada(0, 'Análise nodal')).toBe('Estudar análise nodal');
    expect(tituloDaPassada(1, 'Análise nodal')).toBe('Revisar análise nodal');
    expect(tituloDaPassada(2, 'Análise nodal')).toBe('Revisar análise nodal');
  });
});

describe('tituloComNomeAtual', () => {
  it('troca o nome do conteúdo mantendo o verbo que o plano escolheu', () => {
    expect(tituloComNomeAtual('Estudar análise nodal', 'Análise de malhas')).toBe(
      'Estudar análise de malhas',
    );
    expect(tituloComNomeAtual('Revisar análise nodal', 'Análise de malhas')).toBe(
      'Revisar análise de malhas',
    );
  });

  it('não deixa o nome antigo em sessão nenhuma, nem nas já passadas', () => {
    const passada = tituloDaPassada(0, 'Teorema de Thévenin');

    expect(tituloComNomeAtual(passada, 'Teorema de Norton')).not.toContain('thévenin');
  });
});
