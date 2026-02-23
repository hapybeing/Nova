document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const chapterId = params.get('chapterId');
    const type = params.get('type'); // 'dex' or 'warrior'

    const container = document.getElementById('readerMain') || document.body;
    container.innerHTML = `<div class="loading-state" style="margin-top:10rem;">Summoning pages from ${type} server...</div>`;

    try {
        let imageUrls = [];

        if (type === 'warrior') {
            // Ripping from Manganato via Warrior.Nova
            const res = await fetch(`https://warrior-nova.onrender.com/api/scrape/images?chapterId=${encodeURIComponent(chapterId)}`);
            const data = await res.json();
            imageUrls = data.images.map(url => `https://warrior-nova.onrender.com/api/proxy/image?url=${encodeURIComponent(url)}`);
        } else {
            // Fetching from MangaDex
            const res = await fetch(`/proxy/api/at-home/server/${chapterId}`);
            const data = await res.json();
            imageUrls = data.chapter.data.map(img => `/proxy/uploads/data/${data.chapter.hash}/${img}`);
        }

        container.innerHTML = `<div class="reader-pages" style="display:flex; flex-direction:column; align-items:center;"></div>`;
        const pageBox = container.querySelector('.reader-pages');

        imageUrls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.style.width = "100%";
            img.style.maxWidth = "800px";
            img.loading = "lazy";
            pageBox.appendChild(img);
        });

    } catch (e) {
        container.innerHTML = `<div class="loading-state" style="color:red;">Bridge Collapse. Try another chapter.</div>`;
    }
});
