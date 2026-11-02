import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies } from '@/theme';

type AvatarProps = {
  /** Iniciais prontas, como o servidor devolve em `user.initials`. */
  initials: string;
  /** Nome completo, só para quem usa leitor de tela. */
  name: string;
};

const LADO = 48;

/**
 * Círculo de 48 com as iniciais de quem estuda, no canto do dashboard.
 *
 * O Figma mostra uma foto. O modelo `User` não tem campo de imagem, e
 * inventar um upload aqui seria inventar funcionalidade: a foto entra junto
 * com a tela de perfil. O círculo mantém lado, raio e posição do design.
 *
 * As iniciais vêm calculadas do servidor, e não do nome no aparelho, para
 * que a regra de corte seja a mesma em qualquer tela que as mostre.
 */
export function Avatar({ initials, name }: AvatarProps) {
  return (
    <View style={styles.circle} accessible accessibilityLabel={`Foto de perfil de ${name}`}>
      <Text style={styles.initials}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    backgroundColor: colors.primaryGlow,
    borderRadius: LADO / 2,
    height: LADO,
    justifyContent: 'center',
    width: LADO,
  },
  initials: {
    color: colors.primaryDark,
    fontFamily: fontFamilies.outfitBold,
    fontSize: 16,
    lineHeight: 24,
  },
});
