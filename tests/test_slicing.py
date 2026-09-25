import os, sys
import pytest

# Ajout du chemin racine pour importer run_studio_v3_full_pipeline
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from run_studio_v3_full_pipeline import slice_words_into_units


class TestSlicingAndClamping:
    """Suite de tests unitaires pour le slicing mot-a-mot et le clamping de lead-out."""

    def test_silence_greater_than_300ms_splits_with_lead_out(self):
        """1. Silence > 0,30s avec coupure nette et lead-out (+150ms)."""
        words = [
            {"word": "premier", "start": 1.00, "end": 2.00},
            # Silence de 1.00s (> 0.30s)
            {"word": "deuxieme", "start": 3.00, "end": 4.00}
        ]
        units = slice_words_into_units(words, silence_threshold=0.30, lead_out=0.15)
        
        assert len(units) == 2, "Doit scinder en 2 unites distinctes sur silence > 0.30s"
        # Unite 1
        assert units[0]["start"] == 1.00
        assert units[0]["end"] == 2.15, "Lead-out de +150ms attendu (2.00 + 0.15 = 2.15)"
        assert units[0]["text"] == "premier"
        
        # Unite 2
        assert units[1]["start"] == 3.00, "L'unite suivante doit demarrer pile au mot suivant"
        assert units[1]["end"] == 4.15, "Lead-out final de +150ms attendu"
        assert units[1]["text"] == "deuxieme"
        
        # Verification absence de texte fantome pendant le silence (de 2.15s a 3.00s)
        assert units[1]["start"] - units[0]["end"] == pytest.approx(0.85, abs=0.01)

    def test_clamping_prevents_overlap_when_next_word_starts_under_150ms(self):
        """2. Clamping anti-chevauchement (quand le mot suivant demarre a moins de 150 ms)."""
        words = [
            {"word": "mot1", "start": 1.00, "end": 2.00},
            # Gap de seulement 80ms (< 150ms)
            {"word": "mot2", "start": 2.08, "end": 2.90}
        ]
        # Forcons un split avec un silence_threshold de 0.05s pour tester le clamping
        units = slice_words_into_units(words, silence_threshold=0.05, lead_out=0.15)
        
        assert len(units) == 2
        # Sans clamping, end serait 2.15, ce qui chevaucherait mot2 (start: 2.08)
        # Avec clamping : min(2.00 + 0.15, 2.08) = 2.08
        assert units[0]["end"] == 2.08, "Le lead-out doit etre clampe a 2.08s sans chevaucher mot2"
        assert units[0]["end"] <= units[1]["start"], "Interdiction absolue d'overlap"

    def test_splitting_on_max_words_and_max_duration(self):
        """3. Decoupage sur duree max et nombre de mots max."""
        # A. Test nombre de mots max (8 mots)
        ten_words = [
            {"word": f"mot_{i}", "start": round(i * 0.20, 2), "end": round((i + 1) * 0.20, 2)}
            for i in range(10)
        ]
        # Tous les mots s'enchainent avec 0ms de silence
        units_by_words = slice_words_into_units(ten_words, silence_threshold=0.30, max_words=8, max_unit_duration=10.0)
        assert len(units_by_words) == 2, "Doit scinder a 8 mots max"
        assert len(units_by_words[0]["text"].split()) == 8
        assert len(units_by_words[1]["text"].split()) == 2
        assert units_by_words[0]["end"] <= units_by_words[1]["start"]

        # B. Test duree max (max 2.0s)
        long_duration_words = [
            {"word": "lent1", "start": 0.00, "end": 1.20},
            {"word": "lent2", "start": 1.20, "end": 2.50}, # depasse 2.0s
            {"word": "lent3", "start": 2.50, "end": 3.20}
        ]
        units_by_duration = slice_words_into_units(long_duration_words, silence_threshold=0.30, max_unit_duration=2.0, max_words=20)
        assert len(units_by_duration) >= 2, "Doit scinder des que la duree depasse 2.0s"
        assert units_by_duration[0]["end"] <= units_by_duration[1]["start"]

    def test_empty_list_and_single_word(self):
        """4. Gestion d'une liste vide ou d'un mot unique."""
        # Liste vide
        assert slice_words_into_units([]) == []

        # Mot unique
        single_word = [{"word": "Gaza", "start": 1.20, "end": 2.00}]
        unit_single = slice_words_into_units(single_word, lead_out=0.15)
        assert len(unit_single) == 1
        assert unit_single[0]["start"] == 1.20
        assert unit_single[0]["end"] == 2.15 # 2.00 + 0.15 lead-out
        assert unit_single[0]["text"] == "Gaza"
