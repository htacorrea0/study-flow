# Decisões arquiteturais — Study Flow

Este documento registra **por que** o projeto está estruturado assim. Ele não
descreve funcionalidades: nenhuma funcionalidade foi implementada ainda. O
objetivo é que, nas próximas etapas, cada decisão de implementação encontre
um lugar pronto para encaixar — e que ninguém precise refazer uma escolha já
discutida.

---

## 1. Monorepo com npm workspaces

```
apps/api      → backend Node + Express + Prisma
apps/mobile   → app React Native (Expo)
packages/shared → contratos TypeScript usados pelos dois
```

**Por quê:** app e API evoluem juntos. Com um repositório só, uma mudança de
contrato aparece no mesmo commit dos dois lados, e o `packages/shared` impede
que o formato de uma resposta seja escrito duas vezes e saia de sincronia.

**Trade-off:** o `node_modules` da raiz mistura dependências de backend e de
mobile, e versões precisam ser conciliadas (foi o que aconteceu com o React —
ver seção 8). Em compensação, não existe passo de publicação de pacote para
compartilhar um tipo.

---

## 2. `packages/shared` só com código-fonte TypeScript

O pacote aponta `main` e `types` direto para `src/index.ts`, sem etapa de
build.

**Por quê:** tanto o Metro (bundler do Expo) quanto o `tsx` (runtime da API em
desenvolvimento) consomem `.ts` diretamente. Um passo de build seria uma
engrenagem a mais para alguém esquecer de rodar antes de testar.

**Trade-off:** se um dia existir build de produção da API com `tsc`, o pacote
precisará emitir `dist/` e apontar `main` para lá. Fica registrado como o
ponto de mudança.

**Regra que o pacote precisa manter:** nada de Prisma, nada de APIs do Node,
nada de React Native ali dentro. É um pacote que os dois lados conseguem
importar — se ele depender de um dos dois, deixa de ser compartilhado.

---

## 3. Camadas do backend

```
routes → controllers → services → models (Prisma)
                   ↘ domain/planning (regra pura)
         dtos (entidade → resposta pública)
         schemas (validação Zod na borda)
```

- **`routes`** só declara caminho, middlewares e handler.
- **`controllers`** lê a requisição já validada, chama um service e responde.
  Não contém regra.
- **`services`** é onde a regra de negócio vive. Não conhece `req`/`res`.
- **`models`** é o acesso ao Prisma, por agregado.
- **`dtos`** traduz entidade do banco para a resposta pública da API.
- **`domain/planning`** é regra pura, sem banco e sem HTTP (ver seção 6).

**Por quê:** o enunciado pede explicitamente que a lógica de interface não se
misture com regra de negócio, e que o algoritmo de planejamento não se misture
com consultas ao banco. A separação só funciona se existir desde o começo —
depois que um controller faz query, ninguém desfaz.

**Por que não existe `utils/` na API:** o Express 5 já encaminha promises
rejeitadas para o error handler, então o clássico `asyncHandler` não tem
função. Criar uma pasta para não ter o que colocar nela seria ruído.

---

## 4. Validação na borda, erro tratado no centro

Toda entrada passa por um schema Zod no middleware `validateRequest`. Todo
erro sai pelo `errorHandler`, que conhece três casos: `AppError` (erro
esperado, com status e código), `ZodError` (422 com a lista de campos) e
qualquer outra coisa (500, com a mensagem original escondida em produção).

**Consequência prática:** nenhum controller precisa de `try/catch`, e o app
mobile pode confiar que toda falha chega no formato
`{ error: { code, message, issues? } }` — que é exatamente o que
`src/services/api/errors.ts` sabe interpretar.

**Detalhe do Express 5:** `req.query` virou somente-leitura, então o resultado
da validação não pode sobrescrevê-lo. Por isso existe `req.validated`,
declarado em `src/types/express.d.ts`.

---

## 5. Modelagem do domínio

As quatro decisões que respondem a requisitos explícitos do enunciado:

### 5.1 Progresso ancorado no conteúdo, não na atividade

`StudyProgress` referencia `StudyContent` (obrigatório) e `StudyActivity`
(opcional, `onDelete: SetNull`).

