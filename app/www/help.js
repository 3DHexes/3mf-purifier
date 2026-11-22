// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Przemysław Słowiński (3DHexes). Additional terms apply, see NOTICE.
import { HELP, helpFor } from './help-content.js';

const params = new URLSearchParams(location.search);
const embedded = params.get('embedded') === '1';
if (embedded) document.body.classList.add('embedded');
const LINK_URLS = {
  mmf: 'https://www.myminifactory.com/profile/3DHexes',
  discord: 'https://discord.gg/MfkejWQZ4D',
  kickstarter: 'https://www.kickstarter.com/profile/3dhexes/created',
  kofi: 'https://ko-fi.com/3dhexes',
};
// Osadzona pomoc korzysta z API okna głównego; osobne okno ma własne połączenie z Neutralino.
let neuReady = null;
if (!embedded && window.Neutralino) { try { window.Neutralino.init(); neuReady = Promise.resolve(); } catch { /* bez natywnego API */ } }
const api = {
  openLink(key) {
    if (embedded && window.parent?.api) return window.parent.api.openLink(key);
    if (LINK_URLS[key] && window.Neutralino) window.Neutralino.os.open(LINK_URLS[key]);
  },
  onHelpLang(cb) { window.addEventListener('message', (e) => { if (e.data?.helpLang) cb(e.data.helpLang); }); },
};
const $ = (id) => document.getElementById(id);

// Numer wersji z konfiguracji Neutralino (neutralino.config.json → version), np. 1.0.0 → 1.0
const RAW_VER = window.NL_APPVERSION || (() => { try { return window.parent?.NL_APPVERSION; } catch { return ''; } })() || '';
const OS = window.NL_OS || (() => { try { return window.parent?.NL_OS; } catch { return ''; } })() || '';
const VERSION = RAW_VER.replace(/(\.0)+$/, '').replace(/^(\d+)$/, '$1.0');

const LINKS = [
  ['mmf', 'MyMiniFactory', 'myminifactory.com/profile/3DHexes'],
  ['discord', 'Discord', 'discord.gg/MfkejWQZ4D'],
  ['kickstarter', 'Kickstarter', 'kickstarter.com/profile/3dhexes'],
  ['kofi', 'Ko-fi', 'ko-fi.com/3dhexes'],
];

function render(lang) {
  const h = helpFor(lang, OS);
  document.documentElement.lang = HELP[lang] ? lang : 'en';
  document.title = h.title;
  $('hTitle').textContent = h.title;
  $('tocTitle').textContent = h.toc;
  if (VERSION) { $('hVer').hidden = false; $('hVer').textContent = `${h.version} ${VERSION}`; }
  $('toc').innerHTML = h.sections.map(([id, title]) => `<li><a href="#${id}" data-id="${id}">${title}</a></li>`).join('');
  $('body').innerHTML = h.sections.map(([id, title, html]) => `<section id="${id}"><h2>${title}</h2>${html}</section>`).join('') +
    `<footer class="help-foot"><img src="logo.png" alt=""><div><p>${h.footer}${VERSION ? ` ${h.version} ${VERSION}.` : ''}</p><div class="c-links">` +
    LINKS.map(([k, label, url]) => `<button class="c-link" data-link="${k}" title="${url}">${label}</button>`).join('') + '</div></div></footer>';
  document.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', () => api.openLink(b.dataset.link)));
  document.querySelectorAll('#toc a').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById(a.dataset.id).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $('body').scrollTop = 0;
  markActive();
}

// Podświetlenie bieżącej sekcji w spisie treści
function markActive() {
  const body = $('body');
  let current = null;
  for (const s of body.querySelectorAll('section')) if (s.offsetTop - body.offsetTop <= body.scrollTop + 40) current = s.id;
  document.querySelectorAll('#toc a').forEach((a) => a.classList.toggle('on', a.dataset.id === (current || 'what')));
}
$('body').addEventListener('scroll', markActive);

render(params.get('lang') || 'en');
api.onHelpLang((lang) => render(lang));
