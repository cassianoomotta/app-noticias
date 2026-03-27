import logging
import os
import json
import datetime
import sys

from fastapi import FastAPI      # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from fastapi.staticfiles import StaticFiles          # type: ignore
from apscheduler.schedulers.background import BackgroundScheduler  # type: ignore
from contextlib import asynccontextmanager
import uvicorn  # type: ignore

# ── Path: garante que scraper.py seja encontrado no Render (roda da raiz) ───
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from scraper import fetch_and_process_news  # type: ignore

# ── Logging estruturado ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s — %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S',
)
log = logging.getLogger('radar_global.main')

# ── Caminhos absolutos ───────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, '..', 'frontend')
CACHE_FILE   = os.path.join(BASE_DIR, 'news_cache.json')

# ── CORS: configurável via variável de ambiente ──────────────────────────────
# Em produção: ALLOWED_ORIGINS=https://radarglobal.com
# Em dev: deixar vazio ou "*"
_raw_origins = os.getenv('ALLOWED_ORIGINS', '*')
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(',') if o.strip()]


# ── Job do agendador ─────────────────────────────────────────────────────────
def run_scraper_job():
    log.info("Iniciando job de scraping...")
    try:
        new_data = fetch_and_process_news()
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False, indent=2)
        log.info(f"Job finalizado. {len(new_data)} artigos salvos em cache.")
    except Exception as e:
        log.error(f"Erro no job de scraping: {e}", exc_info=True)


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(application: FastAPI):
    if not os.path.exists(CACHE_FILE):
        log.info("Cache não encontrado — executando scraping inicial...")
        run_scraper_job()

    scheduler = BackgroundScheduler()
    scheduler.add_job(run_scraper_job, 'interval', minutes=15)
    scheduler.start()
    log.info("Agendador iniciado (intervalo: 15 min).")

    yield

    scheduler.shutdown()
    log.info("Agendador encerrado.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title='Radar Global API', version='3.0.0', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get('/health')
def health_check():
    """Health check para monitoramento externo (Render, UptimeRobot, etc.)."""
    cache_age_minutes = None
    if os.path.exists(CACHE_FILE):
        mtime = os.path.getmtime(CACHE_FILE)
        age_seconds = (datetime.datetime.now().timestamp() - mtime)
        cache_age_minutes = int(age_seconds / 60 * 10) / 10  # 1 casa decimal

    return {
        'status': 'ok',
        'cache_exists': os.path.exists(CACHE_FILE),
        'cache_age_minutes': cache_age_minutes,
        'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
    }


@app.get('/api/news')
def get_news():
    """Retorna as notícias do cache local de forma rápida."""
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    log.warning('Cache não encontrado — retornando lista vazia.')
    return []


# ── Static files (frontend) ───────────────────────────────────────────────────
app.mount('/', StaticFiles(directory=FRONTEND_DIR, html=True), name='frontend')


if __name__ == '__main__':
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