Recalcular o plano cria atividades novas e descarta as antigas. Se o progresso
apontasse só para a atividade, o histórico sumiria junto. Ancorando no
conteúdo, "estudei 40 minutos de Integrais por partes" continua valendo
depois de qualquer recálculo — que é o que o enunciado exige quando pede para
preservar os registros de progresso.

### 5.2 Plano versionado em vez de sobrescrito

`StudyPlan` tem `status` (`ACTIVE` | `SUPERSEDED`), `generatedAt` e
`algorithmVersion`. Recalcular cria um plano novo e marca o anterior como
`SUPERSEDED`.

Permite responder "o que mudou no meu cronograma depois que adiei a prova?" e
comparar o comportamento de versões diferentes do algoritmo. Custa linhas no
banco; em troca, nenhum histórico é perdido.

### 5.3 `PLANNED` é diferente de `SKIPPED`

O enunciado pede para distinguir uma atividade que ainda não começou de uma
que foi explicitamente marcada como não realizada. Sem essa distinção no
enum, o app trataria todo o futuro como já perdido e o replanejamento
redistribuiria coisa que não precisava.

Estados: `PLANNED` (ainda vai acontecer), `IN_PROGRESS`, `DONE`, `SKIPPED`
(a pessoa marcou que não fez).

### 5.4 Isolamento por usuário na raiz de cada agregado

`userId` está em `Subject`, `Assessment`, `StudyAvailability`,
`AvailabilityException`, `StudyPlan`, `StudyProgress` e
`NotificationPreference`. `StudyContent` e `StudyResource` chegam ao usuário
através da avaliação.

**Regra permanente:** toda consulta filtra por `userId`. O helper
`assertOwnership` em `src/middlewares/authenticate.ts` existe para o caso em
que o recurso é buscado por id antes de se saber de quem ele é.

Isso atende diretamente "não permita que um usuário consulte ou modifique
dados de outro". Um id vazado na URL não basta para ler dado alheio.

### 5.5 Outras escolhas menores, com motivo

| Escolha | Motivo |
|---|---|
| `Assessment.hasTime` separado de `dueAt` | Trabalho que vence "no dia" não tem hora. Guardar `00:00` e fingir que é hora atrapalha o cálculo e a exibição. |
| `StudyContent.estimatedEffortMinutes` nullable | `null` significa "ainda não estimado", que é diferente de "zero minutos". O algoritmo precisa dessa diferença. |
| `AvailabilityException` com `@@unique([userId, date])` | Uma data tem no máximo uma exceção; ela **substitui** a disponibilidade habitual daquele dia, não soma. |
| `Assessment → Subject` com `onDelete: Restrict` | Apagar uma matéria que ainda tem provas é quase sempre engano. O banco recusa, e o service decide o que dizer para a usuária. |
| `StudyActivity` sem `assessmentId` | A avaliação é alcançada por `content.assessment`. Guardar o id duplicado criaria um dado derivado que uma hora sai do lugar. |
| Datas de calendário como `@db.Date` | Dia de estudo é dia do calendário, não instante no tempo. Guardar como timestamp traria fuso horário para dentro de uma conta que não precisa dele. |

### 5.6 Enums duplicados de propósito

Os enums existem no `schema.prisma` **e** como uniões TypeScript em
`packages/shared/src/types/domain.ts`.

**Por quê:** o app mobile não pode importar o client do Prisma — isso traria o
modelo do banco e um runtime de servidor para dentro do bundle do celular. A
duplicação é consciente e está marcada com comentário nos dois arquivos:
alterou um, altera o outro.

---

## 6. O algoritmo de planejamento é uma porta, não uma implementação

`src/domain/planning/` contém só:

- `types.ts` — `PlanningInput`, `PlanningOutput`, `PlannedActivity`,
  `PlanningConflict`.
- `StudyPlanner.ts` — a interface `{ version, plan(input): output }`.

Três propriedades estão fixadas pela forma da interface:

1. **Isolamento** — `plan` recebe dados prontos e devolve dados. Não consulta
   banco, não lê relógio, não chama rede. O service é quem carrega os dados e
   grava o resultado.
2. **Determinismo** — mesma entrada, mesma saída. Por isso `referenceDate` é
   parâmetro, e não `new Date()` lá dentro.
3. **Testabilidade** — dá para testar o algoritmo inteiro com objetos
   literais, sem subir banco.

