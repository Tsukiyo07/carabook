// App State
let currentBook = null;
let currentInsights = null;
let playingBookContext = null; // To track which book is currently playing in background

// UI Elements
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const libraryResults = document.getElementById('libraryResults');
const libraryEmptyState = document.getElementById('libraryEmptyState');

const bookModal = document.getElementById('bookModal');
const readerModal = document.getElementById('readerModal');
const stickyPlayer = document.getElementById('stickyPlayer');
const bookmarkBtn = document.getElementById('bookmarkBtn');
const generateBtn = document.getElementById('generateBtn');
const resumeBtn = document.getElementById('resumeBtn');
const regenerateBtn = document.getElementById('regenerateBtn');
const loadingStatus = document.getElementById('loadingStatus');

// Init
window.addEventListener('DOMContentLoaded', () => {
    loadHomeData();
    renderLibrary();
    loadHistoryCarousel();
});

// --- Tab Navigation ---
function switchTab(targetId) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${targetId}`).classList.add('active');
    
    navItems.forEach(n => {
        n.classList.remove('active');
        if (n.dataset.target === targetId) n.classList.add('active');
    });
    
    if (targetId === 'library') {
        renderLibrary();
    }
    if (targetId === 'home') {
        loadHistoryCarousel();
    }
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(item.dataset.target);
    });
});

// --- Home Data & History ---
async function loadHomeData() {
    fetchCarouselData('steve jobs', 'featuredBook', true);
    fetchCarouselData('bestseller', 'trendingBooks');
    fetchCarouselData('psychology', 'selfHelpBooks');
}

function loadHistoryCarousel() {
    const history = JSON.parse(localStorage.getItem('carabook_history') || '[]');
    const container = document.getElementById('continueListeningCarousel');
    const section = document.getElementById('continueListeningSection');
    
    if (!history || history.length === 0) {
        if(section) section.classList.add('hidden');
        return;
    }
    
    if(section) section.classList.remove('hidden');
    if(!container) return;
    container.innerHTML = '';
    
    history.forEach(item => {
        const card = document.createElement('div');
        card.className = 'book-card-mini';
        card.innerHTML = `
            <img src="${item.coverUrl}" loading="lazy">
            <h4>${item.title}</h4>
            <p>Reprendre - Chap. ${item.playingIndex + 1}</p>
        `;
        card.onclick = async () => {
            const fakeItem = { title: item.title, key: item.bookKey };
            await openBookDetails(fakeItem, item.coverUrl, item.authors, "");
            
            const cachedData = localStorage.getItem('carabook_cache_' + item.bookKey);
            if (cachedData) {
                const insights = JSON.parse(cachedData);
                openReader(currentBook, insights);
                playTrack(item.playingIndex, item.chunkIndex, item.currentTime);
            }
        };
        container.appendChild(card);
    });
}

async function fetchCarouselData(query, containerId, isFeatured = false) {
    try {
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${isFeatured ? 1 : 10}&language=fre`);
        const data = await res.json();
        const container = document.getElementById(containerId);
        if(!container) return;
        container.innerHTML = '';
        
        data.docs.forEach(item => {
            if (!item.title) return;
            const coverUrl = item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : 'https://placehold.co/300x450/1a1a1a/ffffff?text=Pas+de+couverture';
            const authors = item.author_name ? item.author_name.join(', ') : 'Auteur inconnu';
            
            if (isFeatured) {
                container.innerHTML = `
                    <img src="${coverUrl}" alt="Cover">
                    <div class="featured-info">
                        <h3>${item.title}</h3>
                        <p>${authors}</p>
                    </div>
                `;
                container.onclick = () => openBookDetails(item, coverUrl, authors);
            } else {
                const card = document.createElement('div');
                card.className = 'book-card-mini';
                card.innerHTML = `
                    <img src="${coverUrl}" loading="lazy">
                    <h4>${item.title}</h4>
                    <p>${authors}</p>
                `;
                card.onclick = () => openBookDetails(item, coverUrl, authors);
                container.appendChild(card);
            }
        });
    } catch (e) {
        console.error(e);
    }
}

// --- Search ---
searchBtn.addEventListener('click', () => doSearch(searchInput.value));
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(searchInput.value); });

