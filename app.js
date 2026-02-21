// Configuration - Using Vercel Proxy
const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';

// Flexible function to fetch specific categories
async function fetchCarouselData(containerId, queryParams) {
    const container = document.getElementById(containerId);
    try {
        // Fetch 15 items per carousel for a good swipe experience
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
    container.innerHTML = ''; // Clear loading state

    if (!mangaList || mangaList.length === 0) {
        container.innerHTML = `<div class="loading-state">No items found.</div>`;
        return;
    }

    mangaList.forEach(manga => {
        try {
            const title = getTitle(manga.attributes);
            const coverUrl = getCoverUrl(manga.id, manga.relationships);
            
            // Extract top genre
            let genre = 'Ongoing';
            if (manga.attributes?.tags) {
                const genreTag = manga.attributes.tags.find(tag => tag.attributes?.group === 'genre');
                if (genreTag && genreTag.attributes?.name?.en) {
                    genre = genreTag.attributes.name.en;
                }
            }

            const card = document.createElement('div');
            card.className = 'manga-card';
            
            // Note the referrerpolicy="no-referrer" to defeat hotlink protection
            card.innerHTML = `
                <div class="cover-wrapper">
                    <img src="${coverUrl}" alt="${title}" loading="lazy" referrerpolicy="no-referrer">
                </div>
                <h3 class="manga-title" title="${title}">${title}</h3>
                <p class="manga-tags">${genre}</p>
            `;

            container.appendChild(card);
        } catch (err) {
            // Silently skip corrupted data
        }
    });
}

// Initialize the Netflix-style rows
document.addEventListener('DOMContentLoaded', () => {
    // 1. Trending Manga (Japanese, ordered by follows)
    fetchCarouselData('trendingManga', 'originalLanguage[]=ja&order[followedCount]=desc');
    
    // 2. Must-Read Manhwa (Korean, ordered by rating for highest quality)
    fetchCarouselData('trendingManhwa', 'originalLanguage[]=ko&order[rating]=desc');
    
    // 3. Popular Manhua (Chinese, ordered by follows)
    fetchCarouselData('trendingManhua', 'originalLanguage[]=zh&order[followedCount]=desc');
});
