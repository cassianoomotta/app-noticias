# 🌍 Radar Global

Aplicação web de monitoramento em tempo real de notícias globais sobre guerras, conflitos, diplomacia, China & Rússia e Brasil. Os dados são coletados automaticamente via RSS de 14 fontes internacionais, traduzidos para português e servidos por uma API assíncrona.

---

## ✨ Funcionalidades

- **Seção "HOJE"** — Notícias das últimas 24 horas
- **Seção "SEMANA"** — Notícias dos últimos 7 dias (exceto as de hoje)
- **Filtros por categoria** — Todas | Guerras | Brasil | China & Rússia
- **Busca por palavra-chave** em tempo real
- **Atualização automática** a cada 15 minutos
- **Modo offline inteligente** — exibe cache local quando sem servidor
- **PWA** — instalável em dispositivos móveis
- **Imagens nas notícias** extraídas automaticamente dos feeds RSS

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3 + FastAPI + Uvicorn + APScheduler |
| Scraping | Feedparser + BeautifulSoup4 |
| Tradução | Deep-Translator (Google Translator gratuito) |
| Frontend | HTML5 + CSS3 + JavaScript Vanilla (ES6) |
| Deploy | Render (Web Service) |

---

## 📁 Estrutura do Projeto

```
/
├── backend/
│   ├── main.py          # API FastAPI + agendador
│   └── scraper.py       # Busca, filtra e traduz RSS feeds
├── frontend/
│   ├── index.html       # Interface principal
│   ├── style.css        # Estilos (dark/light, responsivo)
│   ├── app.js           # Lógica, filtros, classificação temporal
│   ├── data.js          # Cache estático (notícias pré-carregadas)
│   └── manifest.json    # Config PWA
├── requirements.txt     # Dependências Python (para o Render)
└── README.md
```

---

## 💻 Rodando Localmente

### Pré-requisitos
- Python 3.10+

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/cassianoomotta/app-noticias.git
cd app-noticias

# 2. Instale as dependências
pip install -r requirements.txt

# 3. Inicie o servidor
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Acesse em: [http://localhost:8000](http://localhost:8000)

---

## 🌐 Deploy no Render

| Configuração | Valor |
|-------------|-------|
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |

> O arquivo `requirements.txt` deve estar na **raiz** do repositório.

---

## 📡 Fontes de Notícias (RSS)

| Região | Fonte |
|--------|-------|
| Global | BBC World, Reuters, Al Jazeera, CNN, DW |
| Oriente Médio | Times of Israel, Jerusalem Post |
| EUA | New York Times, Fox News |
| Rússia | TASS |
| China | Xinhua |
| Brasil | G1 Globo, Folha de S.Paulo |

---

> Desenvolvido por [Cassiano](https://github.com/cassianoomotta).
