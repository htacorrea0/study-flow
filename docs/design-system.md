# Design system — Study Flow

Este documento é o mapa entre o arquivo de referência no Figma e o código em
`apps/mobile/src/theme/`. Ele existe para que ninguém precise abrir o Figma
para saber qual token usar, e para que, quando o design mudar, fique claro o
que mexer.

**Arquivo de referência:** Figma `wG5SEta14Rx3xISF8BrDPL`.

O Figma é **inspiração visual, não contrato de escopo**. Ele contém telas de
funcionalidades que o documento do projeto não pede, e essas não entram no
backlog só por estarem desenhadas (ver seção 5).

---

## 1. Como o Figma virou código

```
apps/mobile/src/theme/
├── colors.ts       as 10 cores do arquivo
├── typography.ts   estilos prontos, família + tamanho + altura de linha + cor
├── spacing.ts      a escala e as medidas fixas
├── radii.ts        os três raios
└── index.ts
```

Regra de uso: **nenhuma tela escreve `#4f46e5` ou `fontSize: 32` direto.**
Tudo vem do tema. Quando o design mudar, muda em um lugar só.

O arquivo do Figma **não define Figma Variables**: os estilos estão aplicados
diretamente nos nós. Os valores abaixo foram lidos do contexto de design dos
nós `5:36` (login) e `5:112` (quick start do dashboard), não inferidos de uma
captura de tela.

---

## 2. Tokens

### 2.1 Cores (`theme/colors.ts`)

| Token | Hex | Onde aparece no Figma |
|---|---|---|
| `canvas` | `#faf9f5` | Fundo de todas as telas (off-white quente) |
| `surface` | `#ffffff` | Inputs, cards, botões secundários |
| `primary` | `#4f46e5` | Botão principal, links, ícone de navegação ativo |
| `primaryDark` | `#3730a3` | Título de tela |
| `ink` | `#1e1b4b` | Texto forte, label de campo, valor digitado |
| `textMuted` | `#475569` | Subtítulo, texto de apoio, ícone dentro do input |
| `textSubtle` | `#94a3b8` | Placeholder, legenda |
| `border` | `#e2e8f0` | Borda de input e de card |
| `success` | `#10b981` | Ação de estudo, texto e borda do bloco verde |
| `successSoft` | `#e6fdf4` | Fundo do bloco verde |
| `primaryGlow` | `#eef2ff` | Fundo da aba ativa na barra inferior |
| `primaryLabel` | `#e0e7ff` | Rótulo em caixa alta sobre o card índigo da meta |
| `primaryBody` | `#c7d2fe` | Texto de apoio sobre o card índigo da meta |
| `rose` | `#f43f5e` | Texto do badge de sequência, tom de matéria |
| `roseSoft` | `#fff1f2` | Fundo do badge de sequência |
| `amber` | `#f59e0b` | Tom de matéria |
| `purple` | `#a855f7` | Tom de matéria |

Os quatro últimos são **tons de matéria**: valores que o Figma usa nas telas
de exemplo e que o seed adota como padrão. A cor real de cada matéria é
escolhida pela pessoa e chega do banco como hexadecimal, então os componentes
recebem a cor por prop, não por token. O bloco de 44px do item de sessão usa
essa cor a 10% de opacidade (`utils/color.ts`).

Dois valores **não vêm do Figma** e estão marcados como tal no arquivo:

- `danger` (`#dc2626`), usado na borda e na mensagem de campo inválido. O
  arquivo não tem nenhuma tela em estado de erro, e um formulário precisa de
  um. É a extensão mínima.
- `white`, atalho para texto sobre o botão primário.

### 2.2 Tipografia (`theme/typography.ts`)

Duas famílias, ambas Google Fonts com licença OFL, carregadas por
`@expo-google-fonts/*`. A regra que o arquivo segue:
**Outfit para o que é título ou ação, Manrope para o que é leitura.**

