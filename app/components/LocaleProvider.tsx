'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { DEFAULT_LOCALE, serialiseLocaleCookie, type Locale } from '@/lib/locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * The default is a real value, not a throw: a component rendered outside the
 * provider (tests, an isolated story) reads Korean and a toggle that does
 * nothing, which is exactly what the app did before it had a language.
 */
const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

export const useLocale = (): LocaleContextValue => useContext(LocaleContext);

interface LocaleProviderProps {
  /** Read from the cookie on the server, so the first paint already agrees with the toggle. */
  initial: Locale;
  children: React.ReactNode;
}

export const LocaleProvider = ({ initial, children }: LocaleProviderProps) => {
  const [locale, setState] = useState<Locale>(initial);

  const setLocale = useCallback((next: Locale) => {
    setState(next);
    document.cookie = serialiseLocaleCookie(next, window.location.protocol === 'https:');
    // `<html lang>` was stamped by the server from the same cookie; keep it honest
    // for the rest of this visit without a reload.
    document.documentElement.lang = next;
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
  );
};
