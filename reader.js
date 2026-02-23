document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const chapterId = urlParams.get('chapterId');

    const readerContainer = document.getElementById('readerMain') || document.querySelector('main') || document.body;

    if (!chapterId) {
        readerContainer.innerHTML = `<div style="text-align:center; padding: 5rem; color:#ef4444;">Error: No Chapter ID found in URL.</div>`;
        return;
    }

    readerContainer.innerHTML = `<div style="text-align:center; padding: 5rem; color:var(--text-primary);">Decrypting high-res pages via Warrior Proxy...</div>`;

    try {
        const response = await fetch(`https://warrior-nova.onrender.com/api/scrape/images?chapterId=${encodeURIComponent(chapterId)}`);
        const data = await response.json();

        if (data.images && data.images.length > 0) {
            readerContainer.innerHTML = `<div class="reader-pages" style="display:flex; flex-direction:column; align-items:center; width:100%;"></div>`;
            const pagesContainer = readerContainer.querySelector('.reader-pages');
            
            data.images.forEach((imgUrl, index) => {
                const img = document.createElement('img');
                
                // THE FIX: Wrap every single image in the Proxy Shield!
                img.src = `https://warrior-nova.onrender.com/api/proxy/image?url=${encodeURIComponent(imgUrl)}`;
                
                img.alt = `Page ${index + 1}`;
                img.loading = "lazy"; 
                img.style.width = "100%"; 
                img.style.maxWidth = "800px"; 
                img.style.display = "block";
                
                pagesContainer.appendChild(img);
            });
        } else {
            readerContainer.innerHTML = `<div style="text-align:center; padding: 5rem; color:#ef4444;">No pages found for this chapter.</div>`;
        }
    } catch (error) {
        console.error("Warrior.Nova connection failed:", error);
        readerContainer.innerHTML = `<div style="text-align:center; padding: 5rem; color:#ef4444;">Failed to connect to the backend server.</div>`;
    }
});
