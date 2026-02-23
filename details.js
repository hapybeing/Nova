const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const WARRIOR_API = 'https://warrior-nova.onrender.com/api/scrape';

async function loadMangaDetails() {
    const params = new URLSearchParams(window.location.search);
    const mangaId = params.get('id');
    const urlTitle = params.get('title');
    const container = document.getElementById('detailsMain');

    try {
        // 1. Resolve ID from Title if needed (for those cached links)
        let id = mangaId;
        if (!id && urlTitle) {
            const s = await fetch(`${API_BASE}/manga?title=${encodeURIComponent(urlTitle)}&limit=1`);
            const d = await s.json();
            id = d.data[0]?.id;
        }

        const info = await (await fetch(`${API_BASE}/manga/${id}?includes[]=cover_art`)).json();
        const title = info.data.attributes.title.en || Object.values(info.data.attributes.title)[0];

        // 2. Multi-Source Chapter Fetch
        let chapters = [];
        // Try Dex
        const dex = await fetch(`${API_BASE}/manga/${id}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=500`);
        const dexData = await dex.json();
        dexData.data.forEach(c => {
            if (!c.attributes.externalUrl) chapters.push({ id: c.id, num: c.attributes.chapter, src: 'dex' });
        });

        // Failover to Warrior (Manganato)
        if (chapters.length === 0) {
            const war = await (await fetch(`${WARRIOR_API}/chapters?title=${encodeURIComponent(title)}`)).json();
            if (war.chapters) war.chapters.forEach(c => chapters.push({ id: c.id, num: c.num, src: 'warrior' }));
        }

        renderUI(info.data, chapters, id);
    } catch (e) { container.innerHTML = "Breach detected. Refreshing..."; }
}

function renderUI(manga, chapters, id) {
    const cover = manga.relationships.find(r => r.type === 'cover_art').attributes.fileName;
    document.getElementById('detailsMain').innerHTML = `
        <div class="details-container">
            <img src="${UPLOADS_BASE}/covers/${id}/${cover}" class="details-cover">
            <h1>${manga.attributes.title.en || 'Manga'}</h1>
        </div>
        <div class="chapters-grid">
            ${chapters.map(c => `
                <div class="chapter-card" onclick="location.href='reader.html?src=${c.src}&id=${encodeURIComponent(c.id)}&mangaId=${id}'">
                    Chapter ${c.num} ${c.src === 'warrior' ? '⚡' : '🛡️'}
                </div>
            `).join('')}
        </div>`;
}
loadMangaDetails();