| Estilo | Família / peso | Tamanho / altura | Cor |
|---|---|---|---|
| `screenTitle` | Outfit ExtraBold (800) | 32 / 40 | `primaryDark` |
| `screenSubtitle` | Manrope Regular (400) | 15 / 22 | `textMuted` |
| `label` | Manrope SemiBold (600) | 14 / 20 | `ink` |
| `input` | Manrope Regular (400) | 15 / 22 | `ink` |
| `button` | Outfit Bold (700) | 16 / 24 | definida pela variante |
| `caption` | Manrope Regular (400) | 13 / 18 | `textSubtle` |
| `inlineLink` | Manrope Bold (700) | 14 / 20 | `primary` |
| `footerText` | Manrope Regular (400) | 14 / 20 | `textMuted` |
| `sectionTitle` | Outfit Bold (700) | 18 / 24 | `ink` |
| `monthTitle` | Outfit ExtraBold (800) | 20 / 28 | `ink` |
| `cardTitle` | Outfit ExtraBold (800) | 26 / 32 | `white` |
| `itemTitle` | Outfit Bold (700) | 15 / 20 | `ink` |
| `badgeStrong` | Manrope Bold (700) | 13 / 18 | `primary` |
| `badgeSoft` | Manrope Regular (400) | 11 / 14 | `textSubtle` |
| `weekdayLabel` | Manrope Bold (700) | 12 / 16 | `textSubtle` |
| `dayNumber` | Manrope Medium (500) | 13 / 18 | `ink` |
| `tabLabelActive` | Manrope Bold (700) | 11 / 14 | `primary` |
| `tabLabel` | Manrope Medium (500) | 11 / 14 | `textMuted` |

O peso **Manrope Medium (500)** entrou com essas telas e está registrado no
`useFonts` de `app/_layout.tsx`, pelo subcaminho, como os outros.

**Pegadinha de bundle:** importe cada peso pelo subcaminho
(`@expo-google-fonts/outfit/700Bold`), nunca pelo índice do pacote. O índice
reexporta as nove variações da família e o Metro empacota todas as que
enxerga. As chaves de `fontFamilies` são exatamente os nomes registrados no
`useFonts` do `app/_layout.tsx`; mudar uma sem a outra quebra silenciosamente
(a fonte vira a do sistema, sem erro).

### 2.3 Espaçamento e medidas (`theme/spacing.ts`)

| Token | Valor | Uso |
|---|---|---|
| `spacing.xs` ... `spacing.xxl` | 4 · 8 · 12 · 16 · 20 · 24 | A escala inteira do arquivo |
| `sizes.pagePadding` | 24 | Padding horizontal de **toda** tela, sem exceção |
| `sizes.controlHeight` | 52 | Input e botão primário |
| `sizes.secondaryButtonHeight` | 48 | Botão secundário |
| `sizes.inputIcon` | 20 | Caixa do ícone dentro do input (glifo de 18) |
| `sizes.minTouchTarget` | 44 | **Não é do Figma.** Mínimo de acessibilidade, usado no `hitSlop` do olho de senha |
| `sizes.checkbox` | 24 | Quadrado do `Checkbox`. **Não é do Figma**: nenhuma tela do arquivo tem caixa de marcação |

Gaps recorrentes do formulário: 20 entre grupos de campo, 8 entre label e
input, 12 entre o ícone e o texto dentro do input.

Cards de conteúdo usam 20 de margem lateral, não 24. Essa é a única exceção
ao padding da página no arquivo inteiro.

### 2.4 Raios (`theme/radii.ts`)

| Token | Valor | Uso |
|---|---|---|
| `control` | 12 | Input, botão |
| `card` | 16 | Card |
| `cardLarge` | 24 | Card da meta do dia e card do calendário |
| `ring` | 14 | Círculo do número do dia na grade (28 de lado) |
| `pill` | 100 | Badge, barra de progresso |
| `checkbox` | 6 | Quadrado do `Checkbox`, menor que `control` para o quadrado não virar bolinha |

---

## 3. Padrões estruturais

Todas as telas do arquivo são frames de **402 × 874** com a mesma composição:

```
<tela>
├── conteúdo rolável
│   ├── status-bar          44px
│   ├── cabeçalho           título + subtítulo, padding 24
│   └── corpo
└── rodapé fixo             bottom-nav ou footer
```

A `status-bar` e a `home-indicator-area` do Figma são **simulação do chrome do
iOS e não viram código**. No app, `useSafeAreaInsets` e `expo-status-bar`
cuidam disso, e o resultado é o mesmo deslocamento de 44px no topo.

---

## 4. Componentes

