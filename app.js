// Configuration - Routing through Vercel Proxy to bypass network blocks
const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';

// DOM Elements
const mangaGrid = document.getElementById('mangaGrid');

// Fetch Trending/Recent Manga
async function fetchDiscoverManga() {
    try {
        // Fetching using our new Vercel proxy route
        const url = `${API_BASE}/manga?limit=12&contentRating[]=safe&includes[]=cover_art&order[followedCount]=desc`;
        const response = await fetch(url);
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.errors?.[0]?.detail || `HTTP Error ${response.status}`);
        }
        
        const data = await response.json();
        renderMangaCards(data.data);
    } catch (error) {
        console.error('Nova Error:', error);
        // Printing the EXACT error to the UI so you can debug without a console
        mangaGrid.innerHTML = `<div class="loading-state" style="color: #ef4444; font-weight: bold;">API Error: ${error.message}</div>`;
    }
}

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
    
    // Fallback SVG if no cover is found
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxMjEyMTIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2ExYTFhYSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPk5vIENvdmVyPC90ZXh0Pjwvc3ZnPg==';
}

// Render the grid with bulletproof null-checks
function renderMangaCards(mangaList) {
    mangaGrid.innerHTML = ''; // Clear loading state

    if (!mangaList || mangaList.length === 0) {
        mangaGrid.innerHTML = `<div class="loading-state">No manga found.</div>`;
        return;
    }

    mangaList.forEach(manga => {
        try {
            const title = getTitle(manga.attributes);
            const coverUrl = getCoverUrl(manga.id, manga.relationships);
            
            // Bulletproof status check
            const rawStatus = manga.attributes?.status || 'ongoing';
            const status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
            
            // Bulletproof tags check
            let tags = status;
            if (manga.attributes?.tags) {
                const genreTags = manga.attributes.tags
                    .filter(tag => tag.attributes?.group === 'genre')
                    .slice(0, 2)
                    .map(tag => tag.attributes?.name?.en)
                    .filter(Boolean); // removes any undefined elements
                
                if (genreTags.length > 0) {
                    tags = genreTags.join(' • ');
                }
            }

            // Create DOM Elements
            const card = document.createElement('div');
            card.className = 'manga-card';
            
            // ADDED referrerpolicy="no-referrer" TO THE IMG TAG TO BYPASS HOTLINK PROTECTION
            card.innerHTML = `
                <div class="cover-wrapper">
                    <img src="${coverUrl}" alt="${title} cover" loading="lazy" referrerpolicy="no-referrer">
                </div>
                <h3 class="manga-title" title="${title}">${title}</h3>
                <p class="manga-tags">${tags}</p>
            `;

            mangaGrid.appendChild(card);
        } catch (err) {
            // Silently skip corrupted manga entries so the rest of the grid still loads
        }
    });
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    fetchDiscoverManga();
});
