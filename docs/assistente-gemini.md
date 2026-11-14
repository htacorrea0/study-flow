# Assistente de plano de estudos (Gemini)

Botão flutuante com o ícone do Gemini, no canto inferior direito de todas as telas
logadas. Ao tocar, abre um chat em tela cheia onde a pessoa envia o plano de aulas
(PDF, foto ou texto) e o Gemini devolve um plano de estudos semanal com matérias,
tempo por matéria e sessões por dia — já respeitando a disponibilidade cadastrada no app.

---

## 1. Ativar (só a chave)

1. Gere a chave em <https://aistudio.google.com/app/apikey> → **Create API key**.
2. Abra `apps/api/.env` e preencha:

   ```env
   GEMINI_API_KEY=cole_sua_chave_aqui
   GEMINI_MODEL=gemini-flash-lite-latest
   ```

3. Instale as dependências novas e suba tudo:

   ```bash
   npm install                                         # raiz: instala multer na API
   cd apps/mobile && npx expo install expo-document-picker && cd ../..
   npm run dev:api
   npm run dev:mobile
   ```

Pronto. Sem a chave a API sobe normalmente e o chat mostra
"O assistente com Gemini ainda não foi configurado…".

> **Por que a chave fica na API e não no app?** Tudo com `EXPO_PUBLIC_` é embutido no
> APK e qualquer pessoa conseguiria extrair a chave e gastar a sua cota. O app fala
> com a nossa API (autenticada por JWT), e só a API fala com o Google.

---

## 2. Como funciona

```
App (chat)  ──multipart: payload + arquivo──▶  POST /ai/study-plan/chat  (JWT + rate limit)
                                                  │
                                                  ├─ 1. sobe o arquivo na Files API do Gemini (1x só)
                                                  ├─ 2. lê disponibilidade e matérias do banco
                                                  ├─ 3. monta: instrução de sistema + exemplos + histórico
                                                  └─ 4. generateContent com JSON Schema obrigatório
App  ◀── { reply, studyPlan, attachment } ──────────┘
```

- A conversa vive na memória do app; a API não guarda nada.
- O arquivo sobe uma vez; as mensagens seguintes levam só a referência (`fileUri`).
  O Google mantém o arquivo por **48 h** — depois disso, "Nova conversa".
- O plano chega estruturado e vira um cartão. O botão **Aplicar plano no calendário** chama
  `POST /ai/study-plan/apply`: cadastra as matérias que ainda não existem, cria as
  avaliações que a IA encontrou no material, vira os tópicos em conteúdos ligados à
  avaliação mais próxima de cada matéria, recalcula o cronograma e guarda o plano no
  banco (tabela `ai_study_plans`, um por pessoa; aplicar outro substitui). Aplicar o
  mesmo plano duas vezes não duplica matéria nem avaliação.
- **Sem data não há calendário.** O planejador agenda a partir de avaliações com
  prazo, então o app pergunta a data de cada matéria que a IA não datou antes de
  aplicar. Quem não informa fica com as matérias cadastradas e lê, em uma linha, por
  que o calendário não mudou. Data no passado é descartada.
- Se a disponibilidade da semana estiver toda zerada, o app oferece preenchê-la com os
  minutos por dia do plano. Oferece: disponibilidade cadastrada à mão nunca é
  sobrescrita.
- Na aba **Matérias** aparecem o resumo do plano e, em cada matéria, o tempo por
  semana, a prioridade e os primeiros conteúdos. Ao abrir a matéria, o quadro
  **O que estudar** mostra todos os conteúdos, o motivo da prioridade e os dias da
  semana com a duração de cada sessão. A correspondência é pelo nome da matéria,
  ignorando maiúsculas e acentos. "Remover plano da IA" apaga só as recomendações.
- **Planos anteriores ficam no aparelho.** O servidor guarda só o plano atual; ao aplicar
  um novo, o anterior vai para o cache do celular (`AsyncStorage`, até 10 planos, separado
  por conta). Cada matéria segue o plano mais recente que fala dela: se o plano novo não a
  inclui, ela continua com o que estudar do plano anterior, marcada como "plano anterior".
  Sem internet, as Matérias mostram o que está guardado no aparelho. "Remover plano da IA"
  apaga o atual e também o histórico do aparelho.

