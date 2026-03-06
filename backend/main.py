# pyright: reportMissingImports=false
from fastapi import FastAPI # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from fastapi.staticfiles import StaticFiles # type: ignore
from apscheduler.schedulers.background import BackgroundScheduler # type: ignore
import uvicorn # type: ignore
import json
import os
import datetime

from scraper import fetch_and_process_news # type: ignore

app = FastAPI(title="Radar Global API")

# Habilitar CORS para o frontend local (ou de qualquer origem se for no ar)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permitir que o HTML seja carregado do arquivo local ou de outro servidor
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Caminho do cache de noticias (simular o "banco de dados")
CACHE_FILE = "news_cache.json"

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

# Iniciar o agendador e fazer a primeira carga rodar ao iniciar o app
@app.on_event("startup")
def startup_event():
    # Se o cache não existe, tenta fazer um fetch imediato de forma sincrona
    if not os.path.exists(CACHE_FILE):
        run_scraper_job()
    
    scheduler = BackgroundScheduler()
    
    # Rodar o scraper a cada 15 minutos para economizar "requisições" invisíveis do tradutor
    scheduler.add_job(run_scraper_job, 'interval', minutes=15)
    scheduler.start()

@app.get("/api/news")
def get_news():
    """Lê o cache local e envia rapidamente para o frontend."""
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data
    return []

# Monta a pasta frontend para ser servida diretamente pelo servidor
app.mount("/", StaticFiles(directory="../.", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
