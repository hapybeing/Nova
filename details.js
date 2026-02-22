const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const CONSUMET_BASE = '/proxy/consumet/manga/mangakakalot'; // The Mercenary API

const detailsMain = document.getElementById('detailsMain');
const urlParams = new URLSearchParams(window.location.search);
const mangaId = urlParams.get('id');

function getTitle(attributes) {
    if (attributes.title && attributes.title.en) return attributes.title.en;
    if (attributes.altTitles && attributes.altTitles.length > 0) {
        const enTitleObj = attributes.altTitles.find(t => t.en);
        if (enTitleObj) return enTitleObj.en;
    }
    if (attributes.title) return attributes.title[Object.keys(attributes.title)[0]] || 'Unknown Title';
    return 'Unknown Title';
}

function sanitizeTitleForSearch(title) {
    return title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
}

async function loadMangaDetails() {
    if (!mangaId) {
        detailsMain.innerHTML = `<div class="loading-state" style="color: #ef4444; margin-top: 10rem;">No Manga Selected.</div>`;
        return;
    }

    try {
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        if (!infoResponse.ok) throw new Error('Failed to load manga data');
        const infoData = await infoResponse.json();
        const manga = infoData.data;

        let chapters = [];
        let source = 'mangadex';

        // 1. TRY MANGADEX
        const feedResponse = await fetch(`${API_BASE}/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=500`);
        if (feedResponse.ok) {
            const feedData = await feedResponse.json();
            const seen = new Set();
            feedData.data.forEach(c => {
                if (c.attributes.externalUrl !== null) return;
                const chapNum = c.attributes.chapter;
                if (chapNum && seen.has(chapNum)) return;
                if (chapNum) seen.add(chapNum);
                chapters.push(c);
            });
        }

        // 2. THE CONSUMET WARRIOR FALLBACK
        if (chapters.length === 0) {
            const cleanTitle = sanitizeTitleForSearch(getTitle(manga.attributes));
            console.log(`Calling Consumet API for: ${cleanTitle}`);
            
            try {
                // Ask Consumet to search MangaKakalot
                const searchRes = await fetch(`${CONSUMET_BASE}/${encodeURIComponent(cleanTitle)}`);
                const searchData = await searchRes.json();
                
                if (searchData && searchData.results && searchData.results.length > 0) {
                    const targetId = searchData.results[0].id;
                    
                    // Ask Consumet to extract the chapters
                    const infoRes = await fetch(`${CONSUMET_BASE}/info?id=${targetId}`);
                    const infoData = await infoRes.json();
                    
                    if (infoData.chapters && infoData.chapters.length > 0) {
                        chapters = infoData.chapters.map(c => ({
                            id: c.id, 
                            attributes: { chapter: c.title.replace(/Chapter/i, '').trim(), title: '' }
                        }));
                        source = 'consumet';
                    }
                }
            } catch (e) {
                console.error("Consumet Warriors Failed.", e);
            }
        }

        sessionStorage.setItem(`nova_chapters_${mangaId}`, JSON.stringify({ chapters, source }));
        renderDetails(manga, chapters, source);
    } catch (error) {
        detailsMain.innerHTML = `<div class="loading-state" style="color: #ef4444; margin-top: 10rem;">Network Error. Please refresh.</div>`;
    }
}

function getDescription(attributes) {
    if (!attributes.description) return 'No synopsis available.';
    return attributes.description.en || Object.values(attributes.description)[0] || 'No synopsis available.';
}

function getCoverUrl(relationships) {
    const coverRel = relationships.find(rel => rel.type === 'cover_art');
    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
        return `${UPLOADS_BASE}/covers/${mangaId}/${coverRel.attributes.fileName}`; 
    }
    return '';
}

function renderDetails(manga, chapters, source) {
    const title = getTitle(manga.attributes);
    const description = getDescription(manga.attributes);
    const coverUrl = getCoverUrl(manga.relationships);
    
    let authorName = 'Unknown Author';
    const authorRel = manga.relationships.find(rel => rel.type === 'author');
    if (authorRel && authorRel.attributes && authorRel.attributes.name) authorName = authorRel.attributes.name;

    let chaptersHTML = '';
    if (chapters.length === 0) {
        chaptersHTML = `
            <div class="loading-state" style="text-align: left; padding: 2.5rem; background: var(--bg-surface); border-radius: 16px; border: 1px solid var(--glass-border);">
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.3rem;">Extraction Failed</h3>
                <p style="color: var(--text-secondary); line-height: 1.6;">Our warrior APIs are currently at capacity. Try again later.</p>
            </div>
        `;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            const readerUrl = `reader.html?id=${mangaId}&chapterId=${chapter.id}`;
            
            return `
                <div class="chapter-card" onclick="window.location.href='${readerUrl}'">
                    <div>
                        <div class="chapter-number">${chapNum}</div>
                    </div>
                    <i class="ph ph-book-open" style="color: var(--text-secondary); font-size: 1.2rem;"></i>
                </div>
            `;
        }).join('');
    }

    detailsMain.innerHTML = `
        <div class="details-container">
            <div class="details-cover">
                <img src="${coverUrl}" alt="${title} cover" referrerpolicy="no-referrer">
            </div>
            <div class="details-info">
                <h1 class="details-title">${title}</h1>
                <div class="details-author">By ${authorName}</div>
                <p class="details-synopsis">${description}</p>
            </div>
        </div>
        <section class="chapters-section">
            <h2 class="chapters-header">Chapters</h2>
            <div class="chapters-grid">
                ${chaptersHTML}
            </div>
        </section>
    `;
}

document.addEventListener('DOMContentLoaded', loadMangaDetails);
