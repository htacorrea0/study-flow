import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// O serviço é mockado: o alvo aqui é o contrato HTTP (multipart, validação,
// autenticação), não a conversa com o Gemini.
vi.mock('../src/services/AiStudyPlanService', () => ({ chat: vi.fn() }));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/security/token';
import * as aiService from '../src/services/AiStudyPlanService';

const app = createApp();
const chat = vi.mocked(aiService.chat);

const USER_ID = '11111111-1111-4111-8111-111111111111';

const RESPOSTA = { reply: 'Plano pronto!', studyPlan: null, attachment: null };

function bearer(): string {
  const { accessToken } = signAccessToken({ sub: USER_ID, email: 'ana@x.com' });
  return `Bearer ${accessToken}`;
}

const payload = JSON.stringify({ messages: [{ role: 'user', text: 'Oi' }] });

describe('POST /ai/study-plan/chat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devolve 200 com o corpo do serviço (sem arquivo)', async () => {
    chat.mockResolvedValue(RESPOSTA);

    const res = await request(app)
      .post('/ai/study-plan/chat')
      .set('Authorization', bearer())
      .field('payload', payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(RESPOSTA);
    expect(chat).toHaveBeenCalledWith(
      USER_ID,
      { messages: [{ role: 'user', text: 'Oi' }] },
      null,
      expect.any(Date),
    );
  });

  it('repassa o PDF recebido ao serviço', async () => {
    chat.mockResolvedValue(RESPOSTA);

    const res = await request(app)
      .post('/ai/study-plan/chat')
      .set('Authorization', bearer())
      .field('payload', payload)
      .attach('file', Buffer.from('%PDF-1.4 teste'), {
        filename: 'plano.pdf',
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(200);
    const arquivo = chat.mock.calls[0]?.[2];
    expect(arquivo?.mimeType).toBe('application/pdf');
    expect(arquivo?.originalName).toBe('plano.pdf');
  });

  it('recusa formato não suportado com 400', async () => {
    const res = await request(app)
      .post('/ai/study-plan/chat')
      .set('Authorization', bearer())
      .field('payload', payload)
      .attach('file', Buffer.from('PK'), {
        filename: 'plano.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(res.status).toBe(400);
    expect(chat).not.toHaveBeenCalled();
  });

  it('devolve 422 quando a última mensagem não é da pessoa', async () => {
    const res = await request(app)
      .post('/ai/study-plan/chat')
      .set('Authorization', bearer())
      .field('payload', JSON.stringify({ messages: [{ role: 'model', text: 'Oi' }] }));

    expect(res.status).toBe(422);
    expect(chat).not.toHaveBeenCalled();
  });

  it('devolve 400 sem payload', async () => {
    const res = await request(app)
      .post('/ai/study-plan/chat')
      .set('Authorization', bearer())
      .field('outro', 'x');

    expect(res.status).toBe(400);
  });

  it('devolve 401 sem Bearer e não chega ao serviço', async () => {
    const res = await request(app).post('/ai/study-plan/chat').field('payload', payload);

    expect(res.status).toBe(401);
    expect(chat).not.toHaveBeenCalled();
  });
});
