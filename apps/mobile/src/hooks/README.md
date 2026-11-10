# `src/hooks`

Hooks de React reutilizáveis por mais de uma tela, por exemplo estado de
requisição, debounce, formatação reativa de datas.

Hook que serve a uma tela só não fica aqui: ele é o controller dela, em
`src/controllers/<tela>/`.

Hoje: `useKeyboardOverlap` (teclado sobre a tela) e `useSavedStudyPlan` (plano da IA
aplicado, usado na lista e no detalhe de matérias).
