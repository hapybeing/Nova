const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const COMICK_BASE = '/proxy/comick'; 
const detailsMain = document.getElementById('detailsMain');

const urlParams = new URLSearchParams(window.location.search);
const mangaId = urlParams.get('id');

// Read the preferred source from the URL, default to MangaDex
let currentSource = urlParams.get('source') || 'mangadex';
let comicKTitleCache = ''; // Store the title so we don't have to re-fetch MangaDex just to search ComicK

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

    detailsMain.innerHTML = `<div class="loading-state" style="margin-top: 10rem;">Connecting to ${currentSource.toUpperCase()}...</div>`;

    try {
        // ALWAYS fetch MangaDex first for the high-quality UI metadata (Covers, Synopsis)
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        if (!infoResponse.ok) throw new Error('Failed to load manga data');
        const infoData = await infoResponse.json();
        const manga = infoData.data;
        
        comicKTitleCache = sanitizeTitleForSearch(getTitle(manga.attributes));
        
        let chapters = [];
        let comicHid = null;

        // FETCH BASED ON USER SELECTED SOURCE
        if (currentSource === 'mangadex') {
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
        } 
        else if (currentSource === 'comick') {
            const searchRes = await fetch(`${COMICK_BASE}/v1.0/search?q=${encodeURIComponent(comicKTitleCache)}&limit=3&t=true`);
            const searchData = await searchRes.json();
            
            if (searchData && searchData.length > 0) {
                const bestMatch = searchData.find(res => res.md_comics) || searchData[0];
                comicHid = bestMatch.hid; 
                
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
                }
            }
        }

        renderDetails(manga, chapters, comicHid);
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

// Global function so the HTML select element can call it
window.changeSource = function(newSource) {
    window.location.href = `details.html?id=${mangaId}&source=${newSource}`;
}

function renderDetails(manga, chapters, comicHid) {
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
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.3rem;">No Chapters Found</h3>
                <p style="color: var(--text-secondary); line-height: 1.6;">Try switching the Source Engine above. If it still fails, the title is heavily licensed and blocked on open APIs.</p>
            </div>
        `;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            const chapTitle = chapter.attributes.title ? `- ${chapter.attributes.title}` : '';
            
            const comicParam = currentSource === 'comick' ? `&comicHid=${comicHid}` : '';
            const readerUrl = `reader.html?id=${mangaId}&chapterId=${chapter.id}&source=${currentSource}${comicParam}`;
            
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

    // THE SOURCE SELECTOR UI
    const sourceSelectorHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--glass-border);">
            <h2 class="chapters-header" style="margin-bottom: 0; border: none; padding: 0;">Chapters</h2>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="color: var(--text-secondary); font-size: 0.9rem;">Source:</span>
                <select onchange="window.changeSource(this.value)" style="background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--glass-border); padding: 0.5rem 1rem; border-radius: 8px; font-family: inherit; font-size: 0.9rem; cursor: pointer; outline: none;">
                    <option value="mangadex" ${currentSource === 'mangadex' ? 'selected' : ''}>MangaDex (HQ)</option>
                    <option value="comick" ${currentSource === 'comick' ? 'selected' : ''}>ComicK (Aggregator)</option>
                </select>
            </div>
        </div>
    `;

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
            ${sourceSelectorHTML}
            <div class="chapters-grid">
                ${chaptersHTML}
            </div>
        </section>
    `;
}

document.addEventListener('DOMContentLoaded', loadMangaDetails);
