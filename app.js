/* ═══════════════════════════════════════════════════════
   ОКТРУ Desktop App — app.js  (v1.0, full feature set)
   ═══════════════════════════════════════════════════════ */
'use strict';

// ══════════════════════════════════════════════════════
//  DATASET CONFIG
// ══════════════════════════════════════════════════════
const DS_CONFIG = {
  oktru: {
    label: 'ОКТРУ', badge: 'b-oktru',
    columns: [
      { key: 'code',   label: 'Код ОКТРУ',           cls: 'td-code',    width: 240 },
      { key: 'nameRu', label: 'Наименование (рус)',   cls: 'td-name',    width: 0   },
      { key: 'nameKk', label: 'Наименование (каз)',   cls: 'td-name-kk', width: 0, kk: true },
      { key: 'parent', label: 'Родит. код',           cls: 'td-parent',  width: 120 },
    ],
  },
  tnved: {
    label: 'ТНВЭД ЕАЭС', badge: 'b-tnved',
    columns: [
      { key: 'code',   label: 'Код ТНВЭД',  cls: 'td-code', width: 160 },
      { key: 'nameRu', label: 'Наименование', cls: 'td-name', width: 0  },
    ],
  },
  units: {
    label: 'Единицы измерения', badge: 'b-unit',
    columns: [
      { key: 'code',   label: 'Код',                cls: 'td-code',    width: 100 },
      { key: 'nameRu', label: 'Наименование (рус)', cls: 'td-name',    width: 0   },
      { key: 'nameKk', label: 'Наименование (каз)', cls: 'td-name-kk', width: 0, kk: true },
    ],
  },
  country: {
    label: 'Страны происхождения', badge: 'b-country',
    columns: [
      { key: 'code',   label: 'ISO-код',       cls: 'td-code',    width: 90 },
      { key: 'nameRu', label: 'Страна (рус)', cls: 'td-name',    width: 0  },
      { key: 'nameKk', label: 'Страна (каз)', cls: 'td-name-kk', width: 0, kk: true },
    ],
  },
  favorites: {
    label: '⭐ Избранное', badge: 'b-unit',
    columns: [
      { key: '_typeLabel', label: 'Тип',          cls: 'td-parent', width: 80  },
      { key: 'code',       label: 'Код',          cls: 'td-code',   width: 240 },
      { key: 'nameRu',     label: 'Наименование', cls: 'td-name',   width: 0   },
    ],
  },
};

// ══════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════
let db          = null;
let activeDs    = 'oktru';
let currentRows = [];
let page        = 0;
let pageSize    = 100;
let sortCol     = null;
let sortDir     = 'asc';
let showKk      = false;
let selectedRow = null;
let searchQuery = '';
let debTimer    = null;
let dropdownResults = [];
let dropdownIdx     = -1;

// Favorites: Map of `ds:code` → item object
let favMap = new Map();

// Search history
let history = [];

// Column widths per dataset: { oktru: { code: 240 }, ... }
let colWidths = {};

// Resize state
let resizeActive = false, resizeStartX = 0, resizeStartW = 0, resizeTh = null, resizeKey = '';

// DB source flag
let dbSource = 'bundled'; // 'bundled' | 'user'

// ══════════════════════════════════════════════════════
//  DOM REFS
// ══════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const searchInput    = $('searchInput');
const clearBtn       = $('clearBtn');
const aiBtn          = $('aiBtn');
const searchDropdown = $('searchDropdown');
const sdInner        = $('sdInner');
const tableHead      = $('tableHead');
const tableBody      = $('tableBody');
const tableWrap      = $('tableWrap');
const selCard        = $('selCard');
const topbarTitle    = $('topbarTitle');
const topbarSub      = $('topbarSub');
const resultBadge    = $('resultBadge');
const toggleKkBtn    = $('toggleKkBtn');
const totalCount     = $('totalCount');
const loadingOverlay = $('loadingOverlay');
const loadingFill    = $('loadingFill');
const loadingSub     = $('loadingSub');
const appEl          = $('app');
const pgFirst        = $('pgFirst');
const pgPrev         = $('pgPrev');
const pgNext         = $('pgNext');
const pgLast         = $('pgLast');
const pgPages        = $('pgPages');
const pgInfo         = $('pgInfo');
const pgSize         = $('pgSize');
const themeBtn       = $('themeBtn');
const themeEmoji     = $('themeEmoji');
const themeLabel     = $('themeLabel');
const exportBtn      = $('exportBtn');
const exportDropdown = $('exportDropdown');
const helpBtn        = $('helpBtn');
const dbUpdateBtn    = $('dbUpdateBtn');
const xlsxFileInput  = $('xlsxFileInput');
const xlsxPickBtn    = $('xlsxPickBtn');
const xlsxFileName   = $('xlsxFileName');
const dbModalOk      = $('dbModalOk');
const historyDropdown = $('historyDropdown');
const historyList     = $('historyList');

// ══════════════════════════════════════════════════════
//  TOAST SYSTEM
// ══════════════════════════════════════════════════════
const toastContainer = $('toastContainer');
const TOAST_ICONS = { success: '✅', info: 'ℹ️', error: '❌', warn: '⚠️' };

