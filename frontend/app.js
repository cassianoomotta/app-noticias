document.addEventListener('DOMContentLoaded', () => {
    const newsContainer = document.getElementById('news-container');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search-input');
    const lastUpdateEl = document.getElementById('last-update');
    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');

    let allNews = [];
    let currentFilter = 'all';

    // Configurações de Paginação
    let currentPage = 1;
    const itemsPerPage = 9;

    // Guardar a lista filtrada atual
    let currentFilteredNews = [];

    // Endereço da API do backend (caminho relativo para funcionar na mesma rede, celular, etc)
    const API_URL = '/api/news';

    // Dados Mockados para demonstração inicial enquanto o backend não está pronto
    const MOCK_DATA = [
        {
            id: 1,
            title: "Trégua negociada entre Israel e grupos armados avança no Oriente Médio",
            summary: "Diplomatas afirmam que as negociações mediadas pelos EUA estão progredindo, com esperanças de um cessar-fogo temporário na região de Gaza.",
            source: "Reuters",
            published: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min atrás
            tags: ["war", "world"],
            category: "Guerras",
            link: "#"
        },
        {
            id: 2,
            title: "Brasil e China assinam novo acordo comercial bilionário em Pequim",
            summary: "O governo brasileiro fechou uma parceira de infraestrutura e exportação agrícola com o governo chinês, fortalecendo os laços do BRICS.",
            source: "BBC World",
            published: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 horas atrás
            tags: ["br", "world"],
            category: "ChinaRússia",
            link: "#"
        },
        {
            id: 3,
            title: "Tensão diplomática: EUA emitem novo alerta sobre movimentações no Irã",
            summary: "Departamento de Estado Americano expressou preocupações nesta manhã sobre enriquecimento de urânio.",
            source: "CNN",
            published: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            tags: ["war"],
            category: "Guerras",
            link: "#"
        },
        {
            id: 4,
            title: "Rússia anuncia expansão de rotas comerciais alternativas",
            summary: "Buscando contornar sanções, Moscou estabelece novas vias de exportação de energia, recebendo apoio diplomático de aliados na Ásia.",
            source: "Al Jazeera",
            published: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
            tags: ["world"],
            category: "ChinaRússia",
            link: "#"
        },
        {
            id: 5,
            title: "Comitiva dos EUA visita o Brasil para discutir transição energética",
            summary: "Secretários americanos estão em Brasília para uma série de reuniões visando cooperação em energias limpas.",
            source: "Reuters",
            published: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
            tags: ["br", "world"],
            category: "Brasil",
            link: "#"
        }
    ];

    // Função para buscar as notícias
    async function fetchNews() {
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

    // Formatação de data (Tempo relativo)
    function timeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Agora mesmo';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min atrás`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} horas atrás`;
        return `${Math.floor(diffInSeconds / 86400)} dias atrás`;
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
        }

        if (currentFilteredNews.length === 0) {
            newsContainer.innerHTML = `
                <div class="loading-state">
                    <p>Nenhuma notícia encontrada para este filtro no momento.</p>
                </div>
            `;
            loadMoreContainer.style.display = 'none';
            return;
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
                    <span class="time-ago">${timeAgo(news.published)}</span>
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

    // Atualiza o horário da última busca
    function updateTimestamp() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        lastUpdateEl.textContent = `Última atualização: hoje às ${timeString}`;
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