Datas trafegam como texto `YYYY-MM-DD` (`IsoDate`), justamente para manter
fuso horário fora de uma conta de dias de calendário.

Recalcular o plano é chamar `plan` de novo com o estado atual. Não existe
"recalculador" separado.

---

## 7. Segurança

| Decisão | Motivo |
|---|---|
| Senha só como hash Argon2id | Nunca em texto puro, em lugar nenhum. O campo no banco se chama `passwordHash` para não restar dúvida. |
| `@node-rs/argon2` em vez de `argon2` | Mesmo algoritmo. O `@node-rs` distribui binário pronto para Linux, Windows e macOS; o outro exige `node-gyp` e Visual Studio Build Tools. Num time em sistemas diferentes, isso é a diferença entre instalar e não instalar. |
| `JWT_SECRET` validado com mínimo de 32 caracteres | A API se recusa a subir com segredo fraco ou ausente, com mensagem explicando como gerar um. Falhar no boot é melhor do que falhar em produção. |
| Nenhum segredo no mobile | Tudo com prefixo `EXPO_PUBLIC_` é embutido no bundle e fica legível para quem tiver o APK. Só a URL pública da API vai ali. Chaves de terceiros (YouTube, Gemini) ficarão exclusivamente no backend. |
| `.env` fora do git, `.env.example` versionado | Os exemplos usam valores ilustrativos de desenvolvimento, nunca credenciais reais. |

---

## 8. Conciliação de versões

Três ajustes feitos depois de verificar o que o ecossistema realmente entrega
hoje — todos validados rodando os comandos, não por suposição:

- **Prisma 7 tirou a `url` do `schema.prisma`.** A URL de migration foi para
  `apps/api/prisma.config.ts` e a de runtime para o driver adapter
  (`@prisma/adapter-pg`) em `src/config/prisma.ts`. O generator também mudou:
  `prisma-client` (com `moduleFormat = "cjs"`) no lugar de `prisma-client-js`.
- **TypeScript 6 depreciou `moduleResolution: node10` e `baseUrl`.** A API usa
  `module: "node18"`, que resolve como o Node e emite CommonJS porque o pacote
  não declara `"type": "module"`.
- **Uma única cópia do React.** O CLI do Prisma carrega o Prisma Studio, que
  tem React como peer dependency, e o npm acabava içando uma versão para a
  raiz diferente da fixada pelo Expo — duas cópias de React quebram hooks em
  React Native. O campo `overrides` não resolveu (o npm não aplica override em
  peer dependency instalada automaticamente), então `react` e `react-dom`
  estão fixados nas `devDependencies` da raiz na versão que o Expo SDK 58
  espera. Verificado com `npx expo-doctor`: 20/20.
- **Imagem `postgres:18`** espera o volume montado em `/var/lib/postgresql`, e
  não mais em `/var/lib/postgresql/data`. O `docker-compose.yml` segue a
  convenção nova.

---

## 9. Por que só o Postgres está no Docker

A API e o Metro rodam na máquina, não em container.

**Por quê:** o Expo Go roda num celular físico e precisa alcançar a API pelo
IP da rede local. Com a API dentro de um container, seria preciso expor porta,
acertar rede e descobrir o IP certo — três pontos de falha a mais, todo dia,
para todo mundo do time. Banco não tem esse problema: ele só é acessado pela
própria máquina.

Para inspecionar o banco, `npm run db:studio` abre o Prisma Studio no
navegador — evita subir um pgAdmin só para isso.

---

## 10. Migrations automáticas

`npm run dev:api` encadeia: sobe o Postgres e espera ficar saudável →
`prisma migrate deploy` → inicia a API.

**Por que não dentro do `server.ts`:** aplicar migration no boot do processo
faria os testes dependerem de banco e esconderia um efeito colateral pesado
dentro de um import. Deixando no script, o comportamento fica visível e os
testes continuam rodando sem Docker.

**`migrate deploy` e não `migrate dev`:** `deploy` só aplica o que já existe,
é idempotente e nunca apaga dados. `migrate dev` cria migration nova e pode
pedir reset — é comando de quem está alterando o schema, não de quem está só
rodando o projeto.

O fluxo do time está no README, seção "Banco de dados e migrations".
