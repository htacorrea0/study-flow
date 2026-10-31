# `src/components`

Componentes de interface **reutilizáveis e sem regra de negócio**: botão,
campo de texto, cartão, estado vazio, carregamento.

Regras:

- Recebem dados por props e devolvem eventos por callback. Não chamam a API,
  não leem contexto de autenticação e não decidem nada de domínio.
- Componente usado por uma única tela não mora aqui: ele é um template e mora
  na pasta da tela, em `src/views/<tela>/`, com `_` na frente do nome.
- Nada de lógica de cálculo de plano de estudos: isso é responsabilidade do
  backend (`apps/api/src/domain/planning`).

Nesta etapa: `ui/` tem `Button`, `TextField`, `InlineLink` e
`ScreenContainer`; `icons/` tem os cinco ícones usados pelas telas de
autenticação.
