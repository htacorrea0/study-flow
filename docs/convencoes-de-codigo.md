# Convenções de código

Este documento define **onde cada arquivo mora** e **como ele se chama**. Vale para o
repositório inteiro (`apps/api`, `apps/mobile`, `packages/shared`).

A regra que vem antes de todas as outras: **o nome do arquivo diz o papel dele**. Quem abre
a pasta entende a camada sem precisar abrir nenhum arquivo, e quem procura "o controller do
login" procura por `LoginController`, não por "o arquivo que tem a função de login".

---

## 1. Sufixo por papel

Arquivos que ocupam um papel de arquitetura usam **PascalCase + sufixo do papel**:

| Papel | Sufixo | Exemplo |
|---|---|---|
| Controller | `Controller` | `LoginController.ts` |
| Service | `Service` | `AuthService.ts` |
| Model (acesso a dados) | `Model` | `UserModel.ts` |
| DTO (recorte de saída) | `Dto` | `UserDto.ts` |
| Schema de validação | `Schemas` | `AuthSchemas.ts` |
| Rotas | `Routes` | `AuthRoutes.ts` |
| Middleware | `Middleware` | `RateLimitMiddleware.ts` |
| Contexto do React | `Context` | `SessionContext.tsx` |
| Componente de interface | (nenhum) | `TextField.tsx` |

Arquivos que **não** ocupam um papel de arquitetura continuam em camelCase descritivo:
utilitários (`formErrors.ts`, `timezone.ts`), configuração (`env.ts`, `prisma.ts`),
infraestrutura de baixo nível (`security/password.ts`, `security/token.ts`) e barris
(`index.ts`).

Classes de erro são PascalCase por serem classes: `AppError.ts`, `HttpErrors.ts`.

**Export principal.** Um controller exporta um símbolo com o mesmo nome do arquivo
(`LoginController.ts` exporta `LoginController`). Nos demais papéis o arquivo nomeia o
módulo e os exports seguem em camelCase (`RateLimitMiddleware.ts` exporta `rateLimit`),
porque eles são usados como função no meio de uma expressão, e não como nome próprio.

---

## 2. Área de views (mobile)

Uma tela nunca é um arquivo solto. Cada tela tem uma **pasta** em `src/views/`, nomeada em
camelCase, e dentro dela:

```
src/views/
├── _templates/                  templates usados por mais de uma tela
│   ├── _screenHeader.tsx
│   └── _formError.tsx
├── login/
│   ├── login.tsx                a tela: tem o nome da pasta
│   └── _loginForm.tsx           template usado só por esta tela
└── signUp/
    ├── signUp.tsx
    ├── _signUpForm.tsx
    └── modals/                  subpastas quando a tela cresce
        └── _resetPassword.tsx
```

Quatro regras:

1. **A pasta é a tela.** O arquivo principal tem exatamente o nome da pasta.
2. **Template começa com `_`.** Qualquer pedaço reaproveitado ou extraído para não
   inchar a tela é um template, e o `_` o separa visualmente do arquivo principal na
   listagem da pasta.
3. **O `_` é do arquivo, não do símbolo.** `_loginForm.tsx` exporta
   `LoginForm`; o arquivo principal exporta por padrão o componente com o nome
   da pasta em PascalCase (`login/login.tsx` exporta `Login`).
4. **Template de uma tela só mora na pasta dela.** Template de mais de uma tela sobe para
   `_templates/`. Componente genérico, sem relação com nenhuma tela específica (botão,
   campo de texto), não é template: mora em `src/components/ui/`.

---

## 3. Controllers espelham as views

Para cada pasta de tela em `views/` existe a pasta de mesmo nome em `controllers/`:

```
src/controllers/
├── login/
│   └── LoginController.ts
└── signUp/
    ├── SignUpController.ts
    └── ResetPasswordModalController.ts
```

O controller guarda **estado, validação e o que acontece ao enviar**. A view só desenha o
que o controller devolve. O critério prático: se o arquivo tem `useState`, `fetch` ou uma
regra de "quando isso, então aquilo", é controller; se tem `<View>` e `StyleSheet`, é view.

No React um controller é um hook, então o export começa com `use`
(`LoginController.ts` exporta `useLoginController`). É a única divergência entre nome de
arquivo e nome de export, e existe porque as regras do React dependem do prefixo `use`
para reconhecer um hook.

Tela sem estado nenhum não precisa de controller.

---

## 4. Exceção: as rotas do Expo Router

O Expo Router **deriva a URL do caminho do arquivo**: `app/(auth)/login.tsx` é a rota
`/login`. Esses arquivos não podem ser renomeados nem movidos, e `_layout.tsx` tem
significado próprio para o framework (não é um template no sentido da seção 2).

Por isso `src/app/` contém **só rotas finas**: cada arquivo reexporta a view
correspondente e não tem conteúdo próprio.

```ts
// src/app/(auth)/login.tsx
export { default } from '@/views/login/login';
```

Assim a URL continua ditada pelo framework e a tela continua organizada pelo nosso padrão.
Os nomes de rota são em português por serem visíveis para quem usa o app (`/cadastro`);
os nomes de pasta e de arquivo são em inglês como o resto do código (`views/signUp/`).

---

## 5. Backend: um controller por ação

Cada ação HTTP tem o seu arquivo, agrupado por recurso:

```
apps/api/src/controllers/
├── auth/
│   ├── SignUpController.ts      POST /auth/signup
│   ├── LoginController.ts       POST /auth/login
│   └── MeController.ts          GET  /auth/me
└── health/
    ├── LivenessController.ts    GET  /health
    └── ReadinessController.ts   GET  /health/ready
```

Um arquivo, um handler, um export. O arquivo de rotas lê como um índice da API:

```ts
authRoutes.post('/login', loginLimiter, validateRequest({ body: signInSchema }), LoginController);
```

A ordem das camadas continua a da Etapa 1: **rota → middleware → controller → service →
model → banco**. O controller não conhece Prisma; o service não conhece `req`/`res`.

---

## 6. Testes

O arquivo de teste tem o nome do arquivo testado mais `.test.ts`:
`AuthService.ts` é testado por `tests/AuthService.test.ts`. Testes que atravessam camadas
ficam em `tests/integration/` e levam o nome do fluxo (`auth.int.test.ts`).

---

## 7. O que este documento não governa

- `packages/shared`: a pasta já declara o papel (`schemas/`, `types/`) e os arquivos são
  contratos, não camadas. Seguem em camelCase.
- `apps/api/src/generated/`: gerado pelo Prisma. Nunca editar nem renomear.
- `src/theme/`: tokens de design, um arquivo por categoria.

---

## 8. Ao criar um arquivo novo

1. Qual é o papel dele? Use o sufixo da seção 1.
2. É uma tela? Crie a pasta em `views/`, não um arquivo solto.
3. É pedaço de tela? Nomeie com `_` na frente.
4. É estado ou regra de tela? Vai para `controllers/<tela>/`, não para dentro da view.
5. É rota do Expo Router? O arquivo só reexporta a view.
