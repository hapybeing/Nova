const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const WARRIOR_BASE = 'https://warrior-nova.onrender.com/api/scrape';

const detailsMain = document.getElementById('detailsMain');
const urlParams = new URLSearchParams(window.location.search);
const mangaId = urlParams.get('id');

async function loadMangaDetails() {
    if (!mangaId) return;
    try {
        const infoRes = await fetch(`${API_BASE}/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        const infoData = await infoRes.json();
        const manga = infoData.data;
        const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0];

        // 1. Try MangaDex Chapters
        const feedRes = await fetch(`${API_BASE}/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=500`);
        let chapters = [];
        if (feedRes.ok) {
            const feedData = await feedRes.json();
            feedData.data.forEach(c => {
                if (c.attributes.externalUrl) return;
                chapters.push({ id: c.id, num: c.attributes.chapter, type: 'dex' });
            });
        }

        // 2. THE FAILSAFE: If Dex is empty, hit the War Cannon (Manganato)
        if (chapters.length === 0) {
            const novaRes = await fetch(`${WARRIOR_BASE}/chapters?title=${encodeURIComponent(title)}`);
            const novaData = await novaRes.json();
            if (novaData.chapters) {
                novaData.chapters.forEach(c => {
                    chapters.push({ id: c.id, num: c.attributes.chapter, type: 'warrior' });
                });
            }
        }

        renderDetails(manga, chapters, title);
    } catch (e) {
        detailsMain.innerHTML = `<div class="loading-state">Network Breach. Retrying...</div>`;
    }
}

function renderDetails(manga, chapters, title) {
    const coverRel = manga.relationships.find(rel => rel.type === 'cover_art');
    const coverUrl = `${UPLOADS_BASE}/covers/${manga.id}/${coverRel.attributes.fileName}`;
    
    let chaptersHTML = chapters.map(c => `
        <div class="chapter-card" onclick="window.location.href='reader.html?type=${c.type}&chapterId=${encodeURIComponent(c.id)}&mangaId=${manga.id}'">
            <div class="chapter-number">Chapter ${c.num}</div>
            <i class="ph ph-lightning" style="color:${c.type === 'warrior' ? '#f59e0b' : '#3b82f6'}"></i>
        </div>
    `).join('');

    detailsMain.innerHTML = `
        <div class="details-container">
            <img src="${coverUrl}" class="details-cover" referrerpolicy="no-referrer">
            <div class="details-info">
                <h1>${title}</h1>
                <p>${manga.attributes.description.en || 'No synopsis.'}</p>
            </div>
        </div>
        <section class="chapters-section">
            <div class="chapters-grid">${chaptersHTML || 'No sources found across all networks.'}</div>
        </section>
    `;
}
document.addEventListener('DOMContentLoaded', loadMangaDetails);
