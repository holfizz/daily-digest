/* ============================================================
   The Trend Times — renderer
   Loads data/news.json ({ ru: {...}, en: {...} }), renders an
   NYT-style issue, works offline, supports a RU/EN language switch
   and an archive of previous issues (data/archive/).
   ============================================================ */

const DATA_URL      = 'data/news.json';
const ARCHIVE_INDEX = 'data/archive/index.json';
const ARCHIVE_DIR   = 'data/archive/';
const CACHE_KEY     = 'trend-times:last-issue';
const LANG_KEY      = 'trend-times:lang';
const LANGS         = ['ru', 'en'];

let currentLang = localStorage.getItem(LANG_KEY);
if (!LANGS.includes(currentLang)) {
  currentLang = (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'ru';
}

let issueData    = null; // full { ru, en } object for today's issue
let archiveData   = null; // full { ru, en } object for a viewed archived issue
let archivedDate  = null; // date string when viewing an archived issue, else null

const MONTHS = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
       'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December']
};
const WEEKDAYS = {
  ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};

const STR = {
  ru: {
    tagline: '«Всё, что стоит вашего внимания»',
    editionDefault: 'Утренний выпуск',
    volumeDefault: 'Vol. I',
    noPrefix: '№',
    loadingIssue: 'Загрузка выпуска…',
    noSections: 'В этом выпуске пока нет разделов.',
    noArticles: 'Материалов пока нет.',
    plural: n => {
      const m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) return 'материал';
      if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'материала';
      return 'материалов';
    },
    footerTag: 'The Trend Times · ежедневный дайджест · создаётся автоматически',
    refreshBtn: 'Обновить выпуск',
    archiveBtn: '📚 Предыдущие выпуски',
    backTodayFooter: '← Вернуться к сегодняшнему',
    backTodayBanner: '← К сегодняшнему выпуску',
    archivedBanner: date => `📚 Выпуск из архива · ${date}`,
    archiveTitle: 'Предыдущие выпуски',
    archiveClose: 'Закрыть ✕',
    archiveLoading: 'Загрузка архива…',
    archiveEmpty: 'Предыдущих выпусков пока нет.<br>Каждое утро свежий выпуск будет автоматически сохраняться сюда.',
    archiveUnavailable: 'Этот выпуск недоступен офлайн (он не был открыт ранее). Откройте его один раз с интернетом.',
    offlineBanner: 'Вы офлайн — показан последний загруженный выпуск.',
    loadErrorNoCache: 'Не удалось загрузить выпуск, и офлайн-копии ещё нет. Откройте приложение один раз с интернетом.',
    source: 'Источник'
  },
  en: {
    tagline: '“All the Trends Fit to Follow”',
    editionDefault: 'Morning Edition',
    volumeDefault: 'Vol. I',
    noPrefix: 'No.',
    loadingIssue: 'Loading issue…',
    noSections: 'This issue has no sections yet.',
    noArticles: 'No articles yet.',
    plural: n => (n === 1 ? 'article' : 'articles'),
    footerTag: 'The Trend Times · daily digest · generated automatically',
    refreshBtn: 'Refresh issue',
    archiveBtn: '📚 Previous issues',
    backTodayFooter: '← Return to today’s issue',
    backTodayBanner: '← Back to today’s issue',
    archivedBanner: date => `📚 Archived issue · ${date}`,
    archiveTitle: 'Previous issues',
    archiveClose: 'Close ✕',
    archiveLoading: 'Loading archive…',
    archiveEmpty: 'There are no previous issues yet.<br>Every morning, the fresh issue will be saved here automatically.',
    archiveUnavailable: 'This issue isn’t available offline (it wasn’t opened before). Open it once while online.',
    offlineBanner: 'You’re offline — showing the last issue that was loaded.',
    loadErrorNoCache: 'Couldn’t load the issue, and there’s no offline copy yet. Open the app once while online.',
    source: 'Source'
  }
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso, lang) {
  const d = iso ? new Date(iso + 'T00:00:00') : new Date();
  if (isNaN(d)) return { long: iso || '', weekday: '' };
  const months = MONTHS[lang], weekdays = WEEKDAYS[lang];
  const long = lang === 'en'
    ? `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
    : `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  return { long, weekday: weekdays[d.getDay()] };
}

function paragraphs(body) {
  if (Array.isArray(body)) return body;
  if (typeof body === 'string') {
    return body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  }
  return [];
}

