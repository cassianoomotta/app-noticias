/* ==================================================
   RADAR GLOBAL — JavaScript v2.0
   - Separa notícias em duas seções: Hoje vs. Semana
   - Filtros funcionam em ambas as seções
   - Load More com paginação por seção
   - Timer de contagem regressiva para próxima atualização
   ================================================== */

const API_URL = '/api/news';
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_CARDS_PER_SECTION = 9;

const isFileProtocol = window.location.protocol === 'file:';

// Mapeia as tags em pt-BR emitidas pelo backend às classes CSS correspondentes
const TAG_MAP = {
    'urgente': 'tag-urgente',
    'guerra': 'tag-guerra',
    'diplomacia': 'tag-diplomacia',
    'crise': 'tag-crise',
    'mundo': 'tag-mundo',
    'brasil': 'tag-brasil',
    // aliases ingleses (compatibilidade)
    'urgent': 'tag-urgente',
    'war': 'tag-guerra',
    'diplomacy': 'tag-diplomacia',
    'crisis': 'tag-crise',
    'world': 'tag-mundo',
    'br': 'tag-brasil',
};

let allNews = [];
let filteredToday = [];
let filteredWeek = [];
let shownToday = INITIAL_CARDS_PER_SECTION;
let shownWeek = INITIAL_CARDS_PER_SECTION;
let activeFilter = 'all';
let searchQuery = '';
let nextRefreshAt = null;
let countdownTimer = null;

/* ─── DOM Refs ─── */
const todayContainer = document.getElementById('today-news-container');
const weekContainer = document.getElementById('week-news-container');
const todayCount = document.getElementById('today-count');
const weekCount = document.getElementById('week-count');
const todayLoadMoreContainer = document.getElementById('today-load-more-container');
const weekLoadMoreContainer = document.getElementById('week-load-more-container');
const todayLoadMoreBtn = document.getElementById('today-load-more-btn');
const weekLoadMoreBtn = document.getElementById('week-load-more-btn');
const lastUpdateText = document.getElementById('last-update-text');
const statusUpdateText = document.getElementById('status-update-text');
const nextUpdateText = document.getElementById('next-update-text');
const searchInput = document.getElementById('search-input');
const currentDateEl = document.getElementById('current-date');
const footerYear = document.getElementById('footer-year');

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate();
    // Bug 1 — guard: footerYear pode ser null se o elemento não existir no DOM
    if (footerYear) footerYear.textContent = new Date().getFullYear();
    loadNews();

    // Auto-refresh
    setInterval(() => {
        loadNews();
    }, REFRESH_INTERVAL_MS);

    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            shownToday = INITIAL_CARDS_PER_SECTION;
            shownWeek = INITIAL_CARDS_PER_SECTION;
            applyFiltersAndRender();
        });
    });

    // Search
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim().toLowerCase();
        shownToday = INITIAL_CARDS_PER_SECTION;
        shownWeek = INITIAL_CARDS_PER_SECTION;
        applyFiltersAndRender();
    });

    // Load More
    todayLoadMoreBtn.addEventListener('click', () => {
        shownToday += INITIAL_CARDS_PER_SECTION;
        renderSection(filteredToday, todayContainer, shownToday, todayLoadMoreContainer, 'today');
    });

    weekLoadMoreBtn.addEventListener('click', () => {
        shownWeek += INITIAL_CARDS_PER_SECTION;
        renderSection(filteredWeek, weekContainer, shownWeek, weekLoadMoreContainer, 'week');
    });
});

/* ─── Date Setup ─── */
function setCurrentDate() {
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = new Date().toLocaleDateString('pt-BR', opts);
}

/* ─── Fetch ─── */
async function loadNews() {
    console.log('DEBUG: Carregando notícias...');
    console.log('DEBUG: CACHED_NEWS existe?', typeof CACHED_NEWS !== 'undefined');
    console.log('DEBUG: CACHED_NEWS tem dados?', CACHED_NEWS && CACHED_NEWS.length);

    if (typeof CACHED_NEWS !== 'undefined' && CACHED_NEWS && CACHED_NEWS.length > 0) {
        console.log('DEBUG: Usando dados do cache, total:', CACHED_NEWS.length);
        allNews = CACHED_NEWS;
        loadSuccess(true);
        return;
    }

    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allNews = await res.json();
        loadSuccess();
    } catch (err) {
        console.error('Erro ao carregar notícias:', err);
        await loadFromCache();
    }
}

