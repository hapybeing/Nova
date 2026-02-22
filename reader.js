const API_BASE = '/proxy/api';
const COMICK_DIRECT = 'https://api.comick.io';
const PROXY_URL = 'https://api.allorigins.win/raw?url=';
const IMAGE_SMUGGLER = 'https://wsrv.nl/?url='; // Bypasses image hotlink protection

const urlParams = new URLSearchParams(window.location.search);
const chapterId = urlParams.get('chapterId');
const mangaId = urlParams.get('id');
const source = urlParams.get('source') || 'mangadex';
const comicSlug = urlParams.get('comicSlug'); 

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

        // --- CASTLE 1: MANGADEX ---
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
        // --- CASTLE 2: COMICK ---
        else if (source === 'comick') {
            const response = await fetch(`${COMICK_DIRECT}/chapter/${chapterId}`);
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
        // --- CASTLE 3: MANGANATO (RAW HTML HEIST) ---
        else if (source === 'manganato') {
            const decodedUrl = atob(chapterId); // Decode the URL we saved in details.js
            const res = await fetch(`${PROXY_URL}${encodeURIComponent(decodedUrl)}`);
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const images = doc.querySelectorAll('.container-chapter-reader img');
            images.forEach(img => {
                const imgEl = document.createElement('img');
                // Use the image smuggler to bypass Manganato's hotlink blocker
                imgEl.src = `${IMAGE_SMUGGLER}${encodeURIComponent(img.src)}&output=webp`;
                imgEl.className = 'reader-page';
                imgEl.loading = 'lazy';
                imgEl.setAttribute('referrerpolicy', 'no-referrer');
                readerContainer.appendChild(imgEl);
            });
        }

        if (mangaId) setupNavigation();

    } catch (error) {
        console.error(error);
        readerContainer.innerHTML = `<div class="loading-state" style="color: #ef4444;">Failed to extract images from target Castle.</div>`;
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
            const feedRes = await fetch(`${COMICK_DIRECT}/comic/${comicSlug}/chapters?lang=en&limit=9999`);
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
        else if (source === 'manganato') {
            // To get navigation for Manganato, we extract the base manga URL from the chapter URL
            const decodedChapterUrl = atob(chapterId);
            const mangaUrl = decodedChapterUrl.substring(0, decodedChapterUrl.lastIndexOf('/'));
            
            const mangaRes = await fetch(`${PROXY_URL}${encodeURIComponent(mangaUrl)}`);
            const mangaHtml = await mangaRes.text();
            const parser = new DOMParser();
            const mangaDoc = parser.parseFromString(mangaHtml, 'text/html');
            
            const chapterNodes = mangaDoc.querySelectorAll('.row-content-chapter li a.chapter-name');
            allChapters = Array.from(chapterNodes).map(node => {
                return {
                    id: btoa(node.href), 
                    attributes: { chapter: node.textContent.replace('Chapter', '').trim() }
                };
            });
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
