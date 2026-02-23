// Bypassing the local proxy to guarantee direct connection
const API_BASE = 'https://api.mangadex.org';
const UPLOADS_BASE = 'https://uploads.mangadex.org';

const detailsMain = document.getElementById('detailsMain');
const urlParams = new URLSearchParams(window.location.search);

// THE ADAPTIVE ROUTER: Grabs whatever app.js decides to send
const mangaId = urlParams.get('id');
const mangaTitleParam = urlParams.get('title');

function getTitle(attributes) {
    if (attributes.title && attributes.title.en) return attributes.title.en;
    if (attributes.altTitles && attributes.altTitles.length > 0) {
        const enTitleObj = attributes.altTitles.find(t => t.en);
        if (enTitleObj) return enTitleObj.en;
    }
    return attributes.title ? (attributes.title[Object.keys(attributes.title)[0]] || 'Unknown Title') : 'Unknown Title';
}

function getDescription(attributes) {
    if (!attributes.description) return 'No synopsis available.';
    return attributes.description.en || Object.values(attributes.description)[0] || 'No synopsis available.';
}

function getCoverUrl(relationships, id) {
    const coverRel = relationships.find(rel => rel.type === 'cover_art');
    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
        return `${UPLOADS_BASE}/covers/${id}/${coverRel.attributes.fileName}`; 
    }
    return '';
}

async function loadMangaDetails() {
    if (!mangaId && !mangaTitleParam) {
        if (detailsMain) detailsMain.innerHTML = `<div class="loading-state" style="color:#ef4444;">Error: No Manga Data Provided in URL.</div>`;
        return;
    }

    try {
        let manga;
        let currentId;

        // SMART FETCHING LOGIC
        if (mangaId) {
            // If it has an ID, fetch directly
            const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
            const infoData = await infoResponse.json();
            manga = infoData.data;
            currentId = mangaId;
        } else if (mangaTitleParam) {
            // If it has a Title, search MangaDex to find the ID automatically
            const searchResponse = await fetch(`${API_BASE}/manga?title=${encodeURIComponent(mangaTitleParam)}&limit=1&includes[]=cover_art&includes[]=author`);
            const searchData = await searchResponse.json();
            if (!searchData.data || searchData.data.length === 0) throw new Error("Target not found on official database.");
            manga = searchData.data[0];
            currentId = manga.id;
        }

        const title = getTitle(manga.attributes);
        const description = getDescription(manga.attributes);
        const coverUrl = getCoverUrl(manga.relationships, currentId);
        
        let authorName = 'Unknown Author';
        const authorRel = manga.relationships.find(rel => rel.type === 'author');
        if (authorRel && authorRel.attributes && authorRel.attributes.name) authorName = authorRel.attributes.name;

        // Visual Confirmation the Bridge is working
        if (detailsMain) detailsMain.innerHTML = `<div class="loading-state">Bridging ${title} with Warrior.Nova...</div>`;

        // FIRE UP WARRIOR.NOVA FOR THE CHAPTERS
        let chapters = [];
        try {
            const novaResponse = await fetch(`https://warrior-nova.onrender.com/api/scrape/chapters?title=${encodeURIComponent(title)}`);
            const novaData = await novaResponse.json();
            if (novaData.chapters && novaData.chapters.length > 0) {
                chapters = novaData.chapters;
            }
        } catch (novaError) {
            console.error("Warrior.Nova fetch failed:", novaError);
        }

        // RENDER THE UI
        renderDetails(currentId, title, description, coverUrl, authorName, chapters);

    } catch (error) {
        console.error(error);
        if (detailsMain) detailsMain.innerHTML = `<div class="loading-state" style="color:#ef4444;">System Offline or Target Missing.</div>`;
    }
}

function renderDetails(id, title, description, coverUrl, authorName, chapters) {
    let library = JSON.parse(localStorage.getItem('nova_library')) || [];
    let isSaved = library.some(m => m.id === id);

    let chaptersHTML = '';
    
    if (chapters.length === 0) {
        chaptersHTML = `
            <div class="loading-state" style="text-align: center; padding: 3rem 2rem; background: var(--bg-surface); border-radius: 16px; border: 1px solid var(--glass-border);">
                <i class="ph ph-lock-key" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.3rem;">No Chapters Found</h3>
                <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.5rem;">This title currently has no English scanlations available on the Nova network.</p>
            </div>
        `;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            const chapTitle = chapter.attributes.title ? `- ${chapter.attributes.title}` : '';
            return `
                <div class="chapter-card" onclick="window.location.href='reader.html?chapterId=${encodeURIComponent(chapter.id)}'">
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
                
                <button id="saveBtn" class="control-btn" style="margin-bottom: 2rem; background: ${isSaved ? 'var(--accent)' : 'var(--bg-surface)'}; border-color: ${isSaved ? 'var(--accent)' : 'var(--glass-border)'}; padding: 0.8rem 1.5rem;">
                    <i id="saveBtnIcon" class="ph ${isSaved ? 'ph-bookmark-simple-fill' : 'ph-bookmark-simple'}"></i> 
                    <span id="saveBtnText">${isSaved ? 'In Library' : 'Save to Library'}</span>
                </button>

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

    document.getElementById('saveBtn').addEventListener('click', () => {
        let currentLibrary = JSON.parse(localStorage.getItem('nova_library')) || [];
        const existingIndex = currentLibrary.findIndex(m => m.id === id);
        
        if (existingIndex > -1) {
            currentLibrary.splice(existingIndex, 1);
            document.getElementById('saveBtnIcon').className = 'ph ph-bookmark-simple';
            document.getElementById('saveBtnText').innerText = 'Save to Library';
            document.getElementById('saveBtn').style.background = 'var(--bg-surface)';
            document.getElementById('saveBtn').style.borderColor = 'var(--glass-border)';
        } else {
            currentLibrary.push({ id: id, title: title, coverUrl: coverUrl, lastReadChapterNum: null });
            document.getElementById('saveBtnIcon').className = 'ph ph-bookmark-simple-fill';
            document.getElementById('saveBtnText').innerText = 'In Library';
            document.getElementById('saveBtn').style.background = 'var(--accent)';
            document.getElementById('saveBtn').style.borderColor = 'var(--accent)';
        }
        localStorage.setItem('nova_library', JSON.stringify(currentLibrary));
    });
}

document.addEventListener('DOMContentLoaded', loadMangaDetails);