function articleHTML(a, isLead, t) {
  const kicker   = a.kicker   ? `<div class="kicker">${esc(a.kicker)}</div>` : '';
  const subhead  = a.subhead  ? `<p class="subhead">${esc(a.subhead)}</p>` : '';
  const byline   = a.byline   ? `<div class="byline">${esc(a.byline)}</div>` : '';
  const source   = a.url
    ? `<a class="source" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.source || t.source)}</a>`
    : (a.source ? `<span class="source">${esc(a.source)}</span>` : '');

  const bodyHTML = paragraphs(a.body).map(p => `<p>${esc(p)}</p>`).join('');

  if (isLead) {
    return `<article class="article lead">
      ${kicker}
      <h3 class="headline">${esc(a.headline)}</h3>
      <div class="lead-grid">
        <div>${subhead}${byline}</div>
        <div class="body">${bodyHTML}${source}</div>
      </div>
    </article>`;
  }

  return `<article class="article">
    ${kicker}
    <h3 class="headline">${esc(a.headline)}</h3>
    ${subhead}
    ${byline}
    <div class="body">${bodyHTML}${source}</div>
  </article>`;
}

function sectionHTML(sec, t) {
  const articles = sec.articles || [];
  const cards = articles.map((a, i) =>
    articleHTML(a, i === 0 && a.lead !== false && articles.length > 1 && sec.lead !== false, t)
  ).join('');

  return `<section class="section" id="sec-${esc(sec.id)}">
    <div class="section-head">
      <h2>${esc(sec.title)}</h2>
      <span class="count">${articles.length} ${t.plural(articles.length)}</span>
    </div>
    <div class="articles">${cards || `<p class="loading">${t.noArticles}</p>`}</div>
  </section>`;
}

function langSwitcherHTML() {
  return LANGS.map(l =>
    `<button class="lang-btn${l === currentLang ? ' active' : ''}" data-lang="${l}">${l.toUpperCase()}</button>`
  ).join('');
}

function render(data, opts) {
  opts = opts || {};
  const archived = !!opts.archived;
  const t = STR[currentLang];
  const app = document.getElementById('app');
  const issue = data.issue || {};
  const d = formatDate(issue.date, currentLang);

  const nav = (data.sections || []).map(s =>
    `<button data-target="sec-${esc(s.id)}">${esc(s.title)}</button>`
  ).join('');

  const sections = (data.sections || []).map(s => sectionHTML(s, t)).join('');

  const archiveBanner = archived
    ? `<div class="archive-banner">
         <span>${esc(t.archivedBanner(d.long))}</span>
         <button class="link-btn" id="back-today">${esc(t.backTodayBanner)}</button>
       </div>`
    : '';

  const footerButtons = archived
    ? `<button class="refresh" id="back-today-2">${esc(t.backTodayFooter)}</button>`
    : `<button class="refresh" id="refresh-btn">${esc(t.refreshBtn)}</button>
       <button class="refresh" id="archive-btn">${esc(t.archiveBtn)}</button>`;

  app.innerHTML = `
    <div class="wrap">
      <header class="masthead">
        <div class="kicker-row">
          <span>${esc(issue.volume || t.volumeDefault)}</span>
          <span class="center">${esc(t.tagline)}</span>
          <span class="right">${esc(t.noPrefix)} ${esc(issue.number != null ? issue.number : '1')}</span>
        </div>
        <h1>The Trend Times</h1>
        <div class="dateline">
          <span>${esc(d.weekday)}</span>
          <span class="edition">${esc(issue.edition || t.editionDefault)}</span>
          <span>${esc(d.long)}</span>
        </div>
        <div class="lang-switch">${langSwitcherHTML()}</div>
      </header>

      ${archiveBanner}

      <nav class="section-nav">${nav}</nav>

      <main>${sections || errorHTML(t.noSections)}</main>

      <footer class="paper-footer">
        <div>${esc(t.footerTag)}</div>
        <div class="footer-actions">${footerButtons}</div>
      </footer>
    </div>`;

  wireNav(archived);
}

function renderCurrent() {
  const full = archivedDate ? archiveData : issueData;
  if (!full) return;
  const langData = full[currentLang] || full.ru || full.en;
  if (!langData) return;
  render(langData, { archived: !!archivedDate });
}

