import { z } from 'zod';

/**
 * Validação do cadastro de matéria.
 *
 * Fica no pacote compartilhado para que o formulário do app aplique a mesma
 * regra que o servidor aplica na fronteira.
 */

/** Limite do nome. Cabe "Introdução à Administração Financeira" com folga. */
export const SUBJECT_NAME_MAX_LENGTH = 80;

export const subjectNameSchema = z
  .string({ message: 'Informe o nome da matéria.' })
  .trim()
  .min(1, 'Informe o nome da matéria.')
  .max(SUBJECT_NAME_MAX_LENGTH, `O nome deve ter no máximo ${SUBJECT_NAME_MAX_LENGTH} caracteres.`);

/**
 * Cor da matéria, em hex de seis dígitos.
 *
 * Seis dígitos e não três porque o app aplica transparência sobre ela
 * (`withOpacity`), e misturar os dois formatos obrigaria todo consumidor a
 * normalizar antes de usar. `null` quer dizer "sem cor escolhida".
 */
export const subjectColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor válida.');

export const createSubjectSchema = z.object({
  name: subjectNameSchema,
  color: subjectColorSchema.nullish(),
});
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

/**
 * Edição de matéria.
 *
 * Todos os campos são opcionais, mas um corpo vazio é recusado: pedir
 * alteração sem dizer o que alterar é erro de quem chama, não um PATCH que
 * não faz nada.
 */
export const updateSubjectSchema = z
  .object({
    name: subjectNameSchema.optional(),
    color: subjectColorSchema.nullish(),
  })
  .refine((value) => value.name !== undefined || value.color !== undefined, {
    message: 'Informe ao menos um campo para alterar.',
  });
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