async function loadFromCache() {
    if (typeof CACHED_NEWS !== 'undefined' && CACHED_NEWS && CACHED_NEWS.length > 0) {
        allNews = CACHED_NEWS;
        loadSuccess(true);
        return;
    }

    try {
        const res = await fetch('./news_cache.json');
        if (res.ok) {
            allNews = await res.json();
            loadSuccess(true);
            return;
        }
    } catch { }

    try {
        const res2 = await fetch('../backend/news_cache.json');
        if (res2.ok) {
            allNews = await res2.json();
            loadSuccess(true);
            return;
        }
    } catch { }

    allNews = SAMPLE_NEWS;
    loadSuccess(true);
}

const SAMPLE_NEWS = [
    { title: "Carregando notícias...", summary: "Execute o servidor Python para carregar as notícias em tempo real.", category: "mundo", pubDate: new Date().toISOString(), link: "#", image: "" },
    { title: "Servidor offline", summary: "Execute 'python main.py' na pasta backend para iniciar.", category: "brasil", pubDate: new Date().toISOString(), link: "#", image: "" }
];

function loadSuccess(fromCache = false) {
    const now = new Date();
    const updateTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (fromCache) {
        lastUpdateText.textContent = `Offline (Cache Local)`;
        statusUpdateText.textContent = `Origem: Arquivo local. Inicie o servidor Python para conteúdo online.`;
    } else {
        lastUpdateText.textContent = `Atualizado às ${updateTime}`;
        statusUpdateText.textContent = `Status: Conectado e atualizando em tempo real`;
    }

    updateReferenceDate(allNews);
    nextRefreshAt = new Date(now.getTime() + REFRESH_INTERVAL_MS);
    startCountdown();
    applyFiltersAndRender();
}

/* ─── Countdown ─── */
function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        if (!nextRefreshAt) return;
        const diff = Math.max(0, nextRefreshAt - new Date());
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        nextUpdateText.textContent = `Próxima atualização em ${m}m ${s < 10 ? '0' : ''}${s}s`;
        if (diff === 0) clearInterval(countdownTimer);
    }, 1000);
}

/* ─── Date Classification ─── */
let referenceDate = new Date();

function updateReferenceDate(articles) {
    referenceDate = new Date();
    if (!articles || articles.length === 0) return;
    const sorted = [...articles].sort((a, b) => {
        const da = parseDate(a.published);
        const db = parseDate(b.published);
        return (db || 0) - (da || 0);
    });
    if (sorted.length > 0) {
        const newest = parseDate(sorted[0].published);
        if (newest && (referenceDate - newest) > 24 * 60 * 60 * 1000) {
            referenceDate = newest;
        }
    }
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    } catch { return null; }
}

function isToday(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return false;
    return d.getUTCDate() === referenceDate.getUTCDate()
        && d.getUTCMonth() === referenceDate.getUTCMonth()
        && d.getUTCFullYear() === referenceDate.getUTCFullYear();
}

function isThisWeek(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return false;
    const weekAgo = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo && d <= referenceDate;
}

/* ─── Filtering ─── */
function matchesFilter(article) {
    if (activeFilter === 'all') return true;
    if (article.category) {
        if (article.category.includes(activeFilter)) return true;
    }
    return false;
}

function matchesSearch(article) {
    if (!searchQuery) return true;
    const haystack = `${article.title} ${article.summary} ${article.source}`.toLowerCase();
    return haystack.includes(searchQuery);
}

function applyFiltersAndRender() {
    console.log('DEBUG applyFilters: allNews.length =', allNews.length);
    const matching = allNews.filter(a => matchesFilter(a) && matchesSearch(a));
    console.log('DEBUG applyFilters: matching.length =', matching.length);
    console.log('DEBUG applyFilters: activeFilter =', activeFilter);

    // Classifica as notícias baseando-se na data (Hoje vs Semana)
    filteredToday = matching.filter(a => isToday(a.published));
    const weekArticles = matching.filter(a => isThisWeek(a.published) && !isToday(a.published));

    // Sort: articles with dates first (newest first), no-date at the end
    const sortByDate = (arr) => arr.sort((a, b) => {
        const da = parseDate(a.published);
        const db = parseDate(b.published);
        if (da && db) return db - da;
        if (da) return -1;
        if (db) return 1;
        return 0;
    });

    filteredToday = sortByDate(filteredToday);
    filteredWeek = sortByDate(weekArticles);

    // Update counts
    todayCount.textContent = `${filteredToday.length} notícia${filteredToday.length !== 1 ? 's' : ''}`;
    weekCount.textContent = `${filteredWeek.length} notícia${filteredWeek.length !== 1 ? 's' : ''}`;

    // Render
    renderSection(filteredToday, todayContainer, shownToday, todayLoadMoreContainer, 'today');
    renderSection(filteredWeek, weekContainer, shownWeek, weekLoadMoreContainer, 'week');
}