function setLang(lang) {
  if (!LANGS.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;
  renderCurrent();
}

function errorHTML(msg) {
  return `<div class="error-box">${msg}</div>`;
}

function wireNav(archived) {
  const nav = document.querySelector('.section-nav');
  if (nav) {
    const buttons = [...nav.querySelectorAll('button')];
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const el = document.getElementById(btn.dataset.target);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    const sections = [...document.querySelectorAll('.section')];
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const id = en.target.id;
          buttons.forEach(b =>
            b.classList.toggle('active', b.dataset.target === id));
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach(s => obs.observe(s));
  }

  [...document.querySelectorAll('.lang-btn')].forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });

  const refresh = document.getElementById('refresh-btn');
  if (refresh) refresh.addEventListener('click', () => load(true));

  const archiveBtn = document.getElementById('archive-btn');
  if (archiveBtn) archiveBtn.addEventListener('click', openArchive);

  ['back-today', 'back-today-2'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => { archivedDate = null; archiveData = null; renderCurrent(); window.scrollTo(0, 0); });
  });
}

/* ---------------- Archive ---------------- */

function archiveHeadline(it) {
  if (it.headline && typeof it.headline === 'object') return it.headline[currentLang] || it.headline.ru || '';
  return it.headline || '';
}
function archiveCount(it) {
  if (it.count && typeof it.count === 'object') return it.count[currentLang] || it.count.ru || '';
  return it.count || '';
}

async function openArchive() {
  const t = STR[currentLang];
  const overlay = document.createElement('div');
  overlay.className = 'archive-overlay';
  overlay.innerHTML = `
    <div class="archive-panel">
      <div class="archive-head">
        <h2>${esc(t.archiveTitle)}</h2>
        <button class="link-btn" id="archive-close">${esc(t.archiveClose)}</button>
      </div>
      <div class="archive-list" id="archive-list">
        <p class="loading">${esc(t.archiveLoading)}</p>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('archive-close')
    .addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const listEl = document.getElementById('archive-list');
  let index = [];
  try {
    const res = await fetch(ARCHIVE_INDEX, { cache: 'no-cache' });
    if (res.ok) index = await res.json();
  } catch (e) { /* offline / no archive yet */ }

  if (!Array.isArray(index) || index.length === 0) {
    listEl.innerHTML = `<div class="archive-empty">${t.archiveEmpty}</div>`;
    return;
  }

  listEl.innerHTML = index.map(it => {
    const d = formatDate(it.date, currentLang);
    return `<button class="archive-item" data-date="${esc(it.date)}">
      <span class="ai-num">${esc(t.noPrefix)} ${esc(it.number)}</span>
      <span class="ai-main">
        <span class="ai-date">${esc(d.long)} · ${esc(d.weekday)}</span>
        <span class="ai-head">${esc(archiveHeadline(it))}</span>
      </span>
      <span class="ai-count">${esc(archiveCount(it))}</span>
    </button>`;
  }).join('');

  [...listEl.querySelectorAll('.archive-item')].forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.remove();
      viewArchivedIssue(btn.dataset.date);
    });
  });
}

async function viewArchivedIssue(date) {
  document.getElementById('app').innerHTML =
    `<div class="loading">${esc(STR[currentLang].loadingIssue)}</div>`;
  try {
    const res = await fetch(ARCHIVE_DIR + date + '.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    archiveData = data;
    archivedDate = date;
    renderCurrent();
    window.scrollTo(0, 0);
  } catch (err) {
    document.getElementById('app').innerHTML = errorHTML(esc(STR[currentLang].archiveUnavailable)) +
      `<div style="text-align:center"><button class="refresh" onclick="load(false)">${esc(STR[currentLang].backTodayFooter)}</button></div>`;
  }
}

/* ---------------- Loading today's issue ---------------- */

async function load(forceNetwork) {
  const banner = document.getElementById('offline-banner');
  try {
    const url = DATA_URL + '?v=' + Date.now();
    const res = await fetch(forceNetwork ? url : DATA_URL, {
      cache: forceNetwork ? 'reload' : 'default'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    archivedDate = null;
    archiveData = null;
    issueData = data;
    document.documentElement.lang = currentLang;
    renderCurrent();
    if (banner) banner.hidden = true;
  } catch (err) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      archivedDate = null;
      archiveData = null;
      issueData = JSON.parse(cached);
      renderCurrent();
      if (banner) banner.textContent = STR[currentLang].offlineBanner;
      if (banner && !navigator.onLine) banner.hidden = false;
    } else {
      document.getElementById('app').innerHTML = errorHTML(esc(STR[currentLang].loadErrorNoCache));
    }
  }
}

window.addEventListener('online',  () => {
  const b = document.getElementById('offline-banner'); if (b) b.hidden = true;
  load(true);
});
window.addEventListener('offline', () => {
  const b = document.getElementById('offline-banner');
  if (b) { b.textContent = STR[currentLang].offlineBanner; b.hidden = false; }
});

document.documentElement.lang = currentLang;
load(false);
