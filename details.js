const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
// THE NEW STEALTH PROXY - Bypasses CORS and basic Cloudflare
const PROXY_URL = 'https://api.codetabs.com/v1/proxy?quest=';

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

// Formats the title perfectly for MangaKakalot's search engine
function makeSlug(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
}

async function loadMangaDetails() {
    if (!mangaId) {
        detailsMain.innerHTML = `<div class="loading-state" style="color: #ef4444; margin-top: 10rem;">No Manga Selected.</div>`;
        return;
    }

    try {
        // --- 1. FETCH PREMIUM UI METADATA FROM MANGADEX ---
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        if (!infoResponse.ok) throw new Error('Failed to load manga data');
        const infoData = await infoResponse.json();
        const manga = infoData.data;

        let chapters = [];
        let source = 'mangadex';
        const cleanTitle = sanitizeTitleForSearch(getTitle(manga.attributes));

        // --- 2. TRY MANGADEX CHAPTERS ---
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

        // --- 3. THE BRUTE-FORCE MANGAKAKALOT HEIST ---
        if (chapters.length === 0) {
            console.log(`Engaging Brute-Force Extraction for: ${cleanTitle}`);
            try {
                const searchSlug = makeSlug(cleanTitle);
                const searchUrl = `https://mangakakalot.com/search/story/${searchSlug}`;
                
                // Fetch the search page HTML through our stealth proxy
                const searchRes = await fetch(`${PROXY_URL}${encodeURIComponent(searchUrl)}`);
                const searchHtml = await searchRes.text();
                const parser = new DOMParser();
                const searchDoc = parser.parseFromString(searchHtml, 'text/html');
                
                // Find the first manga result link
                const firstResult = searchDoc.querySelector('.story_name a');
                
                if (firstResult) {
                    const mangaUrl = firstResult.href;
                    
                    // Fetch the actual manga page HTML
                    const mangaRes = await fetch(`${PROXY_URL}${encodeURIComponent(mangaUrl)}`);
                    const mangaHtml = await mangaRes.text();
                    const mangaDoc = parser.parseFromString(mangaHtml, 'text/html');
                    
                    // Extract all chapters instantly
                    const chapterNodes = mangaDoc.querySelectorAll('.chapter-list .row span a');
                    if (chapterNodes.length > 0) {
                        chapters = Array.from(chapterNodes).map(node => {
                            let chapText = node.textContent.replace(/Chapter/i, '').trim();
                            return {
                                id: btoa(node.href), // Securely encode the raw URL for the reader
                                attributes: { chapter: chapText, title: '' }
                            };
                        });
                        source = 'mangakakalot';
                    }
                }
            } catch (e) {
                console.error("MangaKakalot Extraction Failed.", e);
            }
        }

        // SAVE TO LOCAL MEMORY FOR INSTANT READER LOAD
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
                <p style="color: var(--text-secondary); line-height: 1.6;">Our scrapers were blocked by Cloudflare. Try again later.</p>
            </div>
        `;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            const chapTitle = chapter.attributes.title ? `- ${chapter.attributes.title}` : '';
            
            // Clean URL. No badges. No sources.
            const readerUrl = `reader.html?id=${mangaId}&chapterId=${chapter.id}`;
            
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
