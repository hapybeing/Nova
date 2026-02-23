document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const mId = params.get('mangaId');
    const box = document.getElementById('readerMain') || document.body;

    box.innerHTML = `<div class="loading-state" style="margin-top:10rem;">Decrypting pages...</div>`;

    try {
        const d = await (await fetch(`https://warrior-nova.onrender.com/api/scrape/images?chapterId=${id}`)).json();
        const urls = d.images.map(u => `https://warrior-nova.onrender.com/api/proxy/image?url=${encodeURIComponent(u)}`);

        box.innerHTML = `
            <div style="padding:1rem; position:fixed; top:0; left:0; z-index:100;">
                <button onclick="location.href='details.html?id=${mId}'" class="control-btn">← Back</button>
            </div>
            <div class="reader-pages" style="display:flex; flex-direction:column; align-items:center; background:#000; padding-top:4rem;"></div>
        `;
        const p = box.querySelector('.reader-pages');
        urls.forEach(u => {
            const img = document.createElement('img');
            img.src = u;
            img.style.width = "100%";
            img.style.maxWidth = "800px";
            p.appendChild(img);
        });
    } catch (e) { box.innerHTML = "Encryption Failed. Try again."; }
});
