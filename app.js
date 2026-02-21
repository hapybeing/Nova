// Configuration - Using Vercel Proxy
const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchResultsSection = document.getElementById('searchResultsSection');
const searchResultsGrid = document.getElementById('searchResultsGrid');
const searchHeading = document.getElementById('searchHeading');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const carousels = document.querySelectorAll('.carousel-section');
const navDiscover = document.getElementById('navDiscover');

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

// Search Functionality
searchInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            // Hide carousels, show search results area
            carousels.forEach(c => c.classList.add('hidden'));
            searchResultsSection.classList.remove('hidden');
            searchHeading.innerText = `Results for "${query}"`;
            searchResultsGrid.innerHTML = '<div class="loading-state">Searching database...</div>';
            
            // Blur input to hide mobile keyboard
            searchInput.blur();

            try {
                // Fetch search results ordered by relevance
                const url = `${API_BASE}/manga?title=${encodeURIComponent(query)}&limit=24&contentRating[]=safe&includes[]=cover_art&order[relevance]=desc`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('Search failed');
                
                const data = await response.json();
                renderMangaCards(data.data, searchResultsGrid);
            } catch (error) {
                searchResultsGrid.innerHTML = `<div class="loading-state" style="color: #ef4444;">Failed to find results.</div>`;
            }
        }
    }
});

// Clear Search Functionality
function resetSearch() {
    searchInput.value = '';
    searchResultsSection.classList.add('hidden');
    carousels.forEach(c => c.classList.remove('hidden'));
}

clearSearchBtn.addEventListener('click', resetSearch);
navDiscover.addEventListener('click', (e) => {
    e.preventDefault();
    resetSearch();
});

// Helper to extract the English title safely
function getTitle(attributes) {
    if (!attributes || !attributes.title) return 'Unknown Title';
    if (attributes.title.en) return attributes.title.en;
    const firstAvailableKey = Object.keys(attributes.title)[0];
    return attributes.title[firstAvailableKey] || 'Unknown Title';
}

// Helper to construct the actual cover image URL safely
function getCoverUrl(mangaId, relationships) {
    if (!relationships) return ''; 
    const coverRel = relationships.find(rel => rel.type === 'cover_art');
    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
        const fileName = coverRel.attributes.fileName;
        return `${UPLOADS_BASE}/covers/${mangaId}/${fileName}.256.jpg`;
    }
    return ''; // Blank fallback handled by CSS
}

// Render the cards into a specific container
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
