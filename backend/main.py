from fastapi import FastAPI  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from fastapi.staticfiles import StaticFiles  # type: ignore
from apscheduler.schedulers.background import BackgroundScheduler  # type: ignore
from contextlib import asynccontextmanager
import uvicorn  # type: ignore
import json
import os
import datetime

from scraper import fetch_and_process_news  # type: ignore

# Caminhos absolutos para funcionar tanto local quanto no Render
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
CACHE_FILE = os.path.join(BASE_DIR, "news_cache.json")


def run_scraper_job():
    """Função que rodará pelo agendador a cada X minutos"""
    print(f"[{datetime.datetime.now()}] Iniciando job automático de busca de notícias...")
    try:
        new_data = fetch_and_process_news()

        # Salva em JSON para entrega rápida na API
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(new_data, f, ensure_ascii=False, indent=4)

        print(f"[{datetime.datetime.now()}] Job finalizado. Cache salvo com sucesso.")
    except Exception as e:
        print(f"Erro no agendador ao buscar notícias: {e}")


# Bug 2 — usar lifespan em vez do deprecated @app.on_event("startup")
@asynccontextmanager
async def lifespan(application: FastAPI):
    # startup: se o cache não existe, faz fetch imediato
    if not os.path.exists(CACHE_FILE):
        run_scraper_job()

    scheduler = BackgroundScheduler()
    # Rodar o scraper a cada 15 minutos
    scheduler.add_job(run_scraper_job, "interval", minutes=15)
    scheduler.start()

    yield  # app está em execução

    # shutdown
    scheduler.shutdown()


app = FastAPI(title="Radar Global API", lifespan=lifespan)

# Habilitar CORS para o frontend local (ou de qualquer origem se for no ar)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/news")
def get_news():
    """Lê o cache local e envia rapidamente para o frontend."""
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data
    return []


# Bug 3 — path absoluto para o frontend (funciona no Render e localmente)
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
