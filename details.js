const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const COMICK_DIRECT = 'https://api.comick.io'; // Hitting directly to bypass Datacenter blocks
const PROXY_URL = 'https://api.allorigins.win/raw?url='; // Our HTML smuggling proxy

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
        // --- METADATA FETCH ---
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        if (!infoResponse.ok) throw new Error('Failed to load manga data');
        const infoData = await infoResponse.json();
        const manga = infoData.data;

        let chapters = [];
        let source = 'mangadex';
        let customId = null; 
        const cleanTitle = sanitizeTitleForSearch(getTitle(manga.attributes));

        // --- CASTLE 1: MANGADEX ---
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

        // --- CASTLE 2: COMICK (DIRECT RESIDENTIAL FETCH) ---
        if (chapters.length === 0) {
            console.log(`Castle 1 Empty. Infiltrating ComicK directly for: ${cleanTitle}`);
            try {
                const searchRes = await fetch(`${COMICK_DIRECT}/v1.0/search?q=${encodeURIComponent(cleanTitle)}&limit=3`);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData && searchData.length > 0) {
                        customId = searchData[0].slug; 
                        const chapRes = await fetch(`${COMICK_DIRECT}/comic/${customId}/chapters?lang=en&limit=9999`);
                        if (chapRes.ok) {
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
                    }
                }
            } catch (e) {
                console.warn("Castle 2 Defenses Active.", e);
            }
        }

        // --- CASTLE 3: MANGANATO (RAW HTML DOM SCRAPING) ---
        if (chapters.length === 0) {
            console.log(`Castle 2 Blocked. Initiating Raw DOM Heist on Manganato...`);
            try {
                const searchSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                const searchUrl = `${PROXY_URL}${encodeURIComponent('https://manganato.com/search/story/' + searchSlug)}`;
                
                const searchRes = await fetch(searchUrl);
                const searchHtml = await searchRes.text();
                const parser = new DOMParser();
                const searchDoc = parser.parseFromString(searchHtml, 'text/html');
                
                const firstResult = searchDoc.querySelector('.search-story-item a.item-title');
                
                if (firstResult) {
                    const mangaUrl = `${PROXY_URL}${encodeURIComponent(firstResult.href)}`;
                    const mangaRes = await fetch(mangaUrl);
                    const mangaHtml = await mangaRes.text();
                    const mangaDoc = parser.parseFromString(mangaHtml, 'text/html');
                    
                    const chapterNodes = mangaDoc.querySelectorAll('.row-content-chapter li a.chapter-name');
                    chapters = Array.from(chapterNodes).map(node => {
                        let chapText = node.textContent.replace('Chapter', '').trim();
                        return {
                            id: btoa(node.href), // Base64 encode the raw URL to pass to the reader securely
                            attributes: { chapter: chapText, title: '' }
                        };
                    });
                    source = 'manganato';
                }
            } catch (e) {
                console.warn("Castle 3 Failed.", e);
            }
        }

        renderDetails(manga, chapters, source, customId);
    } catch (error) {
        detailsMain.innerHTML = `<div class="loading-state" style="color: #ef4444; margin-top: 10rem;">Network Error. Trying to reconnect...</div>`;
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

function renderDetails(manga, chapters, source, customId) {
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
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.3rem;">No Chapters Available</h3>
                <p style="color: var(--text-secondary); line-height: 1.6;">All 3 target castles are heavily guarded. We could not extract the chapters.</p>
            </div>
        `;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            const chapTitle = chapter.attributes.title ? `- ${chapter.attributes.title}` : '';
            
            // Pass necessary routing data
            const extraParam = source === 'comick' ? `&comicSlug=${customId}` : '';
            const readerUrl = `reader.html?id=${mangaId}&chapterId=${chapter.id}&source=${source}${extraParam}`;
            
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

    let sourceBadge = '';
    if (source === 'comick') sourceBadge = `<span style="font-size: 0.7rem; background: var(--accent); padding: 0.2rem 0.5rem; border-radius: 4px; margin-left: 1rem;">Castle 2 Active</span>`;
    if (source === 'manganato') sourceBadge = `<span style="font-size: 0.7rem; background: #dc2626; padding: 0.2rem 0.5rem; border-radius: 4px; margin-left: 1rem;">Castle 3 Active</span>`;

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