async function doSearch(query) {
    if (!query) return;
    searchResults.innerHTML = '<div class="spinner" style="margin: 3rem auto;"></div>';
    
    try {
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=15`);
        const data = await res.json();
        
        searchResults.innerHTML = '';
        if (data.docs.length === 0) {
            searchResults.innerHTML = '<div class="empty-state"><i class="fa-solid fa-compass"></i><p>Aucun résultat trouvé.</p></div>';
            return;
        }

        data.docs.forEach(item => {
            if (!item.title) return;
            const coverUrl = item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : 'https://placehold.co/150x220/1a1a1a/ffffff?text=Pas+de+couverture';
            const authors = item.author_name ? item.author_name.join(', ') : 'Inconnu';
            
            const card = document.createElement('div');
            card.className = 'book-card-mini';
            card.innerHTML = `
                <img src="${coverUrl}" loading="lazy">
                <h4>${item.title}</h4>
                <p>${authors}</p>
            `;
            card.onclick = () => openBookDetails(item, coverUrl, authors);
            searchResults.appendChild(card);
        });
    } catch (e) {}
}

// --- Bookmark / Library Logic ---
function getLibrary() {
    return JSON.parse(localStorage.getItem('carabook_library') || '[]');
}
function toggleBookmark(book) {
    let library = getLibrary();
    const exists = library.find(b => b.title === book.title);
    if (exists) {
        library = library.filter(b => b.title !== book.title);
        bookmarkBtn.style.color = "var(--text-secondary)";
    } else {
        library.push(book);
        bookmarkBtn.style.color = "var(--nw-white)";
    }
    localStorage.setItem('carabook_library', JSON.stringify(library));
}

function checkBookmarkState(bookTitle) {
    const library = getLibrary();
    if (library.find(b => b.title === bookTitle)) {
        bookmarkBtn.style.color = "var(--nw-white)";
    } else {
        bookmarkBtn.style.color = "var(--text-secondary)";
    }
}

function renderLibrary() {
    const library = getLibrary();
    if (library.length === 0) {
        libraryEmptyState.style.display = 'flex';
        Array.from(libraryResults.children).forEach(c => {
            if (c !== libraryEmptyState) c.remove();
        });
        return;
    }
    
    libraryEmptyState.style.display = 'none';
    libraryResults.innerHTML = '';
    
    library.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card-mini';
        card.innerHTML = `
            <img src="${book.coverUrl}" loading="lazy">
            <h4>${book.title}</h4>
            <p>${book.authors}</p>
        `;
        const fakeItem = { title: book.title, key: book.key };
        card.onclick = () => openBookDetails(fakeItem, book.coverUrl, book.authors, book.description);
        libraryResults.appendChild(card);
    });
}

// --- Book Details & Cache Logic ---
async function openBookDetails(item, coverUrl, authors, preloadedDesc = null) {
    currentBook = { 
        title: item.title, 
        authors: authors, 
        description: preloadedDesc || "", 
        coverUrl: coverUrl,
        key: item.key
    };
    
    document.getElementById('modalCover').src = coverUrl;
    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalAuthor').textContent = authors;
    
    const pitchText = document.getElementById('modalPitch');
    const pitchLoading = document.getElementById('pitchLoading');
    
    pitchText.textContent = "";
    pitchLoading.classList.remove('hidden');
    generateBtn.classList.add('hidden');
    if(resumeBtn) resumeBtn.classList.add('hidden');
    if(regenerateBtn) regenerateBtn.classList.add('hidden');
    loadingStatus.classList.add('hidden');
    
    checkBookmarkState(currentBook.title);
    bookModal.classList.remove('hidden');

    try {
        if (!preloadedDesc && item.key) {
            const res = await fetch(`https://openlibrary.org${item.key}.json`);
            if (res.ok) {
                const data = await res.json();
                currentBook.description = typeof data.description === 'string' ? data.description : (data.description?.value || "");
            }
        }
        
        pitchLoading.classList.add('hidden');
        pitchText.textContent = currentBook.description || "Aucun résumé trouvé sur internet pour ce livre. Vous pouvez tout de même générer l'audiobook complet.";
        
        // CACHE
        const cachedData = localStorage.getItem('carabook_cache_' + currentBook.key);
        if (cachedData) {
            generateBtn.classList.add('hidden');
            if(resumeBtn) resumeBtn.classList.remove('hidden');
            if(regenerateBtn) regenerateBtn.classList.remove('hidden');
        } else {
            generateBtn.classList.remove('hidden');
            if(resumeBtn) resumeBtn.classList.add('hidden');
            if(regenerateBtn) regenerateBtn.classList.add('hidden');
        }
        
    } catch(e) {
        pitchLoading.classList.add('hidden');
        pitchText.textContent = "Erreur de chargement. Vous pouvez tout de même générer l'audiobook complet.";
        generateBtn.classList.remove('hidden');
    }
}

