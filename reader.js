const COMICK_BASE = '/proxy/comick'; // The Vercel Edge Proxy

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const chapterHid = params.get('chapterHid');
    const mId = params.get('mangaId');
    const box = document.getElementById('readerMain') || document.body;

    if (!chapterHid) {
        box.innerHTML = `<div style="text-align:center; padding:5rem; color:red;">Error: No Chapter Target.</div>`;
        return;
    }

    box.innerHTML = `<div class="loading-state" style="margin-top:10rem;">Ripping High-Res Pages via Vercel Edge...</div>`;

    try {
        const res = await fetch(`${COMICK_BASE}/chapter/${chapterHid}`);
        if (!res.ok) throw new Error("Edge Network Blocked");
        const data = await res.json();
        
        if (!data.chapter || !data.chapter.images) throw new Error("No images returned");

        box.innerHTML = `
            <div style="padding:1rem; position:fixed; top:0; left:0; z-index:100; background: rgba(0,0,0,0.5); width: 100%; backdrop-filter: blur(10px);">
                <button onclick="location.href='details.html?id=${mId}'" style="background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--glass-border); padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-weight: bold;">← Back to Chapters</button>
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
            p.appendChild(imgEl);
        });

    } catch (e) {
        console.error(e);
        box.innerHTML = `<div class="loading-state" style="color:red; margin-top:10rem;">Edge Connection Severed.</div>`;
    }
});