```
apps/mobile/src/components/
├── ui/
│   ├── ScreenContainer.tsx   fundo canvas + safe area + teclado + scroll + rodapé opcional
│   ├── TextField.tsx         label · ícone · input · olho de senha · mensagem de erro
│   ├── Button.tsx            variantes primary e secondary, estados loading e disabled
│   ├── InlineLink.tsx        texto com um trecho clicável (padrão do rodapé do login)
│   ├── Card.tsx              superfície branca com borda, raio 16 ou 24
│   ├── Avatar.tsx            iniciais do nome num círculo de 48
│   ├── ProgressRing.tsx      anel de 80 em SVG, trilho + arco + percentual
│   ├── Checkbox.tsx          quadrado de 24 com CheckIcon, três estados (vazio, parcial, marcado)
│   ├── ListRow.tsx           linha pressionável: ponto de cor, título, apoio, chevron
│   ├── Segmented.tsx         opções lado a lado (Prova / Trabalho, profundidade)
│   ├── DateField.tsx         TextField com máscara DD/MM/AAAA, sem dependência nova
│   ├── ColorPicker.tsx       fileira das cores do tema, mais a opção sem cor
│   ├── ConfirmDialog.tsx     Modal do React Native com confirmar e cancelar
│   └── Banner.tsx            aviso de conflito, fundo roseSoft ou amber, com AlertTriangleIcon
├── navigation/
│   └── BottomTabBar.tsx      barra de abas das Tabs do Expo Router
└── icons/                    SVG do Figma renderizado por react-native-svg
    ├── 26 ícones do Lucide
    └── createIcon.tsx        fábrica: injeta tamanho e cor; viewBox 18 por padrão, 24 opcional
```

O formulário do login é o **único padrão de entrada de dados do arquivo
inteiro**. Por isso ele virou componente logo na primeira etapa, em vez de
código de tela: as próximas telas reusam sem redesenhar nada.

Os sete componentes do bloco de cadastro (do `Checkbox` ao `Banner`) não
estão desenhados no Figma: o arquivo não tem tela de cadastro. Eles são
montados com os tokens que já existem, para que a tela nova pareça a mesma
coisa que as telas desenhadas. `Button` ganhou a variante `danger`, em
`colors.danger`, usada só no botão de apagar do `ConfirmDialog`.

`ConfirmDialog` usa o `Modal` do React Native, e não o `Alert`: o `Alert` não
existe na web, e o projeto roda no navegador durante o desenvolvimento.

Template compartilhado novo: `views/_templates/_screenTopBar.tsx` (voltar de
40 × 40, título e ação à direita), com a mesma geometria que
`views/calendar/_calendarHeader.tsx` já desenhava. Como `headerShown: false`
vale no app inteiro, cada tela empilhada desenha o próprio cabeçalho, e sem
esse template cada uma reinventaria o alinhamento.

### 4.1 Os ícones

Os ícones do arquivo são do conjunto **Lucide**, colados no Figma e escalados
por 0,75 dentro de um viewBox de 18, com `stroke-width` 2. Os `d` em
`MailIcon`, `LockIcon` e `EyeOffIcon` são cópia literal dos nós `5:639`,
`5:642` e `5:645`.

Dois ícones precisaram de trabalho extra, e a origem está comentada em cada
arquivo:

- **`EyeIcon`**: não existe em lugar nenhum do Figma (o arquivo só desenha o
  estado "senha escondida"). Foi derivado do `eye` do Lucide pelo mesmo fator
  0,75. A verificação de que o fator é esse: os literais `1.54628` e
  `16.4537` do `eye-off` do Figma batem dígito a dígito com o Lucide atual
  escalado por 0,75.
- **`UserIcon`**: existe, mas no nó `5:1468` da tela de perfil, num viewBox de
  20. Foi reescalado por 0,9 para cair na mesma grade de 18 dos outros, de
  modo que a espessura de traço fique igual em todos os campos.

Os dezesseis ícones que o dashboard e o calendário trouxeram (`flame`, `play`,
`arrow-right`, `chevron-left`, `chevron-right`, `calendar`, `home`,
`book-open`, `clock`, `bar-chart-2`, `zap`, `map`, `droplet`, `globe`,
`check`, `flag`) são traçados do Lucide na grade nativa de 24. Para isso, `createIcon` ganhou um
terceiro parâmetro opcional `viewBox`, com `'0 0 18 18'` como padrão: os cinco
ícones do login continuam idênticos e os novos entram sem reescalar à mão.

As telas de cadastro trouxeram mais cinco, também do Lucide na grade de 24
(`plus`, `trash-2`, `pencil`, `x`, `alert-triangle`), fechando **26**. Esses
cinco não estão desenhados em nenhum nó do Figma: o arquivo não tem tela de
cadastro, e o conjunto já era Lucide, então pegar o traçado do Lucide é
continuar a mesma família, não escolher outra.

Se um ícone novo for preciso, o caminho é o mesmo: exportar o nó do Figma e
passar o `d` para `createIcon`. Trocar por uma fonte de ícones
(`@expo/vector-icons`) foi descartado: é visualmente parecido, mas é
substituição, não a mesma forma.

### 4.2 Estado de erro

O Figma não tem tela de formulário com erro. O que o `TextField` faz, e que é
extensão nossa:

