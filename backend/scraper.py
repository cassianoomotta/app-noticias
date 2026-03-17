# pyright: reportMissingImports=false
import feedparser  # type: ignore
from deep_translator import GoogleTranslator  # type: ignore
from bs4 import BeautifulSoup  # type: ignore
import re
from email.utils import parsedate_to_datetime


# Feeds de fontes globais confiáveis e locais dos países envolvidos
RSS_FEEDS = {
    # Globais
    "BBC World": "http://feeds.bbci.co.uk/news/world/rss.xml",
    "Reuters": "http://feeds.reuters.com/reuters/topNews",
    "Al Jazeera": "https://www.aljazeera.com/xml/rss/all.xml",
    "CNN": "http://rss.cnn.com/rss/edition.rss",
    "DW (Germany)": "https://rss.dw.com/rdf/rss-en-all",

    # Específicos por País (Em Inglês para garantir processamento rápido)
    "Times of Israel": "https://www.timesofisrael.com/feed/",
    "Jerusalem Post (Israel)": "https://www.jpost.com/rss/rssfeedsfrontpage.aspx",
    "New York Times (EUA)": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "Fox News (EUA)": "http://feeds.foxnews.com/foxnews/world",
    "TASS (Rússia)": "https://tass.com/rss/v2.xml",
    "Xinhua (China)": "http://www.xinhuanet.com/english/rss/world.xml",

    # Veículos do Brasil
    "G1 (Brasil)": "https://g1.globo.com/rss/g1/mundo/",
    "Folha de S.Paulo (Brasil)": "https://feeds.folha.uol.com.br/mundo/rss091.xml"
}

# Palavras-chave em inglês para filtrar os artigos relevantes
KEYWORDS = [
    "israel", "gaza", "palestine", "hamas", "idf", "netanyahu",
    "iran", "tehran", "khamenei",
    "usa", "u.s.", "united states", "washington", "biden", "america",
    "brazil", "brasil", "lula", "bolsonaro", "brasilia",
    "china", "beijing", "xi jinping", "taiwan",
    "russia", "moscow", "putin", "ukraine", "kyiv"
]


def clean_html(raw_html):
    """Remove tags HTML do resumo do feed RSS para deixar só texto limpo."""
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text()


def is_relevant(title, summary):
    """Verifica se o título ou o resumo contêm alguma das palavras-chave configuradas."""
    text_to_search = f"{title} {summary}".lower()
    for kw in KEYWORDS:
        if kw in text_to_search:
            return True
    return False


def translate_to_pt(text):
    """Usa o Google Translator (gratuito) para traduzir o texto para Português."""
    if not text:
        return ""
    try:
        result = GoogleTranslator(source='auto', target='pt').translate(text)
        # Bug 6 — guard: tradução pode retornar None em rate limit
        return result if result is not None else text
    except Exception as e:
        print(f"Erro na tradução: {e}")
        return text  # Em caso de erro, retorna o original em inglês


def parse_published_to_iso(published_str):
    """
    Bug 5 — Converte a data RSS (RFC 2822) para ISO 8601.
    Garante parsing consistente em todos os navegadores.
    """
    if not published_str:
        return ""
    try:
        dt = parsedate_to_datetime(published_str)
        return dt.isoformat()
    except Exception:
        return published_str  # fallback: retorna a string original


def get_category_and_tags(translated_text, is_recent):
    """Categoriza a notícia com base no conteúdo traduzido e adiciona sentimentos."""
    text = translated_text.lower()
    category = "Outros"
    tags = ["world"]

    if is_recent:
        tags.append("urgent")

    if any(word in text for word in ["israel", "gaza", "palestina", "hamas", "irã", "eua", "estados unidos"]):
        category = "Guerras"
        tags.append("war")

    if any(word in text for word in ["brasil", "brasília", "lula", "bolsonaro"]):
        category = "Brasil"
        tags.append("br")

    # Bug 7 — usar "ChinaRussia" (sem acento) para evitar mismatch de encoding HTTP
    if any(word in text for word in ["china", "pequim", "rússia", "moscou", "putin", "xi jinping"]):
        if category == "Brasil":
            category = "Brasil, ChinaRussia"
        elif category == "Outros":
            category = "ChinaRussia"

    # Análise de Sentimento Básica
    if any(word in text for word in ["ataque", "morte", "sanção", "crise", "tensão", "ameaça", "conflito"]):
        tags.append("crisis")
    elif any(word in text for word in ["paz", "acordo", "trégua", "diplomacia", "negociação", "cooperação"]):
        tags.append("diplomacy")

    return category, list(set(tags))


def fetch_and_process_news():
    """Busca os RSS, filtra, traduz e retorna uma lista de dicionários com as notícias processadas."""
    print("Iniciando busca de notícias nos RSS internacionais...")
    processed_news = []
    seen_links = set()  # Evitar notícias duplicadas

    for source_name, url in RSS_FEEDS.items():
        print(f"Verificando {source_name}...")
        try:
            feed = feedparser.parse(url)

            for entry in feed.entries[:15]:  # Busca os 15 mais recentes de cada fonte
                title = entry.get('title', '')
                summary_html = entry.get('summary', '')
                summary = clean_html(summary_html)
                link = entry.get('link', '')
                published_raw = entry.get('published', '')

                if link in seen_links:
                    continue

                if is_relevant(title, summary):
                    print(f"  -> Relevante encontrada: {title}")
                    seen_links.add(link)

                    translated_title = translate_to_pt(title)
                    translated_summary = translate_to_pt(summary)

                    # Bug 6 — garante que nenhum dos dois é None antes de concatenar
                    combined = (translated_title or "") + " " + (translated_summary or "")
                    category, tags = get_category_and_tags(combined, False)

                    # Bug 5 — data em ISO 8601 para parsing consistente nos browsers
                    published_iso = parse_published_to_iso(published_raw)

                    article = {
                        "id": link,
                        "title": translated_title,
                        "summary": translated_summary,
                        "source": source_name,
                        "published": published_iso,
                        "tags": tags,
                        "category": category,
                        "link": link
                    }
                    processed_news.append(article)

        except Exception as e:
            print(f"Erro ao processar o feed {source_name}: {e}")

    print(f"Busca finalizada. Total de notícias relevantes traduzidas: {len(processed_news)}")
    return processed_news