| Camada | Arquivo |
|---|---|
| Prompt, exemplos e schema (o "treino") | `apps/api/src/prompts/studyPlanPrompt.ts` |
| Chamadas HTTP ao Google | `apps/api/src/integrations/gemini/geminiClient.ts` |
| Regra (contexto, histórico, validação) | `apps/api/src/services/AiStudyPlanService.ts` |
| Upload (15 MB, PDF/imagem/texto) | `apps/api/src/middlewares/UploadMiddleware.ts` |
| Rotas (`POST /ai/study-plan/chat`, `GET/PUT/DELETE /ai/study-plan`) | `apps/api/src/routes/AiRoutes.ts` |
| Plano salvo | `apps/api/src/services/SavedStudyPlanService.ts`, `models/AiStudyPlanModel.ts` |
| Plano nas Matérias | `apps/mobile/src/views/subjects/_aiPlanCard.tsx`, `_aiGuidance.tsx`, `_subjectRow.tsx` |
| Teclado sobre o chat | `apps/mobile/src/hooks/useKeyboardOverlap.ts` |
| Cache dos planos anteriores | `apps/mobile/src/services/storage/studyPlanCache.ts`, `hooks/useSavedStudyPlan.ts` |
| Contratos | `packages/shared/src/types/aiStudyPlan.ts`, `schemas/aiStudyPlan.ts` |
| Botão flutuante + modal | `apps/mobile/src/views/studyAssistant/_assistantLauncher.tsx` |
| Chat | `apps/mobile/src/views/studyAssistant/studyAssistant.tsx` |
| Estado do chat | `apps/mobile/src/controllers/studyAssistant/StudyAssistantController.ts` |

Formatos aceitos: PDF, PNG, JPG, WEBP, HEIC, TXT, MD, CSV. **Word (.docx) não** — o
Gemini não lê; peça para salvar como PDF.

---

## 3. Como "treinar" o assistente

Na prática você **não precisa treinar um modelo** (fine-tuning). Para este caso, quase
tudo se resolve com engenharia de prompt, que é imediata, gratuita e reversível. Tudo
fica em **um arquivo**: `apps/api/src/prompts/studyPlanPrompt.ts`.

### 3.1 Instrução de sistema (`SYSTEM_INSTRUCTION`)
É o "manual de conduta" lido em toda mensagem. Ajuste aqui:

- **Regras de cálculo**: duração mínima/máxima das sessões, quantas matérias por dia,
  quanto peso dar a provas próximas, padrão quando não há disponibilidade.
- **Tom e tamanho** do texto do balão.
- **Limites**: o que ele recusa (ex.: fazer trabalho pela pessoa).

Dicas que funcionam:
- Escreva regras **concretas e mensuráveis** ("blocos de 25 a 90 min") em vez de vagas
  ("sessões razoáveis").
- Diga **o que fazer** quando faltar informação ("faça no máximo 2 perguntas").
- Quando ele errar sempre do mesmo jeito, acrescente uma regra **nomeando o erro**.

### 3.2 Exemplos (`FEW_SHOT_EXAMPLES`) — a alavanca mais forte
O modelo imita exemplos muito mais do que obedece regras. Para cada tipo de pedido em
que ele erra, adicione um par pergunta → resposta ideal (o `model` precisa ser JSON no
formato do schema). Mantenha 2 a 5 exemplos: cada um custa tokens em toda chamada.

Exemplo de exemplo a acrescentar, se ele estiver criando sessões longas demais:

```ts
{
  user: 'Tenho 3 horas na quarta para Cálculo e Física. Organiza?',
  model: JSON.stringify({
    reply: 'Dividi em blocos curtos com pausas, alternando as matérias…',
    studyPlan: { /* plano com sessões de 50 min, alternadas */ },
  }),
},
```

### 3.3 Schema de resposta (`STUDY_PLAN_RESPONSE_SCHEMA`)
Garante o formato. As `description` dos campos também orientam o modelo — use-as.
Se mudar campos aqui, mude junto `AiStudyPlan` (shared) e o `_studyPlanCard.tsx`.

### 3.4 Contexto real (`buildContextBlock`)
Hoje vão a data, a disponibilidade semanal e as matérias cadastradas. Para respostas
ainda melhores, dá para acrescentar as **avaliações cadastradas** (datas de prova) —
basta ler do `AssessmentService` em `AiStudyPlanService.chat` e incluir no bloco.

