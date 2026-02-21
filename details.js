const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const COMICK_BASE = '/proxy/comick'; 
const detailsMain = document.getElementById('detailsMain');

const urlParams = new URLSearchParams(window.location.search);
const mangaId = urlParams.get('id');

// --- THE FIX: Aggressive English Extraction for Details/ComicK ---
function getTitle(attributes) {
    if (attributes.title && attributes.title.en) return attributes.title.en;
    if (attributes.altTitles && attributes.altTitles.length > 0) {
        const enTitleObj = attributes.altTitles.find(t => t.en);
        if (enTitleObj) return enTitleObj.en;
    }
    if (attributes.title) return attributes.title[Object.keys(attributes.title)[0]] || 'Unknown Title';
    return 'Unknown Title';
}
// -----------------------------------------------------------------

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

        // THE SHADOW API FALLBACK
        if (chapters.length === 0) {
            // Because of our fix, this is now guaranteed to be the English title!
            const englishTitle = getTitle(manga.attributes);
            console.log("Searching Aggregator for:", englishTitle);
            
            try {
                const searchRes = await fetch(`${COMICK_BASE}/v1.0/search?q=${encodeURIComponent(englishTitle)}&limit=1`);
                const searchData = await searchRes.json();
                
                if (searchData && searchData.length > 0) {
                    comicHid = searchData[0].hid; 
                    
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
                            id: c.hid,
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
        chaptersHTML = `
            <div class="loading-state" style="text-align: left; padding: 2rem; background: var(--bg-surface); border-radius: 12px;">
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Chapters Unavailable</h3>
                <p style="color: var(--text-secondary);">This title is heavily licensed. Our aggregators are waiting for scanlation updates.</p>
            </div>
        `;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            const chapTitle = chapter.attributes.title ? `- ${chapter.attributes.title}` : '';
            
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

    const sourceBadge = source === 'comick' ? `<span style="font-size: 0.8rem; background: var(--accent); padding: 0.2rem 0.6rem; border-radius: 6px; margin-left: 1rem; vertical-align: middle;">Aggregator Mode</span>` : '';

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