function showToast(msg, type = 'success', duration = 2500) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type] || '•'}</span><span class="toast-msg">${escHtml(msg)}</span>`;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
}

// ══════════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════════
const htmlEl = document.documentElement;

function applyTheme(theme, save = true) {
  htmlEl.setAttribute('data-theme', theme);
  themeEmoji.textContent = theme === 'pink' ? '🌸' : '🌙';
  themeLabel.textContent = theme === 'pink' ? 'Розовая' : 'Тёмная';
  if (save) try { localStorage.setItem('oktru-theme', theme); } catch {}
}
try {
  const saved = localStorage.getItem('oktru-theme');
  if (saved === 'pink' || saved === 'dark') applyTheme(saved, false);
} catch {}
themeBtn.addEventListener('click', () => {
  applyTheme(htmlEl.getAttribute('data-theme') === 'dark' ? 'pink' : 'dark');
});

// ══════════════════════════════════════════════════════
//  FAVORITES
// ══════════════════════════════════════════════════════
function loadFavs() {
  try {
    const raw = localStorage.getItem('oktru-favorites');
    if (raw) {
      const arr = JSON.parse(raw);
      arr.forEach(item => favMap.set(item._key, item));
    }
  } catch {}
}
function saveFavs() {
  try { localStorage.setItem('oktru-favorites', JSON.stringify([...favMap.values()])); } catch {}
  updateFavCount();
}
function updateFavCount() {
  $('cnt-favorites').textContent = favMap.size;
  if (activeDs === 'favorites') applyFilter();
}
function isFav(code, ds) { return favMap.has(`${ds}:${code}`); }
function toggleFav(item, ds, starEl) {
  const key = `${ds}:${item.code}`;
  if (favMap.has(key)) {
    favMap.delete(key);
    if (starEl) { starEl.textContent = '☆'; starEl.classList.remove('is-fav'); }
    showToast('Удалено из избранного', 'info');
  } else {
    const dsLabel = DS_CONFIG[ds]?.label || ds;
    favMap.set(key, { ...item, _key: key, _ds: ds, _typeLabel: dsLabel });
    if (starEl) { starEl.textContent = '⭐'; starEl.classList.add('is-fav'); }
    showToast('Добавлено в избранное ⭐', 'success');
  }
  saveFavs();
}

// ══════════════════════════════════════════════════════
//  SEARCH HISTORY
// ══════════════════════════════════════════════════════
function loadHistory() {
  try { history = JSON.parse(localStorage.getItem('oktru-history') || '[]'); } catch { history = []; }
}
function saveHistory() {
  try { localStorage.setItem('oktru-history', JSON.stringify(history)); } catch {}
}
function addToHistory(q) {
  if (!q || q.length < 2) return;
  history = [q, ...history.filter(h => h !== q)].slice(0, 10);
  saveHistory();
}
function renderHistoryDropdown() {
  if (!history.length) { hideHistory(); return; }
  historyList.innerHTML = history.map((h, i) => `
    <div class="history-item" data-q="${escHtml(h)}">
      <span class="history-item-icon">🕐</span>
      <span>${escHtml(h)}</span>
      <button class="history-item-del" data-i="${i}" title="Удалить">✕</button>
    </div>`).join('');

  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('history-item-del')) return;
      searchInput.value = el.dataset.q;
      searchQuery = el.dataset.q;
      clearBtn.style.display = 'inline-flex';
      hideHistory();
      applyFilter();
      closeSearchDropdown();
    });
  });
  historyList.querySelectorAll('.history-item-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      history.splice(parseInt(btn.dataset.i), 1);
      saveHistory();
      renderHistoryDropdown();
    });
  });
  historyDropdown.style.display = 'block';
}
function hideHistory() { historyDropdown.style.display = 'none'; }

$('historyClearBtn').addEventListener('click', () => {
  history = []; saveHistory(); hideHistory();
  showToast('История очищена', 'info');
});

// ══════════════════════════════════════════════════════
//  COPY FUNCTIONS
// ══════════════════════════════════════════════════════
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}
async function copyCode(code) {
  await copyText(String(code));
  showToast(`Код скопирован: ${code}`, 'success');
}
async function copyRow(row) {
  const text = `${row.code} | ${row.nameRu || ''}${row.nameKk ? ' | ' + row.nameKk : ''}`;
  await copyText(text);
  showToast('Строка скопирована', 'success');
}

// ══════════════════════════════════════════════════════
//  LOAD DATA
// ══════════════════════════════════════════════════════
async function loadData() {
  try {
    loadingSub.textContent = 'Читаем данные...';
    loadingFill.style.width = '15%';

    // Check for user-updated data via Electron API
    let data = null;
    if (window.electronAPI) {
      loadingSub.textContent = 'Проверяем обновлённую базу...';
      data = await window.electronAPI.loadUserData();
      if (data) dbSource = 'user';
    }

    if (!data) {
      loadingFill.style.width = '30%';
      loadingSub.textContent = 'Загружаем данные...';
      const res = await fetch('data.json');
      loadingFill.style.width = '70%';
      loadingSub.textContent = 'Обрабатываем записи...';
      data = await res.json();
      dbSource = 'bundled';
    }

    db = data;
    loadingFill.style.width = '90%';

    const total = (db.oktru?.length || 0) + (db.tnved?.length || 0) + (db.units?.length || 0) + (db.countries?.length || 0);
    totalCount.textContent = total.toLocaleString('ru-RU');
    $('cnt-oktru').textContent   = (db.oktru?.length   || 0).toLocaleString('ru-RU');
    $('cnt-tnved').textContent   = (db.tnved?.length   || 0).toLocaleString('ru-RU');
    $('cnt-units').textContent   = (db.units?.length   || 0).toLocaleString('ru-RU');
    $('cnt-country').textContent = (db.countries?.length || 0).toLocaleString('ru-RU');

    loadFavs();
    loadHistory();
    loadColWidths();
    updateFavCount();

    loadingFill.style.width = '100%';
    await new Promise(r => setTimeout(r, 180));
    loadingOverlay.style.opacity = '0';
    loadingOverlay.style.transition = 'opacity 0.3s';
    setTimeout(() => { loadingOverlay.style.display = 'none'; }, 300);
    appEl.style.display = 'flex';

    switchDataset('oktru');
  } catch (e) {
    loadingSub.textContent = '⚠️ Ошибка: ' + e.message;
    console.error(e);
  }
}

// ══════════════════════════════════════════════════════
//  DATASET SWITCHING
// ══════════════════════════════════════════════════════
function getDbList(ds) {
  if (ds === 'favorites') return [...favMap.values()];
  if (ds === 'oktru')   return db.oktru   || [];
  if (ds === 'tnved')   return db.tnved   || [];
  if (ds === 'units')   return db.units   || [];
  if (ds === 'country') return db.countries || [];
  return [];
}

function switchDataset(ds) {
  activeDs = ds;
  page     = 0;
  sortCol  = null;
  sortDir  = 'asc';
  document.querySelectorAll('.dnav-btn').forEach(b => b.classList.toggle('active', b.dataset.ds === ds));
  topbarTitle.textContent = DS_CONFIG[ds]?.label || ds;
  applyFilter();
}

// ══════════════════════════════════════════════════════
//  SEARCH ENGINE  (relevance scoring + stem matching)
// ══════════════════════════════════════════════════════

/** Length of common prefix between two strings */
function commonPrefixLen(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Score an item against a query.
 * Returns -1 if no match, otherwise a positive relevance score.
 * Higher = more relevant.
 */
function scoreItem(item, ql, queryWords) {
  const nameRu = (item.nameRu || '').toLowerCase();
  const nameKk = (item.nameKk || '').toLowerCase();
  const code   = String(item.code   || '').toLowerCase();
  
  if (!nameRu && !code) return -1;

  let exact = false;
  let startsWith = false;
  
  if (nameRu === ql || code === ql) {
    exact = true;
  } else if (nameRu.startsWith(ql) || code.startsWith(ql)) {
    startsWith = true;
  }
  
  const nameRuWords = nameRu.split(/[\s,;./-]+/).filter(Boolean);
  const nameKkWords = nameKk.split(/[\s,;./-]+/).filter(Boolean);
  
  let wordMatches = 0;
  let fuzzyMatches = 0;
  
  for (const w of queryWords) {
    let wm = false;
    let fm = false;
    
    if (code.includes(w)) { wm = true; }
    
    // Check Russian words
    for (const nw of nameRuWords) {
      if (nw === w || nw.startsWith(w)) { wm = true; break; }
      else {
        const cl = commonPrefixLen(w, nw);
        const minL = Math.min(w.length, nw.length);
        if (cl >= 4 && cl >= minL - 2) { fm = true; }
      }
    }
    
    // Check Kazakh words if no Russian match
    if (!wm && !fm) {
        for (const nw of nameKkWords) {
          if (nw === w || nw.startsWith(w)) { wm = true; break; }
        }
    }
    
    if (wm) wordMatches++;
    else if (fm) fuzzyMatches++;
  }
  
  let score = 0;
  if (exact) {
    score = 1000;
  } else if (startsWith) {
    score = 800;
  } else if (wordMatches === queryWords.length && queryWords.length > 0) {
    score = 600;
    if (nameRuWords.length > 0 && nameRuWords[0].startsWith(queryWords[0])) {
      score += 50; // Bonus if first word matches first word of query
    }
  } else if (wordMatches + fuzzyMatches === queryWords.length && queryWords.length > 0) {
    score = 400; // All words found, but some were fuzzy (e.g. олова -> олово)
  } else if (wordMatches > 0 || fuzzyMatches > 0) {
    score = 200 + (wordMatches * 10) + fuzzyMatches;
  } else if (nameRu.includes(ql) || code.includes(ql) || nameKk.includes(ql)) {
    score = 100; // Substring match inside a word (e.g. 'ктрометр' in 'спектрометр')
  }
  
  if (score > 0) {
    // Penalty for length: shorter strings (general categories) bubble to the top!
    // "Спектрометры" (12) beats "Спектрометр ионный" (18) because 800-12 > 800-18.
    score -= nameRu.length;
  }
  
  return score > 0 ? score : -1;
}

/**
 * Search a list, return items sorted by descending relevance score.
 * Only items with score >= 0 are included.
 */
function searchList(list, ql, queryWords) {
  const results = [];
  for (const item of list) {
    const s = scoreItem(item, ql, queryWords);
    if (s >= 0) results.push({ item, score: s });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ══════════════════════════════════════════════════════
//  FILTER + SORT
// ══════════════════════════════════════════════════════
function applyFilter() {
  const list = getDbList(activeDs);
  const q = searchQuery.toLowerCase().trim();

  if (!q) {
    currentRows = list.slice();
  } else {
    const queryWords = q.split(/\s+/).filter(Boolean);
    if (sortCol) {
      // User explicitly sorted — just filter without relevance reordering
      currentRows = list.filter(r => {
        const s = scoreItem(r, q, queryWords);
        return s >= 0;
      });
    } else {
      // Default: sort by relevance
      currentRows = searchList(list, q, queryWords).map(s => s.item);
    }
  }

  if (sortCol) {
    currentRows.sort((a, b) => {
      const av = String(a[sortCol] ?? '').toLowerCase();
      const bv = String(b[sortCol] ?? '').toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv, 'ru') : bv.localeCompare(av, 'ru');
    });
  }

  if (q) {
    topbarSub.textContent = `Найдено ${currentRows.length.toLocaleString('ru-RU')} из ${list.length.toLocaleString('ru-RU')}`;
    resultBadge.textContent = `${currentRows.length} результатов`;
    resultBadge.style.display = 'inline-block';
  } else {
    topbarSub.textContent = `${currentRows.length.toLocaleString('ru-RU')} записей`;
    resultBadge.style.display = 'none';
  }

  page = 0;
  renderTable();
  renderPagination();
}

// ══════════════════════════════════════════════════════
//  RENDER TABLE
// ══════════════════════════════════════════════════════
function renderTable() {
  const cfg  = DS_CONFIG[activeDs];
  const cols = cfg.columns.filter(c => !c.kk || showKk);
  const widths = colWidths[activeDs] || {};

  // ── THEAD ──
  const headerRow = document.createElement('tr');

  // # col
  const thNum = document.createElement('th');
  thNum.className = 'col-num';
  thNum.innerHTML = '<div class="th-inner"><span class="th-label">#</span></div>';
  headerRow.appendChild(thNum);

  cols.forEach(col => {
    const th = document.createElement('th');
    const w = widths[col.key] || col.width;
    if (w) th.style.width = w + 'px';

    const sortMark = sortCol === col.key
      ? (sortDir === 'asc' ? '<span class="th-sort asc">▲</span>' : '<span class="th-sort desc">▼</span>')
      : '<span class="th-sort">↕</span>';

    th.innerHTML = `
      <div class="th-inner" data-col="${col.key}">
        <span class="th-label">${col.label}</span>${sortMark}
      </div>
      <div class="resize-handle" data-col="${col.key}"></div>`;

    th.querySelector('.th-inner').addEventListener('click', () => onSort(col.key));
    th.querySelector('.resize-handle').addEventListener('mousedown', e => startResize(e, th, col.key));
    headerRow.appendChild(th);
  });

  // ⭐ col
  if (activeDs !== 'favorites') {
    const thStar = document.createElement('th');
    thStar.className = 'col-star';
    thStar.innerHTML = '<div class="th-inner" style="justify-content:center"><span class="th-label">⭐</span></div>';
    headerRow.appendChild(thStar);
  }

  tableHead.innerHTML = '';
  tableHead.appendChild(headerRow);

  // ── TBODY ──
  const start = page * pageSize;
  const slice = currentRows.slice(start, Math.min(start + pageSize, currentRows.length));

  if (!slice.length) {
    const msg = activeDs === 'favorites' ? '⭐ Избранное пусто — кликните ☆ в строке таблицы' : '😶 Нет данных';
    tableBody.innerHTML = `<tr><td colspan="${cols.length + 2}" class="table-empty">${msg}</td></tr>`;
    return;
  }

  const frag = document.createDocumentFragment();
  slice.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = start + i;

    const tdNum = document.createElement('td');
    tdNum.className = 'td-num col-num';
    tdNum.textContent = (start + i + 1).toLocaleString('ru-RU');
    tr.appendChild(tdNum);

    cols.forEach(col => {
      const td = document.createElement('td');
      td.className = col.cls;
      const val = row[col.key] ?? '';
      td.textContent = val;
      td.title = val;
      tr.appendChild(td);
    });

    // Star button (not for favorites tab)
    if (activeDs !== 'favorites') {
      const tdStar = document.createElement('td');
      tdStar.className = 'col-star';
      const fav = isFav(row.code, activeDs);
      const starBtn = document.createElement('button');
      starBtn.className = 'star-btn' + (fav ? ' is-fav' : '');
      starBtn.textContent = fav ? '⭐' : '☆';
      starBtn.title = fav ? 'Убрать из избранного' : 'В избранное';
      starBtn.addEventListener('click', e => {
        e.stopPropagation();
        toggleFav(row, activeDs, starBtn);
      });
      tdStar.appendChild(starBtn);
      tr.appendChild(tdStar);
    }

    if (selectedRow && selectedRow.code === row.code && selectedRow._ds === activeDs) {
      tr.classList.add('selected');
    }

    tr.addEventListener('click', () => selectRow(row, tr));
    frag.appendChild(tr);
  });

  tableBody.innerHTML = '';
  tableBody.appendChild(frag);
}

// ── Sort ────────────────────────────────────────────
function onSort(col) {
  sortDir = sortCol === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
  sortCol = col;
  page = 0;
  applyFilter();
}

// ══════════════════════════════════════════════════════
//  COLUMN RESIZE
// ══════════════════════════════════════════════════════
function loadColWidths() {
  try { colWidths = JSON.parse(localStorage.getItem('oktru-col-widths') || '{}'); } catch { colWidths = {}; }
}
function saveColWidths() {
  try { localStorage.setItem('oktru-col-widths', JSON.stringify(colWidths)); } catch {}
}

function startResize(e, th, colKey) {
  e.preventDefault();
  e.stopPropagation();
  resizeActive = true;
  resizeStartX = e.clientX;
  resizeStartW = th.offsetWidth;
  resizeTh     = th;
  resizeKey    = colKey;
  document.body.classList.add('col-resizing');
  e.target.classList.add('resizing');
}

document.addEventListener('mousemove', e => {
  if (!resizeActive || !resizeTh) return;
  const newW = Math.max(60, resizeStartW + (e.clientX - resizeStartX));
  resizeTh.style.width = newW + 'px';
});

document.addEventListener('mouseup', () => {
  if (!resizeActive) return;
  resizeActive = false;
  document.body.classList.remove('col-resizing');
  document.querySelectorAll('.resize-handle.resizing').forEach(el => el.classList.remove('resizing'));
  if (resizeTh && resizeKey) {
    if (!colWidths[activeDs]) colWidths[activeDs] = {};
    colWidths[activeDs][resizeKey] = resizeTh.offsetWidth;
    saveColWidths();
  }
  resizeTh = null;
});

// ══════════════════════════════════════════════════════
//  PAGINATION
// ══════════════════════════════════════════════════════
function renderPagination() {
  const total = currentRows.length;
  const pages = Math.ceil(total / pageSize);
  pgFirst.disabled = pgPrev.disabled = page === 0;
  pgNext.disabled  = pgLast.disabled = page >= pages - 1;

  const from = page * pageSize + 1;
  const to   = Math.min((page + 1) * pageSize, total);
  pgInfo.textContent = `${from.toLocaleString('ru-RU')}–${to.toLocaleString('ru-RU')} из ${total.toLocaleString('ru-RU')}`;

  pgPages.innerHTML = '';
  buildPageRange(page, pages).forEach(p => {
    if (p === '…') {
      const sp = document.createElement('span');
      sp.className = 'pg-ellipsis'; sp.textContent = '…';
      pgPages.appendChild(sp);
    } else {
      const btn = document.createElement('button');
      btn.className = 'pg-num' + (p === page ? ' active' : '');
      btn.textContent = p + 1;
      btn.addEventListener('click', () => goPage(p));
      pgPages.appendChild(btn);
    }
  });
}

function buildPageRange(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  if (cur <= 3)         return [0,1,2,3,4,'…',total-1];
  if (cur >= total - 4) return [0,'…',total-5,total-4,total-3,total-2,total-1];
  return [0,'…',cur-1,cur,cur+1,'…',total-1];
}

function goPage(p) {
  page = p;
  tableWrap.scrollTop = 0;
  renderTable();
  renderPagination();
}

pgFirst.addEventListener('click', () => goPage(0));
pgPrev.addEventListener('click',  () => goPage(page - 1));
pgNext.addEventListener('click',  () => goPage(page + 1));
pgLast.addEventListener('click',  () => goPage(Math.ceil(currentRows.length / pageSize) - 1));
pgSize.addEventListener('change', () => { pageSize = parseInt(pgSize.value, 10); page = 0; renderTable(); renderPagination(); });

// ══════════════════════════════════════════════════════
//  SELECT ROW + CARD
// ══════════════════════════════════════════════════════
function selectRow(row, trEl) {
  selectedRow = { ...row, _ds: activeDs };
  document.querySelectorAll('.data-table tbody tr').forEach(r => r.classList.remove('selected'));
  if (trEl) trEl.classList.add('selected');
  renderSelCard(row);
}

function renderSelCard(row) {
  const cfg    = DS_CONFIG[activeDs];
  const hasKk  = row.nameKk && row.nameKk !== row.nameRu;
  const favKey = `${activeDs}:${row.code}`;
  const fav    = favMap.has(favKey);

  selCard.innerHTML = `
    <button id="selCardClose" style="position:absolute; top:8px; right:8px; background:none; border:none; color:var(--text3); font-size:16px; cursor:pointer; padding:4px;">✕</button>
    <span class="sel-type-badge ${cfg.badge}" style="border:1px solid currentColor">${cfg.label}</span>
    <div class="sel-code">${escHtml(String(row.code ?? '—'))}</div>
    <div class="sel-name">${escHtml(row.nameRu ?? '—')}</div>
    ${hasKk ? `<div class="sel-name-kk">${escHtml(row.nameKk)}</div>` : ''}
    <div class="sel-btns">
      <button class="sel-copy-btn" id="selCopyBtn">📋 Копировать код</button>
      <button class="sel-copy-row-btn" id="selCopyRowBtn">📄 Строку</button>
    </div>
    <button class="sel-copy-btn" id="selFavBtn" style="margin-top:6px;width:100%">
      ${fav ? '⭐ Убрать из избранного' : '☆ В избранное'}
    </button>
    ${row.parent ? `<div class="sel-meta"><div class="sel-meta-row"><span>Родит. код:</span><span class="sel-meta-val">${escHtml(row.parent)}</span></div></div>` : ''}
    ${dbSource === 'user' ? '<div class="db-source-badge">📂 Обновлённая база</div>' : ''}
  `;

  $('selCardClose')?.addEventListener('click', () => {
    document.querySelectorAll('.data-table tbody tr').forEach(r => r.classList.remove('selected'));
    selectedRow = null;
    selCard.innerHTML = '<div class="sel-empty">Кликните строку или нажмите Enter</div>';
  });

  $('selCopyBtn').addEventListener('click', () => copyCode(row.code));
  $('selCopyRowBtn').addEventListener('click', async () => {
    await copyRow(row);
    const btn = $('selCopyRowBtn');
    btn.textContent = '✅ Скопировано!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '📄 Строку'; btn.classList.remove('copied'); }, 2000);
  });
  $('selFavBtn').addEventListener('click', () => {
    toggleFav(row, activeDs, null);
    // update star in table
    const tr = tableBody.querySelector(`tr[data-idx]`);
    if (tr) {
      const starBtn = tableBody.querySelector('.data-table tbody tr.selected .star-btn');
      if (starBtn) {
        const nowFav = favMap.has(favKey);
        starBtn.textContent = nowFav ? '⭐' : '☆';
        starBtn.classList.toggle('is-fav', nowFav);
      }
    }
    renderSelCard(row); // refresh button text
  });
}

// ══════════════════════════════════════════════════════
//  EXPORT
// ══════════════════════════════════════════════════════
function openExportMenu() {
  exportDropdown.style.display = exportDropdown.style.display === 'none' ? 'block' : 'none';
}
function closeExportMenu() { exportDropdown.style.display = 'none'; }

exportBtn.addEventListener('click', e => { e.stopPropagation(); openExportMenu(); });
document.addEventListener('click', e => { if (!e.target.closest('.export-wrap')) closeExportMenu(); });

function exportCSV() {
  closeExportMenu();
  const cols = DS_CONFIG[activeDs].columns;
  const header = cols.map(c => `"${c.label}"`).join(',');
  const rows = currentRows.map(row =>
    cols.map(c => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const csv = '\ufeff' + [header, ...rows].join('\r\n'); // BOM for Excel
  downloadBlob(csv, `OKTRU-export-${dateStr()}.csv`, 'text/csv;charset=utf-8');
  showToast(`Экспортировано ${currentRows.length.toLocaleString('ru-RU')} строк (CSV)`, 'success');
}

function exportXLSX() {
  closeExportMenu();
  // Build CSV then offer as xlsx-named file (xlsx lib not loaded in renderer)
  // Build tab-separated for Excel-compatible
  const cols = DS_CONFIG[activeDs].columns;
  const header = cols.map(c => c.label).join('\t');
  const rows = currentRows.map(row => cols.map(c => row[c.key] ?? '').join('\t'));
  const tsv = '\ufeff' + [header, ...rows].join('\r\n');
  downloadBlob(tsv, `OKTRU-export-${dateStr()}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  showToast(`Экспортировано ${currentRows.length.toLocaleString('ru-RU')} строк (Excel)`, 'success');
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStr() {
  return new Date().toISOString().slice(0, 10);
}

