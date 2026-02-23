const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';
const COMICK_BASE = '/proxy/comick'; // The Vercel Edge Proxy

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
        const mainTitleEn = manga.attributes.title.en || Object.values(manga.attributes.title)[0];

        // 1. THE ALIAS WARHEAD
        let searchQueries = [mainTitleEn];
        if (manga.attributes.altTitles && manga.attributes.altTitles.length > 0) {
            manga.attributes.altTitles.forEach(alt => {
                const altName = Object.values(alt)[0];
                if (altName && !searchQueries.includes(altName)) searchQueries.push(altName);
            });
        }
        const cleanTitle = mainTitleEn.replace(/[^a-zA-Z0-9 ]/g, "").trim();
        if (!searchQueries.includes(cleanTitle)) searchQueries.push(cleanTitle);

        // 2. SMASH THE WALL WITH VERCEL EDGE
        let chapters = [];
        let comicHid = null;

        detailsMain.innerHTML = `<div class="loading-state" style="margin-top: 10rem;">Breaching ComicK via Vercel Edge...</div>`;

        for (let query of searchQueries) {
            if (!query) continue;
            try {
                // Firing through your custom proxy path
                const searchReq = await fetch(`${COMICK_BASE}/v1.0/search?q=${encodeURIComponent(query)}&limit=1`);
                if (!searchReq.ok) continue; // If an alias fails, immediately skip instead of hanging
                
                const searchData = await searchReq.json();
                if (searchData && searchData.length > 0) {
                    comicHid = searchData[0].hid;
                    break; 
                }
            } catch (err) { continue; }
        }

        // 3. EXTRACT CHAPTERS
        if (comicHid) {
            const chapReq = await fetch(`${COMICK_BASE}/comic/${comicHid}/chapters?lang=en&limit=500`);
            if (chapReq.ok) {
                const chapData = await chapReq.json();
                if (chapData.chapters) {
                    chapters = chapData.chapters.map(c => ({
                        id: c.hid,
                        num: c.chap || 'Oneshot'
                    }));
                }
            }
        }

        renderUI(manga, chapters, id, mainTitleEn);

    } catch (e) { 
        detailsMain.innerHTML = `<div style="text-align:center; padding:5rem; color:#ef4444;">Critical System Error. The Edge Proxy failed to connect.</div>`; 
    }
}

function renderUI(manga, chapters, id, title) {
    const coverFile = manga.relationships.find(r => r.type === 'cover_art').attributes.fileName;
    const coverUrl = `${UPLOADS_BASE}/covers/${id}/${coverFile}`;
    
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
                `).join('') : '<div style="grid-column: 1 / -1; padding: 2rem; background: var(--bg-surface); border-radius: 12px; text-align: center; border: 1px solid var(--glass-border);">Target evaded all brute-force sweeps. No chapters found.</div>'}
            </div>
        </div>`;
}

document.addEventListener('DOMContentLoaded', loadMangaDetails);
