# `src/controllers`

Estado, validação e ações das telas. Uma pasta por tela, com o mesmo nome da
pasta correspondente em `src/views/`.

Um controller é um hook, então o arquivo é `NomeController.ts` e o export é
`useNomeController`. Ele conhece `useState`, o contexto de sessão, os schemas
de `@study-flow/shared` e o roteador; não conhece `View`, `Text` nem
`StyleSheet`.

Tela sem estado nenhum não precisa de controller.

Convenções completas: `docs/convencoes-de-codigo.md`.
