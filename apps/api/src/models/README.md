# models

Acesso a dados via Prisma, organizado por agregado do domínio.

Cada agregado ganha aqui um arquivo com as consultas que lhe dizem respeito,
por exemplo `subject.model.ts` com `findManyByUser`, `findByIdForUser`,
`create`, `update` e `remove`.

**Por que esta camada existe:** sem ela, as chamadas ao Prisma se espalham
pelos serviços e a mesma consulta acaba reescrita de formas levemente
diferentes — e basta uma delas esquecer o filtro por `userId` para vazar dado
de outra pessoa.

**Regras:**

- **Toda** consulta filtra por `userId`. Não existe `findMany` sem dono.
- Nada de `req`, `res` ou qualquer tipo do Express aqui.
- Regra de negócio fica nos serviços; aqui mora só a consulta.
- O client vem de `src/config/prisma.ts` — nunca instancie outro `PrismaClient`.
