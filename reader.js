const API_BASE = '/proxy/api';
const COMICK_BASE = '/proxy/comick';

const urlParams = new URLSearchParams(window.location.search);
const chapterId = urlParams.get('chapterId');
const mangaId = urlParams.get('id');
const source = urlParams.get('source') || 'mangadex';
const comicSlug = urlParams.get('comicSlug'); // Fetching the new slug parameter

const readerContainer = document.getElementById('readerContainer');
const readerChapterTitle = document.getElementById('readerChapterTitle');
const backBtn = document.getElementById('backBtn');
const readerControls = document.getElementById('readerControls');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const chapterSelect = document.getElementById('chapterSelect');

let allChapters = [];
let currentIndex = -1;

backBtn.addEventListener('click', () => {
    if (mangaId) window.location.href = `details.html?id=${mangaId}`;
    else window.history.back();
});

async function loadReader() {
    if (!chapterId) {
        readerContainer.innerHTML = `<div class="loading-state">Invalid Chapter.</div>`;
        return;
    }

    try {
        readerContainer.innerHTML = ''; 

        if (source === 'mangadex') {
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
        else if (source === 'comick') {
            const response = await fetch(`${COMICK_BASE}/chapter/${chapterId}`);
            if (!response.ok) throw new Error('ComicK server failed');
            const data = await response.json();
            
            data.chapter.images.forEach(img => {
                const imgEl = document.createElement('img');
                imgEl.src = img.url; 
                imgEl.className = 'reader-page';
                imgEl.loading = 'lazy';
                imgEl.setAttribute('referrerpolicy', 'no-referrer');
                readerContainer.appendChild(imgEl);
            });
        }

        if (mangaId) setupNavigation();

    } catch (error) {
        console.error(error);
        readerContainer.innerHTML = `<div class="loading-state" style="color: #ef4444;">Failed to load images. Server might be busy.</div>`;
    }
}

async function setupNavigation() {
    try {
        if (source === 'mangadex') {
            const feedRes = await fetch(`${API_BASE}/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=500`);
            const feedData = await feedRes.json();
            const seen = new Set();
            allChapters = feedData.data.filter(c => {
                if (c.attributes.externalUrl !== null) return false;
                const chapNum = c.attributes.chapter;
                if (chapNum && seen.has(chapNum)) return false;
                if (chapNum) seen.add(chapNum);
                return true;
            });
        } 
        else if (source === 'comick') {
            // Uncapped limit to match details page so all chapters appear in dropdown
            const feedRes = await fetch(`${COMICK_BASE}/comic/${comicSlug}/chapters?lang=en&limit=9999`);
            const feedData = await feedRes.json();
            const seen = new Set();
            allChapters = feedData.chapters.filter(c => {
                if (!c.chap) return true;
                if (seen.has(c.chap)) return false;
                seen.add(c.chap);
                return true;
            }).map(c => ({
                id: c.hid,
                attributes: { chapter: c.chap }
            }));
        }

        if (allChapters.length > 0) {
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

            const comicParam = source === 'comick' ? `&comicSlug=${comicSlug}` : '';
            
            if (currentIndex > 0) {
                nextBtn.disabled = false;
                nextBtn.onclick = () => window.location.href = `reader.html?id=${mangaId}&chapterId=${allChapters[currentIndex - 1].id}&source=${source}${comicParam}`;
            }
            if (currentIndex < allChapters.length - 1) {
                prevBtn.disabled = false;
                prevBtn.onclick = () => window.location.href = `reader.html?id=${mangaId}&chapterId=${allChapters[currentIndex + 1].id}&source=${source}${comicParam}`;
            }

            chapterSelect.addEventListener('change', (e) => {
                window.location.href = `reader.html?id=${mangaId}&chapterId=${e.target.value}&source=${source}${comicParam}`;
            });
        }
    } catch (error) {
        console.error("Navigation setup failed", error);
    }
}

document.addEventListener('DOMContentLoaded', loadReader);
