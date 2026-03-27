# 🌍 Radar Global — v3.1

Aplicação web de monitoramento em tempo real de notícias globais sobre guerras, conflitos, diplomacia, China & Rússia e Brasil. Coleta dados automaticamente via RSS de 14 fontes internacionais, traduz para português e serve via API de alto desempenho.

---

## ✨ Novidades da Versão 3.1 (UX & Performance)

### 🎨 Frontend & UX
- **Hero Card 🔥** — A notícia mais recente de "Hoje" ganha destaque visual com layout horizontal e imagem expandida.
- **Busca Inteligente 🔍** — Termos pesquisados são destacados em tempo real nos cards com `<mark>`.
- **Status de Leitura ✅** — Notícias visitadas ficam com opacidade reduzida e persistência via `localStorage`.
- **Filtros com Contagem 📊** — Badges dinâmicos mostram a quantidade de notícias por categoria (ex: `Brasil (12)`).
- **Filtros Mobile Modernos 📱** — Scroll horizontal suave em dispositivos móveis, sem quebra de linhas.
- **Sistema de Toasts 🔔** — Feedback visual elegante para erros de conexão ou status de atualização.
- **Animações Fluidas ✨** — Transições `fade-in` suaves ao carregar mais notícias.

### 🐍 Backend & Inteligência
- **Paralelismo Real ⚡** — Scraping de 14 fontes simultâneas via `ThreadPoolExecutor`, reduzindo o tempo de processamento em ~80%.
- **Extração Avançada de Imagem 🖼️** — Se o RSS não prover foto, o scraper acessa o link original e extrai a imagem oficial via **Open Graph (`og:image`)**.
- **Anti-Hotlinking 🛡️** — Implementação de `no-referrer` para garantir a exibição de imagens protegidas por CDNs externos.
- **Deduplicação por Similaridade 🔄** — Algoritmo que evita notícias repetidas de fontes diferentes através de hash de título normalizado.
- **Robustez (Retry & Backoff) 🔁** — Sistema de tradução com 3 tentativas e fallback exponencial para evitar falhas de rede.
- **Health Check 🩺** — Endpoint `/health` para monitorar o status do backend e idade do cache.
- **Testes Automatizados ✅** — Suíte de testes com `pytest` (24 casos de teste) validando a lógica do scraper.

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | Python 3 + FastAPI + Uvicorn + APScheduler |
| **Networking** | HTTPX (Síncrono com paralelismo via threads) |
| **Scraping** | Feedparser + BeautifulSoup4 |
| **Tradução** | Deep-Translator (Google Translator Engine) |
| **Frontend** | HTML5 + CSS3 (V3.0) + JS Vanilla (ES6+) |
| **Testes** | Pytest |
| **Deploy** | Render (Web Service) |

---

## 📁 Estrutura do Projeto

```
/
├── backend/
│   ├── main.py          # API FastAPI + Endpoints (CORS, Health)
│   ├── scraper.py       # Crawler paralelo, Tradução e og:image
│   └── tests/           # Testes unitários (pytest)
├── frontend/
│   ├── index.html       # Interface principal (Referrer-policy, PWA)
│   ├── style.css        # Design System V3.0 (Hero, Cards, Anim)
│   ├── app.js           # Lógica de render, filtros e persistência
│   ├── favicon.svg      # Ícone vetorial local
│   └── icon.png         # Ícone PWA/OG de alta resolução
├── requirements.txt     # Dependências (FastAPI, httpx, pytest, etc)
└── README.md
```

---

## 💻 Rodando Localmente

### Pré-requisitos
- Python 3.10+

### Instalação e Execução

```bash
# 1. Clone o repositório
git clone https://github.com/cassianoomotta/app-noticias.git
cd app-noticias

# 2. Instale as dependências
pip install -r requirements.txt

# 3. (Opcional) Rode os testes
python -m pytest backend/tests/test_scraper.py -v

# 4. Inicie o servidor
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

---

## 📡 Fontes Ativas

- **Internacionais:** BBC World, Reuters, Al Jazeera, CNN, DW, NY Times, Fox News.
- **Oriente Médio:** Times of Israel, Jerusalem Post.
- **Geopolítica:** TASS (Rússia), Xinhua (China).
- **Nacional:** G1 Globo, Folha de S.Paulo.

---

> Projeto refatorado e modernizado (v3.1) para garantir a melhor experiência de leitura de notícias geopolíticas. 🚀
> Desenvolvido por [Cassiano](https://github.com/cassianoomotta).
