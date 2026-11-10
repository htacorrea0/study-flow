import { useEffect, useState, type RefObject } from 'react';
import { Keyboard, Platform, type KeyboardEvent, type ViewInstance } from 'react-native';

/**
 * Quanto o teclado está cobrindo de uma tela, em pontos.
 *
 * Por que não só `KeyboardAvoidingView`: desde o Expo SDK 54 o Android roda
 * de ponta a ponta (edge-to-edge) e, dentro de um `Modal`, o sistema deixou
 * de encolher a janela quando o teclado abre. O campo de texto ficava atrás
 * do teclado.
 *
 * A conta é a mesma que o `KeyboardAvoidingView` faz por dentro: a base da
 * tela (medida na janela) menos o topo do teclado. Se o sistema já tiver
 * encolhido a janela, a base sobe junto e a sobra vira zero — então nunca
 * empurra duas vezes.
 *
 * Quem usa aplica o valor como `paddingBottom` no contêiner da tela.
 */
export function useKeyboardOverlap(container: RefObject<ViewInstance | null>): number {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    // iOS avisa antes de animar (transição suave); o Android só avisa depois.
    const evShow = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const evHide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    function onShow(event: KeyboardEvent): void {
      const topoDoTeclado = event.endCoordinates.screenY;
      const alvo = container.current;

      if (!alvo) {
        setOverlap(event.endCoordinates.height);
        return;
      }

      alvo.measureInWindow((_x, y, _w, altura) => {
        setOverlap(Math.max(0, Math.round(y + altura - topoDoTeclado)));
      });
    }

    const show = Keyboard.addListener(evShow, onShow);
    const hide = Keyboard.addListener(evHide, () => setOverlap(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, [container]);

  return overlap;
}
