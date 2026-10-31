// Configuração do Metro para monorepo com npm workspaces.
// Sem isto o bundler não enxerga `packages/shared` nem as dependências
// içadas para o `node_modules` da raiz.
// Referência: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

// 1. Observa o monorepo inteiro, para recarregar quando `packages/shared` mudar.
config.watchFolders = [workspaceRoot];

// 2. Procura módulos no app e, depois, na raiz do workspace.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// A resolução hierárquica fica ligada (padrão do Expo). A garantia de uma
// única cópia do React vem do campo `overrides` no package.json da raiz.

module.exports = config;
