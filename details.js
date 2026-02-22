const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const COMICK_BASE = '/proxy/comick'; // The Mega-Aggregator Proxy

const detailsMain = document.getElementById('detailsMain');
const urlParams = new URLSearchParams(window.location.search);
const mangaId = urlParams.get('id');

// Cleans brackets and junk from titles for perfect searching
function cleanTitle(title) {
    return title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
}

async function loadMangaDetails() {
    if (!mangaId) {
        detailsMain.innerHTML = `<div class="loading-state">No Manga Selected.</div>`;
        return;
    }

    try {
        // 1. FETCH MANGADEX METADATA
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        const infoData = await infoResponse.json();
        const manga = infoData.data;

        let chapters = [];
        let source = 'mangadex';
        let comicSlug = null;

        // 2. CHECK MANGADEX CHAPTERS
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

        // 3. THE OMNI-SCRAPER FALLBACK
        if (chapters.length === 0) {
            console.log("MangaDex empty. Initiating Omni-Scraper...");
            
            // Build an arsenal of search queries from every known title this manga has
            let searchQueries = new Set();
            if (manga.attributes.title.en) searchQueries.add(cleanTitle(manga.attributes.title.en));
            
            if (manga.attributes.altTitles) {
                manga.attributes.altTitles.forEach(t => {
                    if (t.en) searchQueries.add(cleanTitle(t.en));
                    if (t['ja-ro']) searchQueries.add(cleanTitle(t['ja-ro']));
                    if (t['ko-ro']) searchQueries.add(cleanTitle(t['ko-ro']));
                });
            }
            // Fallback to whatever primary title exists
            searchQueries.add(cleanTitle(manga.attributes.title[Object.keys(manga.attributes.title)[0]]));

            // Convert Set to Array to loop through
            const queryList = Array.from(searchQueries);

            // Relentlessly try every title variation against ComicK until we find chapters
            for (let query of queryList) {
                if (!query) continue;
                
                try {
                    const searchRes = await fetch(`${COMICK_BASE}/v1.0/search?q=${encodeURIComponent(query)}&limit=1`);
                    if (!searchRes.ok) continue;
                    
                    const searchData = await searchRes.json();
                    if (searchData && searchData.length > 0) {
                        const targetSlug = searchData[0].slug;
                        
                        // Grab 9999 chapters (Uncapped)
                        const chapRes = await fetch(`${COMICK_BASE}/comic/${targetSlug}/chapters?lang=en&limit=9999`);
                        if (!chapRes.ok) continue;
                        
                        const chapData = await chapRes.json();
                        if (chapData.chapters && chapData.chapters.length > 0) {
                            const seen = new Set();
                            chapters = chapData.chapters.filter(c => {
                                if (!c.chap) return true;
                                if (seen.has(c.chap)) return false;
                                seen.add(c.chap);
                                return true;
                            }).map(c => ({
                                id: c.hid, // ComicK Hash ID required for reader
                                attributes: { chapter: c.chap, title: c.title || '' }
                            }));
                            
                            source = 'comick';
                            comicSlug = targetSlug;
                            break; // WE FOUND THE GOLD. STOP SEARCHING.
                        }
                    }
                } catch (e) {
                    console.log(`Failed query: ${query}`);
                }
            }
        }

        // Cache the result for an instant reader load
        sessionStorage.setItem(`nova_chapters_${mangaId}`, JSON.stringify({ chapters, source, comicSlug }));
        renderDetails(manga, chapters);

    } catch (error) {
        detailsMain.innerHTML = `<div class="loading-state" style="color:#ef4444;">Network Error.</div>`;
    }
}

// Display title logic
function getDisplayTitle(attributes) {
    if (attributes.title && attributes.title.en) return attributes.title.en;
    if (attributes.altTitles) {
        const enTitleObj = attributes.altTitles.find(t => t.en);
        if (enTitleObj) return enTitleObj.en;
    }
    return attributes.title[Object.keys(attributes.title)[0]] || 'Unknown Title';
}

function renderDetails(manga, chapters) {
    const title = getDisplayTitle(manga.attributes);
    const description = (manga.attributes.description && manga.attributes.description.en) ? manga.attributes.description.en : 'No synopsis available.';
    
    let coverUrl = '';
    const coverRel = manga.relationships.find(rel => rel.type === 'cover_art');
    if (coverRel && coverRel.attributes) coverUrl = `${UPLOADS_BASE}/covers/${mangaId}/${coverRel.attributes.fileName}`;

    let authorName = 'Unknown';
    const authorRel = manga.relationships.find(rel => rel.type === 'author');
    if (authorRel && authorRel.attributes) authorName = authorRel.attributes.name;

    let chaptersHTML = '';
    if (chapters.length === 0) {
        chaptersHTML = `<div class="loading-state">No Chapters Available on any open network yet.</div>`;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            return `
                <div class="chapter-card" onclick="window.location.href='reader.html?id=${mangaId}&chapterId=${chapter.id}'">
                    <div class="chapter-number">${chapNum}</div>
                    <i class="ph ph-book-open" style="color: var(--text-secondary); font-size: 1.2rem;"></i>
                </div>
            `;
        }).join('');
    }

    detailsMain.innerHTML = `
        <div class="details-container">
            <div class="details-cover"><img src="${coverUrl}" referrerpolicy="no-referrer"></div>
            <div class="details-info">
                <h1 class="details-title">${title}</h1>
                <div class="details-author">By ${authorName}</div>
                <p class="details-synopsis">${description}</p>
            </div>
        </div>
        <section class="chapters-section">
            <h2 class="chapters-header">Chapters</h2>
            <div class="chapters-grid">${chaptersHTML}</div>
        </section>
    `;
}

document.addEventListener('DOMContentLoaded', loadMangaDetails);
