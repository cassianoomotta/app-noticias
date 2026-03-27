"""
Testes básicos do Radar Global — backend
Execute com: python -m pytest tests/test_scraper.py -v
"""
import sys
import os

# Garante que o módulo scraper seja encontrado
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from scraper import (
    clean_html,
    is_relevant,
    title_hash,
    parse_published_to_iso,
    get_category_and_tags,
)


# ── clean_html ────────────────────────────────────────────────────────────────
class TestCleanHtml:
    def test_remove_tags(self):
        assert clean_html("<p>Olá <b>mundo</b></p>") == "Olá mundo"

    def test_empty_string(self):
        assert clean_html("") == ""

    def test_none_returns_empty(self):
        assert clean_html(None) == ""

    def test_plain_text_unchanged(self):
        assert clean_html("sem tags") == "sem tags"


# ── is_relevant ───────────────────────────────────────────────────────────────
class TestIsRelevant:
    def test_keyword_in_title(self):
        assert is_relevant("Gaza conflict escalates", "") is True

    def test_keyword_in_summary(self):
        assert is_relevant("Breaking news", "Russia launches attack") is True

    def test_not_relevant(self):
        assert is_relevant("Local sports results", "Team wins championship") is False

    def test_case_insensitive(self):
        assert is_relevant("ISRAEL strikes", "") is True

    def test_brasil_keyword(self):
        assert is_relevant("Brazil economy", "") is True


# ── title_hash ────────────────────────────────────────────────────────────────
class TestTitleHash:
    def test_same_title_same_hash(self):
        assert title_hash("Gaza War Update") == title_hash("Gaza War Update")

    def test_different_titles_different_hash(self):
        assert title_hash("Gaza War Update") != title_hash("Brazil Economy News")

    def test_case_insensitive_dedup(self):
        # Deduplicação deve ser case-insensitive
        assert title_hash("Israel Attacks Gaza") == title_hash("israel attacks gaza")

    def test_punctuation_ignored(self):
        # Títulos com/sem pontuação devem gerar o mesmo hash
        assert title_hash("Israel, attacks Gaza!") == title_hash("Israel attacks Gaza")


# ── parse_published_to_iso ────────────────────────────────────────────────────
class TestParsePublishedToIso:
    def test_rfc2822_to_iso(self):
        result = parse_published_to_iso("Mon, 24 Mar 2026 12:00:00 +0000")
        assert result.startswith("2026-03-24")

    def test_empty_returns_empty(self):
        assert parse_published_to_iso("") == ""

    def test_invalid_returns_original(self):
        result = parse_published_to_iso("not-a-date")
        assert result == "not-a-date"


# ── get_category_and_tags ─────────────────────────────────────────────────────
class TestGetCategoryAndTags:
    def test_guerra_category(self):
        category, tags = get_category_and_tags("israel ataca gaza com mísseis", False)
        assert category == "Guerras"
        assert "guerra" in tags

    def test_brasil_category(self):
        category, tags = get_category_and_tags("lula anuncia novo pacote econômico", False)
        assert category == "Brasil"
        assert "brasil" in tags

    def test_chinarussia_category(self):
        category, tags = get_category_and_tags("putin ordena mobilização na rússia", False)
        assert category == "ChinaRussia"

    def test_urgente_tag_when_recent(self):
        _, tags = get_category_and_tags("qualquer notícia", True)
        assert "urgente" in tags

    def test_nao_urgente_when_old(self):
        _, tags = get_category_and_tags("qualquer notícia", False)
        assert "urgente" not in tags

    def test_crise_tag(self):
        _, tags = get_category_and_tags("conflito e tensão aumentam no oriente médio", False)
        assert "crise" in tags

    def test_diplomacia_tag(self):
        _, tags = get_category_and_tags("acordo de paz firmado após negociação", False)
        assert "diplomacia" in tags

    def test_mundo_tag_always_present(self):
        _, tags = get_category_and_tags("qualquer texto", False)
        assert "mundo" in tags
