const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const COMICK_PROXY = '/proxy/comick'; // Restored proxy to bypass browser CORS blocks

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

async function loadMangaDetails() {
    if (!mangaId) {
        detailsMain.innerHTML = `<div class="loading-state">No Manga Selected.</div>`;
        return;
    }

    // Nuke old empty caches so it is forced to retry
    sessionStorage.removeItem(`nova_chapters_${mangaId}`);

    try {
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        const infoData = await infoResponse.json();
        const manga = infoData.data;

        let chapters = [];
        let source = 'mangadex';
        const searchTitle = cleanTitle(getTitle(manga.attributes));

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

        // THE CORS-BYPASS ENGINE
        if (chapters.length === 0) {
            try {
                // Using the Vercel proxy so the browser doesn't block the request
                const searchRes = await fetch(`${COMICK_PROXY}/v1.0/search?q=${encodeURIComponent(searchTitle)}&limit=1`);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData && searchData.length > 0) {
                        
                        const targetHid = searchData[0].hid; 
                        
                        // Safe pagination to prevent server crash
                        const requests = [1, 2, 3, 4, 5].map(page =>
                            fetch(`${COMICK_PROXY}/comic/${targetHid}/chapters?lang=en&limit=100&page=${page}`)
                            .then(r => r.ok ? r.json() : null)
                            .catch(() => null)
                        );
                        
                        const pagesData = await Promise.all(requests);
                        let allAggregatorChapters = [];
                        
                        pagesData.forEach(data => {
                            if(data && data.chapters) {
                                allAggregatorChapters.push(...data.chapters);
                            }
                        });

                        if (allAggregatorChapters.length > 0) {
                            const seen = new Set();
                            chapters = allAggregatorChapters.filter(c => {
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
            } catch (e) {
                console.warn("Aggregator fetch failed.");
            }
        }

        sessionStorage.setItem(`nova_chapters_${mangaId}`, JSON.stringify({ chapters, source }));
        renderDetails(manga, chapters);

    } catch (error) {
        detailsMain.innerHTML = `<div class="loading-state" style="color:#ef4444;">Network connection lost.</div>`;
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
                <p style="color: var(--text-secondary); line-height: 1.6;">Our engines searched all available networks, but this title is currently locked or heavily licensed.</p>
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
