-- A profundidade de estudo deixa de ser da matéria e passa a ser do
-- conteúdo: numa mesma prova, o assunto dominado pede uma passada e o que
-- trava pede três. Cada conteúdo herda o que estava na matéria dele para que
-- nenhum plano existente mude de forma sozinho.

-- AlterTable
ALTER TABLE "study_contents" ADD COLUMN "depth" "StudyDepth" NOT NULL DEFAULT 'INTERMEDIATE';

UPDATE "study_contents" AS c
SET "depth" = s."depth"
FROM "assessments" AS a
JOIN "subjects" AS s ON s."id" = a."subjectId"
WHERE a."id" = c."assessmentId";

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "depth";