document.getElementById('closeBookModal').addEventListener('click', () => {
    bookModal.classList.add('hidden');
});

bookmarkBtn.addEventListener('click', () => {
    if (currentBook) toggleBookmark(currentBook);
});

if(resumeBtn) {
    resumeBtn.addEventListener('click', () => {
        const cachedData = localStorage.getItem('carabook_cache_' + currentBook.key);
        if (cachedData) {
            const insights = JSON.parse(cachedData);
            openReader(currentBook, insights);
        }
    });
}

if(regenerateBtn) {
    regenerateBtn.addEventListener('click', () => {
        localStorage.removeItem('carabook_cache_' + currentBook.key);
        generateBtn.click();
    });
}

// --- Generation ---
generateBtn.addEventListener('click', async () => {
    generateBtn.classList.add('hidden');
    if(resumeBtn) resumeBtn.classList.add('hidden');
    if(regenerateBtn) regenerateBtn.classList.add('hidden');
    loadingStatus.classList.remove('hidden');
    document.getElementById('statusText').textContent = "L'IA rédige un podcast détaillé...";

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                bookTitle: currentBook.title, 
                bookAuthors: currentBook.authors, 
                bookDesc: currentBook.description 
            })
        });

        if (!response.ok) throw new Error("Erreur de génération serveur");
        const data = await response.json();
        
        localStorage.setItem('carabook_cache_' + currentBook.key, JSON.stringify(data.insights));
        
        loadingStatus.classList.add('hidden');
        openReader(currentBook, data.insights);

    } catch (e) {
        alert("Erreur: " + e.message);
        loadingStatus.classList.add('hidden');
        generateBtn.classList.remove('hidden');
    }
});


// ==========================================
// READER & GOOGLE TTS AUDIO SYSTEM
// ==========================================
function openReader(book, insights) {
    bookModal.classList.add('hidden');
    readerModal.classList.remove('hidden');
    
    document.getElementById('readerBookTitle').textContent = book.title;
    
    // Check old history progress
    const history = JSON.parse(localStorage.getItem('carabook_history') || '[]');
    const existingIndex = history.findIndex(h => h.bookKey === book.key);
    let startIdx = 0;
    
    if (existingIndex !== -1) {
        startIdx = history[existingIndex].playingIndex;
    }
    
    playingBookContext = { book, insights, playingIndex: -1 };
    buildPlaylistUI(startIdx, insights);
}

function buildPlaylistUI(startIdx, insights) {
    const container = document.getElementById('playlistContainer');
    container.innerHTML = '';

    insights.forEach((insight, idx) => {
        const div = document.createElement('div');
        div.className = `track-item ${idx < startIdx ? 'listened' : ''}`;
        div.id = `track-${idx}`;
        div.innerHTML = `
            <div class="track-number">${idx + 1}</div>
            <div class="track-info">
                <h4>${insight.title}</h4>
                <p>Chapitre</p>
            </div>
            <div class="track-status">
                <i class="fa-solid ${idx < startIdx ? 'fa-check' : 'fa-play'}"></i>
            </div>
        `;
        div.addEventListener('click', () => {
            playTrack(idx);
        });
        container.appendChild(div);
    });
    updateGlobalProgress();
}

function updateGlobalProgress() {
    if (!playingBookContext) return;
    const history = JSON.parse(localStorage.getItem('carabook_history') || '[]');
    const existingIndex = history.findIndex(h => h.bookKey === playingBookContext.book.key);
    let listenedCount = 0;
    if (existingIndex !== -1) {
        listenedCount = history[existingIndex].playingIndex;
    }
    
    const fill = document.getElementById('globalProgressFill');
    const text = document.getElementById('progressText');
    
    if(text) text.textContent = `${listenedCount}/${playingBookContext.insights.length} lu`;
    
    const percentage = (listenedCount / playingBookContext.insights.length) * 100;
    if(fill) fill.style.width = `${percentage}%`;
}


// --- Audio System ---
const globalAudio = document.getElementById('globalAudioElement');
const playPauseBtn = document.getElementById('playerPlayPauseBtn');
const visualizer = document.getElementById('audioVisualizer');

let currentPlaylist = [];
let currentPlaylistIndex = 0;

