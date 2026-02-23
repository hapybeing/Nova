document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const chapterId = urlParams.get('chapterId');

    const readerContainer = document.getElementById('readerMain') || document.querySelector('main') || document.body;

    if (!chapterId) {
        readerContainer.innerHTML = `<div style="text-align:center; padding: 5rem; color:#ef4444;">Error: No Chapter ID found in URL.</div>`;
        return;
    }

    readerContainer.innerHTML = `<div style="text-align:center; padding: 5rem; color:var(--text-primary);">Decrypting official pages through Proxy...</div>`;

    try {
        const response = await fetch(`/proxy/api/at-home/server/${chapterId}`);
        if (!response.ok) throw new Error("Failed to fetch chapter data.");
        const data = await response.json();

        const hash = data.chapter.hash;
        const pages = data.chapter.data; 

        readerContainer.innerHTML = `<div class="reader-pages" style="display:flex; flex-direction:column; align-items:center; width:100%;"></div>`;
        const pagesContainer = readerContainer.querySelector('.reader-pages');
        
        pages.forEach((page, index) => {
            // THE ISP BYPASS: Forcing the image through your Vercel proxy instead of the blocked network!
            const imgUrl = `/proxy/uploads/data/${hash}/${page}`;
            const img = document.createElement('img');
            
            img.src = imgUrl;
            img.alt = `Page ${index + 1}`;
            img.loading = "lazy"; 
            img.style.width = "100%"; 
            img.style.maxWidth = "800px"; 
            img.style.display = "block";
            
            pagesContainer.appendChild(img);
        });
    } catch (error) {
        console.error("MangaDex connection failed:", error);
        readerContainer.innerHTML = `<div style="text-align:center; padding: 5rem; color:#ef4444;">Failed to load pages through the proxy network.</div>`;
    }
});
