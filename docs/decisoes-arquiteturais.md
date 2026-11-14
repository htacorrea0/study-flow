# Decisões arquiteturais — Study Flow

Este documento registra **por que** o projeto está estruturado assim. Ele não
é manual de uso: o README cobre isso. O objetivo é que cada decisão já tomada
fique escrita com o motivo, para que ninguém precise refazer a discussão.

Até aqui, a única funcionalidade implementada é a autenticação (seção 11).
O resto do domínio tem a estrutura pronta e nenhuma implementação.

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
`AvailabilityException`, `StudyPlan`, `StudyProgress` e `StudyTimeEntry`.
`StudyContent` e `StudyResource` chegam ao usuário através da avaliação.

**Regra permanente:** toda consulta filtra por `userId`. O helper
`assertOwnership` em `src/middlewares/AuthenticateMiddleware.ts` existe para o caso em
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

`src/domain/planning/` tem:

- `types.ts` — `PlanningInput`, `PlanningOutput`, `PlannedActivity`,
  `PlanningConflict`.
- `StudyPlanner.ts` — a interface `{ version, plan(input): output }`.
- `deadlineFirstPlanner.ts` — a primeira implementação dessa interface
  (seção 13). A porta veio antes, e continua valendo: trocar a heurística é
  trocar esse arquivo, sem tocar em service, rota ou tela.

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
| Nenhum segredo no mobile | Tudo com prefixo `EXPO_PUBLIC_` é embutido no bundle e fica legível para quem tiver o APK. Só a URL pública da API vai ali. As chaves de terceiros (YouTube, Gemini) ficam só no backend, lidas em `src/config/env.ts`. |
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


---

## 11. Autenticação

### 11.1 JWT de acesso, sem refresh token

O enunciado pede JWT. A escolha foi o mais simples que atende: **um único
token de acesso**, com validade controlada por `JWT_EXPIRES_IN` (7 dias no
desenvolvimento), guardado no SecureStore do aparelho. Não existe refresh
token nem tabela de sessões.

**Contrapartida, assumida de propósito:** não há revogação no servidor. O
logout apaga o token no aparelho, e um token roubado vale até expirar. Para
um app de organização de estudos, em estágio inicial, o custo de uma tabela
de sessões (consulta no banco a cada requisição, limpeza dos registros
vencidos, invalidação em cascata) não se paga. Quando precisar revogar de
verdade, o caminho é uma tabela `Session` com o `jti` do token; o payload já
carrega `sub` e `email` e nada mais, então nada mais precisa mudar.

O corpo da resposta devolve `expiresAt` junto do token. Assim o app sabe
quando a sessão caduca sem precisar decodificar o JWT no cliente.

### 11.2 Parâmetros do Argon2id ficam no código, não no `.env`

`m = 19456 KiB, t = 2, p = 1`, que é a recomendação da OWASP para Argon2id.

Eles estão em constantes comentadas em `src/security/password.ts`, e não em
variável de ambiente, por um motivo prático: trocar um parâmetro muda o
formato do hash gerado. Se isso virasse configuração, dois ambientes com
valores diferentes produziriam hashes incompatíveis sem ninguém perceber.
Mudança de parâmetro é alteração de código, revisada, e acompanhada de um
plano de reidratação dos hashes existentes.

### 11.3 Defesa contra enumeração de usuário

Login com e-mail inexistente e login com senha errada devolvem o **mesmo**
status e a **mesma** mensagem: `401` com "E-mail ou senha incorretos.".
Qualquer diferença entre os dois casos entrega ao atacante a lista de quem
tem conta.

Mensagem igual não basta sozinha: se o servidor respondesse na hora quando o
e-mail não existe e só depois de verificar o hash quando existe, o tempo de
resposta diria a mesma coisa. Por isso, quando o usuário não é encontrado, o
serviço roda `verify` contra um hash fictício (`DUMMY_HASH`) antes de
recusar.

O cadastro, por natureza, não tem como esconder que o e-mail já existe: ele
precisa devolver `409`. É o preço de um formulário de cadastro utilizável.

### 11.4 E-mail normalizado em código, sem `citext`

A unicidade do e-mail no Postgres é sensível a maiúsculas: `Ana@x.com` e
`ana@x.com` seriam duas contas. A garantia de que isso não acontece vem de
`normalizeEmail` (`trim` mais `toLowerCase`) no pacote compartilhado,
aplicada na camada de model antes de qualquer leitura ou escrita.

**Por que não a extensão `citext`:** ela exige `CREATE EXTENSION` no banco,
o que amarra o projeto a um Postgres onde você tem permissão para isso, e
move uma regra de aplicação para dentro do schema, onde ela some da vista de
quem lê o código. A normalização em um único ponto resolve o mesmo problema,
é testável sem banco, e o teste de integração confirma que entrar com outra
capitalização encontra a mesma conta.

**Condição para isso valer:** todo acesso a `User` por e-mail passa por
`UserModel.ts`. Uma consulta ao Prisma escrita fora dali pula a
normalização.

### 11.5 Rate limit em memória, e o que ele não resolve

`src/middlewares/RateLimitMiddleware.ts` é uma janela deslizante por IP, sem
dependência nova: 10 tentativas por 15 minutos no login, 20 por hora no
cadastro.

**Limitações, documentadas em vez de escondidas:** o contador vive na memória
do processo, então ele zera a cada restart e cada instância da API tem o seu
próprio. Com mais de um processo no ar, o limite efetivo é o número de
instâncias vezes o configurado. Também é por IP, então um NAT grande (uma
rede de faculdade, por exemplo) compartilha a cota.

Para o estágio atual, com uma instância, isso atrasa um ataque de tentativa e
erro o suficiente. Quando houver mais de um processo, a troca é por um
contador no Redis, mantendo a mesma interface do middleware.

### 11.6 Hash e token ficam em `src/security/`, fora de `services/`

Hash de senha e assinatura de JWT são infraestrutura, não regra de negócio.
Mantê-los em um diretório próprio deixa `AuthService.ts` testável sem
conhecer Argon2id nem JWT, e preserva a regra de camadas da seção 3.

### 11.7 Os schemas de auth moram no `packages/shared`

É exatamente para isso que o pacote existe. O formulário no celular valida
com a mesma regra que o servidor aplica na borda, sem duplicar a definição e
sem risco de as duas divergirem.

