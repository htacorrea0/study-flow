/**
 * Cor de matéria vinda do banco.
 *
 * A cor de cada matéria é escolhida por quem estuda e chega como
 * hexadecimal, então não pode virar token de tema: o que o tema define é
 * como ela é usada. O Figma pinta o quadrado do ícone com a mesma cor a 10%,
 * e é só para isso que este arquivo existe.
 */

const HEX_COMPLETO = /^#([0-9a-f]{6})$/i;
const HEX_CURTO = /^#([0-9a-f]{3})$/i;

/**
 * Converte `#10b981` em `rgba(16, 185, 129, 0.1)`.
 *
 * Devolve `null` para qualquer coisa que não seja um hexadecimal válido —
 * inclusive `null`, que é o que o servidor manda enquanto a matéria não tem
 * cor. Quem chama decide o que desenhar no lugar; inventar um cinza aqui
 * esconderia o dado faltando.
 */
export function withOpacity(hex: string | null, alpha: number): string | null {
  if (hex === null) {
    return null;
  }

  const curto = HEX_CURTO.exec(hex);
  const normalizado = curto?.[1] === undefined
    ? hex
    : `#${curto[1].split('').map((c) => c + c).join('')}`;

  const completo = HEX_COMPLETO.exec(normalizado);
  if (completo?.[1] === undefined) {
    return null;
  }

  const valor = parseInt(completo[1], 16);
  const r = (valor >> 16) & 255;
  const g = (valor >> 8) & 255;
  const b = valor & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