$('exportCsvBtn').addEventListener('click',  exportCSV);
$('exportXlsxBtn').addEventListener('click', exportXLSX);

// ══════════════════════════════════════════════════════
//  DB UPDATE MODAL
// ══════════════════════════════════════════════════════
let xlsxBuffer = null;

function openDbModal() { $('dbModal').style.display = 'flex'; }
function closeDbModal() {
  $('dbModal').style.display = 'none';
  xlsxBuffer = null;
  xlsxFileName.textContent = 'Файл не выбран';
  xlsxFileName.classList.remove('has-file');
  dbModalOk.disabled = true;
  $('dbProgress').style.display = 'none';
  $('dbProgressFill').style.width = '0%';
  xlsxFileInput.value = '';
}

dbUpdateBtn.addEventListener('click', openDbModal);
$('dbModalClose').addEventListener('click',  closeDbModal);
$('dbModalCancel').addEventListener('click', closeDbModal);
$('modal-overlay')?.addEventListener('click', e => { if (e.target === $('dbModal')) closeDbModal(); });
$('dbModal').addEventListener('click', e => { if (e.target === $('dbModal')) closeDbModal(); });

xlsxPickBtn.addEventListener('click', () => xlsxFileInput.click());
xlsxFileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  xlsxBuffer = await file.arrayBuffer();
  xlsxFileName.textContent = `📄 ${file.name}`;
  xlsxFileName.classList.add('has-file');
  dbModalOk.disabled = false;
});

