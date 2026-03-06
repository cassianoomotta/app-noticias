document.addEventListener('DOMContentLoaded', () => {
    const newsContainer = document.getElementById('news-container');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search-input');
    const lastUpdateEl = document.getElementById('last-update');
    const nextUpdateEl = document.getElementById('next-update');
    const currentDateEl = document.getElementById('current-date');
    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');

    let allNews = [];
    let currentFilter = 'all';
    let nextRefreshTime = null;

    // Configurações de Paginação
    let currentPage = 1;
    const itemsPerPage = 9;

    // Guardar a lista filtrada atual
    let currentFilteredNews = [];

    // Endereço da API do backend - Oficial na Nuvem
    const API_URL = 'https://app-noticias.onrender.com/api/news';

    // Intervalo de atualização: 5 minutos (300.000 ms)
    const REFRESH_INTERVAL_MS = 300000;

    // Imprimir Data de Hoje no Topo
    function renderTodayDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        let dateString = new Date().toLocaleDateString('pt-BR', options);
        // Capitalizar a primeira letra
        dateString = dateString.charAt(0).toUpperCase() + dateString.slice(1);
        currentDateEl.textContent = dateString;
    }
    renderTodayDate();

    // Função para buscar as notícias do backend
    async function fetchNews(force = false) {
        try {
            // Em produção ou com backend rodando, usaremos o fetch real:
            const response = await fetch(API_URL);
            const data = await response.json();

            allNews = data;
            renderNews();
            updateTimestamp();
        } catch (error) {
            console.error('Erro ao buscar notícias:', error);
            newsContainer.innerHTML = `
                <div class="loading-state" style="color: var(--accent-red)">
                    <p>Erro ao conectar com o servidor. Verifique se o backend Python está rodando.</p>
                </div>
            `;
        }
    }

    // Formatação de data da Publicação (Exata + Relativa)
    function formatDate(dateString) {
        if (!dateString) return 'Data desconhecida';

        const pubDate = new Date(dateString);
        if (isNaN(pubDate.getTime())) return dateString; // Fallback se o formato vier quebrado

        // Data e Hora exatas da publicação
        const exactDate = pubDate.toLocaleDateString('pt-BR');
        const exactTime = pubDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // Tempo Relativo (há 1 hora, há 2 dias...)
        const now = new Date();
        const diffInSeconds = Math.floor((now - pubDate) / 1000);

        let relativeTime = '';
        if (diffInSeconds < 60) relativeTime = 'Agora mesmo';
        else if (diffInSeconds < 3600) relativeTime = `${Math.floor(diffInSeconds / 60)} min atrás`;
        else if (diffInSeconds < 86400) relativeTime = `${Math.floor(diffInSeconds / 3600)}h atrás`;
        else relativeTime = `${Math.floor(diffInSeconds / 86400)} dias atrás`;

        return `${exactDate} às ${exactTime} (${relativeTime})`;
    }

    function renderNews(resetPage = true) {
        if (resetPage) {
            newsContainer.innerHTML = '';
            currentPage = 1;

            // 1. Filtragem por Botão Categoria
            currentFilteredNews = currentFilter === 'all'
                ? allNews
                : allNews.filter(news => news.category.includes(currentFilter) || news.tags.includes(currentFilter.toLowerCase()));

            // 2. Filtragem por Texto de Busca
            const searchTerm = searchInput.value.toLowerCase().trim();
            if (searchTerm) {
                currentFilteredNews = currentFilteredNews.filter(news =>
                    news.title.toLowerCase().includes(searchTerm) ||
                    news.summary.toLowerCase().includes(searchTerm)
                );
            }

            // 3. Ordenação em tempo real (Da mais nova para a mais velha)
            currentFilteredNews.sort((a, b) => {
                const dateA = new Date(a.published).getTime();
                const dateB = new Date(b.published).getTime();
                if (isNaN(dateA)) return 1;
                if (isNaN(dateB)) return -1;
                return dateB - dateA;
            });

            if (currentFilteredNews.length === 0) {
                newsContainer.innerHTML = `
                    <div class="loading-state">
                        <p>Nenhuma notícia encontrada para este filtro no momento.</p>
                    </div>
                `;
                loadMoreContainer.style.display = 'none';
                return;
            }
        }

        // Determinar o slice da página atual
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const newsToRender = currentFilteredNews.slice(startIndex, endIndex);

        newsToRender.forEach((news, index) => {
            const card = document.createElement('article');
            card.className = 'news-card';
            card.style.animationDelay = `${(index % itemsPerPage) * 0.05}s`;

            // Gerando as tags visuais (war, crisis, diplomacy, etc) e badge urgente
            let tagsHTML = '';
            let isUrgent = false;

            news.tags.forEach(tag => {
                if (tag === 'urgent') {
                    isUrgent = true;
                } else {
                    tagsHTML += `<span class="tag ${tag}" title="${tag}"></span>`;
                }
            });

            const urgentBadgeHTML = isUrgent ? `<span class="urgent-badge">URGENTE</span>` : '';

            // Texto pronto para WhatsApp
            const shareText = encodeURIComponent(`🚨 *${news.title}*\n\n${news.summary}\n\nVia Radar Global 🌎`);
            const shareUrl = `https://wa.me/?text=${shareText}`;

            card.innerHTML = `
                <div class="card-header">
                    <div>
                        ${urgentBadgeHTML}
                        <span class="source-badge">${news.source}</span>
                    </div>
                    <span class="time-ago">${formatDate(news.published)}</span>
                </div>
                <h3>${news.title}</h3>
                <p>${news.summary}</p>
                <div class="card-footer">
                    <div class="tags">${tagsHTML}</div>
                    <div style="display: flex; gap: 10px;">
                        <a href="${shareUrl}" target="_blank" class="share-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                            Zap
                        </a>
                        <a href="${news.link}" target="_blank" class="read-more">Ler Artigo &rarr;</a>
                    </div>
                </div>
            `;

            newsContainer.appendChild(card);
        });

        // Controle de exibição do botão Load More
        if (endIndex >= currentFilteredNews.length) {
            loadMoreContainer.style.display = 'none';
        } else {
            loadMoreContainer.style.display = 'block';
        }
    }

    // Evento do botão Carregar Mais
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentPage++;
            renderNews(false); // Renderiza apenas a próxima página mantendo o que já está na tela
        });
    }

    // Atualiza os horários da Busca (Anterior e Próxima)
    function updateTimestamp() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        lastUpdateEl.textContent = `Última sincronização: Hoje às ${timeString}`;

        // Calculando o Horário da Próxima Atualização
        const nextUpdate = new Date(now.getTime() + REFRESH_INTERVAL_MS);
        const nextTimeString = nextUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        nextUpdateEl.textContent = `Próxima busca programada para: ${nextTimeString}`;
    }

    // Eventos de Filtro (Botões)
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active classe de todos
            filterBtns.forEach(b => b.classList.remove('active'));
            // Adiciona no clicado
            e.target.classList.add('active');

            // Atualiza filtro e renderiza
            currentFilter = e.target.getAttribute('data-filter');
            renderNews();
        });
    });

    // Evento de Filtro (Digitação na Busca)
    searchInput.addEventListener('input', () => {
        renderNews();
    });

    // Iniciar aplicação
    fetchNews();

    // Auto-refresh a cada 5 minutos (300000 ms)
    setInterval(fetchNews, 300000);
});
