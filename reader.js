document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const chapterHid = params.get('chapterHid');
    const mId = params.get('mangaId');
    const box = document.getElementById('readerMain') || document.body;

    if (!chapterHid) {
        box.innerHTML = `<div style="text-align:center; padding:5rem; color:red;">Error: No Chapter Target.</div>`;
        return;
    }

    box.innerHTML = `<div class="loading-state" style="margin-top:10rem; color:#fff;">Ripping Pages Direct...</div>`;

    try {
        // Direct fetch to ComicK
        const res = await fetch(`https://api.comick.io/chapter/${chapterHid}`);
        if (!res.ok) throw new Error("Direct IP connection rejected by host.");
        const data = await res.json();
        
        if (!data.chapter || !data.chapter.images) throw new Error("No images returned from payload");

        box.innerHTML = `
            <div style="padding:1rem; position:fixed; top:0; left:0; z-index:100; background: rgba(0,0,0,0.8); width: 100%; backdrop-filter: blur(10px);">
                <button onclick="location.href='details.html?id=${mId}'" style="background: #374151; color: #fff; border: 1px solid #4b5563; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: bold;">← Return to Details</button>
            </div>
            <div class="reader-pages" style="display:flex; flex-direction:column; align-items:center; background:#000; padding-top:4rem;"></div>
        `;
        
        const p = box.querySelector('.reader-pages');
        
        data.chapter.images.forEach(img => {
            const imgEl = document.createElement('img');
            imgEl.src = img.url; 
            imgEl.style.width = "100%";
            imgEl.style.maxWidth = "800px";
            imgEl.style.display = "block";
            imgEl.loading = "lazy";
            // Crucial: Hides your site's URL from ComicK's image servers so they don't block the hotlink
            imgEl.referrerPolicy = "no-referrer"; 
            p.appendChild(imgEl);
        });

    } catch (e) {
        console.error(e);
        box.innerHTML = `<div class="loading-state" style="color:#ef4444; margin-top:10rem;">Direct Connection Severed. Mission Failed.</div>`;
    }
});