dbModalOk.addEventListener('click', async () => {
  if (!xlsxBuffer) return;
  const mode = document.querySelector('input[name="dbMode"]:checked')?.value || 'replace';
  const prog = $('dbProgress');
  const fill = $('dbProgressFill');
  const txt  = $('dbProgressText');

  prog.style.display = 'flex';
  fill.style.width = '20%';
  txt.textContent = 'Парсим файл...';
  dbModalOk.disabled = true;

  try {
    let newData;
    if (window.electronAPI) {
      newData = window.electronAPI.parseXlsx(xlsxBuffer);
    } else {
      throw new Error('Функция доступна только в десктопном приложении');
    }

    fill.style.width = '60%';
    txt.textContent = mode === 'merge' ? 'Объединяем данные...' : 'Применяем новую базу...';

    let finalData;
    if (mode === 'replace') {
      finalData = { oktru: newData.oktru || [], tnved: newData.tnved || [], units: newData.units || [], countries: newData.countries || [] };
    } else {
      finalData = mergeData(db, newData);
    }

    fill.style.width = '80%';
    txt.textContent = 'Сохраняем на диск...';

    const saveResult = await window.electronAPI.saveDataJson(JSON.stringify(finalData));

    fill.style.width = '100%';
    if (!saveResult.success) throw new Error(saveResult.error);

    db = finalData;
    dbSource = 'user';

    // update counts
    const total = (db.oktru?.length||0)+(db.tnved?.length||0)+(db.units?.length||0)+(db.countries?.length||0);
    totalCount.textContent = total.toLocaleString('ru-RU');
    $('cnt-oktru').textContent   = (db.oktru?.length||0).toLocaleString('ru-RU');
    $('cnt-tnved').textContent   = (db.tnved?.length||0).toLocaleString('ru-RU');
    $('cnt-units').textContent   = (db.units?.length||0).toLocaleString('ru-RU');
    $('cnt-country').textContent = (db.countries?.length||0).toLocaleString('ru-RU');

    closeDbModal();
    switchDataset(activeDs);

    const modeLabel = mode === 'replace' ? 'заменена' : 'дополнена';
    showToast(`База ${modeLabel}! Всего записей: ${total.toLocaleString('ru-RU')}`, 'success', 4000);
  } catch (err) {
    fill.style.width = '100%';
    txt.textContent = '❌ Ошибка: ' + err.message;
    dbModalOk.disabled = false;
    showToast('Ошибка обновления базы: ' + err.message, 'error', 5000);
  }
});

