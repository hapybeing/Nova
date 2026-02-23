document.addEventListener("DOMContentLoaded", async () => {
    // 1. Grab the secret chapter ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const chapterId = urlParams.get('chapterId');

    // Find the main container (handles different HTML setups)
    const readerContainer = document.getElementById('readerMain') || document.querySelector('main') || document.body;

    if (!chapterId) {
        readerContainer.innerHTML = `<div style="text-align:center; padding: 5rem; color:#ef4444;">Error: No Chapter ID found in URL.</div>`;
        return;
    }

    // Visual confirmation that it's using YOUR server now
    readerContainer.innerHTML = `<div style="text-align:center; padding: 5rem; color:var(--text-primary);">Ripping high-res pages from Warrior.Nova...</div>`;

    try {
        // 2. Call your custom backend for the images!
        const response = await fetch(`https://warrior-nova.onrender.com/api/scrape/images?chapterId=${encodeURIComponent(chapterId)}`);
        const data = await response.json();

        if (data.images && data.images.length > 0) {
            readerContainer.innerHTML = `<div class="reader-pages" style="display:flex; flex-direction:column; align-items:center; width:100%;"></div>`;
            const pagesContainer = readerContainer.querySelector('.reader-pages');
            
            // 3. Render every single page seamlessly
            data.images.forEach((imgUrl, index) => {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.alt = `Page ${index + 1}`;
                img.loading = "lazy"; // Prevents browser crash by loading as you scroll
                img.style.width = "100%"; 
                img.style.maxWidth = "800px"; // Keeps it readable on tablets/PCs
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
