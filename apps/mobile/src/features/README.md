# `src/features`

Uma pasta por funcionalidade do produto, cada uma reunindo o que só pertence a
ela: componentes de tela, hooks, chamadas de API e tipos locais.

Organização prevista para as próximas etapas:

```
features/
├── auth/          # cadastro, login, sessão
├── subjects/      # matérias
├── assessments/   # provas e trabalhos + conteúdos a estudar
├── availability/  # disponibilidade semanal e exceções
├── calendar/      # calendário e detalhe do dia
├── plan/          # plano de estudos e recálculo
└── resources/     # materiais de apoio
```

Regras:

- Uma funcionalidade não importa arquivos de dentro de outra. O que for
  compartilhado sobe para `src/components`, `src/hooks` ou `src/services`.
- As telas ficam em `src/app/` (Expo Router) e devem ser finas: montam a
  interface a partir do que está aqui.

Vazio nesta etapa: nenhuma funcionalidade foi implementada ainda.
