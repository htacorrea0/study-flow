import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/integrations/gemini/geminiClient', () => ({
  uploadFile: vi.fn(),
  generateContent: vi.fn(),
}));
vi.mock('../src/services/AvailabilityService', () => ({ get: vi.fn() }));
vi.mock('../src/services/SubjectService', () => ({ list: vi.fn() }));

import * as gemini from '../src/integrations/gemini/geminiClient';
import * as aiService from '../src/services/AiStudyPlanService';
import * as availabilityService from '../src/services/AvailabilityService';
import * as subjectService from '../src/services/SubjectService';

const uploadFile = vi.mocked(gemini.uploadFile);
const generateContent = vi.mocked(gemini.generateContent);

/** Formato devolvido pelo cliente do Gemini. */
const resposta = (text: string) => ({ text, finishReason: 'STOP', model: 'gemini-teste' });

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-11-09T12:00:00Z');

const PLANO = {
  title: 'Plano',
  summary: 'Resumo',
  totalWeeklyMinutes: 999,
  subjects: [{ name: 'Cálculo', priority: 'ALTA', weeklyMinutes: 120.4, topics: ['Limites'], reason: 'Prova' }],
  weeklySchedule: [
    { weekday: 'WEDNESDAY', sessions: [{ subject: 'Cálculo', topic: 'Derivadas', durationMinutes: 50 }] },
    { weekday: 'MONDAY', sessions: [{ subject: 'Cálculo', topic: 'Limites', durationMinutes: 70 }] },
    { weekday: 'FRIDAY', sessions: [] },
  ],
  tips: ['Durma bem'],
};

describe('AiStudyPlanService.chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(availabilityService.get).mockResolvedValue({
      days: [{ weekday: 'MONDAY', minutes: 90 }],
    } as never);
    vi.mocked(subjectService.list).mockResolvedValue([{ name: 'Cálculo' }] as never);
  });

  it('sobe o arquivo, anexa à última mensagem e devolve a referência', async () => {
    uploadFile.mockResolvedValue({ uri: 'https://g/files/abc', mimeType: 'application/pdf', name: 'plano.pdf' });
    generateContent.mockResolvedValue(resposta(JSON.stringify({ reply: 'Pronto!', studyPlan: PLANO })));

    const res = await aiService.chat(
      USER_ID,
      { messages: [{ role: 'user', text: '' }] },
      { buffer: Buffer.from('x'), mimeType: 'application/pdf', originalName: 'plano.pdf' },
      NOW,
    );

    expect(res.attachment).toEqual({ fileUri: 'https://g/files/abc', mimeType: 'application/pdf', name: 'plano.pdf' });
    const contents = generateContent.mock.calls[0]?.[0].contents ?? [];
    const ultima = contents[contents.length - 1];
    expect(ultima?.parts[0]).toEqual({ fileData: { fileUri: 'https://g/files/abc', mimeType: 'application/pdf' } });
    const texto = (ultima?.parts[1] as { text: string }).text;
    expect(texto).toContain('CONTEXTO DO APP');
    expect(texto).toContain('segunda: 90 min');
    expect(texto).toContain('Monte meu plano');
  });

  it('normaliza o plano: ordena os dias, tira dias vazios e recalcula o total', async () => {
    generateContent.mockResolvedValue(resposta('```json\n' + JSON.stringify({ reply: 'Ok', studyPlan: PLANO }) + '\n```'));

    const res = await aiService.chat(USER_ID, { messages: [{ role: 'user', text: 'Monte' }] }, null, NOW);

    expect(res.studyPlan?.weeklySchedule.map((d) => d.weekday)).toEqual(['MONDAY', 'WEDNESDAY']);
    expect(res.studyPlan?.totalWeeklyMinutes).toBe(120);
    expect(res.studyPlan?.subjects[0]?.weeklyMinutes).toBe(120);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('sem plano na resposta, devolve studyPlan null', async () => {
    generateContent.mockResolvedValue(resposta(JSON.stringify({ reply: 'Revisão espaçada é...' })));

    const res = await aiService.chat(USER_ID, { messages: [{ role: 'user', text: 'O que é?' }] }, null, NOW);

    expect(res).toEqual({ reply: 'Revisão espaçada é...', studyPlan: null, attachment: null });
  });

  it('texto que não é JSON vira a própria resposta', async () => {
    generateContent.mockResolvedValue(resposta('Olá! Posso ajudar.'));

    const res = await aiService.chat(USER_ID, { messages: [{ role: 'user', text: 'Oi' }] }, null, NOW);

    expect(res.reply).toBe('Olá! Posso ajudar.');
    expect(res.studyPlan).toBeNull();
  });

  it('reenvia o anexo antigo e o plano anterior no histórico', async () => {
    generateContent.mockResolvedValue(resposta(JSON.stringify({ reply: 'Ajustado' })));

    await aiService.chat(
      USER_ID,
      {
        messages: [
          { role: 'user', text: 'Plano', attachment: { fileUri: 'https://g/files/x', mimeType: 'application/pdf', name: 'a.pdf' } },
          { role: 'model', text: 'Pronto', studyPlan: { title: 'P' } },
          { role: 'user', text: 'Tire o sábado' },
        ],
      },
      null,
      NOW,
    );

    const contents = generateContent.mock.calls[0]?.[0].contents ?? [];
    const reais = contents.slice(-3);
    expect(reais[0]?.parts[0]).toEqual({ fileData: { fileUri: 'https://g/files/x', mimeType: 'application/pdf' } });
    expect(JSON.parse((reais[1]?.parts[0] as { text: string }).text)).toEqual({ reply: 'Pronto', studyPlan: { title: 'P' } });
  });
});
