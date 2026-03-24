# Radar Global 🌍

Aplicação web focada no monitoramento em tempo real de notícias globais sobre conflitos, guerras, diplomacia e crise. Os dados são coletados via web scraping (RSS) e servidos por uma API assíncrona até a interface (frontend).

## 🚀 Como funciona
A arquitetura é dividida em duas partes integradas:
- **Backend (API)**: Construído em Python usando **FastAPI**. Ele captura notícias de fontes internacionais usando Feedparser, traduz usando Deep-Translator e serve o JSON via rotas. O backend também hospeda o frontend estaticamente.
- **Frontend**: Desenvolvido em HTML/CSS/JS nativo com forte ênfase em design moderno, UX (Leis de contraste, Von Restorff) e perfomance (completamente responsivo e suporta PWA offline cache mode).

---

## 🛠️ Tecnologias Utilizadas
- **Python 3+** (FastAPI, Uvicorn, APScheduler, BeautifulSoup4)
- **CSS3** (Variáveis dinâmicas, Glassmorphism, CSS Grid & Flexbox)
- **JavaScript (ES6)**

---

## 💻 Rodando Localmente

### Pré-requisitos
Tenha o Python 3.10+ instalado na sua máquina.

1. **Clone o repositório**
```bash
git clone https://github.com/cassianoomotta/app-noticias.git
cd app-noticias
```

2. **Instale as dependências**
Na raiz do projeto, instale os pacotes definidos no `requirements.txt`:
```bash
pip install -r requirements.txt
```

3. **Inicie o servidor**
Execute o comando abaixo para ativar tanto a raspagem automática de notícias quanto a API:
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
4. **Acesse o App**
Abra o navegador em: [http://localhost:8000](http://localhost:8000)

## 🌐 Deploy no Render
Este projeto já foi otimizado para a plataforma **Render**.
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

---

> Desenvolvido por [Cassiano](https://github.com/cassianoomotta).