function mergeData(current, incoming) {
  function mergeList(curList, newList) {
    const map = new Map((curList || []).map(r => [String(r.code), { ...r }]));
    for (const item of (newList || [])) {
      const key = String(item.code);
      if (map.has(key)) {
        const ex = map.get(key);
        if (item.nameRu) ex.nameRu = item.nameRu;
        if (item.nameKk) ex.nameKk = item.nameKk;
        if (item.parent) ex.parent = item.parent;
      } else {
        map.set(key, { ...item });
      }
    }
    return [...map.values()];
  }
  return {
    oktru:     mergeList(current.oktru,     incoming.oktru),
    tnved:     mergeList(current.tnved,     incoming.tnved),
    units:     mergeList(current.units,     incoming.units),
    countries: mergeList(current.countries, incoming.countries),
  };
}

// ══════════════════════════════════════════════════════
//  HELP MODAL
// ══════════════════════════════════════════════════════
helpBtn.addEventListener('click',       () => $('helpModal').style.display = 'flex');
$('helpModalClose').addEventListener('click', () => $('helpModal').style.display = 'none');
$('helpModal').addEventListener('click', e => { if (e.target === $('helpModal')) $('helpModal').style.display = 'none'; });

// ══════════════════════════════════════════════════════
//  DATASET NAV
// ══════════════════════════════════════════════════════
document.querySelectorAll('.dnav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearBtn.style.display = 'none';
    closeSearchDropdown();
    hideHistory();
    switchDataset(btn.dataset.ds);
  });
});

