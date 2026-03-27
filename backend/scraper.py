# pyright: reportMissingImports=false
from concurrent.futures import ThreadPoolExecutor, as_completed
import httpx          # type: ignore
import feedparser     # type: ignore
from deep_translator import GoogleTranslator  # type: ignore
from bs4 import BeautifulSoup  # type: ignore
import time
import hashlib
import logging
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone, timedelta

# ── Logging estruturado ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s — %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S'
)
log = logging.getLogger('radar_global.scraper')


# ── Fontes RSS ───────────────────────────────────────────────────────────────
RSS_FEEDS = {
    "BBC World":               "http://feeds.bbci.co.uk/news/world/rss.xml",
    "Reuters":                 "http://feeds.reuters.com/reuters/topNews",
    "Al Jazeera":              "https://www.aljazeera.com/xml/rss/all.xml",
    "CNN":                     "http://rss.cnn.com/rss/edition.rss",
    "DW (Germany)":            "https://rss.dw.com/rdf/rss-en-all",
    "Times of Israel":         "https://www.timesofisrael.com/feed/",
    "Jerusalem Post":          "https://www.jpost.com/rss/rssfeedsfrontpage.aspx",
    "New York Times":          "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "Fox News":                "http://feeds.foxnews.com/foxnews/world",
    "TASS (Rússia)":           "https://tass.com/rss/v2.xml",
    "Xinhua (China)":          "http://www.xinhuanet.com/english/rss/world.xml",
    "G1 (Brasil)":             "https://g1.globo.com/rss/g1/mundo/",
    "Folha de S.Paulo":        "https://feeds.folha.uol.com.br/mundo/rss091.xml",
}

KEYWORDS = [
    "israel", "gaza", "palestine", "hamas", "idf", "netanyahu",
    "iran", "tehran", "khamenei",
    "usa", "u.s.", "united states", "washington", "biden", "america",
    "brazil", "brasil", "lula", "bolsonaro", "brasilia",
    "china", "beijing", "xi jinping", "taiwan",
    "russia", "moscow", "putin", "ukraine", "kyiv",
]


# ── Utilitários ──────────────────────────────────────────────────────────────
def clean_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    return BeautifulSoup(raw_html, "html.parser").get_text()


def extract_image_url(entry) -> str:
    if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
        return entry.media_thumbnail[0].get('url', '')

    for enc in getattr(entry, 'enclosures', []):
        if enc.get('type', '').startswith('image/'):
            return enc.get('url', '')

    raw = entry.get('summary', '') or ''
    if not raw and hasattr(entry, 'content') and entry.content:
        raw = entry.content[0].get('value', '')
    if raw:
        soup = BeautifulSoup(raw, 'html.parser')
        img = soup.find('img')
        if img and img.get('src') and img['src'].startswith('http'):
            return img['src']

    return ''


def is_relevant(title: str, summary: str) -> bool:
    text = f"{title} {summary}".lower()
    return any(kw in text for kw in KEYWORDS)


def title_hash(title: str) -> str:
    """Hash do título normalizado — detecta duplicatas entre fontes diferentes."""
    normalized = ''.join(c for c in title.lower() if c.isalnum())
    return hashlib.md5(normalized.encode()).hexdigest()


def translate_to_pt(text: str, retries: int = 3) -> str:
    """Traduz para pt-BR com retry + backoff exponencial."""
    if not text:
        return ""
    for attempt in range(retries):
        try:
            result = GoogleTranslator(source='auto', target='pt').translate(text)
            return result if result is not None else text
        except Exception as e:
            wait = 2 ** attempt
            log.warning(f"Erro na tradução (tentativa {attempt + 1}/{retries}): {e}. Aguardando {wait}s...")
            time.sleep(wait)
    log.error("Tradução falhou após todas as tentativas. Retornando original.")
    return text


def parse_published_to_iso(published_str: str) -> str:
    if not published_str:
        return ""
    try:
        dt = parsedate_to_datetime(published_str)
        return dt.isoformat()
    except Exception:
        return published_str


def get_category_and_tags(translated_text: str, is_recent: bool):
    text = translated_text.lower()
    category = "Outros"
    tags = ["mundo"]

    if is_recent:
        tags.append("urgente")

    if any(w in text for w in ["israel", "gaza", "palestina", "hamas", "irã", "eua", "estados unidos"]):
        category = "Guerras"
        tags.append("guerra")

    if any(w in text for w in ["brasil", "brasília", "lula", "bolsonaro"]):
        category = "Brasil"
        tags.append("brasil")

    if any(w in text for w in ["china", "pequim", "rússia", "moscou", "putin", "xi jinping"]):
        if category == "Brasil":
            category = "Brasil, ChinaRussia"
        elif category == "Outros":
            category = "ChinaRussia"

    if any(w in text for w in ["ataque", "morte", "sanção", "crise", "tensão", "ameaça", "conflito"]):
        tags.append("crise")
    elif any(w in text for w in ["paz", "acordo", "trégua", "diplomacia", "negociação", "cooperação"]):
        tags.append("diplomacia")

    return category, list(set(tags))


