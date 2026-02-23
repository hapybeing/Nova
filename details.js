const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';

const detailsMain = document.getElementById('detailsMain');
const urlParams = new URLSearchParams(window.location.search);

async function loadMangaDetails() {
    const mangaId = urlParams.get('id');
    const urlTitle = urlParams.get('title');

    try {
        // 1. Get official metadata from MangaDex (For the beautiful covers)
        let id = mangaId;
        if (!id && urlTitle) {
            const s = await fetch(`${API_BASE}/manga?title=${encodeURIComponent(urlTitle)}&limit=1`);
            const d = await s.json();
            id = d.data[0]?.id;
        }

        const info = await (await fetch(`${API_BASE}/manga/${id}?includes[]=cover_art`)).json();
        const manga = info.data;
        const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0];

        // 2. THE HOLY GRAIL: COMICK API (Bypasses all Cloudflare blocks)
        let chapters = [];
        try {
            const comickSearch = await fetch(`https://api.comick.io/v1.0/search?q=${encodeURIComponent(title)}&limit=1`);
            const searchData = await comickSearch.json();

            if (searchData.length > 0) {
                const comicHid = searchData[0].hid;
                const chapRes = await fetch(`https://api.comick.io/comic/${comicHid}/chapters?lang=en&limit=500`);
                const chapData = await chapRes.json();
                
                if (chapData.chapters) {
                    chapters = chapData.chapters.map(c => ({
                        id: c.hid,
                        num: c.chap || 'Oneshot'
                    }));
                }
            }
        } catch (err) {
            console.error("ComicK Database unreachable:", err);
        }

        renderUI(manga, chapters, id, title);
    } catch (e) { 
        detailsMain.innerHTML = `<div style="text-align:center; padding:5rem; color:red;">System Error. Reload the page.</div>`; 
    }
}

function renderUI(manga, chapters, id, title) {
    const coverFile = manga.relationships.find(r => r.type === 'cover_art').attributes.fileName;
    const coverUrl = `${UPLOADS_BASE}/covers/${id}/${coverFile}`;
    
    // Fixing the UI layout directly in the HTML so it can't break
    detailsMain.innerHTML = `
        <div style="max-width: 1000px; margin: 6rem auto 0; padding: 2rem;">
            <div style="display: flex; gap: 2rem; flex-wrap: wrap; align-items: flex-start;">
                <img src="${coverUrl}" style="width: 250px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" referrerpolicy="no-referrer">
                <div style="flex: 1; min-width: 300px;">
                    <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--text-primary);">${title}</h1>
                    <p style="color: var(--text-secondary); line-height: 1.6; max-height: 250px; overflow-y: auto;">${manga.attributes.description.en || 'No synopsis.'}</p>
                </div>
            </div>
            
            <h2 style="margin-top: 4rem; margin-bottom: 1.5rem; color: var(--text-primary);">Chapters</h2>
            <div class="chapters-grid">
                ${chapters.length > 0 ? chapters.map(c => `
                    <div class="chapter-card" onclick="location.href='reader.html?chapterHid=${encodeURIComponent(c.id)}&mangaId=${id}'">
                        Chapter ${c.num}
                    </div>
                `).join('') : '<div style="grid-column: 1 / -1; padding: 2rem; background: var(--bg-surface); border-radius: 12px; text-align: center;">No English chapters found in the database.</div>'}
            </div>
        </div>`;
}

document.addEventListener('DOMContentLoaded', loadMangaDetails);
