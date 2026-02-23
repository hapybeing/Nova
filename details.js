const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const WARRIOR_API = 'https://warrior-nova.onrender.com/api/scrape';

const detailsMain = document.getElementById('detailsMain');
const urlParams = new URLSearchParams(window.location.search);

async function loadMangaDetails() {
    const mangaId = urlParams.get('id');
    const urlTitle = urlParams.get('title');

    try {
        let id = mangaId;
        if (!id && urlTitle) {
            const s = await fetch(`${API_BASE}/manga?title=${encodeURIComponent(urlTitle)}&limit=1`);
            const d = await s.json();
            id = d.data[0]?.id;
        }

        const info = await (await fetch(`${API_BASE}/manga/${id}?includes[]=cover_art`)).json();
        const manga = info.data;
        const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0];

        // Fetch from Manganato (Warrior)
        const war = await (await fetch(`${WARRIOR_API}/chapters?title=${encodeURIComponent(title)}`)).json();
        const chapters = war.chapters || [];

        renderUI(manga, chapters, id, title);
    } catch (e) { detailsMain.innerHTML = "System Error. Reloading..."; }
}

function renderUI(manga, chapters, id, title) {
    const cover = manga.relationships.find(r => r.type === 'cover_art').attributes.fileName;
    detailsMain.innerHTML = `
        <div class="details-container">
            <div class="details-header">
                <img src="${UPLOADS_BASE}/covers/${id}/${cover}" class="details-cover-img">
                <div class="details-text">
                    <h1 class="details-title">${title}</h1>
                    <p class="details-synopsis">${manga.attributes.description.en || 'No synopsis.'}</p>
                </div>
            </div>
            <div class="chapters-grid">
                ${chapters.map(c => `
                    <div class="chapter-card" onclick="location.href='reader.html?src=warrior&id=${encodeURIComponent(c.id)}&mangaId=${id}'">
                        Chapter ${c.num}
                    </div>
                `).join('')}
            </div>
        </div>`;
}
loadMangaDetails();
