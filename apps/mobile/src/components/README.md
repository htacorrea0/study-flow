# `src/components`

Componentes de interface **reutilizáveis e sem regra de negócio**: botão,
campo de texto, cartão, estado vazio, carregamento.

Regras:

- Recebem dados por props e devolvem eventos por callback. Não chamam a API,
  não leem contexto de autenticação e não decidem nada de domínio.
- Componente usado por uma única tela não mora aqui — mora dentro da pasta da
  funcionalidade correspondente em `src/features/`.
- Nada de lógica de cálculo de plano de estudos: isso é responsabilidade do
  backend (`apps/api/src/domain/planning`).

Vazio nesta etapa: nenhuma interface foi implementada ainda.
