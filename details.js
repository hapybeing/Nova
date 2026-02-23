const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';

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

async function loadMangaDetails() {
    if (!mangaId) return;

    try {
        const infoResponse = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        const infoData = await infoResponse.json();
        const manga = infoData.data;

        let chapters = [];
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

        renderDetails(manga, chapters);
    } catch (error) {
        detailsMain.innerHTML = `<div class="loading-state" style="color:#ef4444;">Network Offline.</div>`;
    }
}

function renderDetails(manga, chapters) {
    const title = getTitle(manga.attributes);
    const description = getDescription(manga.attributes);
    const coverUrl = getCoverUrl(manga.relationships);
    
    let authorName = 'Unknown Author';
    const authorRel = manga.relationships.find(rel => rel.type === 'author');
    if (authorRel && authorRel.attributes && authorRel.attributes.name) authorName = authorRel.attributes.name;

    let library = JSON.parse(localStorage.getItem('nova_library')) || [];
    let isSaved = library.some(m => m.id === mangaId);

    let chaptersHTML = '';
    
    if (chapters.length === 0) {
        chaptersHTML = `
            <div class="loading-state" style="text-align: center; padding: 3rem 2rem; background: var(--bg-surface); border-radius: 16px; border: 1px solid var(--glass-border);">
                <i class="ph ph-lock-key" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem;"></i>
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.3rem;">No Chapters Found</h3>
                <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.5rem;">This title is highly protected by official publishers or currently has no English scanlations available on our network.</p>
                <a href="https://google.com/search?q=read+${encodeURIComponent(title)}+manga+online" target="_blank" style="background: var(--accent); color: #fff; padding: 0.8rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; transition: all 0.2s;">
                    Search Web for Chapters <i class="ph ph-arrow-square-out" style="margin-left: 5px;"></i>
                </a>
            </div>
        `;
    } else {
        chaptersHTML = chapters.map(chapter => {
            const chapNum = chapter.attributes.chapter ? `Chapter ${chapter.attributes.chapter}` : 'Oneshot';
            const chapTitle = chapter.attributes.title ? `- ${chapter.attributes.title}` : '';
            return `
                <div class="chapter-card" onclick="window.location.href='reader.html?chapterId=${chapter.id}'">
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
        const existingIndex = currentLibrary.findIndex(m => m.id === mangaId);
        
        if (existingIndex > -1) {
            currentLibrary.splice(existingIndex, 1);
            document.getElementById('saveBtnIcon').className = 'ph ph-bookmark-simple';
            document.getElementById('saveBtnText').innerText = 'Save to Library';
            document.getElementById('saveBtn').style.background = 'var(--bg-surface)';
            document.getElementById('saveBtn').style.borderColor = 'var(--glass-border)';
        } else {
            currentLibrary.push({ id: mangaId, title: title, coverUrl: coverUrl, lastReadChapterNum: null });
            document.getElementById('saveBtnIcon').className = 'ph ph-bookmark-simple-fill';
            document.getElementById('saveBtnText').innerText = 'In Library';
            document.getElementById('saveBtn').style.background = 'var(--accent)';
            document.getElementById('saveBtn').style.borderColor = 'var(--accent)';
        }
        localStorage.setItem('nova_library', JSON.stringify(currentLibrary));
    });
}

document.addEventListener('DOMContentLoaded', loadMangaDetails);

