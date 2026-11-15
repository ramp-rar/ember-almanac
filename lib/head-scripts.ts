import { LOCALES } from './i18n/messages';

/**
 * Inline <head> scripts. They must live in a plain (server-safe) module: a string exported from a
 * 'use client' file reaches a server component as a client reference, not as the text.
 */
export const THEME_KEY = 'ft-theme';
export const LOCALE_KEY = 'ft-lang';

/**
 * Runs before first paint (inlined in <head>): resolves the stored preference or the OS setting
 * into data-theme on <html>, so there is no flash of the wrong theme. Follows OS changes in "system".
 */
export const THEME_SCRIPT = `(function(){try{var k='${THEME_KEY}',d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var p=null;try{p=localStorage.getItem(k)}catch(e){}var t=p==='light'||p==='dark'?p:(m.matches?'dark':'light');d.setAttribute('data-theme',t);d.setAttribute('data-theme-pref',p==='light'||p==='dark'?p:'system')}a();m.addEventListener('change',a);window.__ftTheme=a}catch(e){}})();`;

/**
 * Inlined in <head> before first paint: stored choice, else the browser language (ru / tg),
 * else English. Sets <html lang> and data-lang so screen readers and the UI agree.
 */
export const LOCALE_SCRIPT = `(function(){try{var k='${LOCALE_KEY}',d=document.documentElement,s=null;try{s=localStorage.getItem(k)}catch(e){}var ok=${JSON.stringify(LOCALES)};var n=(navigator.language||'en').slice(0,2).toLowerCase();var l=ok.indexOf(s)>=0?s:(n==='ru'||n==='tg'?n:'en');d.setAttribute('data-lang',l);d.setAttribute('lang',l)}catch(e){}})();`;
