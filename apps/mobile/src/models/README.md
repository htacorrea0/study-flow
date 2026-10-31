# `src/models`

Representações de domínio **do lado do app**: tipos de tela, estados derivados
e conversões entre o formato devolvido pela API e o formato que a interface
consome (por exemplo, agrupar atividades por dia do calendário).

Regras:

- Os contratos com a API vêm de `@study-flow/shared`. Este diretório guarda o
  que é específico da apresentação.
- Nenhum modelo do Prisma é importado aqui. O app não conhece o banco.

Vazio nesta etapa.
