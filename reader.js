const API_BASE = '/proxy/api';
const CONSUMET_BASE = '/proxy/consumet/manga/mangakakalot';

const urlParams = new URLSearchParams(window.location.search);
const chapterId = urlParams.get('chapterId');
const mangaId = urlParams.get('id');

const readerContainer = document.getElementById('readerContainer');
const readerChapterTitle = document.getElementById('readerChapterTitle');
const backBtn = document.getElementById('backBtn');
const readerControls = document.getElementById('readerControls');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const chapterSelect = document.getElementById('chapterSelect');

let allChapters = [];
let currentIndex = -1;
let sourceEngine = 'mangadex'; 

backBtn.addEventListener('click', () => {
    if (mangaId) window.location.href = `details.html?id=${mangaId}`;
    else window.history.back();
});

async function loadReader() {
    if (!chapterId || !mangaId) {
        readerContainer.innerHTML = `<div class="loading-state">Invalid Chapter Data.</div>`;
        return;
    }

    const cachedData = sessionStorage.getItem(`nova_chapters_${mangaId}`);
    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        allChapters = parsed.chapters;
        sourceEngine = parsed.source;
    }

    try {
        readerContainer.innerHTML = ''; 

        if (sourceEngine === 'mangadex') {
            const response = await fetch(`${API_BASE}/at-home/server/${chapterId}`);
            if (!response.ok) throw new Error('Image server failed');
            const data = await response.json();
            
            data.chapter.data.forEach(img => {
                const imgEl = document.createElement('img');
                imgEl.src = `${data.baseUrl}/data/${data.chapter.hash}/${img}`;
                imgEl.className = 'reader-page';
                imgEl.loading = 'lazy';
                imgEl.setAttribute('referrerpolicy', 'no-referrer');
                readerContainer.appendChild(imgEl);
            });
        } 
        else if (sourceEngine === 'consumet') {
            // Ask Consumet for the image pages
            const response = await fetch(`${CONSUMET_BASE}/read?chapterId=${chapterId}`);
            if (!response.ok) throw new Error('Consumet server failed');
            const data = await response.json();
            
            data.forEach(img => {
                const imgEl = document.createElement('img');
                imgEl.src = img.img; 
                imgEl.className = 'reader-page';
                imgEl.loading = 'lazy';
                imgEl.setAttribute('referrerpolicy', 'no-referrer');
                readerContainer.appendChild(imgEl);
            });
        }

        if (allChapters.length > 0) {
            setupNavigation();
        }

    } catch (error) {
        console.error(error);
        readerContainer.innerHTML = `<div class="loading-state" style="color: #ef4444;">Extraction failed.</div>`;
    }
}

function setupNavigation() {
    readerControls.style.display = 'flex';
    currentIndex = allChapters.findIndex(c => c.id === chapterId);
    
    const currentChap = allChapters[currentIndex];
    if (currentChap) {
        readerChapterTitle.innerText = currentChap.attributes.chapter ? `Chapter ${currentChap.attributes.chapter}` : 'Oneshot';
    }

    chapterSelect.innerHTML = allChapters.map((c, index) => {
        const num = c.attributes.chapter ? `Chapter ${c.attributes.chapter}` : 'Oneshot';
        return `<option value="${c.id}" ${index === currentIndex ? 'selected' : ''}>${num}</option>`;
    }).join('');

    if (currentIndex > 0) {
        nextBtn.disabled = false;
        nextBtn.onclick = () => window.location.href = `reader.html?id=${mangaId}&chapterId=${allChapters[currentIndex - 1].id}`;
    }
    if (currentIndex < allChapters.length - 1) {
        prevBtn.disabled = false;
        prevBtn.onclick = () => window.location.href = `reader.html?id=${mangaId}&chapterId=${allChapters[currentIndex + 1].id}`;
    }

    chapterSelect.addEventListener('change', (e) => {
        window.location.href = `reader.html?id=${mangaId}&chapterId=${e.target.value}`;
    });
}

document.addEventListener('DOMContentLoaded', loadReader);