async function playTrack(index, startChunk = 0, resumeTime = 0) {
    if (!playingBookContext) return;
    if (index >= playingBookContext.insights.length) return; 
    
    const insight = playingBookContext.insights[index];
    
    document.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
    const trackDiv = document.getElementById(`track-${index}`);
    if (trackDiv) {
        trackDiv.classList.add('active');
        trackDiv.classList.remove('listened');
        trackDiv.querySelector('.track-status i').className = 'fa-solid fa-play';
    }
    
    document.getElementById('playerInsightTitle').textContent = insight.title;
    document.getElementById('playerBookTitle').textContent = playingBookContext.book.title;
    stickyPlayer.classList.remove('hidden');
    playPauseBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    playingBookContext.playingIndex = index;
    
    if (!globalAudio.paused) globalAudio.pause();
    globalAudio.src = '';

    try {
        if (!insight.audioUrls) {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: insight.text })
            });
            if (!res.ok) throw new Error("Erreur de synthèse vocale.");
            const data = await res.json();
            insight.audioUrls = data.urls;
            
            localStorage.setItem('carabook_cache_' + playingBookContext.book.key, JSON.stringify(playingBookContext.insights));
        }

        currentPlaylist = insight.audioUrls;
        currentPlaylistIndex = startChunk;
        
        playCurrentChunk(resumeTime);
    } catch (e) {
        alert(e.message);
        playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

function playCurrentChunk(resumeTime = 0) {
    if (currentPlaylistIndex >= currentPlaylist.length) {
        // End of track, go next
        visualizer.classList.add('hidden');
        if (playingBookContext) {
            
            // Mark current as listened in UI
            const trackDiv = document.getElementById(`track-${playingBookContext.playingIndex}`);
            if (trackDiv) {
                trackDiv.classList.add('listened');
                trackDiv.querySelector('.track-status i').className = 'fa-solid fa-check';
            }
            
            if (playingBookContext.playingIndex + 1 < playingBookContext.insights.length) {
                playTrack(playingBookContext.playingIndex + 1);
            } else {
                playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        }
        return;
    }
    
    globalAudio.src = currentPlaylist[currentPlaylistIndex].url;
    
    if (resumeTime > 0) {
        globalAudio.onloadedmetadata = () => {
            globalAudio.currentTime = Math.max(0, resumeTime - 3);
            globalAudio.play();
            globalAudio.onloadedmetadata = null; // Clean up
        };
    } else {
        globalAudio.play();
    }
}

// --- History Tracker ---
function saveHistory() {
    if (!playingBookContext || !playingBookContext.book) return;
    const history = JSON.parse(localStorage.getItem('carabook_history') || '[]');
    
    const existingIndex = history.findIndex(h => h.bookKey === playingBookContext.book.key);
    const state = {
        bookKey: playingBookContext.book.key,
        title: playingBookContext.book.title,
        coverUrl: playingBookContext.book.coverUrl,
        authors: playingBookContext.book.authors,
        playingIndex: playingBookContext.playingIndex,
        chunkIndex: currentPlaylistIndex,
        currentTime: globalAudio.currentTime,
        timestamp: Date.now()
    };

    if (existingIndex !== -1) {
        history[existingIndex] = state;
    } else {
        history.push(state);
    }
    
    history.sort((a,b) => b.timestamp - a.timestamp);
    if(history.length > 10) history.pop();
    
    localStorage.setItem('carabook_history', JSON.stringify(history));
    updateGlobalProgress();
}

let lastSaveTime = 0;
globalAudio.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastSaveTime > 3000) { // Save every 3 seconds
        saveHistory();
        lastSaveTime = now;
    }
});

globalAudio.addEventListener('ended', () => {
    currentPlaylistIndex++;
    playCurrentChunk();
});

globalAudio.addEventListener('play', () => {
    playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    visualizer.classList.remove('hidden');
});

globalAudio.addEventListener('pause', () => {
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    visualizer.classList.add('hidden');
    saveHistory(); // Save on pause
});

playPauseBtn.addEventListener('click', () => {
    if (globalAudio.paused) globalAudio.play();
    else globalAudio.pause();
});

// Modals closes
document.getElementById('closeReaderBtn').addEventListener('click', () => {
    readerModal.classList.add('hidden');
});
document.getElementById('globalPlayerInfo').addEventListener('click', () => {
    if (playingBookContext) {
        readerModal.classList.remove('hidden');
    }
});