A exceção é "confirmar senha": é regra só do cliente, porque o servidor não
recebe nem precisa do campo.

Uma consequência que parece bug e não é: o schema de **login** aceita
qualquer senha de até 128 caracteres, enquanto o de **cadastro** exige no
mínimo 8. Se o login aplicasse a política, um `422` entregaria a regra de
senha a quem está tentando adivinhar.

### 11.8 Nada sensível em log

Senha, hash e token não aparecem em log em nenhum ponto do fluxo. Verificado
com `grep` nos logs do servidor depois de exercitar cadastro, login e
`/auth/me`.

### 11.9 Política de senha

Exigências no **cadastro**, definidas em `packages/shared/src/schemas/auth.ts`:

| Regra | Valor |
|---|---|
| Tamanho mínimo | 8 caracteres |
| Tamanho máximo | 128 caracteres |
| Letra minúscula | obrigatória (inclui acentuadas) |
| Letra maiúscula | obrigatória (inclui acentuadas) |
| Caractere especial | obrigatório |

Três detalhes da implementação que merecem registro:

- **Uma mensagem, não quatro.** As exigências de composição são avaliadas
  juntas num `superRefine` que lista o que falta numa frase só ("A senha
  precisa ter pelo menos 8 caracteres, uma letra maiúscula e um caractere
  especial."). Quatro mensagens empilhadas abaixo do campo fariam a pessoa
  corrigir um item por vez e tentar de novo.
- **"Especial" é definido por exclusão:** o que não é letra, dígito nem
  espaço. Assim `@`, `-`, `!` e até emoji contam, e `á` não conta, porque ela
  já satisfaz a regra de minúscula e valer nas duas seria um furo.
- **Nada de `\p{Lu}` e companhia.** As propriedades Unicode do regex dependem
  de suporte do motor, e o app roda no Hermes. As classes usam intervalos
  explícitos que cobrem o latim acentuado.

A mesma política não é aplicada no **login** (ver 11.7): lá, qualquer senha de
até 128 caracteres é sintaticamente aceita, e credencial errada é sempre o
mesmo `401`.

**Ressalva registrada, não escondida:** NIST SP 800-63B e a OWASP hoje
desaconselham regras de composição, porque na prática elas empurram as pessoas
para senhas curtas e previsíveis do tipo `Senha@123`, que estão em qualquer
lista de ataque. A decisão de exigir maiúscula, minúscula e especial foi
tomada pela responsável pelo projeto, com essa ressalva na mesa. O que
compensaria de verdade, se um dia entrar, é subir o mínimo para 12 e checar a
senha contra a lista do Have I Been Pwned por k-anonymity.

O teto de 128 continua sendo defesa, não política: sem ele, uma senha enorme
forçaria o servidor a gastar 19 MiB e o tempo de hash por tentativa.

---

## 12. Dashboard e calendário

### 12.1 Dados de verdade sem CRUD: seed mais leitura

As duas telas precisam de matérias, avaliações, disponibilidade, plano e
progresso. Nada disso tem rota de escrita ainda, e o algoritmo de
distribuição é só uma interface (seção 6). Havia duas saídas: dados falsos
dentro do app, ou dados de verdade no banco.

Escolhemos a segunda. Um seed cria um usuário de demonstração completo, e as
telas leem do Postgres pelas três rotas novas. O custo é um arquivo a mais; o
ganho é que o isolamento por usuário, a paginação, o fuso e os estados de erro
são exercitados desde o primeiro dia, em vez de aparecerem na etapa em que o
CRUD entrar.

**O seed grava atividades sem passar por planner.** Ele não tem como passar: o
planner não existe. Para que isso não vire uma mentira silenciosa no banco, o
plano criado pelo seed leva `algorithmVersion: 'seed-v1'`. Quando o algoritmo
de verdade entrar, dá para distinguir um plano semeado de um plano calculado
com uma consulta, sem adivinhação.

O seed também é **restrito ao usuário de demonstração**: ele apaga e recria só
os dados daquele `userId`, dentro de uma transação. Nunca limpa o banco.

### 12.2 Isolamento quando a entidade não tem `userId`

A regra da seção 5.4 diz que toda consulta filtra por usuário. `StudyActivity`
e `Content` não têm `userId` próprio: o dono chega pelo pai. O filtro então
passa pelo caminho, não pelo campo:

- atividade: `{ planId, plan: { userId } }`
- conteúdo: `{ assessment: { userId } }`

Confiar só no `planId` vindo da requisição seria o furo clássico: o id é
adivinhável e não prova posse. O teste de integração
`tests/integration/dashboard.int.test.ts` semeia dois usuários e verifica que
o usuário A não enxerga nenhuma atividade, cor ou minuto do usuário B em
nenhuma das três rotas.

### 12.3 Datas sem biblioteca

`apps/mobile/src/utils/date.ts` monta a matriz do mês, formata o rótulo e
compara datas ISO, sem dependência nova.

O que seria difícil aqui não é a aritmética: é nome de mês em português e
conversão de fuso. Os dois já estão resolvidos, o primeiro pelo `Intl` nativo
e o segundo pelo backend, que devolve tudo em `AAAA-MM-DD` já no fuso do
usuário. O que sobra é contar dias, e isso é uma função com teste de mesa
óbvio.

`date-fns` entraria para resolver um problema que não temos.
`react-native-calendars` traria uma grade com estilo próprio que precisaria
ser domada célula a célula para bater com o Figma, o que custa mais do que
escrever a matriz.

Todo o cálculo é feito em UTC (`Date.UTC`, `getUTC*`). Datas civis não têm
hora, e usar o relógio local abriria a porta para o dia virar sozinho perto da
meia-noite ou no horário de verão.

**Pendência registrada:** o utilitário ainda não tem teste automatizado,
porque o app mobile não tem runner. A matriz foi conferida à mão (outubro de
2026, fevereiro de 2026 e a virada de novembro).

### 12.4 Onde o Figma não cabe no modelo, e o que fizemos

Divergências deliberadas, para que não sejam lidas como descuido:

1. **Horário da sessão.** O Figma mostra "11:30 AM". `StudyActivity` tem
   `scheduledDate @db.Date` e `position`, sem hora, de propósito: o plano
   distribui dias, não agenda relógio. Inventar um horário seria inventar
   funcionalidade. O badge mostra a duração estimada e o prazo da avaliação
   ("Prova em 3 dias"), na mesma caixa e na mesma tipografia.
2. **Avatar com foto.** Não há campo de foto no modelo. O círculo de 48px
   mostra as iniciais do nome. Upload entra junto com a tela de perfil.
3. **Ícone por matéria.** O Figma dá um ícone diferente a cada matéria, e o
   modelo só guarda nome e cor. O ícone é escolhido de uma paleta fixa por
   hash do nome da matéria: estável entre aberturas, decorativo, e nunca
   apresentado como dado do usuário.
4. **Botão de voltar no cabeçalho do calendário.** O calendário é uma aba, não
   uma tela empilhada: não há para onde voltar. O botão da esquerda saiu e o
   da direita virou o atalho "ir para hoje".
5. **Cinco abas em vez de quatro.** A barra do Figma tem quatro abas de 76px
   com `justify-between`; cinco não cabem nos 370px úteis. Cada aba passou a
   `flex: 1`. Altura, glow, raio, ícone e rótulo seguem idênticos.
6. **Cabeçalho da grade com três letras, não uma.** O Figma usa a inicial do
   dia da semana, que em inglês ainda se lê: M T W T F S S. Em português a
   inicial dá S T Q Q S S D, e as colunas de segunda, sexta e sábado ficam
   todas com a mesma letra. O cabeçalho mostra `Seg Ter Qua Qui Sex Sáb Dom`,
   que cabe nos 40px da célula e mantém peso, tamanho e cor do Figma.
7. **Marca do dia da prova, que o Figma não desenha.** A grade do arquivo só
   tem os pontos de sessão. O dia do prazo ganhou um anel na célula, descrito
   em 12.9: é acréscimo, não leitura divergente do desenho.

### 12.5 A frase do card da meta sai do percentual

A linha grande do card índigo é texto no Figma ("Almost there!"), não número.
Mantê-la como texto evita o terceiro número na mesma caixa, já que o anel e a
linha de apoio abaixo dela já mostram o progresso em percentual e em minutos.
A frase é derivada do mesmo `percent` que desenha o anel, de modo que nunca
pode contradizer o resto do card: sem meta reservada, "Dia livre"; em 0%,
"Vamos começar?"; abaixo de 50%, "Bom começo!"; abaixo de 100%, "Quase lá!";
daí em diante, "Meta batida!".

### 12.6 As três aparências do item de sessão

`StudyActivity` tem três estados, e a agenda do calendário devolve as sessões
do dia em qualquer um deles. Desenhar os três iguais faria a tela esconder a
única informação que o dia passado tem a dar. O item lê `status`:

- `PLANNED`: o item padrão, com o prazo da avaliação no canto.
- `IN_PROGRESS`: a linha do prazo vira "Em andamento" em índigo, a mesma cor
  que o app já usa para o que está ativo (aba selecionada, dia escolhido).
- `DONE`: o quadrado da matéria troca o ícone pelo `check`, o título fica
  riscado e em cinza, e a linha do prazo vira "Concluída".

Nos dois estados que não são `PLANNED` o prazo sai da caixa de propósito: o
estado é a informação mais útil ali, e o prazo continua visível nas outras
sessões da mesma avaliação. O dashboard não é afetado, porque a lista de
próximas sessões já filtra por `PLANNED` e `IN_PROGRESS`.

### 12.7 Dois pontos por dia, sem repetir cor

Cada célula do calendário mostra até dois pontos coloridos. Quando o dia tem
duas sessões da mesma matéria, a cor repetida é descartada em vez de ocupar o
segundo ponto: dois pontos idênticos não informam nada, e gastariam o único
espaço que mostraria a segunda matéria do dia.

Matéria sem cor escolhida também ganha ponto. Antes do cadastro existir, toda
matéria vinha do seed e tinha cor, e o servidor descartava a cor nula ao montar
a grade. Com o cadastro, escolher cor virou opcional, e o descarte apagava o
dia inteiro: um dia com estudo marcado ficava igual a um dia vazio. Agora o
`null` viaja na lista de cores e a interface desenha o ponto em índigo, que é o
mesmo que ela já faz na agenda do dia e no anel do prazo.

### 12.8 Sair da conta mora provisoriamente no Progresso

O botão de sair vivia na tela placeholder que o dashboard substituiu. Ele foi
para o rodapé da aba Progresso, com comentário dizendo que o lugar dele é a
tela de perfil. Sem isso, a única forma de sair seria limpar os dados do app.

### 12.9 O dia da prova é marcado à parte da sessão

A grade mostrava só sessões de estudo do plano ativo. O dia da prova ou da
entrega não tinha marca própria: ele aparecia apenas como texto dentro do
item ("Prova em 3 dias"). Quem abria o mês não via a data que não pode ser
remarcada.

As duas coisas são diferentes e nenhuma substitui a outra: a sessão responde
"quando eu estudo", a avaliação responde "quando é". Por isso o prazo **não**
virou mais um ponto colorido. Ele virou um **anel** na cor da matéria em volta
do número do dia, e os pontos continuam significando só sessão. O anel
sobrevive ao dia selecionado, que já preenche o círculo de índigo, e some
junto com o mês quando a pessoa navega.

Três consequências que valem registro:

- **O contrato cresceu.** `CalendarDayMark` ganhou `assessments`, e
  `CalendarDayResponse` também: a grade precisa da cor para desenhar o anel, e
  o leitor de tela precisa do título ("Dia 12, prova"). Um booleano não daria
  conta dos dois.
- **A avaliação não depende de plano ativo.** `Assessment` tem `userId`
  próprio, então a consulta filtra direto, sem passar por `plan`. Isso é de
  propósito: a prova existe assim que é cadastrada, e um calendário que
  esconde o dia dela por falta de plano esconde justamente o que não se pode
  esquecer. Sem plano, o mês vem sem pontos mas com os anéis.
- **`dueAt` é instante, `scheduledDate` é data civil.** O prazo é convertido
  para o dia do relógio da pessoa antes de virar marca. Uma entrega às 23h em
  São Paulo é dia 20 para quem entrega, mesmo sendo dia 21 em UTC. A janela da
  consulta usa `dayBoundsUtc`, meia-aberta, pela mesma razão.

Na agenda do dia a avaliação entra **antes** das sessões, com a mesma caixa do
item de sessão para alinhar na mesma grade, mas com o quadrado da matéria em
cor cheia e ícone branco, em vez dos 10% de tinta da sessão: o prazo é o
compromisso do dia e precisa pesar mais do que um estudo que pode ser
remarcado. A frase "Nenhuma sessão de estudo marcada para este dia" continua
aparecendo embaixo de um prazo sem sessão, porque "a prova é hoje e não há
nada marcado" é exatamente o que vale a pena saber.

---

## 13. Distribuição, recálculo e confirmação do dia

### A heurística do `deadline-first`

`domain/planning/deadlineFirstPlanner.ts` é a implementação de
`StudyPlanner`. Em ordem: descarta as passadas já concluídas, agrupa os
conteúdos por avaliação, encolhe a demanda de cada avaliação até ela caber no
tempo livre até o prazo e divide cada dia entre as avaliações por urgência. A
conta da compressão e o rateio dos dias estão na seção 16; aqui ficam as
escolhas que valem desde a primeira versão.

**A carga é espalhada, não empilhada no começo.** Encher hoje até o limite e
só então passar para amanhã produziria um plano tecnicamente válido e
humanamente ruim: a pessoa estuda cinco horas na segunda e nada na quinta. Na
`v1` isso vinha de escolher sempre o dia mais vazio; na `v2` vem do teto de
ritmo (seção 16), e o dia mais vazio ficou só como destino da passada que não
coube em cota nenhuma.

**O conteúdo não é partido entre dois dias.** O conteúdo é a unidade de
planejamento e o progresso é registrado contra ele: partir "Derivadas" em
dois dias criaria duas atividades com um progresso só, e marcar uma delas
como feita deixaria o banco sem resposta para "esse conteúdo está estudado?".
Um conteúdo grande demais para um dia é um conteúdo mal cadastrado, e a
pessoa resolve isso dividindo em dois, onde o app não precisa adivinhar.

**"Encaixa e avisa" em vez de deixar conteúdo sem data.** Quando nem o tempo
mínimo por sessão cabe, o conteúdo entra no dia mais vazio assim mesmo e o
excedente vira um conflito `INSUFFICIENT_TIME` com o déficit em minutos. A alternativa seria
devolver o conteúdo em `unscheduledContentIds`, o que na tela vira um
conteúdo que simplesmente não aparece em dia nenhum. Estourar o tempo é um
fato que a pessoa precisa ver; sumir não é.

### Por que o recálculo é global

Todo recálculo refaz o futuro de todas as avaliações pendentes:
`recalculate(userId, now)`, sem escopo. A primeira versão recalculava só a
avaliação tocada e copiava as outras nas mesmas datas, para que mexer em
Cálculo não remarcasse História. A compressão da `v2` tirou essa opção: o
fator de cada avaliação depende da demanda de todas as que vencem antes dela
(seção 16), então copiar as outras intactas devolveria um cronograma que
contradiz a própria conta — incluir uma prova não apertaria as antigas, e
apagar uma não devolveria o tempo às que ficaram.

O que a cópia ainda preserva é o passado: `selecionarCopias` repete as
atividades anteriores a hoje, com datas, posições e status. O que já
aconteceu é histórico e não se replaneja; daqui para a frente é tudo
redistribuído.

Recalcular nunca sobrescreve. Cria um `StudyPlan` novo `ACTIVE` e marca o
anterior como `SUPERSEDED`, na mesma transação, como o `schema.prisma` já
previa.

### `recordedAt` é o dia confirmado, não o instante da confirmação

Confirmar uma segunda-feira na quarta grava o progresso **na segunda**. Se
gravasse em "agora", recuperar três dias esquecidos de uma vez inflaria a
meta de hoje para 300% e inventaria uma sequência que não houve. A data
confirmada é a verdade sobre quando o estudo aconteceu; o instante do toque é
só quando a pessoa lembrou de registrar.

Pela mesma razão, dia futuro não pode ser confirmado: não há o que registrar
sobre um dia que não aconteceu.

### Reconfirmar não duplica

A confirmação apaga os `StudyProgress` daquelas atividades antes de gravar os
novos. Quem marca errado e corrige em seguida tem um registro por atividade,
não dois: o dia confirmado é um retrato do dia, e um retrato substitui o
anterior.

### O painel manda o dia inteiro numa requisição só

A tela acumula as marcações e envia tudo ao tocar em "Confirmar dia". Mandar
uma sessão por vez remontaria o calendário a cada toque, movendo as sessões
debaixo do dedo de quem ainda está marcando.


### Profundidade de estudo = número de passadas, não dia mais longo

O conteúdo tem um campo `depth` (`BASIC`, `INTERMEDIATE`, `INTENSE`), e ele
vira a quantidade de vezes que aquele conteúdo é agendado: uma, duas ou três
passadas, cada uma num dia diferente. Não é um multiplicador de minutos.

O pedido era "mais dias de estudo" para quem quer intenso, e esticar a sessão
de 60 para 180 minutos não dá mais dias: dá um dia pesado. Repetir o conteúdo
em dias diferentes também é o que faz diferença para lembrar na prova, que é
o que "estudo intenso" quer dizer na prática.

A primeira passada custa o esforço estimado do conteúdo; as seguintes custam
metade (`PESO_DA_REVISAO = 0.5`, mínimo de um minuto). Revisar é mais barato
do que ver pela primeira vez, e sem esse desconto o modo intenso triplicaria
a carga e encheria o plano de `INSUFFICIENT_TIME` — o aviso perderia sentido
por aparecer sempre.

Quando há menos dias livres do que passadas, a mesma data se repete: é a
mesma decisão de "encaixa e avisa" já tomada para o tempo livre. Melhor duas
passadas no mesmo dia do que uma passada perdida.

### O progresso conta passadas, e por isso é ancorado no conteúdo

O planner recebe `completedPassesByContentId`, não mais uma lista de
conteúdos concluídos: quem já estudou uma vez e ainda deve duas revisões
precisa voltar ao calendário apenas com o que falta. A contagem sai de um
`groupBy` nos `StudyProgress` com status `DONE` por `contentId` — possível
porque o progresso é gravado contra o conteúdo (não contra a atividade) e
reconfirmar um dia substitui o registro daquela data em vez de empilhar um
segundo.

### A profundidade é do conteúdo, não da matéria

Começou na matéria e mudou de lugar: numa mesma prova, um assunto já é
dominado e pede uma passada enquanto outro trava e pede três. Profundidade
por matéria força o mesmo tratamento para todos os assuntos dela, e aí quem
quer intenso em um capítulo paga três passadas em todos.

A migração `20261103010000_profundidade_por_conteudo` copia para cada
conteúdo o valor que estava na matéria dele antes de derrubar a coluna, para
que nenhum plano já montado mude de forma sozinho.

Como todo mutador de conteúdo já termina em `PlanService.recalculate`, mudar
a profundidade redistribui o plano inteiro sem nenhum caminho novo. O
`PATCH /subjects/:id` voltou a devolver a matéria pura (`SubjectResponse`),
porque nome e cor não mexem no plano e não há aviso para dar.

### Apagar: a avaliação leva o que é dela, a matéria não leva nada

`DELETE /assessments/:id` apaga conteúdos e sessões junto, por cascade, e
recalcula: apagar uma prova **libera** tempo, e as outras estavam comprimidas
por causa dela. Deixar os dias vagos, como a versão anterior fazia, manteria
o aperto depois que a causa sumiu. `DELETE /subjects/:id` encosta no `onDelete: Restrict` do
schema e devolve 409 com a razão ("Esta matéria ainda tem provas ou
trabalhos...") enquanto houver avaliação: apagar uma matéria é barato de
pedir e caro de desfazer, e o histórico de estudo mora nas avaliações. Nas
duas telas o toque passa por um `ConfirmDialog` que diz o que sai junto.

### O título da sessão é derivado na leitura, não confiado ao que foi gravado

`StudyActivity.title` é uma cópia do nome do conteúdo feita no instante em que
o plano foi calculado. Isso é útil para quem lê o banco direto, mas envelhece:
renomear um conteúdo não reescreve as atividades já gravadas, e o recálculo
copia as atividades passadas literalmente (é o que preserva o histórico). O
resultado era um calendário com o nome antigo nos dias que já passaram e o
novo nos dias à frente — a mesma matéria aparecendo com dois nomes.

A correção não foi reescrever o campo a cada renomeação, que exigiria varrer
todos os planos aposentados e ainda assim perderia qualquer atividade criada
antes. `SessionDto` passou a montar o título a partir do nome que o conteúdo
tem **agora** (`StudyActivityModel.SELECAO_COM_CONTEXTO` já traz
`content.title`), preservando apenas o verbo que o planner escolheu:
`activityTitle.tituloComNomeAtual` lê "Estudar" ou "Revisar" do título gravado
e troca o resto. Uma fonte de verdade só, a do conteúdo; o campo gravado vira
registro histórico, não origem do que a tela mostra.

`activityTitle.tituloDaPassada`, usada pelo planner na escrita, e
`tituloComNomeAtual`, usada na leitura, ficam no mesmo arquivo justamente para
que as duas frases nunca divirjam.

## 14. Dias que fogem da semana

### A chave da rota é a data, não um `id`

`availability_exceptions` tem `@@unique([userId, date])`: por construção, uma
pessoa tem no máximo um ajuste por dia. A rota foi desenhada em cima dessa
chave — `PUT /availability/exceptions/:date` e `DELETE
/availability/exceptions/:date` —, e não em cima de um `id` gerado.

A razão é concreta e já custou caro neste projeto: com `id` na URL, o
formulário precisa saber se está criando ou editando, e errar essa decisão
grava um segundo registro em vez de corrigir o primeiro. Foi exatamente o que
aconteceu com avaliação, que chegou a mostrar várias "AC1" da mesma matéria no
calendário. Com a data na URL o `PUT` é idempotente pela forma: salvar o
mesmo dia duas vezes cai no mesmo `upsert`, e a tela não guarda identificador
nenhum.

A contrapartida é que a chave é pública e igual para todo mundo — o dia 18 de
novembro de A tem a mesma URL que o de B. Por isso o isolamento por `userId`
não pode depender só de revisão: `apps/api/tests/integration/crud.int.test.ts`
monta duas contas no mesmo banco e verifica que A não lê, não sobrescreve e
não apaga o ajuste de B, e que o `DELETE` de A num dia que só B ajustou
responde 404 sem apagar nada.

### A exceção recalcula com escopo `all`

As outras escritas recalculam o plano de uma avaliação só (`{ kind:
'assessment', assessmentId }`), porque é o alcance real da mudança. O ajuste
de um dia não tem esse alcance: encolher a terça-feira tira espaço de tudo o
que estava marcado para aquela terça, de qualquer matéria. Recalcular só uma
avaliação deixaria as outras ocupando um tempo que não existe mais. Por isso a
exceção usa `{ kind: 'all' }`, a mesma coisa que salvar a semana já faz.

### O cálculo não mudou

`services/support/capacity.ts` já aplicava a regra antes de existir qualquer
tela: a exceção de uma data **substitui** o valor do dia da semana, e dia com
zero minuto sai da lista de dias de estudo. A etapa de escrita só preencheu a
tabela que o cálculo já lia. É por isso que ela é pequena, e é a razão de a
pendência ter sido registrada como "o cálculo lê, a interface não cria" em vez
de ser tratada como funcionalidade nova.

### Só de hoje em diante

O `PUT` recusa data passada com 400, e a tela nem oferece o atalho na agenda
de um dia que já passou. Ajustar ontem não muda plano nenhum: o passado já foi
distribuído e, quando houve confirmação, já virou progresso. Aceitar a escrita
daria à pessoa a impressão de estar corrigindo algo que o recálculo ignoraria.

## 15. O aviso de "não cabe" é do plano, não da tela

### Onde ele morava antes

O aviso nascia na resposta de uma escrita (`PUT /availability`,
`POST /assessments`, confirmação do dia), ia para um `useState` da tela e
morria quando a tela desmontava. Nada era gravado, e nenhuma rota de leitura
devolvia conflito. Quatro consequências, todas sentidas em uso:

1. Salvar, ver o aviso, sair da tela e voltar fazia o aviso sumir — mesmo
   continuando sem caber.
2. Aumentar o tempo na Disponibilidade limpava o aviso ali, e o formulário da
   avaliação continuava mostrando o antigo.
3. Uma escrita escopada numa avaliação devolvia só os conflitos dela. Salvar
   um conteúdo de Cálculo apagava, na tela, o aviso de Direito, que ninguém
   tinha resolvido.
4. O déficit não atualizava: faltavam 60 minutos, a pessoa mexia no tempo e
   continuavam aparecendo 60 onde já eram 40.

### A coluna fica no plano

`study_plans.conflicts` (`Json`, default `[]`) guarda o conjunto de avisos da
versão do plano. Não é tabela própria porque o conflito nasce e morre com a
versão: `PlanService.recalculate` **sempre** aposenta o plano anterior e cria
uma linha nova dentro da mesma transação. Guardado ali, o conjunto não tem
como ficar velho — não existe caminho que grave plano sem gravar o aviso
junto.

A leitura é defensiva (`toStoredPlanConflicts`, em `dtos/PlanDto.ts`): uma
coluna `Json` não tem forma garantida, e um plano gravado por uma versão
anterior do código não pode derrubar a rota. O que não casa com
`PLAN_CONFLICT_KINDS` é descartado em silêncio.

### Os avisos do plano novo são os do recálculo, sem herança

Como o recálculo é global (seção 13), o distribuidor sempre fala de todas as
avaliações pendentes: o conjunto que ele devolve já é o conjunto completo, e
não existe aviso de outra avaliação a herdar. Foi isso que tirou
`mesclarConflitos` e `dropConflictsOfAssessment` do `PlanService` — apagar
uma avaliação recalcula, e o aviso dela some porque ela saiu da conta, não
porque alguém o podou.

### Uma rota de leitura, não um campo em três respostas

`GET /plan/conflicts` devolve `{ conflicts }` do plano ativo. A alternativa
era pendurar `conflicts` em `GET /dashboard`, `GET /availability` e
`GET /calendar/:date`, o que mudaria a forma de três contratos — e
`AvailabilityResponse` é também o corpo do `PUT`. Como é um dado só, com um
dono só, ele ganhou rota própria.

Toda escrita que recalcula devolve `listConflicts(userId)`, e não o resultado
do distribuidor: a resposta da mutação e a da leitura são, por construção, o
mesmo conjunto.

### No app, um contexto

`PlanConflictsContext` guarda a lista e expõe `refresh()`, que delega para
`services/plan/PlanService.ts` (contexto não faz regra de negócio). As três
telas que mostram o aviso — Disponibilidade, formulário da avaliação e painel
de confirmação do dia — leem dele e gravam nele o que a escrita devolveu, e
chamam `refresh()` ao ganhar foco. É isso que faz o aviso aparecer ao
**abrir** a tela, e não só depois de salvar. A lista é zerada quando a sessão
deixa de estar autenticada.

## 16. O cronograma que cabe no tempo que existe (`deadline-first-v2`)

### O problema da `v1`

A `v1` agendava cada passada com o esforço **cheio** no dia mais vazio antes
do prazo. 150 minutos de conteúdo com 60 minutos livres viravam 150 minutos
agendados e um alerta: um cronograma que a pessoa não tinha como cumprir, com
um aviso dizendo que ela não teria. Pior, incluir uma prova nova não mexia na
antiga — o recálculo escopado copiava as outras avaliações nas mesmas datas —
e a prova que entrou ficava com as sobras.

### A compressão é por avaliação, não por conteúdo

A demanda ideal de um conteúdo é `esforço × soma dos pesos das passadas que
faltam`. Somando os conteúdos, cada avaliação tem uma demanda ideal, e é ela
que é multiplicada por um fator `f ≤ 1` até caber.

O fator é da **avaliação** porque é dentro dela que a intensidade relativa
importa: quem marcou um capítulo como intenso e outro como leve quer que o
primeiro continue valendo o dobro do segundo mesmo quando o tempo encolhe.
Um fator por conteúdo (por exemplo, cortar mais de quem tem mais minutos)
achataria exatamente a escolha que a pessoa fez. 100/50 com 60 minutos livres
vira 40/20; entrando um conteúdo de 30 na conta, vira 33/17/10.

### O fator é o mínimo dos prazos que incluem a avaliação

Com os prazos distintos em ordem `d₁ < d₂ < … < dₖ`:

- `cap(dₖ)` = minutos livres entre hoje e `dₖ`;
- `demandaPrefixo(dₖ)` = demanda ideal das avaliações com prazo até `dₖ`;
- `gₖ = cap(dₖ) / demandaPrefixo(dₖ)`;
- `fᵢ = min(1, min gₖ para todo k ≥ i)`.

Cada avaliação é encolhida pelo prazo mais apertado que a inclui, e só por
ele. Usar só o próprio prazo deixaria o plano inviável (duas provas no mesmo
dia caberiam cada uma sozinha, mas não as duas); usar o prazo mais distante
para todas faria a prova de daqui a quinze dias pagar pelo aperto da de
daqui a dois, sem motivo — ela tem os treze dias seguintes. Com o mínimo dos
prazos à frente, todo prefixo cabe por construção:
`Σᵢ≤ₖ fᵢ·demandaᵢ ≤ gₖ·demandaPrefixo(dₖ) = cap(dₖ)`.

### O piso por sessão separa "apertado" de "impossível"

`MINIMO_POR_SESSAO = 10`: sessão de três minutos não é estudo, é ruído no
calendário. Conteúdo cujo esforço cheio já é menor que o piso não é inflado —
o piso dele é o próprio esforço.

Daí os dois avisos:

- comprimiu e coube → `COMPRESSED_PLAN`, com `compressionPercent`, que a tela
  mostra em tom de informação (o cronograma está de pé, só mais lento);
- nem no piso coube → `INSUFFICIENT_TIME`, com o déficit em minutos.

Esta é a diferença que a `v1` não fazia: lá, qualquer aperto virava
`INSUFFICIENT_TIME`, e o alerta aparecia tanto quando dava para ajustar
quanto quando não dava.

### O dia é rateado por ritmo exigido, com reserva para quem vence antes

Dia a dia, cada avaliação ainda elegível tem uma `taxa = demanda restante /
dias elegíveis até o prazo` — o ritmo que ela exige. A capacidade do dia é
rateada proporcional a essa taxa, com dois ajustes:

- **reserva**: a avaliação de prazo mais próximo leva no mínimo
  `FATIA_DO_MAIS_URGENTE = 0,6` do dia enquanto tiver demanda. É o "o foco
  ainda são os conteúdos da prova de sexta"; sem ela, uma prova distante com
  500 minutos de conteúdo teria o maior ritmo exigido e tomaria o dia da
  prova de depois de amanhã;
- **teto de ritmo**: nenhuma cota passa da própria taxa. Sem o teto, uma
  avaliação sozinha levaria o dia inteiro e o plano amontoaria tudo nos
  primeiros dias, deixando vazios justamente os dias de véspera.

Os 40% que sobram são o "ir estudando de leve" o conteúdo pesado da prova
distante. Passada a prova mais próxima, ela deixa de dividir e a seguinte
fica com o dia inteiro.

### A folga do dia só vai para o dia que ficaria vazio

Depois do rateio pode sobrar tempo que nenhuma cota consegue usar (a passada
seguinte é maior que a cota). Essa sobra é oferecida **só a um dia que ficaria
sem nenhuma sessão**, e no máximo uma passada por avaliação, na ordem de
prazo. Oferecer a sobra de todo dia desfaria a distribuição que a cota
acabou de montar; e deixar a mais urgente levar quanto coubesse faria ela
tomar o dia inteiro, com a prova distante só começando depois do prazo da
primeira.

### O que esta versão ainda não faz

A passada continua indivisível: um conteúdo é agendado inteiro num dia, nunca
partido em dois (seção 13, pelo mesmo motivo de sempre — o progresso é
registrado contra o conteúdo). A compressão garante que o **total** agendado
cabe na janela até o prazo, não que cada dia caiba em si mesmo: uma sessão
comprimida que ficou maior do que um dia sozinho ocupa o dia mais vazio
estourando a capacidade dele, porque conteúdo apertado é melhor do que
conteúdo que some do calendário. É o caso que
`tests/integration/crud.int.test.ts` fixa: três conteúdos em dois dias de 30
minutos dão 17 num dia e 43 no outro, com o total nos 60 disponíveis.

## 17. Por onde estudar, e o dia que passou em silêncio

O plano já dizia quando estudar e por quanto tempo. Faltavam as duas coisas
que a pessoa pediu depois: material para abrir na hora da sessão, e uma
regra justa para o dia que terminou sem ninguém confirmar nada.

### O acervo é por conteúdo; a fatia é por passada

Os links não são buscados por sessão, e sim por conteúdo: `StudyResource`
guarda até 24 resultados ligados ao `StudyContent`, com `rank` na ordem em
que a busca os devolveu. A sessão não escolhe o que buscar, ela escolhe
**qual pedaço do acervo mostrar**: `fatiarPorPassada(acervo, passIndex)`
devolve três links por passada, em janela deslizante com volta.

É daí que sai a diversificação que ela pediu. O mesmo conteúdo estudado hoje,
amanhã e depois tem `passIndex` 0, 1 e 2, logo abre as posições 0 a 2, 3 a 5
e 6 a 8 do acervo: nenhum vídeo repetido entre os dias. Se o acervo vier
curto, a janela dá a volta em vez de devolver tela vazia, porque repetir é
melhor do que não ter nada para abrir.

O `rank` existe porque sem ele a ordem do acervo seria `createdAt`, e as
linhas do acervo entram na mesma transação com o mesmo instante. O `passIndex` passou a
ser gravado em `StudyActivity` pelo mesmo motivo: o distribuidor sempre soube
de qual passada a sessão era, só jogava a informação fora.

### A busca é gravada, não refeita

A primeira sessão que abre um conteúdo sem acervo dispara a busca, ordena o
resultado e grava. Da segunda em diante nada sai para a internet. Três razões,
na ordem: a diversificação só é estável se o acervo for o mesmo entre os dias;
a tela abre no tempo do banco, não no tempo de uma API externa; e a cota
gratuita da chave acabaria num dia de uso normal se cada toque buscasse.

A `YOUTUBE_API_KEY` é opcional. Sem ela a API responde
`suggestionsUnavailable: true` e a tela explica que as sugestões dependem da
configuração, em vez de quebrar. Em teste os provedores ficam desligados por
duas chaves diferentes (`env.temBuscaDeMaterial` e o `configurado` de cada
provedor), porque suíte que sai para a rede não é suíte.

### Por que só o YouTube busca

O plano previa um segundo provedor, o Google Programmable Search, para trazer
artigo e lista de exercício em texto. Ele foi escrito e descartado: a Custom
Search JSON API está fechada para clientes novos e tem descontinuação marcada
para 1º de janeiro de 2027. Projeto criado hoje recebe
`403 This project does not have the access to Custom Search JSON API` mesmo
com a API ativada, chave no projeto certo e mecanismo de pesquisa criado —
não é configuração, é recusa de cadastro.

O que restou cobre as duas intenções com um provedor só: o `YouTubeSearchProvider`
faz duas chamadas por conteúdo, uma atrás de aula e outra atrás de exercício
resolvido, e marca a segunda como `EXERCISE_LIST`. Vídeo de resolução não é
lista de exercício impressa, mas é material de praticar, que era o ponto.

A interface `ResourceSearchProvider` continua existindo por isso mesmo: trocar
ou somar provedor (Brave, Tavily, Wikipédia) é escrever um arquivo em
`providers/` e acrescentá-lo à lista do serviço. Nada mais no app conhece o
YouTube.

A busca mora em `providers/`, pasta nova, e não em `domain/`: o domínio é
puro e continua sendo. O ranking e o fatiamento, que são a parte interessante,
ficaram em `domain/resources/`, sem rede, e é lá que a promessa de não repetir
link está provada em teste.

### Dia que passou sem marcação é dia estudado

Antes, só `StudyProgress` com status `DONE` contava como passada feita. O
efeito era perverso: quem não abriu o app no fim do dia via o cronograma
inteiro reapertar sozinho no dia seguinte, como se não tivesse estudado nada.
A regra agora é a oposta. `contarPassadasPresumidas` lê as atividades do plano
com data anterior a hoje e conta como feita toda passada cujo status não é
`SKIPPED`.

O ponto fino é que a presunção é uma **leitura do plano**, não um fato
gravado. `StudyProgress` continua tendo só o que a pessoa afirmou: inventar um
`DONE` que ela não marcou mentiria no histórico e nos minutos estudados, que
alimentam o dashboard e a sequência. E a leitura se mantém entre recálculos
porque `selecionarCopias` carrega o status que a atividade tinha.

Quem quer reapertar o cronograma diz que não estudou. A sessão vira `SKIPPED`,
para de contar, e o recálculo redistribui aquele conteúdo nos dias que restam
até o prazo. Calendário, bolinhas, cards e avisos atualizam sozinhos, porque
todos já leem do plano ativo.

A marcação vale para qualquer dia anterior a hoje e nunca para o futuro
(`input.date > hoje` continua sendo `400`): confirmar um dia que ainda não
aconteceu não é um registro, é um palpite. A tela do dia abre com tudo
marcado como estudado e a pessoa desmarca o que falhou, que é a mesma regra
do servidor, visível.

---

## 18. O cronômetro fecha a sessão do plano

O Timer media tempo e o plano marcava sessão, e nada ligava os dois: quem
cronometrava duas horas de Eletrônica ainda precisava abrir o calendário e
confirmar a sessão de Eletrônica à mão, dizendo a mesma coisa duas vezes.

### A entrada de tempo aponta para a sessão

`StudyTimeEntry` ganhou `activityId` opcional, com `onDelete: SetNull`:
apagar a avaliação (e com ela as sessões) não pode apagar o tempo que a
pessoa de fato estudou. O `subjectId` continua vindo do conteúdo da sessão, e
não do que o app mandou — o servidor não confia no cliente para dizer de que
matéria era o estudo que ele mesmo pode conferir.

A sessão creditada é carregada por `findForTimeCreditForUser`, que já filtra
pelo dono através do plano, e sessão com data futura é recusada pela mesma
razão que a confirmação do dia recusa: registrar estudo que ainda não
aconteceu não é registro, é palpite.

### Abaixo do previsto a sessão fica `IN_PROGRESS`, não `PLANNED`

O plano original dizia que, abaixo dos minutos estimados, nada seria gravado e
o tempo ficaria só acumulado. Na implementação isso virou `IN_PROGRESS` com
`minutesSpent` igual ao total já cronometrado, porque os três estados já
existem e a agenda já desenha `IN_PROGRESS` de forma diferente (12.6). Deixar
a sessão `PLANNED` depois de quarenta minutos de cronômetro faria a tela
mentir sobre o que a pessoa fez. Quando a soma alcança `estimatedMinutes`, o
mesmo progresso vira `DONE` e a atividade também.

Fechar uma sessão **não** dispara recálculo, pela mesma razão que o
`ActivityConfirmationService` só recalcula quando há sessão pulada: estudar o
que estava planejado não libera capacidade nenhuma, então não há o que
redistribuir.

### Por que a meta do dia passou a ignorar parte do cronômetro

`DashboardService` somava minutos do progresso **mais** segundos do
cronômetro. Com o crédito, o mesmo estudo passou a existir dos dois lados, e a
meta do dia contaria em dobro: uma hora cronometrada numa sessão de uma hora
marcaria duas horas.

A correção fica no model: `sumSecondsInRange` filtra `activityId: null`, ou
seja, só soma o cronômetro **avulso**. O tempo creditado já chega pelo
progresso, com o mesmo valor. A sequência (`resolveStreak`) não mudou: ali os
registros só respondem "houve estudo neste dia", e contar duas vezes o mesmo
dia não altera a resposta.

---

## 19. O plano da IA precisa de data para virar calendário

O Gemini devolvia uma grade semanal (dia da semana + sessões) e ela morria
como recomendação na aba Matérias. O motor do app é `deadline-first`: ele
agenda o que está preso a uma avaliação com data. Grade semanal sem prazo não
tem como entrar nele — não é limitação de código, é o que o algoritmo
significa.

### Devolver o que já estava sendo lido

O prompt já mandava o modelo identificar "datas de aulas, provas, trabalhos e
entregas" no material, e depois jogava isso fora. `AiStudyPlan` ganhou
`assessments`, com matéria, título, data e tipo, e a instrução ficou
explícita: devolver só data que esteja no material, nunca inventar. O schema
descarta avaliação inválida — e também data no passado — sem derrubar o plano
inteiro, na mesma linha tolerante do resto da validação.

Quando a IA não acha data nenhuma, quem pergunta é o app, uma data por
matéria, antes de aplicar. Quem prefere não informar continua tendo as
matérias cadastradas, e a resposta diz em uma linha por que o calendário não
se moveu, em vez de deixar a pessoa procurando sessões que nunca seriam
criadas.

### Aplicar é um serviço, não um monte de chamadas da tela

`POST /ai/study-plan/apply` cria as matérias que faltam, as avaliações, os
conteúdos vindos dos `topics` e então recalcula. Três decisões aqui:

- **Idempotência por nome normalizado.** `normalizeSubjectName` (que ignora
  acento e caixa) subiu do app para o `packages/shared`, junto com a paleta de
  cores, justamente porque agora os dois lados precisam decidir igual se
  "Cálculo II" e "calculo ii" são a mesma matéria. Avaliação com mesmo título
  e mesma data também não duplica.
- **Os tópicos vão para a avaliação mais próxima daquela matéria.** Espalhar o
  mesmo conteúdo por todas as provas da matéria multiplicaria o estudo; ligar
  à mais distante adiaria tudo. A mais próxima é a que o `deadline-first` vai
  apertar primeiro, que é o comportamento que a pessoa espera ao aplicar um
  plano.
- **Um `recalculate` só, no fim e fora da transação.** Recalcular a cada
  matéria criada refaria o cronograma inteiro N vezes para chegar ao mesmo
  lugar, e o recálculo tem transação própria.

### A disponibilidade é oferecida, nunca sobrescrita

Se a semana estiver toda zerada, a tela oferece preencher com os minutos por
dia que a IA sugeriu. Oferece: sobrescrever uma disponibilidade cadastrada à
mão seria apagar uma decisão de quem estuda, e é justamente o dado que o
planejador trata como verdade.