// ══════════════════════════════════════════════════════
//  TOGGLE KAZAKH COLUMN
// ══════════════════════════════════════════════════════
toggleKkBtn.addEventListener('click', () => {
  showKk = !showKk;
  toggleKkBtn.classList.toggle('active', showKk);
  renderTable();
});

// ══════════════════════════════════════════════════════
//  SEARCH
// ══════════════════════════════════════════════════════
searchInput.addEventListener('focus', () => {
  if (!searchInput.value.trim() && history.length) renderHistoryDropdown();
});
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearBtn.style.display = q ? 'inline-flex' : 'none';
  aiBtn.style.display = q ? 'inline-flex' : 'none';
  if (!q) { hideHistory(); }
  clearTimeout(debTimer);
  debTimer = setTimeout(() => {
    searchQuery = q;
    if (q.length >= 1) {
      hideHistory();
      showGlobalSearch(q);
    } else {
      closeSearchDropdown();
      applyFilter();
    }
  }, 180);
});
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeSearchDropdown(); hideHistory(); searchInput.blur(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); navigateDropdown(1); }
  if (e.key === 'ArrowUp')   { e.preventDefault(); navigateDropdown(-1); }
  if (e.key === 'Enter')     { e.preventDefault(); selectDropdownItem(); }
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  clearBtn.style.display = 'none';
  aiBtn.style.display = 'none';
  closeSearchDropdown();
  hideHistory();
  applyFilter();
  searchInput.focus();
});

