# `src/contexts`

Estado global compartilhado via Context API — principalmente a sessão do
usuário (token em armazenamento seguro, usuário autenticado, logout).

Regras:

- O token nunca é guardado em memória global solta nem em `AsyncStorage` em
  texto puro: o contexto de autenticação é quem registra o provedor de token
  em `src/services/api/client.ts` (`setAccessTokenProvider`).
- Contexto não faz regra de negócio; ele guarda estado e delega as chamadas
  para `src/services`.

Vazio nesta etapa: a autenticação funcional não faz parte deste escopo.
