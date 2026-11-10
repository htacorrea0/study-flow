import type { RequestHandler } from 'express';
import multer from 'multer';
import { AI_ACCEPTED_MIME_TYPES, AI_MAX_FILE_BYTES } from '@study-flow/shared';

import { BadRequestError } from '../errors/HttpErrors';

/**
 * Recebe UM arquivo `multipart/form-data` no campo `file`, em memória.
 *
 * Memória e não disco: o arquivo só existe para ser repassado ao Gemini e é
 * descartado no fim da requisição — nada fica gravado no servidor. O limite
 * de 15 MB mantém o consumo de memória previsível.
 *
 * Alguns celulares mandam PDF como `application/octet-stream`; nesse caso o
 * tipo é deduzido pela extensão do nome.
 */

const POR_EXTENSAO: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
};

const ACEITOS = new Set<string>(AI_ACCEPTED_MIME_TYPES);

/** Tipo efetivo do arquivo, corrigindo o `octet-stream` genérico. */
export function resolveMimeType(file: Express.Multer.File): string {
  const declarado = file.mimetype.toLowerCase().split(';')[0]?.trim() ?? '';
  if (ACEITOS.has(declarado)) return declarado;

  const extensao = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  return POR_EXTENSAO[extensao] ?? declarado;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AI_MAX_FILE_BYTES,
    files: 1,
    // O histórico da conversa vem em texto no campo `payload`.
    fieldSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (ACEITOS.has(resolveMimeType(file))) {
      callback(null, true);
      return;
    }
    callback(
      new BadRequestError(
        'Formato não suportado. Envie PDF, imagem (PNG/JPG) ou texto. Se o plano estiver em Word, salve como PDF.',
      ),
    );
  },
});

/** Middleware pronto: aceita o campo `file` e traduz os erros do multer. */
export function singleFileUpload(field = 'file'): RequestHandler {
  const handler = upload.single(field);

  return (req, res, next) => {
    handler(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError) {
        next(
          new BadRequestError(
            error.code === 'LIMIT_FILE_SIZE'
              ? `Arquivo grande demais. O limite é ${Math.round(AI_MAX_FILE_BYTES / 1024 / 1024)} MB.`
              : 'Não foi possível ler o arquivo enviado.',
          ),
        );
        return;
      }
      next(error);
    });
  };
}