// ── AI Search ─────────────────────────────────────────
aiBtn.addEventListener('click', async () => {
  const q = searchInput.value.trim();
  if (!q) return;
  aiBtn.disabled = true;
  aiBtn.textContent = '⏳';
  try {
    let synonyms = [];
    if (window.electronAPI) {
      // 1. Десктопная версия (через Electron main.js)
      const res = await window.electronAPI.askGemini(q);
      if (!res.success) throw new Error(res.error);
      synonyms = res.data;
    } else {
      // 2. Веб-версия (прямой запрос с "разрезанным" ключом)
      const p1 = "AQ.Ab8RN6";
      const p2 = "KToKpuMaBQh-G";
      const p3 = "D5V6xuqioJb52WC2czWaMc0bxSeijHw";
      const apiKey = p1 + p2 + p3;
      
      const prompt = `Пользователь ищет "${q}" в справочнике товаров/услуг. 
Дай 3-5 официальных синонимов, названий категорий или связанных терминов в именительном падеже, которые могут встретиться в строгом классификаторе товаров (ТНВЭД / ОКТРУ).
Верни ТОЛЬКО валидный JSON массив строк. Больше ничего не пиши, никаких пояснений.
Пример: ["портативный компьютер", "ноутбук", "эвм"]`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      let text = data.candidates[0].content.parts[0].text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
      }
      synonyms = JSON.parse(text);
    }

    showToast('ИИ подсказал: ' + synonyms.join(', '), 'info', 5000);
    searchQuery = synonyms.join(' ');
    closeSearchDropdown();
    hideHistory();
    applyFilter();
  } catch (e) {
    showToast('Ошибка вызова ИИ: ' + e.message, 'error');
  } finally {
    aiBtn.disabled = false;
    aiBtn.textContent = '🧠 ИИ';
  }
});

// ── Dropdown navigation ──────────────────────────────
function navigateDropdown(dir) {
  const items = sdInner.querySelectorAll('.sd-item');
  if (!items.length) return;
  dropdownIdx = Math.max(-1, Math.min(items.length - 1, dropdownIdx + dir));
  items.forEach((el, i) => el.classList.toggle('sd-active', i === dropdownIdx));
  if (dropdownIdx >= 0) items[dropdownIdx].scrollIntoView({ block: 'nearest' });
}

function selectDropdownItem() {
  const active = sdInner.querySelector('.sd-item.sd-active');
  if (active) active.click();
}

