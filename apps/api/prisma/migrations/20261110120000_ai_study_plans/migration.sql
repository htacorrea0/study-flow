-- Último plano de estudos sugerido pelo assistente Gemini, um por pessoa.

-- CreateTable
CREATE TABLE "ai_study_plans" (
    "userId" UUID NOT NULL,
    "plan" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_study_plans_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "ai_study_plans" ADD CONSTRAINT "ai_study_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
