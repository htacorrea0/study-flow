// Importados peso a peso, e não do índice do pacote: o índice reexporta as
// nove variações de cada família, e o Metro empacota todas as que enxerga.
// São 55 KB por arquivo que o app baixaria sem nunca desenhar com eles.
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { Outfit_800ExtraBold } from '@expo-google-fonts/outfit/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessionProvider } from '@/contexts/SessionContext';
import { colors } from '@/theme';

// Segura a splash enquanto as fontes carregam. Chamado no escopo do módulo,
// antes de qualquer render: dentro de um efeito a primeira tela já teria
// aparecido com a fonte do sistema e trocado logo em seguida.
void SplashScreen.preventAutoHideAsync();

/**
 * Layout raiz.
 *
 * Carrega as duas famílias do Figma e monta o provider de sessão em volta de
 * toda a navegação. A guarda de acesso não está aqui: ela vive no layout do
 * grupo `(app)`, perto das telas que protege.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    // O erro também libera a splash: uma fonte que não baixou degrada para a
    // do sistema, enquanto uma splash eterna deixaria o app inutilizável.
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </SessionProvider>
  );
}
