const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';

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

        // 2. THE DIRECT STRIKE (Bypassing Vercel & Render entirely)
        let chapters = [];
        let comicHid = null;

        detailsMain.innerHTML = `<div class="loading-state" style="margin-top: 10rem;">Executing Direct IP Strike on ComicK Database...</div>`;

        for (let query of searchQueries) {
            if (!query) continue;
            try {
                // Hitting the official API directly using your residential IP
                const searchReq = await fetch(`https://api.comick.io/v1.0/search?q=${encodeURIComponent(query)}&limit=1`);
                if (!searchReq.ok) continue; 
                
                const searchData = await searchReq.json();
                if (searchData && searchData.length > 0) {
                    comicHid = searchData[0].hid;
                    break; 
                }
            } catch (err) { continue; }
        }

        // 3. EXTRACT CHAPTERS
        if (comicHid) {
            const chapReq = await fetch(`https://api.comick.io/comic/${comicHid}/chapters?lang=en&limit=500`);
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
        detailsMain.innerHTML = `<div style="text-align:center; padding:5rem; color:#ef4444;">Critical Failure. The target could not be acquired.</div>`; 
    }
}

function renderUI(manga, chapters, id, title) {
    const coverFile = manga.relationships.find(r => r.type === 'cover_art').attributes.fileName;
    const coverUrl = `${UPLOADS_BASE}/covers/${id}/${coverFile}`;
    
    // Forcing strict CSS isolation so the UI cannot break
    detailsMain.innerHTML = `
        <div style="max-width: 1000px; margin: 6rem auto 0; padding: 2rem;">
            <div style="display: flex; gap: 2rem; flex-wrap: wrap; align-items: flex-start;">
                <img src="${coverUrl}" style="width: 250px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" referrerpolicy="no-referrer">
                <div style="flex: 1; min-width: 300px;">
                    <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #fff;">${title}</h1>
                    <p style="color: #9ca3af; line-height: 1.6; max-height: 250px; overflow-y: auto;">${manga.attributes.description.en || 'No synopsis available.'}</p>
                </div>
            </div>
            
            <h2 style="margin-top: 4rem; margin-bottom: 1.5rem; color: #fff;">Chapters</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem;">
                ${chapters.length > 0 ? chapters.map(c => `
                    <div onclick="location.href='reader.html?chapterHid=${encodeURIComponent(c.id)}&mangaId=${id}'" style="background: #1f2937; padding: 1rem; border-radius: 8px; text-align: center; cursor: pointer; color: #fff; font-weight: bold; border: 1px solid #374151; transition: 0.2s;">
                        Chapter ${c.num}
                    </div>
                `).join('') : '<div style="grid-column: 1 / -1; padding: 2rem; background: #1f2937; border-radius: 12px; text-align: center; color: #ef4444; border: 1px solid #374151;">Target evaded all direct sweeps. No chapters found.</div>'}
            </div>
        </div>`;
}

document.addEventListener('DOMContentLoaded', loadMangaDetails);
