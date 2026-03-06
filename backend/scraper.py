# pyright: reportMissingImports=false
import feedparser # type: ignore
from deep_translator import GoogleTranslator # type: ignore
from bs4 import BeautifulSoup # type: ignore
import re

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
    "Xinhua (China)": "http://www.xinhuanet.com/english/rss/world.xml"
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
    """Remove tags HTML (como <img> ou <script>) do resumo do feed RSS para deixar só texto limpo."""
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text()

def is_relevant(title, summary):
    """Verifica se o título ou o resumo contêm alguma das palavras-chave configuradas."""
    text_to_search = f"{title} {summary}".lower()
    for kw in KEYWORDS:
        # Busca por palavra exata usando regex boundaries para não pegar palavras como "iranian" ao buscar "iran" (embora pudesse)
        # Vamos fazer um check mais abrangente contendo a palavra raiz
        if kw in text_to_search:
            return True
    return False

def translate_to_pt(text):
    """Usa o Google Translator (gratuito) para traduzir o texto para Português."""
    if not text:
        return ""
    try:
        # O deep_translator fará as requisições web por baixo dos panos simulando o uso do site do Google Tradutor
        return GoogleTranslator(source='auto', target='pt').translate(text)
    except Exception as e:
        print(f"Erro na tradução: {e}")
        return text # Em caso de erro, retorna o original em inglês mesmo

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
        
    if any(word in text for word in ["china", "pequim", "rússia", "moscou", "putin", "xi jinping"]):
        if category == "Brasil":
            category = "Brasil, ChinaRússia"
        elif category == "Outros":
            category = "ChinaRússia"
            
    # Análise de Sentimento Básica
    if any(word in text for word in ["ataque", "morte", "sanção", "crise", "tensão", "ameaça", "conflito"]):
        tags.append("crisis")
    elif any(word in text for word in ["paz", "acordo", "trégua", "diplomacia", "negociação", "cooperação"]):
        tags.append("diplomacy")
            
    return category, list(set(tags))

def is_published_recently(published_str):
    """Verifica se a notícia foi pulicada há menos de 1 hora."""
    if not published_str:
        return False
    # Muitas datas de feedparser vem em parsed_Date
    return False # Para evitar bugs com timezones variadas, o frontend fará o cálculo exato do URGENTE.

def fetch_and_process_news():
    """Busca os RSS, filtra, traduz e retorna uma lista de dicionários com as notícias processadas."""
    print("Iniciando busca de notícias nos RSS internacionais...")
    processed_news = []
    seen_links = set() # Evitar notícias duplicadas

    for source_name, url in RSS_FEEDS.items():
        print(f"Verificando {source_name}...")
        try:
            feed = feedparser.parse(url)
            
            for entry in feed.entries[:15]: # Busca os 15 mais recentes de cada fonte para não demorar muito
                title = entry.get('title', '')
                summary_html = entry.get('summary', '')
                summary = clean_html(summary_html)
                link = entry.get('link', '')
                published = entry.get('published', '')

                if link in seen_links:
                    continue
                
                if is_relevant(title, summary):
                    print(f"  -> Relevante encontrada: {title}")
                    seen_links.add(link)
                    
                    # Tradução pesada aqui (pode demorar alguns ms/s pro request do Google)
                    translated_title = translate_to_pt(title)
                    translated_summary = translate_to_pt(summary)
                    
                    category, tags = get_category_and_tags(translated_title + " " + translated_summary, False)

                    article = {
                        "id": link,
                        "title": translated_title,
                        "summary": translated_summary,
                        "source": source_name,
                        "published": published,
                        "tags": tags,
                        "category": category,
                        "link": link
                    }
                    processed_news.append(article)
                    
        except Exception as e:
            print(f"Erro ao processar o feed {source_name}: {e}")

    # Ordenar por data (simplificado, já que RSS strings variam, mas o ideal é deixar como string e o frontend ordena)
    print(f"Busca finalizada. Total de notícias relevantes traduzidas: {len(processed_news)}")
    return processed_news


