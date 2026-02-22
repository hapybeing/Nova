const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
// The ultimate raw HTML smuggler
const HTML_PROXY = 'https://api.allorigins.win/get?url=';

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

function cleanTitleForManganato(title) {
    // Manganato uses underscores for spaces in their search URLs
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
}

async function loadMangaDetails() {
    if (!mangaId) return;

    try {
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        const infoData = await infoResponse.json();
        const manga = infoData.data;

        let chapters = [];
        let source = 'mangadex';
        const searchTitle = cleanTitleForManganato(getTitle(manga.attributes));

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

        // THE RAW DOM HEIST (Manganato)
        if (chapters.length === 0) {
            console.log("MangaDex empty. Raiding Manganato HTML for:", searchTitle);
            try {
                // 1. Search Manganato
                const searchUrl = `https://manganato.com/search/story/${searchTitle}`;
                const proxySearch = await fetch(`${HTML_PROXY}${encodeURIComponent(searchUrl)}`);
                const searchData = await proxySearch.json();
                
                const parser = new DOMParser();
                const searchDoc = parser.parseFromString(searchData.contents, 'text/html');
                
                // Find the first manga link on their site
                const firstResult = searchDoc.querySelector('.search-story-item a.item-title');
                
                if (firstResult) {
                    const mangaUrl = firstResult.href;
                    
                    // 2. Load the actual manga page
                    const proxyManga = await fetch(`${HTML_PROXY}${encodeURIComponent(mangaUrl)}`);
                    const mangaPageData = await proxyManga.json();
                    const mangaDoc = parser.parseFromString(mangaPageData.contents, 'text/html');
                    
                    // 3. Slice out the chapters
                    const chapterNodes = mangaDoc.querySelectorAll('.row-content-chapter li a.chapter-name');
                    
                    if (chapterNodes.length > 0) {
                        chapters = Array.from(chapterNodes).map(node => {
                            let chapText = node.textContent.replace(/Chapter/i, '').trim();
                            return {
                                // We base64 encode their website link to safely pass it to our reader
                                id: btoa(node.href), 
                                attributes: { chapter: chapText, title: '' }
                            };
                        });
                        source = 'manganato';
                    }
                }
            } catch (e) {
                console.error("Manganato Heist failed.", e);
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
                <p style="color: var(--text-secondary); line-height: 1.6;">Translators are currently working on this title. Chapters will appear here once available.</p>
            </div>
        `;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            return `
                <div class="chapter-card" onclick="window.location.href='reader.html?id=${mangaId}&chapterId=${chapter.id}'">
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
                <div class="details-cover-inner">
                    <img src="${coverUrl}" alt="cover" referrerpolicy="no-referrer">
                </div>
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
