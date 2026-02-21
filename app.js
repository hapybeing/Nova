// Configuration
const API_BASE = 'https://api.mangadex.org';
const UPLOADS_BASE = 'https://uploads.mangadex.org';

// DOM Elements
const mangaGrid = document.getElementById('mangaGrid');

// Fetch Trending/Recent Manga
async function fetchDiscoverManga() {
    try {
        // Fetching 12 safe manga titles and including the cover_art relationship data
        const response = await fetch(`${API_BASE}/manga?limit=12&contentRating[]=safe&includes[]=cover_art&order[rating]=desc`);
        
        if (!response.ok) throw new Error('Failed to fetch from MangaDex');
        
        const data = await response.json();
        renderMangaCards(data.data);
    } catch (error) {
        console.error('Nova Error:', error);
        mangaGrid.innerHTML = `<div class="loading-state" style="color: #ef4444;">Failed to sync with network. Please try again.</div>`;
    }
}

// Helper to extract the English title (or fallback to any available title)
function getTitle(attributes) {
    if (attributes.title.en) return attributes.title.en;
    const firstAvailableKey = Object.keys(attributes.title)[0];
    return attributes.title[firstAvailableKey] || 'Unknown Title';
}

// Helper to construct the actual cover image URL
function getCoverUrl(mangaId, relationships) {
    const coverRel = relationships.find(rel => rel.type === 'cover_art');
    if (coverRel && coverRel.attributes) {
        const fileName = coverRel.attributes.fileName;
        // Using .256.jpg for highly optimized mobile performance
        return `${UPLOADS_BASE}/covers/${mangaId}/${fileName}.256.jpg`;
    }
    // Fallback if no cover is found
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxMjEyMTIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2ExYTFhYSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPk5vIENvdmVyPC90ZXh0Pjwvc3ZnPg==';
}

// Render the grid
function renderMangaCards(mangaList) {
    // Clear loading state
    mangaGrid.innerHTML = '';

    mangaList.forEach(manga => {
        const title = getTitle(manga.attributes);
        const coverUrl = getCoverUrl(manga.id, manga.relationships);
        const status = manga.attributes.status.charAt(0).toUpperCase() + manga.attributes.status.slice(1);
        
        // Extract top 2 tags for clean UI
        const tags = manga.attributes.tags
            .filter(tag => tag.attributes.group === 'genre')
            .slice(0, 2)
            .map(tag => tag.attributes.name.en)
            .join(' • ');

        // Create DOM Elements
        const card = document.createElement('div');
        card.className = 'manga-card';
        card.innerHTML = `
            <div class="cover-wrapper">
                <img src="${coverUrl}" alt="${title} cover" loading="lazy">
            </div>
            <h3 class="manga-title" title="${title}">${title}</h3>
            <p class="manga-tags">${tags || status}</p>
        `;

        mangaGrid.appendChild(card);
    });
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    fetchDiscoverManga();
});
