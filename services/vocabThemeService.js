/**
 * services/vocabThemeService.js
 * 
 * Gestionnaire des thèmes de fiches de vocabulaire (Mode Administrable)
 * Permet aux administrateurs de configurer et d'enrichir la liste des thèmes proposés aux utilisateurs.
 */

const fs = require('fs');
const path = require('path');

const THEMES_FILE = path.join(__dirname, '..', 'data', 'vocab_themes.json');

function readThemes() {
    try {
        if (!fs.existsSync(THEMES_FILE)) {
            return [];
        }
        const data = fs.readFileSync(THEMES_FILE, 'utf-8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error('[THEMES SERVICE] Erreur lecture data/vocab_themes.json:', err.message);
        return [];
    }
}

function writeThemes(themes) {
    try {
        fs.writeFileSync(THEMES_FILE, JSON.stringify(themes, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error('[THEMES SERVICE] Erreur écriture data/vocab_themes.json:', err.message);
        return false;
    }
}

function getAllThemes(onlyActive = true) {
    const list = readThemes();
    if (onlyActive) {
        return list.filter(t => t.active !== false);
    }
    return list;
}

function addTheme({ titleFr, titleAr, emoji, category }) {
    if (!titleFr || typeof titleFr !== 'string' || !titleFr.trim()) {
        throw new Error("Le titre en français est requis.");
    }

    const themes = readThemes();
    const id = 'theme_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newTheme = {
        id,
        titleFr: titleFr.trim(),
        titleAr: (titleAr && typeof titleAr === 'string') ? titleAr.trim() : '',
        emoji: (emoji && typeof emoji === 'string') ? emoji.trim() : '✨',
        category: (category && typeof category === 'string') ? category.trim() : 'Général',
        active: true,
        createdAt: new Date().toISOString()
    };

    themes.push(newTheme);
    writeThemes(themes);
    return newTheme;
}

function deleteTheme(id) {
    let themes = readThemes();
    const initialLen = themes.length;
    themes = themes.filter(t => t.id !== id);
    if (themes.length === initialLen) {
        return false;
    }
    writeThemes(themes);
    return true;
}

function toggleTheme(id) {
    const themes = readThemes();
    const theme = themes.find(t => t.id === id);
    if (!theme) return null;
    theme.active = !theme.active;
    writeThemes(themes);
    return theme;
}

module.exports = {
    getAllThemes,
    addTheme,
    deleteTheme,
    toggleTheme
};
