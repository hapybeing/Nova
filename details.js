const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
// BYPASSING VERCEL entirely. Hitting directly from the user's tablet.
const COMICK_DIRECT_API = 'https://api.comick.io'; 

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

function cleanTitleForAggregator(title) {
    return title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
}

async function loadMangaDetails() {
    if (!mangaId) return;

    try {
        // 1. GET METADATA
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        const infoData = await infoResponse.json();
        const manga = infoData.data;

        let chapters = [];
        let source = 'mangadex';
        let comicSlug = null;
        const cleanTitle = cleanTitleForAggregator(getTitle(manga.attributes));

        // 2. CHECK MANGADEX FIRST
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

        // 3. THE CLIENT-SIDE AGGREGATOR FALLBACK (Unblockable)
        if (chapters.length === 0) {
            try {
                // Hitting the open API directly from your tablet!
                const searchRes = await fetch(`${COMICK_DIRECT_API}/v1.0/search?q=${encodeURIComponent(cleanTitle)}&limit=1`);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData && searchData.length > 0) {
                        comicSlug = searchData[0].slug;
                        
                        // Pull up to 9999 chapters
                        const chapRes = await fetch(`${COMICK_DIRECT_API}/comic/${comicSlug}/chapters?lang=en&limit=9999`);
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
                                    attributes: { chapter: c.chap, title: c.title || '' }
                                }));
                                source = 'comick';
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn("Aggregator connection failed.");
            }
        }

        // Cache for the reader
        sessionStorage.setItem(`nova_chapters_${mangaId}`, JSON.stringify({ chapters, source, comicSlug }));
        renderDetails(manga, chapters);

    } catch (error) {
        detailsMain.innerHTML = `<div class="loading-state" style="color: #ef4444;">Network Error.</div>`;
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
            <div class="loading-state" style="text-align: left; padding: 2.5rem; background: var(--bg-surface); border-radius: 16px; border: 1px solid var(--glass-border);">
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.3rem;">No Chapters Available</h3>
                <p style="color: var(--text-secondary); line-height: 1.6;">Translators are currently working on this title. Chapters will appear here once available.</p>
            </div>
        `;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            const chapTitle = chapter.attributes.title ? `- ${chapter.attributes.title}` : '';
            const readerUrl = `reader.html?id=${mangaId}&chapterId=${chapter.id}&v=2`;
            
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

    // Notice we inject the cache-buster ?v=2 into the CSS link dynamically too, just in case
    detailsMain.innerHTML = `
        <style>@import url('styles.css?v=2');</style>
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
