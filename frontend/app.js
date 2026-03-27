/* ==================================================
   RADAR GLOBAL — app.js v3.0
   - Hero card (primeiro card de Hoje)
   - Highlight de busca com <mark>
   - Notícias lidas via localStorage
   - Contagem nos filtros
   - Toast de erro visual
   - Animação fade-in no Load More
   - showError() integrado ao fluxo
   ================================================== */

const API_URL = '/api/news';
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_CARDS_PER_SECTION = 9;
const READ_KEY = 'rg_read_links';

// Mapeia tags às classes CSS
const TAG_MAP = {
    'urgente': 'tag-urgente',
    'guerra': 'tag-guerra',
    'diplomacia': 'tag-diplomacia',
    'crise': 'tag-crise',
    'mundo': 'tag-mundo',
    'brasil': 'tag-brasil',
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
let autoRefreshTimer = null;   // timer do ciclo automático
let readLinks = new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));

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
const filterBtns = document.querySelectorAll('.filter-btn');
const refreshNowBtn = document.getElementById('refresh-now-btn');
const refreshIndicator = document.getElementById('refresh-indicator');

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
    setCurrentDate();
    if (footerYear) footerYear.textContent = new Date().getFullYear();
    loadNews();

    // Inicia ciclo automático
    startAutoRefresh();

    // Filters
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
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
        renderSection(filteredToday, todayContainer, shownToday, todayLoadMoreContainer, 'today', true);
    });

    weekLoadMoreBtn.addEventListener('click', () => {
        shownWeek += INITIAL_CARDS_PER_SECTION;
        renderSection(filteredWeek, weekContainer, shownWeek, weekLoadMoreContainer, 'week', true);
    });

    // Refresh imediato — adianta o ciclo e reinicia o timer de 15min do zero
    refreshNowBtn.addEventListener('click', async () => {
        if (refreshNowBtn.disabled) return;
        refreshNowBtn.disabled = true;
        refreshNowBtn.classList.add('loading');
        await loadNews();
        startAutoRefresh();          // reinicia o timer do zero a partir desse momento
        refreshNowBtn.disabled = false;
        refreshNowBtn.classList.remove('loading');
    });
});

/* ─── Auto-refresh control ─── */
function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(loadNews, REFRESH_INTERVAL_MS);
}



/* ─── Date Setup ─── */
function setCurrentDate() {
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = new Date().toLocaleDateString('pt-BR', opts);
}

/* ─── Fetch ─── */
async function loadNews() {
    if (window.location.protocol === 'file:') {
        await loadFromCache();
        return;
    }
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allNews = await res.json();
        if (!allNews || allNews.length === 0) throw new Error('empty');
        loadSuccess(false);
    } catch (err) {
        console.error('API indisponível, tentando cache:', err);
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

    // Último fallback: sem dados
    allNews = SAMPLE_NEWS;
    loadSuccess(true);
    showToast('Servidor offline. Exibindo dados locais.', 'error');
}

const SAMPLE_NEWS = [
    { title: "Carregando notícias...", summary: "Execute o servidor Python para carregar as notícias em tempo real.", category: "mundo", published: new Date().toISOString(), link: "#", image_url: "" },
    { title: "Servidor offline", summary: "Execute 'python main.py' na pasta backend para iniciar.", category: "brasil", published: new Date().toISOString(), link: "#", image_url: "" }
];

function loadSuccess(fromCache = false) {
    const now = new Date();
    const updateTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (fromCache) {
        lastUpdateText.textContent = 'Offline (Cache Local)';
        statusUpdateText.textContent = 'Origem: Arquivo local. Inicie o servidor Python para conteúdo online.';
    } else {
        lastUpdateText.textContent = `Atualizado às ${updateTime}`;
        statusUpdateText.textContent = 'Status: Conectado e atualizando em tempo real';
    }

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
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return d >= cutoff && d <= now;
}

function isThisWeek(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return false;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo && d < new Date(now.getTime() - 24 * 60 * 60 * 1000);
}

