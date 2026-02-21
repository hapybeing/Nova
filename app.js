// Configuration - Using Vercel Proxy
const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchDropdown = document.getElementById('searchDropdown');
const searchResultsSection = document.getElementById('searchResultsSection');
const searchResultsGrid = document.getElementById('searchResultsGrid');
const searchHeading = document.getElementById('searchHeading');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const carousels = document.querySelectorAll('.carousel-section');
const navDiscover = document.getElementById('navDiscover');

let searchTimeout; // Used for Debouncing

// LIVE SEARCH AUTOCOMPLETE
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Clear previous timeout so we don't spam the API
    clearTimeout(searchTimeout);
    
    if (!query) {
        searchDropdown.classList.add('hidden');
        return;
    }

    // Show loading state in dropdown
    searchDropdown.classList.remove('hidden');
    searchDropdown.innerHTML = '<div class="dropdown-msg">Searching...</div>';

    // Wait 500ms after user stops typing to fetch
    searchTimeout = setTimeout(async () => {
        try {
            // Fetch top 5 results for the dropdown
            const url = `${API_BASE}/manga?title=${encodeURIComponent(query)}&limit=5&contentRating[]=safe&includes[]=cover_art&order[relevance]=desc`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Search failed');
            
            const data = await response.json();
            renderLiveSearchDropdown(data.data);
        } catch (error) {
            searchDropdown.innerHTML = '<div class="dropdown-msg" style="color:#ef4444;">Error finding titles</div>';
        }
    }, 500);
});

// Render the small dropdown list
function renderLiveSearchDropdown(mangaList) {
    searchDropdown.innerHTML = '';
    
    if (!mangaList || mangaList.length === 0) {
        searchDropdown.innerHTML = '<div class="dropdown-msg">No titles found</div>';
        return;
    }

    mangaList.forEach(manga => {
        const title = getTitle(manga.attributes);
        const coverUrl = getCoverUrl(manga.id, manga.relationships);
        const status = manga.attributes.status ? manga.attributes.status.charAt(0).toUpperCase() + manga.attributes.status.slice(1) : 'Unknown';
        const year = manga.attributes.year || status;
        
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        
        // Notice we include referrerpolicy="no-referrer" here too!
        item.innerHTML = `
            <img src="${coverUrl}" alt="${title}" class="dropdown-thumb" loading="lazy" referrerpolicy="no-referrer">
            <div class="dropdown-info">
                <span class="dropdown-title">${title}</span>
                <span class="dropdown-meta">${year}</span>
            </div>
        `;
        
        // When a user taps a dropdown item, run the full search for it
        item.addEventListener('click', () => {
            searchInput.value = title;
            searchDropdown.classList.add('hidden');
            executeFullSearch(title);
        });

        searchDropdown.appendChild(item);
    });
}

// FULL GRID SEARCH
async function executeFullSearch(query) {
    carousels.forEach(c => c.classList.add('hidden'));
    searchResultsSection.classList.remove('hidden');
    searchHeading.innerText = `Results for "${query}"`;
    searchResultsGrid.innerHTML = '<div class="loading-state">Searching database...</div>';
    searchInput.blur(); // Hide tablet keyboard

    try {
        const url = `${API_BASE}/manga?title=${encodeURIComponent(query)}&limit=24&contentRating[]=safe&includes[]=cover_art&order[relevance]=desc`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Search failed');
        
        const data = await response.json();
        renderMangaCards(data.data, searchResultsGrid);
    } catch (error) {
        searchResultsGrid.innerHTML = `<div class="loading-state" style="color: #ef4444;">Failed to find results.</div>`;
    }
}

// Listen for the "Enter" key
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            searchDropdown.classList.add('hidden');
            executeFullSearch(query);
        }
    }
});

// Hide dropdown if tapping anywhere else on the screen
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.add('hidden');
    }
});

// CLEAR SEARCH
function resetSearch() {
    searchInput.value = '';
    searchDropdown.classList.add('hidden');
    searchResultsSection.classList.add('hidden');
    carousels.forEach(c => c.classList.remove('hidden'));
}

clearSearchBtn.addEventListener('click', resetSearch);
navDiscover.addEventListener('click', (e) => { e.preventDefault(); resetSearch(); });

// Flexible function to fetch specific categories
async function fetchCarouselData(containerId, queryParams) {
    const container = document.getElementById(containerId);
    try {
        const url = `${API_BASE}/manga?limit=15&contentRating[]=safe&includes[]=cover_art&${queryParams}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const data = await response.json();
        renderMangaCards(data.data, container);
    } catch (error) {
        console.error('Nova Error:', error);
        container.innerHTML = `<div class="loading-state" style="color: #ef4444;">Failed to load.</div>`;
    }
}

// Helper functions (Title & Cover)
function getTitle(attributes) {
    if (!attributes || !attributes.title) return 'Unknown Title';
    if (attributes.title.en) return attributes.title.en;
    const firstAvailableKey = Object.keys(attributes.title)[0];
    return attributes.title[firstAvailableKey] || 'Unknown Title';
}

function getCoverUrl(mangaId, relationships) {
    if (!relationships) return ''; 
    const coverRel = relationships.find(rel => rel.type === 'cover_art');
    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
        const fileName = coverRel.attributes.fileName;
        return `${UPLOADS_BASE}/covers/${mangaId}/${fileName}.256.jpg`;
    }
    return ''; 
}

// Render Grid/Carousel Cards
function renderMangaCards(mangaList, container) {
    container.innerHTML = ''; 
    if (!mangaList || mangaList.length === 0) {
        container.innerHTML = `<div class="loading-state">No items found.</div>`;
        return;
    }
    mangaList.forEach(manga => {
        try {
            const title = getTitle(manga.attributes);
            const coverUrl = getCoverUrl(manga.id, manga.relationships);
            
            let genre = 'Ongoing';
            if (manga.attributes?.tags) {
                const genreTag = manga.attributes.tags.find(tag => tag.attributes?.group === 'genre');
                if (genreTag && genreTag.attributes?.name?.en) {
                    genre = genreTag.attributes.name.en;
                }
            }

            const card = document.createElement('div');
            card.className = 'manga-card';
            
            card.innerHTML = `
                <div class="cover-wrapper">
                    <img src="${coverUrl}" alt="${title}" loading="lazy" referrerpolicy="no-referrer">
                </div>
                <h3 class="manga-title" title="${title}">${title}</h3>
                <p class="manga-tags">${genre}</p>
            `;
            container.appendChild(card);
        } catch (err) {}
    });
}

// Initialize the Application
document.addEventListener('DOMContentLoaded', () => {
    fetchCarouselData('trendingManga', 'originalLanguage[]=ja&order[followedCount]=desc');
    fetchCarouselData('trendingManhwa', 'originalLanguage[]=ko&order[rating]=desc');
    fetchCarouselData('trendingManhua', 'originalLanguage[]=zh&order[followedCount]=desc');
});
