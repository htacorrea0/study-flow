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
`AvailabilityException`, `StudyPlan`, `StudyProgress` e
`NotificationPreference`. `StudyContent` e `StudyResource` chegam ao usuário
através da avaliação.

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

### 12.8 Sair da conta mora provisoriamente no Progresso

O botão de sair vivia na tela placeholder que o dashboard substituiu. Ele foi
para o rodapé da aba Progresso, que ainda é uma tela em branco, com comentário
dizendo que o lugar dele é a tela de perfil. Sem isso, a única forma de sair
seria limpar os dados do app.

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