/* ─── Render Section ─── */
function renderSection(articles, container, shown, loadMoreContainer, sectionType) {
    container.innerHTML = '';

    if (articles.length === 0) {
        container.innerHTML = renderEmpty(sectionType);
        loadMoreContainer.style.display = 'none';
        return;
    }

    const slice = articles.slice(0, shown);
    const fragment = document.createDocumentFragment();
    slice.forEach(article => {
        const card = createCard(article);
        fragment.appendChild(card);
    });
    container.appendChild(fragment);

    // Load more
    if (articles.length > shown) {
        const remaining = articles.length - shown;
        loadMoreContainer.style.display = 'flex';
        const btn = loadMoreContainer.querySelector('button');
        const sectionLabel = sectionType === 'today' ? 'de hoje' : 'da semana';
        btn.textContent = `Ver mais ${remaining} notícia${remaining !== 1 ? 's' : ''} ${sectionLabel}`;
    } else {
        loadMoreContainer.style.display = 'none';
    }
}

/* ─── Card Creation ─── */
function buildTagHtml(tagName) {
    const cssClass = TAG_MAP[tagName.toLowerCase()] || `tag-${tagName}`;
    const label = tagName.charAt(0).toUpperCase() + tagName.slice(1);
    return `<span class="tag ${cssClass}">${escapeHtml(label)}</span>`;
}

function createCard(article) {
    const card = document.createElement('a');
    const hasImage = !!(article.image_url);
    card.className = hasImage ? 'news-card has-image' : 'news-card';
    card.href = article.link || '#';
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    const allTags = article.tags || [];
    const isUrgent = allTags.some(t => t === 'urgente' || t === 'urgent');
    const otherTags = allTags.filter(t => t !== 'urgente' && t !== 'urgent');
    const timeLabel = formatRelativeTime(article.published);

    const imagePart = hasImage
        ? `<div class="card-image"><img src="${escapeHtml(article.image_url)}" alt="" loading="lazy" onerror="this.parentElement.remove();this.closest('.news-card').classList.remove('has-image')"></div>`
        : '';

    card.innerHTML = `
        ${imagePart}
        <div class="card-top">
            <div class="tag-list">
                ${isUrgent ? '<span class="tag tag-urgente">Urgente</span>' : ''}
                ${otherTags.map(buildTagHtml).join('')}
            </div>
            ${timeLabel ? `<span class="time-pill">${timeLabel}</span>` : ''}
        </div>
        <h3 class="card-title">${escapeHtml(article.title || 'Sem título')}</h3>
        ${article.summary ? `<p class="card-summary">${escapeHtml(article.summary)}</p>` : ''}
        <div class="card-footer">
            <span class="source-name">${escapeHtml(article.source || 'Desconhecido')}</span>
            ${article.category ? `<span class="category-label">${escapeHtml(article.category)}</span>` : ''}
        </div>
    `;
    return card;
}

/* ─── Helpers ─── */
function formatRelativeTime(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return '';
    const diff = Math.floor((new Date() - d) / 1000);
    if (diff < 60) return 'agora mesmo';
    if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    const days = Math.floor(diff / 86400);
    return `há ${days} dia${days > 1 ? 's' : ''}`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderEmpty(sectionType) {
    const msgMap = {
        today: { icon: '📰', msg: 'Nenhuma notícia de hoje nesta categoria.' },
        week: { icon: '🗓️', msg: 'Nenhuma notícia desta semana nesta categoria.' }
    };
    const { icon, msg } = msgMap[sectionType] || { icon: '📰', msg: 'Nenhuma notícia encontrada.' };
    return `<div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
            <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>
        </svg>
        <p>${msg}</p>
    </div>`;
}

function showError(container) {
    container.innerHTML = `<div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>Não foi possível conectar ao servidor.<br>Verifique se o backend está ativo.</p>
    </div>`;
}
