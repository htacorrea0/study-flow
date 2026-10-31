import { StyleSheet, Text, View } from 'react-native';

/**
 * Rota inicial. Existe apenas porque o Expo Router precisa de pelo menos uma
 * rota para o app subir. Não é a tela de login nem qualquer tela do produto:
 * nenhuma interface de funcionalidade foi implementada nesta etapa.
 */
export default function IndexRoute() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Study Flow</Text>
      <Text style={styles.subtitle}>
        Estrutura inicial do projeto. Nenhuma tela implementada.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.6,
  },
});
