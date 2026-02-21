const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const COMICK_BASE = '/proxy/comick'; // Our new Shadow API
const detailsMain = document.getElementById('detailsMain');

const urlParams = new URLSearchParams(window.location.search);
const mangaId = urlParams.get('id');

async function loadMangaDetails() {
    if (!mangaId) {
        detailsMain.innerHTML = `<div class="loading-state" style="color: #ef4444; margin-top: 10rem;">No Manga Selected.</div>`;
        return;
    }

    try {
        // 1. Fetch Manga Metadata from MangaDex (Always best for UI)
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        if (!infoResponse.ok) throw new Error('Failed to load manga data');
        const infoData = await infoResponse.json();
        const manga = infoData.data;

        // 2. Try fetching Chapters from MangaDex
        const feedResponse = await fetch(`${API_BASE}/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=500`);
        let chapters = [];
        let source = 'mangadex';
        let comicHid = null;

        if (feedResponse.ok) {
            const feedData = await feedResponse.json();
            const seen = new Set();
            chapters = feedData.data.filter(c => {
                const isExternal = c.attributes.externalUrl !== null;
                const chapNum = c.attributes.chapter;
                if (isExternal) return false;
                if (chapNum && seen.has(chapNum)) return false;
                if (chapNum) seen.add(chapNum);
                return true;
            });
        }

        // 3. THE SHADOW API FALLBACK: If MangaDex is empty, query ComicK
        if (chapters.length === 0) {
            console.log("MangaDex chapters empty. Engaging ComicK fallback...");
            const title = getTitle(manga.attributes);
            
            try {
                // Search ComicK by Title
                const searchRes = await fetch(`${COMICK_BASE}/v1.0/search?q=${encodeURIComponent(title)}&limit=1`);
                const searchData = await searchRes.json();
                
                if (searchData && searchData.length > 0) {
                    comicHid = searchData[0].hid; // ComicK's unique ID
                    
                    // Fetch Chapters from ComicK
                    const chapRes = await fetch(`${COMICK_BASE}/comic/${comicHid}/chapters?lang=en&limit=500`);
                    const chapData = await chapRes.json();
                    
                    if (chapData.chapters && chapData.chapters.length > 0) {
                        const seen = new Set();
                        chapters = chapData.chapters.filter(c => {
                            if (!c.chap) return true;
                            if (seen.has(c.chap)) return false;
                            seen.add(c.chap);
                            return true;
                        }).map(c => ({
                            id: c.hid, // ComicK chapter ID
                            attributes: { chapter: c.chap, title: c.title }
                        }));
                        source = 'comick';
                    }
                }
            } catch (fallbackError) {
                console.error("ComicK Fallback Failed", fallbackError);
            }
        }

        renderDetails(manga, chapters, source, comicHid);
    } catch (error) {
        detailsMain.innerHTML = `<div class="loading-state" style="color: #ef4444; margin-top: 10rem;">Network Error.</div>`;
    }
}

function getTitle(attributes) {
    if (attributes.title.en) return attributes.title.en;
    return attributes.title[Object.keys(attributes.title)[0]] || 'Unknown Title';
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

function renderDetails(manga, chapters, source, comicHid) {
    const title = getTitle(manga.attributes);
    const description = getDescription(manga.attributes);
    const coverUrl = getCoverUrl(manga.relationships);
    
    let authorName = 'Unknown Author';
    const authorRel = manga.relationships.find(rel => rel.type === 'author');
    if (authorRel && authorRel.attributes && authorRel.attributes.name) authorName = authorRel.attributes.name;

    let chaptersHTML = '';
    if (chapters.length === 0) {
        chaptersHTML = `<div class="loading-state">No readable English chapters found across any source.</div>`;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            const chapTitle = chapter.attributes.title ? `- ${chapter.attributes.title}` : '';
            
            // Build the Reader URL to include the Source and ID
            const comicParam = source === 'comick' ? `&comicHid=${comicHid}` : '';
            const readerUrl = `reader.html?id=${mangaId}&chapterId=${chapter.id}&source=${source}${comicParam}`;
            
            return `
                <div class="chapter-card" onclick="window.location.href='${readerUrl}'">
                    <div>
                        <div class="chapter-number">${chapNum}</div>
                        <div class="chapter-title">${chapTitle}</div>
                    </div>
                    <i class="ph ph-book-open" style="color: var(--text-secondary); font-size: 1.2rem;"></i>
                </div>
            `;
        }).join('');
    }

    // Add a small badge so you know if it's using the fallback
    const sourceBadge = source === 'comick' ? `<span style="font-size: 0.8rem; background: var(--accent); padding: 0.2rem 0.5rem; border-radius: 4px; margin-left: 1rem;">Aggregator Mode</span>` : '';

    detailsMain.innerHTML = `
        <div class="details-container">
            <div class="details-cover">
                <img src="${coverUrl}" alt="${title} cover" referrerpolicy="no-referrer">
            </div>
            <div class="details-info">
                <h1 class="details-title">${title} ${sourceBadge}</h1>
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
