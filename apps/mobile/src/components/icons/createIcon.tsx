import type { FC } from 'react';
import { SvgXml } from 'react-native-svg';

import { colors, sizes } from '@/theme';

export type IconProps = {
  /** Lado do quadrado em pontos. Por padrão, o glifo de 18 do Figma. */
  size?: number;
  /** Cor do traço. Por padrão, o cinza de apoio usado nos campos. */
  color?: string;
};

/**
 * Monta um componente de ícone a partir do corpo de um SVG exportado do Figma.
 *
 * Os ícones do arquivo de design são do conjunto Lucide desenhados numa
 * viewBox de 18 com traço de 2 — mais encorpados que o Lucide padrão. Em vez
 * de aproximar com uma fonte de ícones, o `d` exportado entra aqui literal:
 * o que aparece na tela é a mesma geometria que está no Figma.
 *
 * O `stroke` fixo do export dá lugar à cor recebida, para que o mesmo ícone
 * sirva ao estado normal, ao de foco e ao de erro de um campo.
 *
 * `viewBox` existe porque nem todo glifo vem da mesma grade: os cinco ícones
 * dos formulários foram exportados do Figma em 18, e os do dashboard e do
 * calendário usam o traçado original do Lucide, desenhado em 24. Passar a
 * grade é mais seguro do que reescalar cada `d` à mão.
 */
export function createIcon(name: string, body: string, viewBox = '0 0 18 18'): FC<IconProps> {
  const Icon: FC<IconProps> = ({ size = sizes.inputIcon - 2, color = colors.textMuted }) => (
    <SvgXml
      xml={`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`}
      width={size}
      height={size}
    />
  );

  Icon.displayName = name;
  return Icon;
}
