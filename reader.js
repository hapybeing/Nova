document.addEventListener("DOMContentLoaded", async () => {
    // 1. Grab the secret chapter ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const chapterId = urlParams.get('chapterId');

    // Make sure your HTML has a div with id="reader-container"
    const readerContainer = document.getElementById('reader-container');

    if (!chapterId) {
        readerContainer.innerHTML = "<p>Error: No chapter ID provided in URL.</p>";
        return;
    }

    readerContainer.innerHTML = "<p>Ripping high-res pages from Warrior.Nova...</p>";

    try {
        // 2. Call your custom backend for the images!
        const response = await fetch(`https://warrior-nova.onrender.com/api/scrape/images?chapterId=${encodeURIComponent(chapterId)}`);
        const data = await response.json();

        if (data.images && data.images.length > 0) {
            readerContainer.innerHTML = ""; // Clear the loading text
            
            // 3. Render every single page
            data.images.forEach((imgUrl, index) => {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.alt = `Page ${index + 1}`;
                img.loading = "lazy"; // Prevents the browser from crashing by loading them as you scroll
                img.style.width = "100%"; // Basic styling to fit mobile screens
                img.style.maxWidth = "800px";
                img.style.display = "block";
                img.style.margin = "0 auto 10px auto"; // Centers the images
                
                readerContainer.appendChild(img);
            });
        } else {
            readerContainer.innerHTML = "<p>No pages found for this chapter.</p>";
        }
    } catch (error) {
        console.error("Warrior.Nova connection failed:", error);
        readerContainer.innerHTML = "<p>Failed to connect to the backend server.</p>";
    }
});
