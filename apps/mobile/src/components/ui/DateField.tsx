import { forwardRef } from 'react';

import { CalendarIcon } from '@/components/icons';
import { maskBrDate } from '@/utils/date';

import { TextField, type TextFieldProps, type TextFieldRef } from './TextField';

type DateFieldProps = Omit<
  TextFieldProps,
  'icon' | 'value' | 'onChangeText' | 'keyboardType' | 'secureToggle'
> & {
  /** O texto mascarado, `DD/MM/AAAA`. O dono do estado guarda este valor. */
  readonly value: string;
  readonly onChangeText: (value: string) => void;
};

/**
 * Campo de data em `DD/MM/AAAA`.
 *
 * É o `TextField` com máscara e teclado numérico, não um seletor de
 * calendário. A escolha foi deliberada: o seletor nativo exige uma
 * dependência ou um módulo por plataforma, e o único uso aqui é digitar uma
 * data de prova que a pessoa já sabe de cabeça. Digitar oito números é mais
 * rápido do que navegar meses.
 *
 * A máscara é aplicada no `onChangeText`, então o estado de quem usa o
 * componente nunca guarda um texto fora do formato. A conversão para
 * `AAAA-MM-DD` e a recusa de datas que não existem ficam em `brDateToIso`,
 * no momento do envio.
 */
export const DateField = forwardRef<TextFieldRef, DateFieldProps>(function DateField(
  { value, onChangeText, ...rest },
  ref,
) {
  return (
    <TextField
      ref={ref}
      icon={CalendarIcon}
      value={value}
      onChangeText={(texto) => onChangeText(maskBrDate(texto))}
      keyboardType="number-pad"
      placeholder="DD/MM/AAAA"
      maxLength={10}
      {...rest}
    />
  );
});
