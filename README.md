# Study Flow

Aplicativo mobile de organização acadêmica. A estudante cadastra suas
matérias, as datas de provas e trabalhos e o que precisa estudar; o sistema
transforma isso em um roteiro de estudos distribuído no calendário, que se
recalcula conforme o progresso real.

> **Estado atual: Etapa 1 — estrutura inicial.**
> Este repositório contém a base técnica do projeto: monorepo configurado,
> camadas de arquitetura, modelagem do banco, contratos compartilhados e
> documentação. **Nenhuma tela e nenhuma funcionalidade foram implementadas.**
> A lista completa do que falta está na seção
> [O que ainda não foi implementado](#13-o-que-ainda-não-foi-implementado).

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Stack](#2-stack)
3. [Pré-requisitos](#3-pré-requisitos)
4. [Setup em 5 passos](#4-setup-em-5-passos)
5. [Estrutura do repositório](#5-estrutura-do-repositório)
6. [Variáveis de ambiente e segredos](#6-variáveis-de-ambiente-e-segredos)
7. [Banco de dados e migrations](#7-banco-de-dados-e-migrations)
8. [Rodando a API](#8-rodando-a-api)
9. [Rodando o app no celular (Expo Go)](#9-rodando-o-app-no-celular-expo-go)
10. [Scripts disponíveis](#10-scripts-disponíveis)
11. [Testes](#11-testes)
12. [Arquitetura em resumo](#12-arquitetura-em-resumo)
13. [O que ainda não foi implementado](#13-o-que-ainda-não-foi-implementado)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Visão geral

O problema: organizar estudos para várias matérias ao mesmo tempo é difícil
não por falta de informação, mas por falta de um plano que caiba no tempo que
a pessoa realmente tem — e que se ajuste quando o plano não é cumprido.

O Study Flow resolve isso em quatro movimentos:

1. **Entrada** — matérias, provas e trabalhos com data, e os conteúdos a
   estudar para cada avaliação.
2. **Disponibilidade** — quantos minutos a pessoa tem por dia da semana, mais
   exceções para dias específicos.
3. **Plano** — o sistema distribui os conteúdos pelos dias disponíveis até a
   data de cada avaliação, respeitando prioridade e esforço estimado.
4. **Recálculo** — conforme as atividades são concluídas, adiadas ou marcadas
   como não realizadas, o plano é regerado — **sem perder o histórico de
   progresso já registrado**.

---

## 2. Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Mobile | React Native + Expo (SDK 58) | Um código para Android e iOS, e o Expo Go permite testar no celular sem build nativo. |
| Navegação | Expo Router | Rotas por arquivo, no mesmo modelo de pastas do resto do projeto. |
| HTTP (mobile) | Axios | Interceptors centralizam token e tratamento de erro num lugar só. |
| Notificações | Expo Notifications | Lembretes locais sem depender de serviço pago. |
| Backend | Node.js + Express 5 | Simples, previsível, e o Express 5 já encaminha erros de `async` sozinho. |
| Linguagem | TypeScript (modo estrito) | Contrato entre app e API verificado em tempo de compilação. |
| ORM | Prisma 7 | Migrations versionadas e client tipado a partir do schema. |
| Banco | PostgreSQL 18 | Relacional, que é a natureza do domínio (usuário → matéria → avaliação → conteúdo). |
| Validação | Zod 4 | Valida a entrada e já gera o tipo — sem duplicar a definição. |
| Autenticação | JWT + Argon2id | Padrão para API sem estado; Argon2id é a recomendação atual para hash de senha. |
| Testes | Vitest + Supertest | Roda TypeScript sem configuração extra; Supertest testa as rotas sem abrir porta. |
| Repositório | npm workspaces | App, API e contratos compartilhados no mesmo repositório. |

As justificativas completas, incluindo o que foi descartado e por quê, estão
em [`docs/decisoes-arquiteturais.md`](docs/decisoes-arquiteturais.md). Os
tokens visuais, os componentes de interface e o mapa do Figma de referência
estão em [`docs/design-system.md`](docs/design-system.md).

---

## 3. Pré-requisitos

| Ferramenta | Versão mínima | Como conferir |
|---|---|---|
| Node.js | 20 (recomendado 22+) | `node --version` |
| npm | 10 | `npm --version` |
| Docker + Docker Compose | Compose v2.17 | `docker --version` e `docker compose version` |
| Git | qualquer recente | `git --version` |

No celular:

- **Expo Go** instalado ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
  / [iOS](https://apps.apple.com/app/expo-go/id982107779)).
- Celular e computador **na mesma rede Wi-Fi**. Isso não é opcional: o app no
  celular busca a API pelo IP da sua máquina.

### Notas por sistema

**Linux** — se `docker ps` pedir `sudo`, adicione seu usuário ao grupo
`docker` e reabra a sessão:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

**Windows** — use o **Docker Desktop** com backend WSL2. Rode os comandos
deste README no **PowerShell** (não no CMD).

**macOS** — Docker Desktop ou Colima, tanto faz.

---

## 4. Setup em 5 passos

### Passo 1 — Clonar e instalar

**Linux / macOS**

```bash
git clone <url-do-repositorio> studyflow
cd studyflow
npm install
```

**Windows (PowerShell)**

```powershell
git clone <url-do-repositorio> studyflow
Set-Location studyflow
npm install
```

O `npm install` instala os três workspaces de uma vez e gera o client do
Prisma automaticamente (não precisa de banco para isso).

### Passo 2 — Criar os arquivos `.env`

São três, um por contexto. Nenhum deles vai para o git.

**Linux / macOS**

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

**Windows (PowerShell)**

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

### Passo 3 — Gerar o `JWT_SECRET`

O mesmo comando funciona nos dois sistemas:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cole o valor em `apps/api/.env`, na linha `JWT_SECRET=`. A API **não sobe**
com um segredo de menos de 32 caracteres — é proposital.

### Passo 4 — Subir o banco e aplicar as migrations

```bash
npm run db:up
npm run db:deploy
```

O primeiro comando baixa a imagem do PostgreSQL (só na primeira vez), sobe o
container e espera ele ficar saudável. O segundo cria todas as tabelas.

> Atalho: `npm run setup` faz os passos 1, 4 e as migrations de uma vez — mas
> os `.env` (passos 2 e 3) precisam existir antes.

### Passo 5 — Rodar API e app

Dois terminais, porque o Expo precisa de um terminal interativo.

**Terminal 1 — API**

```bash
npm run dev:api
```

**Terminal 2 — app**

```bash
npm run dev:mobile
```

Leia o QR code com o **Expo Go** (Android) ou com a **câmera** (iOS).

---

## 5. Estrutura do repositório

```
studyflow/
├── apps/
│   ├── api/                      Backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma     Modelo de dados (fonte da verdade do banco)
│   │   │   └── migrations/       Histórico versionado — vai para o git
│   │   ├── src/
│   │   │   ├── config/           env validado com Zod, singleton do Prisma
│   │   │   ├── routes/           Caminhos e middlewares de cada endpoint
│   │   │   ├── controllers/      Um arquivo por ação: lê, chama o service, responde
│   │   │   ├── services/         Regra de negócio
│   │   │   ├── models/           Acesso ao banco via Prisma, por agregado
│   │   │   ├── dtos/             Entidade do banco → resposta pública
│   │   │   ├── schemas/          Schemas Zod de validação
│   │   │   ├── domain/planning/  Algoritmo de planejamento (só a interface)
│   │   │   ├── middlewares/      Validação, autenticação, erros, 404
│   │   │   ├── errors/           AppError e os erros HTTP derivados
│   │   │   ├── types/            Tipos e augmentação do Express
│   │   │   ├── app.ts            Monta o Express (sem abrir porta)
│   │   │   └── server.ts         Abre a porta e encerra com ordem
│   │   ├── tests/                Vitest + Supertest
│   │   └── prisma.config.ts      Configuração da CLI do Prisma
│   │
│   └── mobile/                   App React Native
│       ├── src/
│       │   ├── app/              Rotas do Expo Router (só reexportam a view)
│       │   ├── views/            Uma pasta por tela; templates com `_` na frente
│       │   ├── controllers/      Estado e regras de cada tela, espelhando views/
│       │   ├── components/       Componentes reutilizáveis sem regra
│       │   ├── services/         Cliente Axios, chamadas de API, armazenamento
│       │   ├── hooks/            Hooks compartilhados por mais de uma tela
│       │   ├── contexts/         Estado global (sessão)
│       │   ├── models/           Tipos de apresentação
│       │   ├── constants/        Configuração pública do app
│       │   ├── types/            Ponto único de import de tipos
│       │   └── utils/            Funções puras
│       ├── app.json              Configuração do Expo
│       └── metro.config.js       Ajustes do bundler para o monorepo
│
├── packages/shared/              Contratos usados pelos dois lados
│   └── src/
│       ├── types/                Uniões de domínio e envelope de erro
│       └── schemas/              Schemas Zod comuns (uuid, data, paginação)
│
├── docs/                         Decisões, design system e convenções de código
├── docker-compose.yml            PostgreSQL de desenvolvimento
└── package.json                  Workspaces e scripts do dia a dia
```

Onde cada arquivo mora e como ele se chama:
[`docs/convencoes-de-codigo.md`](docs/convencoes-de-codigo.md).

Cada pasta ainda sem código tem um `README.md` descrevendo sua
responsabilidade e o que **não** pode entrar nela.

---

## 6. Variáveis de ambiente e segredos

### Regras que valem para todo mundo

1. **`.env` nunca vai para o git.** Já está no `.gitignore`. Só os
   `.env.example` são versionados, e eles contêm apenas valores ilustrativos.
2. **Segredo de verdade não entra no app mobile.** Tudo com prefixo
   `EXPO_PUBLIC_` é embutido no bundle e fica legível para quem tiver o APK.
   Chaves de serviços de terceiros ficam exclusivamente no backend.
3. **Senha nunca é guardada em texto.** O banco só armazena hash Argon2id.

### `.env` (raiz) — lido pelo Docker Compose

| Variável | Exemplo | Para quê |
|---|---|---|
| `POSTGRES_USER` | `studyflow` | Usuário do banco de desenvolvimento |
| `POSTGRES_PASSWORD` | `studyflow_dev_password` | Senha local. Não é segredo de produção. |
| `POSTGRES_DB` | `studyflow` | Nome do banco |
| `POSTGRES_PORT` | `5432` | Porta exposta na sua máquina |

> Se já existir um PostgreSQL ocupando a 5432 na sua máquina, troque
> `POSTGRES_PORT` aqui **e** a porta na `DATABASE_URL` em `apps/api/.env`.

### `apps/api/.env`

| Variável | Exemplo | Para quê |
|---|---|---|
| `NODE_ENV` | `development` | Ambiente |
| `PORT` | `3333` | Porta da API |
| `HOST` | `0.0.0.0` | **Mantenha assim.** Com `127.0.0.1` a API só aceita conexões da própria máquina e o celular nunca alcança. |
| `DATABASE_URL` | `postgresql://studyflow:studyflow_dev_password@localhost:5432/studyflow?schema=public` | Conexão com o banco |
| `JWT_SECRET` | (gerado, 32+ caracteres) | Assinatura dos tokens |
| `JWT_EXPIRES_IN` | `7d` | Validade do token |
| `CORS_ORIGIN` | `*` | Origens permitidas. Em produção, restringir. |

### `apps/mobile/.env`

| Variável | Exemplo | Para quê |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://192.168.0.10:3333` | **Opcional.** Se ficar vazia, o app descobre sozinho o IP da máquina que está rodando o Metro. Preencha só para apontar para outro ambiente. |

### Gerando um segredo

Funciona igual em Linux, macOS e Windows:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 7. Banco de dados e migrations

### Como funciona o automático

`npm run dev:api` faz três coisas, nesta ordem:

```
docker compose up -d --wait     sobe o Postgres e espera ficar saudável
prisma migrate deploy           aplica as migrations que ainda faltam
tsx watch src/server.ts         inicia a API
```

Ou seja: **quem dá `git pull` e roda `npm run dev:api` já recebe o banco
criado e as tabelas atualizadas.** Não existe passo manual.

`migrate deploy` é idempotente e nunca apaga dados: se não houver migration
pendente, ele avisa e sai.

### Fluxo do time

**Você alterou o `schema.prisma`:**

```bash
npm run db:migrate -- --name descricao_curta_da_mudanca
```

Isso cria `apps/api/prisma/migrations/<timestamp>_descricao/migration.sql` e
aplica no seu banco. **Commite o `schema.prisma` e a pasta da migration
juntos** — sem o `.sql`, ninguém consegue reproduzir a mudança.

**Alguém do time alterou o schema:**

```bash
git pull
npm install
npm run dev:api
```

Pronto. O `migrate deploy` embutido no `dev:api` resolve.

### Outros comandos

```bash
npm run db:status    # quais migrations foram aplicadas e quais faltam
npm run db:studio    # abre o Prisma Studio no navegador para ver os dados
npm run db:down      # para o banco, preservando os dados
npm run db:reset     # APAGA o volume e recria o banco do zero
```

> `db:reset` destrói os dados locais sem confirmação. É a saída para
> migration com conflito (*drift*) ou banco em estado estranho.

---

## 8. Rodando a API

```bash
npm run dev:api
```

Saída esperada:

```
  Study Flow API — ambiente: development
  Local:    http://localhost:3333
  Saúde:    http://localhost:3333/health
  Celular:  http://192.168.0.10:3333
```

A linha **Celular** já traz o IP da sua máquina na rede — é esse endereço que
o app usa.

Para conferir que está tudo de pé:

**Linux / macOS**

```bash
curl http://localhost:3333/health
curl http://localhost:3333/health/ready
```

**Windows (PowerShell)**

```powershell
Invoke-RestMethod http://localhost:3333/health
Invoke-RestMethod http://localhost:3333/health/ready
```

- `/health` responde `{"status":"ok","uptimeSeconds":N}` sem tocar no banco.
- `/health/ready` responde `{"database":"up",...}` — confirma a conexão com o
  PostgreSQL. Se devolver `503`, o banco não está acessível.

A API recarrega sozinha a cada alteração nos arquivos.

---

## 9. Rodando o app no celular (Expo Go)

```bash
npm run dev:mobile
```

O Metro sobe e mostra um QR code. Leia com o **Expo Go** (Android) ou com a
**câmera** (iOS).

### Descobrir o IP da sua máquina

Normalmente não é preciso — o app descobre sozinho. Se precisar:

**Linux**

```bash
hostname -I | awk '{print $1}'
```

**macOS**

```bash
ipconfig getifaddr en0
```

**Windows (PowerShell)**

```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' }).IPAddress
```

### Liberar a porta 3333 no firewall do Windows

O Windows bloqueia conexões de entrada por padrão, então o celular não
alcança a API. Em um PowerShell **como administrador**, uma vez só:

```powershell
New-NetFirewallRule -DisplayName "Study Flow API" -Direction Inbound -LocalPort 3333 -Protocol TCP -Action Allow -Profile Private
```

Se o Metro também não for alcançado, repita para a porta `8081`.

> Use `-Profile Private`. Se o Windows classificou sua rede Wi-Fi como
> "Pública", mude para "Privada" em *Configurações → Rede e Internet* — é mais
> seguro do que liberar a porta em rede pública.

### Checagem do ambiente do app

```bash
npm run -w @study-flow/mobile doctor
```

---

## 10. Scripts disponíveis

Todos rodam **na raiz do repositório** e funcionam igual em Linux, macOS e
Windows.

| Script | O que faz |
|---|---|
| `npm run setup` | Instala, sobe o banco e aplica as migrations |
| `npm run dev:api` | Banco + migrations + API em modo watch |
| `npm run dev:mobile` | Metro bundler (QR code do Expo Go) |
| `npm run db:up` | Sobe o PostgreSQL e espera ficar saudável |
| `npm run db:down` | Para o PostgreSQL preservando os dados |
| `npm run db:reset` | Apaga o volume e recria o banco do zero |
| `npm run db:migrate -- --name x` | Cria uma migration nova |
| `npm run db:deploy` | Aplica as migrations pendentes |
| `npm run db:status` | Mostra o estado das migrations |
| `npm run db:generate` | Regenera o client do Prisma |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run db:logs` | Acompanha os logs do PostgreSQL |
| `npm run typecheck` | Verifica tipos nos três workspaces |
| `npm test` | Roda os testes da API |
| `npm run test:watch` | Testes em modo watch |

---

## 11. Testes

### Sem banco e sem Docker

```bash
npm test
```

Roda em qualquer máquina, inclusive sem Docker no ar. O `app.ts` é separado do
`server.ts`, então o Supertest exercita as rotas sem abrir porta, e o que
depende do banco fica mockado.

| Arquivo | O que cobre |
|---|---|
| `tests/HealthRoutes.test.ts` | Rotas de saúde respondem; rota inexistente devolve `404` no formato padrão de erro. |
| `tests/ErrorHandlerMiddleware.test.ts` | Cada tipo de `AppError` vira o status HTTP certo; erro de validação devolve `422` com a lista de campos; erro não previsto vira `500` sem vazar detalhe interno. |
| `tests/security/password.test.ts` | O hash nunca é a senha; `verify` aceita a correta e rejeita a errada; dois hashes da mesma senha diferem (salt). |
| `tests/security/token.test.ts` | Token assinado verifica; assinatura adulterada, token expirado e segredo errado falham. |
| `tests/AuthService.test.ts` | Com o model mockado: e-mail já cadastrado vira `ConflictError`; usuário inexistente e senha errada produzem a **mesma** mensagem; e-mail com maiúsculas e espaços é normalizado antes da busca. |
| `tests/AuthRoutes.test.ts` | Contrato das três rotas de auth, `422` com `issues`, `401` sem Bearer e `passwordHash` ausente de toda resposta. |
| `tests/passwordPolicy.test.ts` | A política de senha aceita o que deve aceitar e recusa o que falta maiúscula, minúscula, caractere especial ou tamanho; o que falta vira uma mensagem só; o login não aplica a política. |
| `tests/RateLimitMiddleware.test.ts` | A janela deslizante libera dentro do limite e devolve `429` ao estourar. |

### Com banco de verdade

```bash
npm run test:int
```

**Exige Docker.** O comando sobe o Postgres (`npm run db:up`), cria o banco
`studyflow_test` se ele não existir, aplica as migrations nele
(`apps/api/scripts/setup-test-db.mjs`, que roda igual em Linux e Windows) e só
então executa `tests/integration/`.

O teste percorre o caminho completo: cadastro `201`, login `200` com o mesmo
e-mail escrito em outra capitalização, `/auth/me` com o token, `409` ao repetir
o cadastro e, por último, uma consulta direta no banco conferindo que o campo
gravado é o hash Argon2id e que a senha em texto não aparece em lugar nenhum.

Os dois comandos são separados de propósito: `npm test` precisa continuar
rodando na máquina de quem ainda não configurou o Docker.

### Mobile

O app ainda não tem runner de teste. `jest-expo` e biblioteca de teste de
componente ficam para uma etapa própria.

---

## 12. Arquitetura em resumo

### Backend — fluxo de uma requisição

```
rota → validateRequest (Zod) → authenticate → controller → service → model (Prisma)
                                                              ↘ domain/planning
                                                    dto ← resposta pública
```

Regras que sustentam isso:

- **Controller não contém regra**; service não conhece `req`/`res`.
- **Toda entrada é validada na borda**, com Zod, antes de chegar ao
  controller.
- **Todo erro sai pelo `errorHandler`** no formato
  `{ error: { code, message, issues? } }`. Nenhum controller precisa de
  `try/catch`.
- **Toda consulta filtra por `userId`.** Um id na URL nunca é suficiente para
  ler dado de outra pessoa.
- **O algoritmo de planejamento não toca no banco.** Ele recebe dados prontos
  e devolve atividades e conflitos — por isso é testável sem infraestrutura.

### Mobile

- **Rota, view e controller são três arquivos.** A rota em `src/app/` só
  reexporta a view; a view em `src/views/<tela>/` desenha; o controller em
  `src/controllers/<tela>/` guarda estado, validação e navegação.
- Toda chamada passa pelo `apiClient`, que resolve a URL base, anexa o token
  e normaliza o erro.
- O app **não conhece o Prisma**. Os tipos vêm de `@study-flow/shared`.

### Compartilhado

`packages/shared` guarda só o que os dois lados precisam: uniões de domínio,
envelope de erro, paginação e schemas Zod comuns. Nada de Prisma, nada de
Node, nada de React Native.

Detalhes e trade-offs: [`docs/decisoes-arquiteturais.md`](docs/decisoes-arquiteturais.md).
Tokens, componentes e o mapa do Figma: [`docs/design-system.md`](docs/design-system.md).
Nomes de arquivo e organização de pastas:
[`docs/convencoes-de-codigo.md`](docs/convencoes-de-codigo.md).

---

## 13. O que ainda não foi implementado

### O que já existe

**Autenticação completa, ponta a ponta:**

- `POST /auth/signup`, `POST /auth/login` e `GET /auth/me` na API, com senha
  guardada só como hash Argon2id, JWT de acesso, rate limit nas rotas de auth
  e mensagem de erro genérica no login (não revela se o e-mail existe).
- Telas de **login** e **cadastro** no app, seguindo o Figma de referência
  (tokens e padrões em [`docs/design-system.md`](docs/design-system.md)), com o token guardado no
  SecureStore do aparelho e as rotas internas protegidas por uma guarda de
  sessão.
- O `middleware/authenticate` deixou de ser esqueleto: ele valida o Bearer e
  popula `req.user`.

**Dashboard e calendário, lendo dados de verdade:**

- `GET /dashboard`, `GET /calendar?month=AAAA-MM` e `GET /calendar/:date` na
  API, todas atrás do `authenticate`. Toda consulta filtra pelo usuário da
  sessão: as atividades não têm `userId` próprio, então o filtro passa pelo
  plano (`plan: { userId }`), e isso é coberto por teste de integração.
- Telas de **dashboard** (meta do dia, sequência, próximas sessões) e
  **calendário** (grade do mês com pontos por matéria e agenda do dia
  selecionado), com os três estados: carregando, erro e vazio. O dia de uma
  prova ou entrega ganha um anel na cor da matéria, e o prazo aparece no topo
  da agenda daquele dia. Avaliação não depende de plano ativo: o anel aparece
  mesmo num mês sem sessão marcada.
- Navegação por abas: Início, Matérias, Calendário, Timer e Progresso.
  Matérias, Timer e Progresso ainda são telas em branco, e dizem isso.
- **Seed** com dados fictícios (`npm run db:seed`): um usuário de
  demonstração com matérias, avaliações, disponibilidade, um plano ativo e
  progresso suficiente para uma sequência real.

### O que ainda não existe

**Interface**
- Telas de matérias, avaliações, conteúdos, disponibilidade, cronômetro,
  progresso e perfil. As três últimas abas abrem uma tela em branco.
- Marcar uma atividade como concluída pela tela. Hoje o progresso só entra
  pelo seed.
- Recuperação de senha, onboarding e login com Google ou Apple.
- Foto de perfil. O avatar mostra as iniciais do nome.

**Backend**
- CRUD de matérias, avaliações, conteúdos e disponibilidade. As três rotas de
  leitura existem; nenhuma rota de escrita.
- Algoritmo de distribuição do plano de estudos e as regras de
  redistribuição. Existe a interface `StudyPlanner` e os tipos de entrada e
  saída: nenhuma implementação, nem fictícia. O seed grava as atividades
  direto, marcadas com `algorithmVersion: 'seed-v1'` para que isso fique
  explícito no banco.
- Notificações agendadas.
- Revogação de sessão no servidor. Não há refresh token nem tabela de
  sessões; o logout apaga o token no aparelho. O motivo e a contrapartida
  estão em [`docs/decisoes-arquiteturais.md`](docs/decisoes-arquiteturais.md),
  seção 11.

**Integrações**
- Busca de conteúdo no YouTube ou na internet.
- Qualquer integração com IA (Gemini ou outra).
- Qualquer API externa.

**Testes**
- O app mobile ainda não tem runner de testes. A aritmética do calendário
  (`apps/mobile/src/utils/date.ts`) foi conferida à mão e continua sem teste
  automatizado.

---

## 14. Troubleshooting

### `Bind for 0.0.0.0:5432 failed: port is already allocated`

Já existe algo usando a 5432 (outro container, ou um PostgreSQL instalado na
máquina).

Descubra o que é:

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'   # containers
```

```bash
ss -lntp | grep 5432          # Linux
```

```powershell
Get-NetTCPConnection -LocalPort 5432          # Windows
```

Solução mais simples: escolher outra porta. Em `.env`, troque
`POSTGRES_PORT=5434`; em `apps/api/.env`, ajuste a porta na `DATABASE_URL`
para a mesma. Depois `npm run db:up`.

### O celular não alcança a API

Na ordem:

1. Celular e computador estão na **mesma rede Wi-Fi**? Rede de visitantes
   costuma isolar os dispositivos.
2. `HOST=0.0.0.0` em `apps/api/.env`? Com `127.0.0.1` não funciona.
3. No Windows, a porta 3333 está liberada no firewall? Veja a
   [seção 9](#9-rodando-o-app-no-celular-expo-go).
4. Teste pelo navegador **do celular**: `http://<IP-DA-MAQUINA>:3333/health`.
   Se isso não responder, o problema é de rede, não do app.
5. Último recurso: preencha `EXPO_PUBLIC_API_URL` em `apps/mobile/.env` com o
   IP na mão e reinicie o Metro.

### `permission denied` ao usar o Docker no Linux

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Migration com conflito (*drift*)

Acontece quando o banco local não bate com o histórico de migrations —
normalmente depois de alterar o schema sem gerar a migration, ou de trocar de
branch.

```bash
npm run db:status   # ver o diagnóstico
npm run db:reset    # recriar do zero (APAGA os dados locais)
```

### `Environment variable not found: DATABASE_URL`

O `apps/api/.env` não existe ou está sem a variável. Volte ao
[passo 2 do setup](#4-setup-em-5-passos).

### A API não sobe e reclama do `JWT_SECRET`

É a validação funcionando. Gere um segredo com 32+ caracteres:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### O Metro trava ou mostra erro de módulo que você acabou de criar

Cache. Limpe:

```bash
npm run -w @study-flow/mobile start -- --clear
```

### Erro de tipo no client do Prisma depois de alterar o schema

O client gerado ficou velho:

```bash
npm run db:generate
```

### O `npm install` avisa sobre *install scripts*

```
npm warn install-scripts 3 packages have install scripts not yet covered by allowScripts
```

É um aviso de segurança do npm 11, não um erro. O projeto instala e roda
normalmente — esses scripts não são necessários aqui. Pode ignorar.
