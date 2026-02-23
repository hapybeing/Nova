const API_BASE = '/proxy/api';
const UPLOADS_BASE = '/proxy/uploads';

const searchInput = document.getElementById('searchInput');
const searchDropdown = document.getElementById('searchDropdown');
const searchResultsSection = document.getElementById('searchResultsSection');
const searchResultsGrid = document.getElementById('searchResultsGrid');
const searchHeading = document.getElementById('searchHeading');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const carousels = document.querySelectorAll('.carousel-section');
const genreLinks = document.querySelectorAll('.genre-pill');

let searchTimeout; 

function getTitle(attributes) {
    if (attributes.title && attributes.title.en) return attributes.title.en;
    if (attributes.altTitles && attributes.altTitles.length > 0) {
        const enTitleObj = attributes.altTitles.find(t => t.en);
        if (enTitleObj) return enTitleObj.en;
    }
    return attributes.title ? (attributes.title[Object.keys(attributes.title)[0]] || 'Unknown Title') : 'Unknown Title';
}

function getCoverUrl(mangaId, relationships) {
    const coverRel = relationships.find(rel => rel.type === 'cover_art');
    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
        return `${UPLOADS_BASE}/covers/${mangaId}/${coverRel.attributes.fileName}.256.jpg`;
    }
    return ''; 
}

// GENRE CLICK: Fetches category data
genreLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
        e.preventDefault();
        const genreId = e.target.getAttribute('data-genre');
        const genreName = e.target.getAttribute('data-name');
        
        carousels.forEach(c => c.classList.add('hidden'));
        searchResultsSection.classList.remove('hidden');
        searchHeading.innerText = `Top ${genreName}`;
        searchResultsGrid.innerHTML = '<div class="loading-state">Syncing secure database...</div>';

        try {
            const url = `${API_BASE}/manga?includedTags[]=${genreId}&limit=35&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=en&hasAvailableChapters=true&includes[]=cover_art&order[followedCount]=desc`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("API Blocked");
            const data = await response.json();
            renderMangaCards(data.data, searchResultsGrid);
        } catch (error) {
            searchResultsGrid.innerHTML = `<div class="loading-state" style="color: #ef4444;">Connection failed. Retrying...</div>`;
        }
    });
});

// LIVE SEARCH: Kept broad so users can still look up official titles
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);
    
    if (!query) { searchDropdown.classList.add('hidden'); return; }

    searchDropdown.classList.remove('hidden');
    searchDropdown.innerHTML = '<div class="dropdown-msg">Searching secure database...</div>';

    searchTimeout = setTimeout(async () => {
        try {
            const url = `${API_BASE}/manga?title=${encodeURIComponent(query)}&limit=6&includes[]=cover_art&order[relevance]=desc`;
            const response = await fetch(url);
            const data = await response.json();
            
            searchDropdown.innerHTML = '';
            if (data.data.length === 0) {
                searchDropdown.innerHTML = '<div class="dropdown-msg">No titles found</div>';
                return;
            }

            data.data.forEach(manga => {
                const title = getTitle(manga.attributes);
                const coverUrl = getCoverUrl(manga.id, manga.relationships);
                const status = manga.attributes.status || 'Unknown';
                
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.innerHTML = `
                    <img src="${coverUrl}" alt="cover" class="dropdown-thumb" loading="lazy" referrerpolicy="no-referrer">
                    <div class="dropdown-info">
                        <span class="dropdown-title">${title}</span>
                        <span class="dropdown-meta" style="text-transform: capitalize;">${status}</span>
                    </div>
                `;
                // THE FIX: Pass the title instead of the ID from the search bar
                item.addEventListener('click', () => { window.location.href = `details.html?title=${encodeURIComponent(title)}`; });
                searchDropdown.appendChild(item);
            });
        } catch (error) {
            searchDropdown.innerHTML = '<div class="dropdown-msg" style="color:#ef4444;">Error finding titles</div>';
        }
    }, 500);
});

searchInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            searchDropdown.classList.add('hidden');
            carousels.forEach(c => c.classList.add('hidden'));
            searchResultsSection.classList.remove('hidden');
            searchHeading.innerText = `Results for "${query}"`;
            searchResultsGrid.innerHTML = '<div class="loading-state">Searching...</div>';
            searchInput.blur(); 

            try {
                const url = `${API_BASE}/manga?title=${encodeURIComponent(query)}&limit=30&contentRating[]=safe&contentRating[]=suggestive&includes[]=cover_art&order[relevance]=desc`;
                const response = await fetch(url);
                const data = await response.json();
                renderMangaCards(data.data, searchResultsGrid, false); // No strict filter on explicit searches
            } catch (error) {
                searchResultsGrid.innerHTML = `<div class="loading-state" style="color: #ef4444;">Search failed.</div>`;
            }
        }
    }
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.add('hidden');
    }
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchDropdown.classList.add('hidden');
    searchResultsSection.classList.add('hidden');
    carousels.forEach(c => c.classList.remove('hidden'));
});

// CAROUSELS
async function fetchCarouselData(containerId, queryParams) {
    const container = document.getElementById(containerId);
    try {
        const url = `${API_BASE}/manga?limit=35&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=en&hasAvailableChapters=true&includes[]=cover_art&${queryParams}`;
        const response = await fetch(url);
        const data = await response.json();
        renderMangaCards(data.data, container);
    } catch (error) {
        container.innerHTML = `<div class="loading-state" style="color: #ef4444;">Connection blocked.</div>`;
    }
}

// THE RENDER ENGINE WITH THE SMART FILTER
function renderMangaCards(mangaList, container, applyStrictFilter = true) {
    container.innerHTML = ''; 
    if (!mangaList || mangaList.length === 0) {
        container.innerHTML = `<div class="loading-state">No readable titles found in this category.</div>`;
        return;
    }
    
    let renderedCount = 0;

    mangaList.forEach(manga => {
        try {
            // THE SMART FILTER: Skips rendering highly-licensed/DMCA'd titles (Official English Links)
            if (applyStrictFilter && manga.attributes?.links?.engtl) {
                return; 
            }

            if (renderedCount >= 15 && container.classList.contains('carousel-container')) return;

            const title = getTitle(manga.attributes);
            const coverUrl = getCoverUrl(manga.id, manga.relationships);
            let genre = 'Ongoing';
            if (manga.attributes?.tags) {
                const genreTag = manga.attributes.tags.find(tag => tag.attributes?.group === 'genre' || tag.attributes?.group === 'theme');
                if (genreTag && genreTag.attributes?.name?.en) genre = genreTag.attributes.name.en;
            }

            const card = document.createElement('div');
            card.className = 'manga-card';
            
            // THE FIX: Pass the title instead of the ID from the homepage carousels
            card.onclick = () => { window.location.href = `details.html?title=${encodeURIComponent(title)}`; };
            
            card.innerHTML = `
                <div class="cover-wrapper">
                    <img src="${coverUrl}" alt="cover" loading="lazy" referrerpolicy="no-referrer">
                </div>
                <h3 class="manga-title" title="${title}">${title}</h3>
                <p class="manga-tags">${genre}</p>
            `;
            container.appendChild(card);
            renderedCount++;
        } catch (err) {}
    });

    if (renderedCount === 0) {
        container.innerHTML = `<div class="loading-state">All top titles in this category are officially licensed and unavailable.</div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchCarouselData('trendingManga', 'originalLanguage[]=ja&order[followedCount]=desc');
    setTimeout(() => fetchCarouselData('trendingManhwa', 'originalLanguage[]=ko&order[rating]=desc'), 1000);
    setTimeout(() => fetchCarouselData('trendingManhua', 'originalLanguage[]=zh&order[followedCount]=desc'), 2000);
});
