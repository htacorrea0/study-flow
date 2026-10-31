# dtos

Tradução entre as entidades do banco e o formato público da API.

Cada funcionalidade ganha aqui um arquivo com funções de mapeamento, por
exemplo `user.dto.ts` com `toUserResponse(user: User): UserResponse`.

**Por que esta camada existe:** o contrato da API precisa ser independente dos
detalhes de persistência. Sem ela, qualquer coluna nova no Prisma vazaria
direto para o app — inclusive colunas que não podem sair do servidor, como
`passwordHash`. Devolver a entidade do Prisma direto na resposta é justamente
o que esta pasta impede.

**Regras:**

- Os tipos de retorno vêm de `@study-flow/shared`, nunca do client do Prisma.
- O mapeamento é explícito, campo a campo. Nada de `...spread` da entidade:
  é assim que um campo sensível aparece na resposta sem ninguém perceber.
- Datas saem como texto ISO 8601.
- Sem consulta ao banco e sem regra de negócio aqui — só transformação.
