const API_BASE = '/proxy/api';

const urlParams = new URLSearchParams(window.location.search);
const chapterId = urlParams.get('chapterId');
const mangaId = urlParams.get('id');

const readerContainer = document.getElementById('readerContainer');
const readerChapterTitle = document.getElementById('readerChapterTitle');
const backBtn = document.getElementById('backBtn');

// Navigation Elements
const readerControls = document.getElementById('readerControls');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const chapterSelect = document.getElementById('chapterSelect');

let allChapters = [];
let currentIndex = -1;

backBtn.addEventListener('click', () => {
    // Go back to the specific details page
    if (mangaId) {
        window.location.href = `details.html?id=${mangaId}`;
    } else {
        window.history.back();
    }
});

async function loadReader() {
    if (!chapterId) {
        readerContainer.innerHTML = `<div class="loading-state">Invalid Chapter.</div>`;
        return;
    }

    try {
        // 1. Fetch Images (Priority 1)
        const response = await fetch(`${API_BASE}/at-home/server/${chapterId}`);
        if (!response.ok) throw new Error('Failed to connect to image server');
        const data = await response.json();
        
        readerContainer.innerHTML = '';
        data.chapter.data.forEach(img => {
            const imgEl = document.createElement('img');
            imgEl.src = `${data.baseUrl}/data/${data.chapter.hash}/${img}`;
            imgEl.className = 'reader-page';
            imgEl.loading = 'lazy';
            imgEl.setAttribute('referrerpolicy', 'no-referrer');
            readerContainer.appendChild(imgEl);
        });

        // 2. Fetch Navigation Data (Priority 2)
        if (mangaId) {
            setupNavigation();
        } else {
            // Fallback title if we don't have mangaId
            readerChapterTitle.innerText = "Reading Chapter";
        }

    } catch (error) {
        readerContainer.innerHTML = `<div class="loading-state" style="color: #ef4444;">Failed to load images.</div>`;
    }
}

async function setupNavigation() {
    try {
        const feedRes = await fetch(`${API_BASE}/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=500`);
        const feedData = await feedRes.json();
        
        // Filter exactly like details page
        const seen = new Set();
        allChapters = feedData.data.filter(c => {
            if (c.attributes.externalUrl !== null) return false;
            const chapNum = c.attributes.chapter;
            if (chapNum && seen.has(chapNum)) return false;
            if (chapNum) seen.add(chapNum);
            return true;
        });

        if (allChapters.length > 0) {
            readerControls.style.display = 'flex';
            
            // Find current chapter index in the array
            currentIndex = allChapters.findIndex(c => c.id === chapterId);
            
            // Set Top Title
            const currentChap = allChapters[currentIndex];
            if (currentChap) {
                readerChapterTitle.innerText = currentChap.attributes.chapter ? `Chapter ${currentChap.attributes.chapter}` : 'Oneshot';
            }

            // Populate Dropdown
            chapterSelect.innerHTML = allChapters.map((c, index) => {
                const num = c.attributes.chapter ? `Chapter ${c.attributes.chapter}` : 'Oneshot';
                return `<option value="${c.id}" ${index === currentIndex ? 'selected' : ''}>${num}</option>`;
            }).join('');

            // In our array, index 0 is the NEWEST chapter. 
            // So "Next Chapter" means going BACKWARDS in the array (index - 1)
            // "Previous Chapter" means going FORWARDS in the array (index + 1)
            
            if (currentIndex > 0) {
                nextBtn.disabled = false;
                nextBtn.onclick = () => window.location.href = `reader.html?id=${mangaId}&chapterId=${allChapters[currentIndex - 1].id}`;
            }
            if (currentIndex < allChapters.length - 1) {
                prevBtn.disabled = false;
                prevBtn.onclick = () => window.location.href = `reader.html?id=${mangaId}&chapterId=${allChapters[currentIndex + 1].id}`;
            }

            // Handle Dropdown Change
            chapterSelect.addEventListener('change', (e) => {
                window.location.href = `reader.html?id=${mangaId}&chapterId=${e.target.value}`;
            });
        }
    } catch (error) {
        console.error("Navigation failed to load", error);
    }
}

document.addEventListener('DOMContentLoaded', loadReader);