### 3.5 Ciclo de melhoria recomendado
1. Junte 5 a 10 planos de aula reais (PDFs diferentes: fotos tortas, cronogramas, ementas).
2. Teste cada um no app e anote onde a resposta ficou ruim.
3. Para cada falha: uma regra no `SYSTEM_INSTRUCTION` **ou** um exemplo em `FEW_SHOT_EXAMPLES`.
4. Reteste todos (não só o que falhou) para não quebrar o que funcionava.
5. Para iterar mais rápido, cole o `SYSTEM_INSTRUCTION` como *System instructions* no
   [Google AI Studio](https://aistudio.google.com), suba o PDF lá e ajuste o texto até
   gostar; depois copie de volta para o arquivo.

### 3.6 Escolha do modelo
`GEMINI_MODEL` no `.env`. `gemini-flash-latest` acompanha o Flash mais novo (rápido e
barato, ótimo para este caso). Para travar uma versão específica em produção, use o ID
exato listado em <https://ai.google.dev/gemini-api/docs/models>. Um modelo "Pro" raciocina
melhor em planos muito grandes, mas é mais lento e caro.

### 3.7 E fine-tuning de verdade?
Só vale a pena se, depois de bons prompts e exemplos, ainda houver um padrão de erro
que não some — e normalmente exige centenas de exemplos rotulados e o Vertex AI
(Google Cloud). Para um app de planos de estudo, prompt + exemplos + contexto resolvem.

---

## 4. Limites e custos

- **Rate limit**: 30 mensagens a cada 10 min por IP (`AiRoutes.ts`).
- **Histórico**: últimas 40 mensagens (`AI_HISTORY_MAX_MESSAGES`).
- **Arquivo**: 15 MB (`AI_MAX_FILE_BYTES`).
- A chave gratuita do AI Studio tem cota por minuto/dia; em erro 429 o app mostra
  "O limite de uso do Gemini foi atingido…". Para produção, ative o faturamento no projeto.
- No plano gratuito o Google pode usar os dados enviados para melhorar os produtos dele;
  avise isso na política de privacidade se o app for público.

## 5. Plano gratuito: sobrecarga e lentidão

No plano gratuito os servidores do Google ficam sobrecarregados com frequência
(`503 UNAVAILABLE — This model is currently experiencing high demand`) ou demoram a
responder. A API já trata isso sozinha:

1. **Sobrecarga (503/500)** → espera 2 s, 5 s e tenta de novo no mesmo modelo (até 3 vezes).
2. **Sem resposta no tempo** → passa direto para o **modelo reserva**.
3. **Limite gratuito atingido (429)** → passa para o modelo reserva (cada modelo tem a sua cota).
4. Tudo dentro de um prazo total; se nada responder, o app mostra uma mensagem clara.

O terminal da API mostra cada passo (`[gemini] ... tentativa 2 em 2s`,
`usando o modelo reserva ...`, `resposta em 8.4s (modelo ...)`).

Variáveis em `apps/api/.env`:

| Variável | Padrão | Para que serve |
|---|---|---|
| `GEMINI_MODEL` | `gemini-flash-lite-latest` | Modelo principal |
| `GEMINI_FALLBACK_MODELS` | `gemini-flash-latest` | Reservas, separados por vírgula |
| `GEMINI_THINKING_LEVEL` | `low` | Menos "pensamento" = respostas bem mais rápidas |
| `GEMINI_TIMEOUT_SECONDS` | `60` | Tempo máximo de uma tentativa |
| `GEMINI_TOTAL_TIMEOUT_SECONDS` | `150` | Prazo total da mensagem, somando tentativas |

Um modelo que trava ou fica sobrecarregado é evitado por 5 minutos: as mensagens seguintes
vão direto para o reserva.

Para descobrir o melhor modelo para a sua chave, rode `npm run gemini:check`: ele lista os
modelos liberados, mede o tempo de cada um em paralelo e diz exatamente o que pôr no `.env`.

Para conferir tudo do computador da API: `npm run gemini:check` (na raiz). Ele testa a
chave, a conexão, o tempo de resposta e os modelos reserva.

## 6. Problemas comuns

| Mensagem no app | Causa | Solução |
|---|---|---|
| "ainda não foi configurado" | `GEMINI_API_KEY` vazia | Preencher e reiniciar a API |
| "A chave do Gemini é inválida" | Chave errada/revogada | Gerar outra no AI Studio |
| "modelo … não foi encontrado" | `GEMINI_MODEL` errado, ou arquivo com mais de 48 h | Corrigir o ID ou tocar em Nova conversa |
| "Formato não suportado" | .docx ou outro formato | Salvar como PDF |
| "Não foi possível falar com o servidor" | App não alcança a API | Mesma rede Wi-Fi, API no ar |
| "servidores do Gemini estão sobrecarregados" | 503 no Google (plano gratuito) | Esperar 1–2 min; ver seção 5 |
| "demorou demais para responder" | Google lento/travado | `npm run gemini:check`; trocar o modelo principal |
| "limite gratuito do Gemini foi atingido" | Cota por minuto/dia (429) | Esperar; adicionar outro modelo reserva |

Logs técnicos de qualquer falha aparecem no terminal da API com o prefixo `[gemini]`.
