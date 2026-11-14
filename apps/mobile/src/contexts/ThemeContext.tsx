import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark';

type ThemeValue = {
  readonly mode: ThemeMode;
  readonly isDark: boolean;
  readonly setMode: (mode: ThemeMode) => void;
};

const STORAGE_KEY = 'study-flow.theme';
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value === 'dark' || value === 'light') setModeState(value);
    });
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(STORAGE_KEY, nextMode);
  }, []);

  const value = useMemo(
    () => ({ mode, isDark: mode === 'dark', setMode }),
    [mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error('useTheme precisa estar dentro de <ThemeProvider>.');
  return value;
}
