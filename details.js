const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
// The ultimate bypass tool. Takes blocked data and smuggles it as raw text.
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

const detailsMain = document.getElementById('detailsMain');
const urlParams = new URLSearchParams(window.location.search);
const mangaId = urlParams.get('id');

function getTitle(attributes) {
    if (attributes.title && attributes.title.en) return attributes.title.en;
    if (attributes.altTitles && attributes.altTitles.length > 0) {
        const enTitleObj = attributes.altTitles.find(t => t.en);
        if (enTitleObj) return enTitleObj.en;
    }
    return attributes.title ? (attributes.title[Object.keys(attributes.title)[0]] || 'Unknown Title') : 'Unknown Title';
}

function cleanTitle(title) {
    return title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
}

// Bypasses network blocks by smuggling JSON inside a CORS proxy
async function fetchAggregator(url) {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    const data = await response.json();
    return JSON.parse(data.contents); // Extracts the actual JSON from the proxy string
}

async function loadMangaDetails() {
    if (!mangaId) return;

    try {
        // 1. Fetch High-Res Details from MangaDex
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        const infoData = await infoResponse.json();
        const manga = infoData.data;

        let chapters = [];
        let source = 'mangadex';
        const searchTitle = cleanTitle(getTitle(manga.attributes));

        // 2. Fetch MangaDex Chapters
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

        // 3. THE UNBLOCKABLE FALLBACK (ComicK via AllOrigins Proxy)
        if (chapters.length === 0) {
            console.log("Engaging Unblockable Scraper for:", searchTitle);
            try {
                // Search for the ID securely
                const searchUrl = `https://api.comick.io/v1.0/search?q=${encodeURIComponent(searchTitle)}&limit=1`;
                const searchData = await fetchAggregator(searchUrl);
                
                if (searchData && searchData.length > 0) {
                    const targetHid = searchData[0].hid; 
                    
                    // Fetch up to 300 chapters safely
                    const chapUrl = `https://api.comick.io/comic/${targetHid}/chapters?lang=en&limit=300`;
                    const chapData = await fetchAggregator(chapUrl);
                    
                    if (chapData && chapData.chapters && chapData.chapters.length > 0) {
                        const seen = new Set();
                        chapters = chapData.chapters.filter(c => {
                            if (!c.chap) return true;
                            if (seen.has(c.chap)) return false;
                            seen.add(c.chap);
                            return true;
                        }).map(c => ({
                            id: c.hid, 
                            attributes: { chapter: c.chap, title: c.title || '' }
                        }));
                        source = 'comick';
                    }
                }
            } catch (e) {
                console.error("Scraper fully blocked by ISP.");
            }
        }

        sessionStorage.setItem(`nova_chapters_${mangaId}`, JSON.stringify({ chapters, source }));
        renderDetails(manga, chapters);

    } catch (error) {
        detailsMain.innerHTML = `<div class="loading-state" style="color:#ef4444;">Network Offline.</div>`;
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

function renderDetails(manga, chapters) {
    const title = getTitle(manga.attributes);
    const description = getDescription(manga.attributes);
    const coverUrl = getCoverUrl(manga.relationships);
    
    let authorName = 'Unknown Author';
    const authorRel = manga.relationships.find(rel => rel.type === 'author');
    if (authorRel && authorRel.attributes && authorRel.attributes.name) authorName = authorRel.attributes.name;

    let chaptersHTML = '';
    if (chapters.length === 0) {
        chaptersHTML = `
            <div class="loading-state" style="text-align: left; padding: 2.5rem; background: #18181b; border-radius: 16px; border: 1px solid var(--glass-border);">
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.3rem;">No Chapters Available</h3>
                <p style="color: var(--text-secondary); line-height: 1.6;">Our proxy was completely blocked by security. We cannot extract these chapters at this time.</p>
            </div>
        `;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            const chapTitle = chapter.attributes.title ? `- ${chapter.attributes.title}` : '';
            return `
                <div class="chapter-card" onclick="window.location.href='reader.html?id=${mangaId}&chapterId=${chapter.id}'">
                    <div>
                        <div class="chapter-number">${chapNum}</div>
                        <div class="chapter-title">${chapTitle}</div>
                    </div>
                    <i class="ph ph-book-open" style="color: var(--text-secondary); font-size: 1.2rem;"></i>
                </div>
            `;
        }).join('');
    }

    detailsMain.innerHTML = `
        <div class="details-container">
            <div class="details-cover">
                <img src="${coverUrl}" alt="cover" referrerpolicy="no-referrer">
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
