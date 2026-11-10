import type { RequestHandler } from 'express';
import { aiStudyPlanChatSchema, type AiStudyPlanChatResponse } from '@study-flow/shared';

import { BadRequestError, UnauthorizedError, ValidationError } from '../../errors/HttpErrors';
import { resolveMimeType } from '../../middlewares/UploadMiddleware';
import * as AiStudyPlanService from '../../services/AiStudyPlanService';

/**
 * POST /ai/study-plan/chat   (multipart/form-data)
 *
 * Campos:
 *   payload  texto JSON com `{ messages: AiChatMessage[] }`
 *   file     (opcional) o plano de aulas — PDF, imagem ou texto
 *
 * O `validateRequest` não serve aqui porque o corpo é multipart: o histórico
 * chega como texto e só vira objeto depois do `JSON.parse`. A validação é a
 * mesma, com o mesmo formato de erro (422).
 */
export const StudyPlanChatController: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticação necessária.');
  }

  const payloadRaw: unknown = (req.body as Record<string, unknown> | undefined)?.payload;
  if (typeof payloadRaw !== 'string') {
    throw new BadRequestError('Campo "payload" ausente.');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    throw new BadRequestError('Campo "payload" não é um JSON válido.');
  }

  const parsed = aiStudyPlanChatSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((issue) => ({
        path: ['payload', ...issue.path.map(String)].join('.'),
        message: issue.message,
      })),
    );
  }

  const file = req.file
    ? {
        buffer: req.file.buffer,
        mimeType: resolveMimeType(req.file),
        originalName: req.file.originalname || 'plano-de-aulas',
      }
    : null;

  const body: AiStudyPlanChatResponse = await AiStudyPlanService.chat(
    req.user.id,
    parsed.data,
    file,
    new Date(),
  );

  res.status(200).json(body);
};
