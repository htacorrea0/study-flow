# `src/views`

As telas. Uma pasta por tela, nomeada em camelCase, e dentro dela o arquivo
principal com o mesmo nome da pasta:

```
views/
├── _templates/        templates usados por mais de uma tela
├── login/login.tsx
├── signUp/signUp.tsx
└── home/home.tsx
```

Template (pedaço de tela) começa com `_`. Template de uma tela só mora na
pasta dela; de mais de uma, em `_templates/`. Peça genérica de interface, sem
relação com nenhuma tela, não é template: mora em `src/components/ui/`.

A view desenha. Estado, validação, chamada de API e navegação ficam no
controller correspondente em `src/controllers/<tela>/`.

As rotas em `src/app/` só reexportam a view: é o Expo Router que define a URL
pelo caminho do arquivo, e por isso aqueles nomes não seguem este padrão.

Convenções completas: `docs/convencoes-de-codigo.md`.
