import { SvgXml } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

type GeminiIconProps = {
  /** Lado do quadrado em pontos. */
  size?: number;
  /**
   * Cor sólida. Ausente = o gradiente azul → roxo característico do Gemini.
   * Use `white` sobre fundos coloridos.
   */
  color?: string;
};

/**
 * Brilho de quatro pontas do Gemini.
 *
 * Não usa `createIcon` porque é preenchido (não traçado) e tem gradiente.
 * O `id` do gradiente é fixo; duas instâncias na mesma tela compartilham a
 * mesma definição, o que é inofensivo porque ela é idêntica.
 */
export function GeminiIcon({ size = 24, color }: GeminiIconProps) {
  const { isDark } = useTheme();
  const fill = color ?? (isDark ? '#c4b5fd' : 'url(#sf-gemini-grad)');

  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="sf-gemini-grad" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1C7DFF"/>
      <stop offset="0.52" stop-color="#7B61FF"/>
      <stop offset="1" stop-color="#C86DD7"/>
    </linearGradient>
  </defs>
  <path fill="${fill}" d="M12 24A14.3 14.3 0 0 0 0 12 14.3 14.3 0 0 0 12 0a14.3 14.3 0 0 0 12 12 14.3 14.3 0 0 0-12 12Z"/>
</svg>`;

  return <SvgXml xml={xml} width={size} height={size} />;
}
