/* ============================================================
   The Trend Times — renderer
   Loads data/news.json, renders an NYT-style issue, works offline.
   Supports an archive of previous issues (data/archive/).
   ============================================================ */

const DATA_URL      = 'data/news.json';
const ARCHIVE_INDEX = 'data/archive/index.json';
const ARCHIVE_DIR   = 'data/archive/';
const CACHE_KEY     = 'trend-times:last-issue';

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];
const WEEKDAYS_RU = [
  'Воскресенье', 'Понедельник', 'Вторник', 'Среда',
  'Четверг', 'Пятница', 'Суббота'
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  const d = iso ? new Date(iso + 'T00:00:00') : new Date();
  if (isNaN(d)) return { long: iso || '', weekday: '' };
  return {
    long: `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`,
    weekday: WEEKDAYS_RU[d.getDay()]
  };
}

function paragraphs(body) {
  if (Array.isArray(body)) return body;
  if (typeof body === 'string') {
    return body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  }
  return [];
}

function articleHTML(a, isLead) {
  const kicker   = a.kicker   ? `<div class="kicker">${esc(a.kicker)}</div>` : '';
  const subhead  = a.subhead  ? `<p class="subhead">${esc(a.subhead)}</p>` : '';
  const byline   = a.byline   ? `<div class="byline">${esc(a.byline)}</div>` : '';
  const source   = a.url
    ? `<a class="source" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.source || 'Источник')}</a>`
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

function sectionHTML(sec) {
  const articles = sec.articles || [];
  const cards = articles.map((a, i) =>
    articleHTML(a, i === 0 && a.lead !== false && articles.length > 1 && sec.lead !== false)
  ).join('');

  return `<section class="section" id="sec-${esc(sec.id)}">
    <div class="section-head">
      <h2>${esc(sec.title)}</h2>
      <span class="count">${articles.length} ${plural(articles.length)}</span>
    </div>
    <div class="articles">${cards || '<p class="loading">Материалов пока нет.</p>'}</div>
  </section>`;
}

function plural(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'материал';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'материала';
  return 'материалов';
}

function render(data, opts) {
  opts = opts || {};
  const archived = !!opts.archived;
  const app = document.getElementById('app');
  const issue = data.issue || {};
  const d = formatDate(issue.date);

  const nav = (data.sections || []).map(s =>
    `<button data-target="sec-${esc(s.id)}">${esc(s.title)}</button>`
  ).join('');

  const sections = (data.sections || []).map(sectionHTML).join('');

  const archiveBanner = archived
    ? `<div class="archive-banner">
         <span>📚 Выпуск из архива · ${esc(d.long)}</span>
         <button class="link-btn" id="back-today">← К сегодняшнему выпуску</button>
       </div>`
    : '';

  const footerButtons = archived
    ? `<button class="refresh" id="back-today-2">← Вернуться к сегодняшнему</button>`
    : `<button class="refresh" id="refresh-btn">Обновить выпуск</button>
       <button class="refresh" id="archive-btn">📚 Предыдущие выпуски</button>`;

  app.innerHTML = `
    <div class="wrap">
      <header class="masthead">
        <div class="kicker-row">
          <span>${esc(issue.volume || 'Vol. I')}</span>
          <span class="center">«Всё, что стоит вашего внимания»</span>
          <span class="right">№ ${esc(issue.number != null ? issue.number : '1')}</span>
        </div>
        <h1>The Trend Times</h1>
        <div class="dateline">
          <span>${esc(d.weekday)}</span>
          <span class="edition">${esc(issue.edition || 'Утренний выпуск')}</span>
          <span>${esc(d.long)}</span>
        </div>
      </header>

      ${archiveBanner}

      <nav class="section-nav">${nav}</nav>

      <main>${sections || errorHTML('В этом выпуске пока нет разделов.')}</main>

      <footer class="paper-footer">
        <div>The Trend Times · ежедневный дайджест · создаётся автоматически</div>
        <div class="footer-actions">${footerButtons}</div>
      </footer>
    </div>`;

  wireNav(archived);
}

function errorHTML(msg) {
  return `<div class="error-box">${esc(msg)}</div>`;
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

  const refresh = document.getElementById('refresh-btn');
  if (refresh) refresh.addEventListener('click', () => load(true));

  const archiveBtn = document.getElementById('archive-btn');
  if (archiveBtn) archiveBtn.addEventListener('click', openArchive);

  ['back-today', 'back-today-2'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => load(false));
  });
}

/* ---------------- Archive ---------------- */

async function openArchive() {
  const overlay = document.createElement('div');
  overlay.className = 'archive-overlay';
  overlay.innerHTML = `
    <div class="archive-panel">
      <div class="archive-head">
        <h2>Предыдущие выпуски</h2>
        <button class="link-btn" id="archive-close">Закрыть ✕</button>
      </div>
      <div class="archive-list" id="archive-list">
        <p class="loading">Загрузка архива…</p>
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
    listEl.innerHTML = `<div class="archive-empty">
      Предыдущих выпусков пока нет.<br>
      Каждое утро свежий выпуск будет автоматически сохраняться сюда.
    </div>`;
    return;
  }

  listEl.innerHTML = index.map(it => {
    const d = formatDate(it.date);
    return `<button class="archive-item" data-date="${esc(it.date)}">
      <span class="ai-num">№ ${esc(it.number)}</span>
      <span class="ai-main">
        <span class="ai-date">${esc(d.long)} · ${esc(d.weekday)}</span>
        <span class="ai-head">${esc(it.headline || '')}</span>
      </span>
      <span class="ai-count">${esc(it.count || '')}</span>
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
    `<div class="loading">Загрузка выпуска…</div>`;
  try {
    const res = await fetch(ARCHIVE_DIR + date + '.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    render(data, { archived: true });
    window.scrollTo(0, 0);
  } catch (err) {
    document.getElementById('app').innerHTML = errorHTML(
      'Этот выпуск недоступен офлайн (он не был открыт ранее). ' +
      'Откройте его один раз с интернетом.'
    ) + `<div style="text-align:center"><button class="refresh" onclick="load(false)">← К сегодняшнему</button></div>`;
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
    render(data);
    if (banner) banner.hidden = true;
  } catch (err) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      render(JSON.parse(cached));
      if (banner && !navigator.onLine) banner.hidden = false;
    } else {
      document.getElementById('app').innerHTML =
        errorHTML('Не удалось загрузить выпуск, и офлайн-копии ещё нет. ' +
                  'Откройте приложение один раз с интернетом.');
    }
  }
}

window.addEventListener('online',  () => {
  const b = document.getElementById('offline-banner'); if (b) b.hidden = true;
  load(true);
});
window.addEventListener('offline', () => {
  const b = document.getElementById('offline-banner'); if (b) b.hidden = false;
});

load(false);