# ── Fetch paralelo (síncrono com threads — sem asyncio) ──────────────────────
def fetch_feed_bytes(source_name: str, url: str) -> tuple[str, bytes | None]:
    """Baixa um feed RSS de forma síncrona (thread-safe, sem asyncio)."""
    try:
        with httpx.Client(timeout=15, follow_redirects=True,
                          headers={"User-Agent": "RadarGlobal/3.0"}) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                log.info(f"Feed recebido: {source_name}")
                return source_name, resp.content
            log.warning(f"Feed {source_name} retornou HTTP {resp.status_code}")
    except Exception as e:
        log.warning(f"Erro ao baixar feed {source_name}: {e}")
    return source_name, None


def fetch_all_feeds() -> dict[str, bytes]:
    """Baixa todos os feeds em paralelo via ThreadPoolExecutor (sem asyncio)."""
    results: dict[str, bytes] = {}
    with ThreadPoolExecutor(max_workers=len(RSS_FEEDS)) as executor:
        futures = {executor.submit(fetch_feed_bytes, name, url): name
                   for name, url in RSS_FEEDS.items()}
        for future in as_completed(futures):
            source_name, content = future.result()
            if content:
                results[source_name] = content
    return results


# ── Entry point principal ─────────────────────────────────────────────────────
def fetch_and_process_news() -> list[dict]:
    """Busca feeds em paralelo (threads), filtra, traduz e retorna lista de artigos."""
    log.info("Iniciando busca paralela de notícias RSS (threads)...")

    feeds_content = fetch_all_feeds()  # síncrono — sem asyncio.run()
    log.info(f"Feeds baixados: {len(feeds_content)}/{len(RSS_FEEDS)}")

    processed_news = []
    seen_links: set[str] = set()
    seen_title_hashes: set[str] = set()  # deduplicação por similaridade de título

    for source_name, content in feeds_content.items():
        try:
            feed = feedparser.parse(content)

            for entry in feed.entries[:15]:
                title = entry.get('title', '')
                summary_html = entry.get('summary', '')
                summary = clean_html(summary_html)
                link = entry.get('link', '')
                published_raw = entry.get('published', '')

                # Deduplicação por URL
                if link in seen_links:
                    continue

                # Deduplicação por hash de título (cobre mesma notícia em fontes diferentes)
                t_hash = title_hash(title)
                if t_hash in seen_title_hashes:
                    log.info(f"  [dup-título] {title[:60]}")
                    continue

                if not is_relevant(title, summary):
                    continue

                log.info(f"  -> Relevante: {title[:70]}")
                seen_links.add(link)
                seen_title_hashes.add(t_hash)

                translated_title = translate_to_pt(title)
                translated_summary = translate_to_pt(summary)
                combined = (translated_title or "") + " " + (translated_summary or "")

                published_iso = parse_published_to_iso(published_raw)
                is_recent = False
                if published_iso:
                    try:
                        pub_dt = datetime.fromisoformat(published_iso)
                        if pub_dt.tzinfo is None:
                            pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                        is_recent = (datetime.now(timezone.utc) - pub_dt) < timedelta(hours=2)
                    except Exception:
                        pass

                category, tags = get_category_and_tags(combined, is_recent)

                img_url = extract_image_url(entry)
                if not img_url:
                    if category == "Guerras":
                        img_url = "https://images.unsplash.com/photo-1579548122080-c35fd6820ecb?auto=format&fit=crop&w=800&q=80"
                    elif category == "Brasil":
                        img_url = "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=800&q=80"
                    elif category == "ChinaRussia":
                        img_url = "https://images.unsplash.com/photo-1541888081622-4a00cb9dc49b?auto=format&fit=crop&w=800&q=80"
                    else:  # Mundo
                        img_url = "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=800&q=80"

                processed_news.append({
                    "id": link,
                    "title": translated_title,
                    "summary": translated_summary,
                    "source": source_name,
                    "published": published_iso,
                    "tags": tags,
                    "category": category,
                    "link": link,
                    "image_url": img_url,
                })

        except Exception as e:
            log.error(f"Erro ao processar feed {source_name}: {e}")

    log.info(f"Busca finalizada. Total de artigos relevantes: {len(processed_news)}")
    return processed_news
