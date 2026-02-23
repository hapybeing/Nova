document.addEventListener("DOMContentLoaded", async () => {
    // 1. Grab the manga title from the URL (e.g., ?title=Solo Leveling)
    const urlParams = new URLSearchParams(window.location.search);
    const mangaTitle = urlParams.get('title');

    // Make sure your HTML has a div with id="chapter-list"
    const chapterListEl = document.getElementById('chapter-list');
    
    // Make sure your HTML has an element with id="manga-title" to show the name
    const titleEl = document.getElementById('manga-title');
    if (titleEl && mangaTitle) titleEl.innerText = mangaTitle;

    if (!mangaTitle) {
        chapterListEl.innerHTML = "<p>Error: No manga title provided.</p>";
        return;
    }

    chapterListEl.innerHTML = "<p>Summoning chapters from Warrior.Nova...</p>";

    try {
        // 2. Call your custom backend!
        const response = await fetch(`https://warrior-nova.onrender.com/api/scrape/chapters?title=${encodeURIComponent(mangaTitle)}`);
        const data = await response.json();

        if (data.chapters && data.chapters.length > 0) {
            chapterListEl.innerHTML = ""; // Clear the loading text
            
            // 3. Create a button for every single chapter
            data.chapters.forEach(chap => {
                const btn = document.createElement('a');
                // Pass the secret encoded chapter ID to the reader page
                btn.href = `reader.html?chapterId=${encodeURIComponent(chap.id)}`;
                btn.className = "chapter-btn"; // Make sure you style this class in styles.css!
                
                // Format the button text
                const chapTitle = chap.attributes.title ? `- ${chap.attributes.title}` : '';
                btn.innerText = `Chapter ${chap.attributes.chapter} ${chapTitle}`;
                
                chapterListEl.appendChild(btn);
            });
        } else {
            chapterListEl.innerHTML = "<p>No chapters found on the network.</p>";
        }
    } catch (error) {
        console.error("Warrior.Nova connection failed:", error);
        chapterListEl.innerHTML = "<p>Failed to connect to the backend server.</p>";
    }
});
