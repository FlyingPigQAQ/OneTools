import { app, BrowserWindow } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { IPC_EVENTS } from '@shared/constants';
import { resolveLocale, type Locale } from '@shared/i18n';
import { createMenu } from '../menu';

let current: Locale = 'en';
let mainWindow: BrowserWindow | null = null;

function localeFile(): string {
  return join(app.getPath('userData'), 'locale.json');
}

function readSaved(): string | null {
  try {
    const parsed = JSON.parse(readFileSync(localeFile(), 'utf8')) as { locale?: unknown };
    return typeof parsed.locale === 'string' ? parsed.locale : null;
  } catch {
    return null;
  }
}

function writeSaved(locale: Locale): void {
  try {
    writeFileSync(localeFile(), JSON.stringify({ locale }), 'utf8');
  } catch (err) {
    console.error('[OneTools] Failed to save locale', err);
  }
}

export function initLocale(window: BrowserWindow): Locale {
  mainWindow = window;
  current = resolveLocale(readSaved(), app.getLocale());
  return current;
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(next: string): Locale {
  if (next !== 'zh' && next !== 'en') return current;
  current = next;
  writeSaved(current);
  if (mainWindow && !mainWindow.isDestroyed()) {
    createMenu(mainWindow, current, setLocale);
    mainWindow.webContents.send(IPC_EVENTS.LOCALE_CHANGED, current);
  }
  return current;
}
