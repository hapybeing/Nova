document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    const id = params.get('id');
    const mId = params.get('mangaId');
    const box = document.getElementById('readerMain') || document.body;

    box.innerHTML = `<div class="loading-state" style="margin-top:10rem;">Initializing ${src.toUpperCase()} Stream...</div>`;

    try {
        let urls = [];
        if (src === 'warrior') {
            const d = await (await fetch(`https://warrior-nova.onrender.com/api/scrape/images?chapterId=${id}`)).json();
            urls = d.images.map(u => `https://warrior-nova.onrender.com/api/proxy/image?url=${encodeURIComponent(u)}`);
        } else {
            const d = await (await fetch(`/proxy/api/at-home/server/${id}`)).json();
            urls = d.chapter.data.map(i => `/proxy/uploads/data/${d.chapter.hash}/${i}`);
        }

        box.innerHTML = `<div class="reader-pages" style="display:flex; flex-direction:column; align-items:center;"></div>`;
        const p = box.querySelector('.reader-pages');
        urls.forEach(u => {
            const img = document.createElement('img');
            img.src = u;
            img.style.width = "100%";
            img.style.maxWidth = "800px";
            p.appendChild(img);
        });
        
        // Add a "Back" button at bottom
        const b = document.createElement('button');
        b.innerText = "Finish Reading";
        b.onclick = () => location.href = `details.html?id=${mId}`;
        b.className = "control-btn";
        box.appendChild(b);

    } catch (e) { box.innerHTML = "Stream Interrupted."; }
});