/* ─── Filtering ─── */
function matchesFilter(article) {
    if (activeFilter === 'all') return true;
    if (article.category && article.category.includes(activeFilter)) return true;
    return false;
}

function matchesSearch(article) {
    if (!searchQuery) return true;
    const haystack = `${article.title} ${article.summary} ${article.source}`.toLowerCase();
    return haystack.includes(searchQuery);
}

/* ─── Contagens por categoria ─── */
function buildFilterCounts(articles) {
    const counts = { all: articles.length, Guerras: 0, Brasil: 0, ChinaRussia: 0 };
    articles.forEach(a => {
        if (!a.category) return;
        if (a.category.includes('Guerras')) counts.Guerras++;
        if (a.category.includes('Brasil')) counts.Brasil++;
        if (a.category.includes('ChinaRussia')) counts.ChinaRussia++;
    });
    return counts;
}

function updateFilterCounts(all) {
    const counts = buildFilterCounts(all);
    filterBtns.forEach(btn => {
        const f = btn.dataset.filter;
        let badge = btn.querySelector('.filter-count');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'filter-count';
            btn.appendChild(badge);
        }
        badge.textContent = counts[f] !== undefined ? counts[f] : '';
    });
}

function applyFiltersAndRender() {
    // Atualiza contagens antes de filtrar
    updateFilterCounts(allNews);

    const matching = allNews.filter(a => matchesFilter(a) && matchesSearch(a));
    filteredToday = matching.filter(a => isToday(a.published));
    const weekArticles = matching.filter(a => isThisWeek(a.published) && !isToday(a.published));

    const sortByDate = arr => arr.sort((a, b) => {
        const da = parseDate(a.published);
        const db = parseDate(b.published);
        if (da && db) return db - da;
        if (da) return -1;
        if (db) return 1;
        return 0;
    });

    filteredToday = sortByDate(filteredToday);
    filteredWeek = sortByDate(weekArticles);

    todayCount.textContent = `${filteredToday.length} notícia${filteredToday.length !== 1 ? 's' : ''}`;
    weekCount.textContent = `${filteredWeek.length} notícia${filteredWeek.length !== 1 ? 's' : ''}`;

    renderSection(filteredToday, todayContainer, shownToday, todayLoadMoreContainer, 'today', false);
    renderSection(filteredWeek, weekContainer, shownWeek, weekLoadMoreContainer, 'week', false);
}

