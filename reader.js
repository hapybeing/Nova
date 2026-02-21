const API_BASE = '/proxy/api';

const urlParams = new URLSearchParams(window.location.search);
const chapterId = urlParams.get('chapterId');
const readerContainer = document.getElementById('readerContainer');
const readerChapterTitle = document.getElementById('readerChapterTitle');
const backBtn = document.getElementById('backBtn');

// Send user back to the previous page
backBtn.addEventListener('click', () => {
    window.history.back();
});

async function loadReader() {
    if (!chapterId) {
        readerContainer.innerHTML = `<div class="loading-state" style="color: #ef4444; margin-top: 10rem;">Invalid Chapter.</div>`;
        return;
    }

    try {
        // 1. Fetch chapter metadata to set the top title (Optional but nice)
        fetch(`${API_BASE}/chapter/${chapterId}`)
            .then(res => res.json())
            .then(data => {
                const chap = data.data.attributes;
                readerChapterTitle.innerText = chap.chapter ? `Chapter ${chap.chapter}` : 'Oneshot';
            }).catch(err => console.error(err));

        // 2. Fetch the actual image server details
        const response = await fetch(`${API_BASE}/at-home/server/${chapterId}`);
        if (!response.ok) throw new Error('Failed to connect to image server');
        const data = await response.json();

        const baseUrl = data.baseUrl;
        const hash = data.chapter.hash;
        const images = data.chapter.data; // High-res array

        readerContainer.innerHTML = ''; // Clear loading text

        // 3. Inject images into the DOM
        images.forEach(img => {
            const imgUrl = `${baseUrl}/data/${hash}/${img}`;
            const imgEl = document.createElement('img');
            imgEl.src = imgUrl;
            imgEl.className = 'reader-page';
            imgEl.loading = 'lazy'; // Hardware acceleration memory fix
            imgEl.setAttribute('referrerpolicy', 'no-referrer'); // Bypass hotlink protection
            readerContainer.appendChild(imgEl);
        });

    } catch (error) {
        console.error("Reader Error:", error);
        readerContainer.innerHTML = `<div class="loading-state" style="color: #ef4444; margin-top: 10rem;">Failed to load images. MangaDex servers might be busy.</div>`;
    }
}

document.addEventListener('DOMContentLoaded', loadReader);