// ── Global search across all datasets (scored) ──────
function showGlobalSearch(q) {
  const ql = q.toLowerCase();
  const queryWords = ql.split(/\s+/).filter(Boolean);
  const MAX_PER = 12; // top 12 per group, sorted by relevance

  const groups = [
    { key: 'oktru',   list: db.oktru,     badge: 'b-oktru',   label: '🔷 ОКТРУ' },
    { key: 'tnved',   list: db.tnved,     badge: 'b-tnved',   label: '🌐 ТНВЭД' },
    { key: 'units',   list: db.units,     badge: 'b-unit',    label: '📏 Ед.изм.' },
    { key: 'country', list: db.countries, badge: 'b-country', label: '🌍 Страны' },
  ];

  dropdownResults = [];
  let html = '';

  groups.forEach(g => {
    // Score ALL items, sort by relevance, take top MAX_PER
    const scored = searchList(g.list || [], ql, queryWords);
    if (!scored.length) return;

    const topHits = scored.slice(0, MAX_PER);
    const totalFound = scored.length;

    html += `<div class="sd-section">`;
    html += `<div class="sd-section-title">${g.label}`;
    if (totalFound > MAX_PER) html += ` <span style="opacity:.5;font-weight:400">(показано ${MAX_PER} из ${totalFound.toLocaleString('ru-RU')})</span>`;
    html += `</div>`;

    topHits.forEach(({ item }) => {
      dropdownResults.push({ ...item, _groupKey: g.key });
      html += `<div class="sd-item" data-ds="${g.key}" data-code="${escHtml(String(item.code))}">
        <span class="sd-item-badge ${g.badge}">${g.label.split(' ')[1]}</span>
        <div class="sd-item-body">
          <div class="sd-item-code">${hl(String(item.code ?? ''), q)}</div>
          <div class="sd-item-name">${hl(item.nameRu ?? '', q)}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  });

  if (!html) {
    html = `<div class="sd-footer" style="padding:20px">😶 Ничего не найдено по запросу <b>"${escHtml(q)}"</b></div>`;
  } else {
    html += `<div class="sd-footer">По релевантности · ↑↓ навигация · Enter выбор · Ctrl+F фокус</div>`;
  }

  sdInner.innerHTML = html;
  searchDropdown.style.display = 'block';
  dropdownIdx = -1;

  sdInner.querySelectorAll('.sd-item').forEach(el => {
    el.addEventListener('click', () => jumpToResult(el.dataset.ds, el.dataset.code));
  });
}

function jumpToResult(ds, code) {
  const q = searchInput.value.trim();
  addToHistory(q);
  switchDataset(ds);
  closeSearchDropdown();
  setTimeout(() => {
    const idx = currentRows.findIndex(r => String(r.code) === code);
    if (idx >= 0) {
      page = Math.floor(idx / pageSize);
      renderTable();
      renderPagination();
      setTimeout(() => {
        const rows = tableBody.querySelectorAll('tr');
        const local = idx - page * pageSize;
        if (rows[local]) {
          rows[local].classList.add('selected');
          rows[local].scrollIntoView({ block: 'center' });
          selectRow(currentRows[idx], rows[local]);
        }
      }, 50);
    }
  }, 50);
}

function closeSearchDropdown() { searchDropdown.style.display = 'none'; dropdownIdx = -1; }
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap') && !e.target.closest('.search-dropdown')) {
    closeSearchDropdown();
    hideHistory();
  }
});

// ══════════════════════════════════════════════════════
//  HOTKEYS
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
//  HOTKEYS  (use e.code — keyboard-layout independent)
// ══════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  const ctrl  = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const inInput = ['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);

  // Ctrl+F — focus search (works on any layout)
  if (ctrl && e.code === 'KeyF') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }
  // Ctrl+E — export menu
  if (ctrl && !shift && e.code === 'KeyE') {
    e.preventDefault();
    openExportMenu();
    return;
  }
  // Ctrl+U — update DB
  if (ctrl && !shift && e.code === 'KeyU') {
    e.preventDefault();
    openDbModal();
    return;
  }
  // F1 — help
  if (e.code === 'F1') {
    e.preventDefault();
    $('helpModal').style.display = 'flex';
    return;
  }
  // Escape — close modals / dropdowns
  if (e.code === 'Escape') {
    if ($('helpModal').style.display !== 'none') { $('helpModal').style.display = 'none'; return; }
    if ($('dbModal').style.display   !== 'none') { closeDbModal(); return; }
    closeSearchDropdown();
    hideHistory();
    closeExportMenu();
    if (inInput) { searchInput.value = ''; searchQuery = ''; clearBtn.style.display = 'none'; applyFilter(); }
    return;
  }
  // Arrow navigation in search dropdown
  if (e.code === 'ArrowDown' && searchDropdown.style.display !== 'none') {
    e.preventDefault(); navigateDropdown(1); return;
  }
  if (e.code === 'ArrowUp' && searchDropdown.style.display !== 'none') {
    e.preventDefault(); navigateDropdown(-1); return;
  }
  if (e.code === 'Enter' && searchDropdown.style.display !== 'none') {
    e.preventDefault(); selectDropdownItem(); return;
  }
  // Ctrl+C — copy selected row code (not in input fields)
  if (ctrl && !shift && e.code === 'KeyC' && selectedRow && !inInput) {
    e.preventDefault();
    copyCode(selectedRow.code);
    return;
  }
  // Ctrl+Shift+C — copy full row
  if (ctrl && shift && e.code === 'KeyC' && selectedRow) {
    e.preventDefault();
    copyRow(selectedRow);
    return;
  }
});

// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════
function hl(text, q) {
  if (!q || !text) return escHtml(text || '');
  let result = escHtml(text);
  // Highlight each word in query separately
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  // Sort longest first so shorter words don't break already-marked spans
  words.sort((a, b) => b.length - a.length);
  for (const w of words) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`(?!<[^>]*)(${esc})(?![^<]*>)`, 'gi'), '<mark>$1</mark>');
  }
  return result;
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════
if (!window.electronAPI) {
  // Hide DB update button in web version since it requires Node.js filesystem access
  const updateBtn = document.getElementById('dbUpdateBtn');
  if (updateBtn) updateBtn.style.display = 'none';
}

loadData();
