import { create } from 'zustand';
import type { Locale } from '@shared/i18n';

function readInitial(): Locale {
  if (typeof window !== 'undefined' && window.electronAPI?.getInitialLocale) {
    return window.electronAPI.getInitialLocale();
  }
  return 'en';
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: readInitial(),
  setLocale: async (locale) => {
    const saved = await window.electronAPI.setLocale(locale);
    set({ locale: saved });
  },
}));
