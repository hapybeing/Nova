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

        const war = await (await fetch(`${WARRIOR_API}/chapters?title=${encodeURIComponent(title)}`)).json();
        const chapters = war.chapters || [];

        renderUI(manga, chapters, id, title);
    } catch (e) { detailsMain.innerHTML = "System Error. Please refresh."; }
}

function renderUI(manga, chapters, id, title) {
    const coverFile = manga.relationships.find(r => r.type === 'cover_art').attributes.fileName;
    const coverUrl = `${UPLOADS_BASE}/covers/${id}/${coverFile}`;
    
    detailsMain.innerHTML = `
        <div class="details-container">
            <div class="details-header">
                <img src="${coverUrl}" class="details-cover-img" referrerpolicy="no-referrer">
                <div class="details-text">
                    <h1 class="details-title">${title}</h1>
                    <p class="details-synopsis">${manga.attributes.description.en || 'No synopsis.'}</p>
                </div>
            </div>
            <h2 style="margin: 2rem 0 1rem; padding: 0 2rem;">Chapters</h2>
            <div class="chapters-grid">
                ${chapters.length > 0 ? chapters.map(c => `
                    <div class="chapter-card" onclick="location.href='reader.html?id=${encodeURIComponent(c.id)}&mangaId=${id}'">
                        Chapter ${c.num}
                    </div>
                `).join('') : '<p style="padding: 2rem;">Searching all libraries... No chapters found yet.</p>'}
            </div>
        </div>`;
}
loadMangaDetails();
