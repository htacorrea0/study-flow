import { createIcon } from './createIcon';

/**
 * `eye` — o par do `eye-off` do nó `5:645`.
 *
 * O arquivo de design só tem a senha oculta, então o olho aberto não existe
 * lá para ser exportado. Ele não foi desenhado no olho: o `eye-off` do Figma
 * é o `eye-off` do Lucide reduzido a 75% (`1.54628` e `16.4537` batem dígito a
 * dígito com o original a 24), então este é o `eye` do mesmo Lucide reduzido
 * pelo mesmo fator. Mesma família, mesma grade, mesma espessura.
 */
export const EyeIcon = createIcon(
  'EyeIcon',
  '<path d="M1.54628 9.26118a0.75 0.75 0 0 1 0-0.52236 8.0625 8.0625 0 0 1 14.90744 0 0.75 0.75 0 0 1 0 0.52236 8.0625 8.0625 0 0 1-14.90744 0" /><circle cx="9" cy="9" r="2.25" />',
);