- borda `danger` em vez de `border`;
- mensagem abaixo do campo em 13, na cor `danger`;
- `aria-invalid`, `aria-describedby` e `accessibilityLiveRegion="polite"`,
  para que o erro seja anunciado por leitor de tela e não só visto.

A borda de foco (`primary`) também não está no arquivo e foi adicionada pelo
mesmo motivo: sem ela não há como saber qual campo está ativo ao navegar por
teclado.

### 4.3 Texto de apoio

O `TextField` aceita uma prop `hint`, renderizada no estilo `caption` abaixo do
campo. Ela ocupa o mesmo lugar da mensagem de erro e some quando há uma: o
campo nunca mostra as duas ao mesmo tempo.

É assim que a tela de cadastro mostra a política de senha antes de a pessoa
errar, usando `PASSWORD_POLICY_HINT` do pacote compartilhado, de modo que a
dica e a validação não tenham como divergir.

---

## 5. As 12 telas do arquivo

| Nó | Tela | Situação |
|---|---|---|
| `5:11` | onboarding | Fora do escopo |
| `5:36` | **login** | **Implementada** |
| (sem nó) | **cadastro** | **Implementada.** Não existe no Figma: derivada do login, sem inventar elemento visual novo |
| `5:84` | **home-dashboard** | **Implementada** |
| `5:168` | **subjects** | **Implementada.** Lista de matérias, avaliações, conteúdos e o resumo do plano da IA |
| `5:874` | **calendar-schedule** | **Implementada.** Cobre "calendário" e "detalhe do dia" |
| `5:438` | **progress-stats** | **Implementada.** Acumulado do mês, por dia e por matéria |
| `5:1129` | **profile-settings** | **Implementada em parte.** A disponibilidade semanal tem tela própria, com as exceções por dia; o perfil (nome, fuso, foto) ainda não existe |
| `5:303` | **study-timer (Pomodoro)** | **Implementada.** A aba Timer registra o tempo, credita a sessão do dia e tem os ciclos de foco e descanso |
| `5:371` | flashcards | **Fora do enunciado** |
| `5:542` | notes | **Fora do enunciado** |
| `5:1222` | achievements | **Fora do enunciado** |
| `5:1310` | study-groups | **Fora do enunciado** |

Quatro das doze telas — flashcards, notas, conquistas e grupos de estudo —
são funcionalidades que o documento do projeto não descreve. Ficam
registradas aqui como material visual reaproveitável, e **não** como backlog.

### 5.1 A barra de abas

A barra inferior (`5:1108`) tem quatro abas de 76px com `justify-between`. O
app tem cinco, porque o calendário ganhou aba própria, e cinco de 76 não
cabem nos 370px úteis: cada aba passou a `flex: 1`. Altura 72, borda superior
`border`, glow `px 16 py 4` com raio 16 em `primaryGlow`, ícone 20 e rótulo 11
seguem o arquivo.

As cinco abas têm tela de verdade. O "Sair da conta" segue provisoriamente no
rodapé do Progresso, à espera da tela de perfil.

### 5.2 As divergências aceitas

As divergências deliberadas entre o Figma e o que foi implementado (horário
da sessão, ícone por matéria, botão de voltar do calendário, número de abas,
as três letras do cabeçalho da grade e o anel que marca o dia da prova) estão
justificadas uma a uma em
[`decisoes-arquiteturais.md`](decisoes-arquiteturais.md), seção 12.4.

---

## 6. O que foi tirado do login de propósito

Decisões tomadas com a responsável pelo projeto, registradas para não serem
refeitas:

| Elemento do Figma | Decisão |
|---|---|
| Botões "Google" e "Apple" e o divisor "or continue with" | Removidos. Login social não entra agora. O lugar deles na tela fica livre se um dia entrar |
| Link "Forgot?" ao lado do label de senha | Removido. Recuperação de senha está fora do escopo desta etapa |
| Textos em inglês | Traduzidos. Só o texto muda: layout, tokens e espaçamentos seguem o arquivo |

---

## 7. Conferência contra o Figma

A tela de login renderizada foi comparada pixel a pixel com o nó `5:36`:
padding da página em 24, input e botão com 52 de altura, a curva do raio de
12 idêntica linha a linha, e `canvas`, `primaryDark`, `primary`, `textMuted`,
`textSubtle` e `border` nas mesmas posições. A única diferença é o
deslocamento de 44px no topo, que é a status bar desenhada no Figma e que no
app vem da safe area do aparelho.

Para repetir a conferência:

```bash
npm run -w @study-flow/mobile start -- --web
```