/* ─── Render Section ─── */
function renderSection(articles, container, shown, loadMoreContainer, sectionType, animate) {
    const previousCount = container.querySelectorAll('.news-card').length;
    container.innerHTML = '';

    if (articles.length === 0) {
        container.innerHTML = renderEmpty(sectionType);
        loadMoreContainer.style.display = 'none';
        return;
    }

    const slice = articles.slice(0, shown);
    const fragment = document.createDocumentFragment();

    slice.forEach((article, index) => {
        const isHero = (sectionType === 'today' && index === 0);
        const card = createCard(article, isHero);

        // Anima apenas os novos cards (load more)
        if (animate && index >= previousCount) {
            card.classList.add('animate-in');
            card.style.animationDelay = `${(index - previousCount) * 60}ms`;
        }

        fragment.appendChild(card);
    });

    container.appendChild(fragment);

    // Load more
    if (articles.length > shown) {
        const remaining = articles.length - shown;
        loadMoreContainer.style.display = 'flex';
        const btn = loadMoreContainer.querySelector('button');
        const label = sectionType === 'today' ? 'de hoje' : 'da semana';
        btn.textContent = `Ver mais ${remaining} notícia${remaining !== 1 ? 's' : ''} ${label}`;
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

function highlightText(text) {
    if (!searchQuery || !text) return escapeHtml(text || '');
    const escaped = escapeHtml(text);
    const escapedQuery = escapeHtml(searchQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(`(${escapedQuery})`, 'gi'),
        '<mark class="search-highlight">$1</mark>');
}

function createCard(article, isHero = false) {
    const card = document.createElement('a');
    const hasImage = !!(article.image_url);
    const isRead = readLinks.has(article.link);

    // Classes do card
    let classes = 'news-card';
    if (isHero) classes += ' hero-card';
    if (hasImage) classes += ' has-image';
    if (!hasImage && isHero) classes += ' no-hero-image';
    if (isRead) classes += ' read';

    card.className = classes;
    card.href = article.link || '#';
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    // Marcar como lido ao clicar
    card.addEventListener('click', () => {
        if (article.link && article.link !== '#') {
            readLinks.add(article.link);
            localStorage.setItem(READ_KEY, JSON.stringify([...readLinks]));
            card.classList.add('read');
        }
    });

    const allTags = article.tags || [];
    const isUrgent = allTags.some(t => t === 'urgente' || t === 'urgent');
    const otherTags = allTags.filter(t => t !== 'urgente' && t !== 'urgent');
    const timeLabel = formatRelativeTime(article.published);

    const titleHtml = highlightText(article.title || 'Sem título');
    const summaryHtml = highlightText(article.summary || '');

    const imagePart = hasImage
        ? `<div class="card-image"><img src="${escapeHtml(article.image_url)}" alt="" loading="lazy" onerror="this.parentElement.remove();this.closest('.news-card').classList.remove('has-image','hero-card');"></div>`
        : '';

    const innerContent = `
        <div class="card-top">
            <div class="tag-list">
                ${isUrgent ? '<span class="tag tag-urgente">Urgente</span>' : ''}
                ${otherTags.map(buildTagHtml).join('')}
            </div>
            ${timeLabel ? `<span class="time-pill">${timeLabel}</span>` : ''}
        </div>
        <h3 class="card-title">${titleHtml}</h3>
        ${summaryHtml ? `<p class="card-summary">${summaryHtml}</p>` : ''}
        <div class="card-footer">
            <span class="source-name">${escapeHtml(article.source || 'Desconhecido')}</span>
            ${article.category ? `<span class="category-label">${escapeHtml(article.category)}</span>` : ''}
        </div>
    `;

    if (isHero && hasImage) {
        card.innerHTML = `
            ${imagePart}
            <div class="hero-body">${innerContent}</div>
        `;
    } else {
        card.innerHTML = `${imagePart}${innerContent}`;
    }

    return card;
}

/* ─── Toast ─── */
let toastTimeout = null;
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    if (toastTimeout) clearTimeout(toastTimeout);

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${type === 'error'
            ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
            : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'}
        </svg>
        <span>${escapeHtml(message)}</span>
    `;
    document.body.appendChild(toast);

    toastTimeout = setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 4500);
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
    const isSearchActive = searchQuery.length > 0;
    const clearAction = isSearchActive
        ? `<span class="empty-action" onclick="clearSearch()">Limpar busca</span>`
        : '';

    const msgMap = {
        today: {
            icon: '📰',
            msg: isSearchActive
                ? `Nenhuma notícia de hoje encontrada para "<strong>${escapeHtml(searchQuery)}</strong>".`
                : 'Nenhuma notícia de hoje nesta categoria.'
        },
        week: {
            icon: '🗓️',
            msg: isSearchActive
                ? `Nenhuma notícia desta semana encontrada para "<strong>${escapeHtml(searchQuery)}</strong>".`
                : 'Nenhuma notícia desta semana nesta categoria.'
        }
    };
    const { icon, msg } = msgMap[sectionType] || { icon: '📰', msg: 'Nenhuma notícia encontrada.' };

    return `<div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
            <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>
        </svg>
        <p>${msg}</p>
        ${clearAction}
    </div>`;
}

function clearSearch() {
    searchInput.value = '';
    searchQuery = '';
    shownToday = INITIAL_CARDS_PER_SECTION;
    shownWeek = INITIAL_CARDS_PER_SECTION;
    applyFiltersAndRender();
}

function showError(container) {
    container.innerHTML = `<div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>Não foi possível conectar ao servidor.<br>Verifique se o backend está ativo.</p>
    </div>`;
}
