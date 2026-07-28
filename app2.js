// App State
let currentBook = null;
let currentInsights = null;

// UI Elements
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const bookModal = document.getElementById('bookModal');
const readerModal = document.getElementById('readerModal');

// Init
window.addEventListener('DOMContentLoaded', () => {
    loadHomeData();
});

// --- Tab Navigation ---
function switchTab(targetId) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${targetId}`).classList.add('active');
    
    navItems.forEach(n => {
        n.classList.remove('active');
        if (n.dataset.target === targetId) n.classList.add('active');
    });
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(item.dataset.target);
    });
});

// --- Home Data ---
async function loadHomeData() {
    fetchCarouselData('steve jobs', 'featuredBook', true);
    fetchCarouselData('bestseller', 'trendingBooks');
    fetchCarouselData('psychology', 'selfHelpBooks');
}

async function fetchCarouselData(query, containerId, isFeatured = false) {
    try {
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${isFeatured ? 1 : 10}&language=fre`);
        const data = await res.json();
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        data.docs.forEach(item => {
            if (!item.title) return;
            const coverUrl = item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : 'https://via.placeholder.com/300x450?text=Pas+de+couverture';
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
            searchResults.innerHTML = '<div class="empty-state"><p>Aucun résultat trouvé.</p></div>';
            return;
        }

        data.docs.forEach(item => {
            if (!item.title) return;
            const coverUrl = item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : 'https://via.placeholder.com/150x220?text=No+Cover';
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

// --- Book Details & Pitch Logic ---
async function openBookDetails(item, coverUrl, authors) {
    document.getElementById('modalCover').src = coverUrl;
    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalAuthor').textContent = authors;
    
    const pitchText = document.getElementById('modalPitch');
    const pitchLoading = document.getElementById('pitchLoading');
    const generateBtn = document.getElementById('generateBtn');
    
    pitchText.textContent = "";
    pitchLoading.classList.remove('hidden');
    generateBtn.classList.add('hidden'); // Hide btn until pitch is ready
    
    currentBook = { title: item.title, authors: authors, description: "" };
    bookModal.classList.remove('hidden');

    try {
        // Fetch raw description from internet (OpenLibrary)
        if (item.key) {
            const res = await fetch(`https://openlibrary.org${item.key}.json`);
            if (res.ok) {
                const data = await res.json();
                currentBook.description = typeof data.description === 'string' ? data.description : (data.description?.value || "");
            }
        }
        
        pitchLoading.classList.add('hidden');
        pitchText.textContent = currentBook.description || "Aucun résumé trouvé sur internet pour ce livre. Vous pouvez tout de même générer l'audiobook complet.";
        generateBtn.classList.remove('hidden');
        
    } catch(e) {
        pitchLoading.classList.add('hidden');
        pitchText.textContent = "Erreur de chargement du résumé. Vous pouvez tout de même générer l'audiobook complet.";
        generateBtn.classList.remove('hidden');
    }
}

document.getElementById('closeBookModal').addEventListener('click', () => {
    bookModal.classList.add('hidden');
});

// --- Playlist Generation (Full Audio) ---
document.getElementById('generateBtn').addEventListener('click', async () => {
    document.getElementById('generateBtn').classList.add('hidden');
    document.getElementById('loadingStatus').classList.remove('hidden');

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                type: 'full', 
                bookTitle: currentBook.title, 
                bookAuthors: currentBook.authors, 
                bookDesc: currentBook.description 
            })
        });

        if (!response.ok) throw new Error("Erreur de génération serveur");
        
        const insightsData = await response.json();
        currentInsights = insightsData.insights;
        
        buildPlaylist(currentInsights, currentBook);
        
        document.getElementById('loadingStatus').classList.add('hidden');
        document.getElementById('generateBtn').classList.remove('hidden');
        
        bookModal.classList.add('hidden');
        readerModal.classList.remove('hidden');
        
        // Auto-play the first track that isn't finished!
        const savedProgress = loadProgress(currentBook.title);
        const nextTrack = currentInsights.findIndex(i => !savedProgress.includes(i.title));
        if (nextTrack !== -1) {
            playTrack(nextTrack);
        } else {
            playTrack(0); // Play from beginning if all finished
        }
        
    } catch (e) {
        alert("Erreur: " + e.message);
        document.getElementById('loadingStatus').classList.add('hidden');
        document.getElementById('generateBtn').classList.remove('hidden');
    }
});

document.getElementById('closeReaderBtn').addEventListener('click', () => {
    readerModal.classList.add('hidden');
    globalAudio.pause();
    document.getElementById('stickyPlayer').classList.add('hidden');
});

// --- PLAYLIST UI & LOGIC ---
const audioCache = new Map();
let currentPlayingIndex = -1;

function buildPlaylist(insights, book) {
    document.getElementById('readerBookTitle').textContent = book.title;
    
    const container = document.getElementById('playlistContainer');
    container.innerHTML = '';
    
    const savedProgress = loadProgress(book.title);
    
    insights.forEach((insight, i) => {
        const isListened = savedProgress.includes(insight.title);
        
        const div = document.createElement('div');
        div.className = `track-item ${isListened ? 'listened' : ''}`;
        div.id = `track-${i}`;
        
        // Hidden text, just track UI
        div.innerHTML = `
            <div class="track-number">${i+1}</div>
            <div class="track-info">
                <h4>${insight.title}</h4>
                <p>Podcast IA</p>
            </div>
            <div class="track-status">
                <i class="fa-solid ${isListened ? 'fa-circle-check' : 'fa-play'}"></i>
            </div>
        `;
        
        div.onclick = () => playTrack(i);
        container.appendChild(div);
    });
    
    updateGlobalProgress();
}

// --- Progression (LocalStorage) ---
function loadProgress(bookTitle) {
    const saved = localStorage.getItem(`carabook_progress_${bookTitle}`);
    return saved ? JSON.parse(saved) : [];
}

function saveProgress(bookTitle, insightTitle) {
    const progress = loadProgress(bookTitle);
    if (!progress.includes(insightTitle)) {
        progress.push(insightTitle);
        localStorage.setItem(`carabook_progress_${bookTitle}`, JSON.stringify(progress));
    }
    
    // Update UI
    const trackDiv = document.getElementById(`track-${currentPlayingIndex}`);
    if (trackDiv) {
        trackDiv.classList.add('listened');
        trackDiv.querySelector('.track-status i').className = 'fa-solid fa-circle-check';
    }
    updateGlobalProgress();
}

function updateGlobalProgress() {
    if (!currentBook || !currentInsights) return;
    const progress = loadProgress(currentBook.title);
    const fill = document.getElementById('globalProgressFill');
    const text = document.getElementById('progressText');
    
    const percentage = (progress.length / currentInsights.length) * 100;
    fill.style.width = `${percentage}%`;
    text.textContent = `${progress.length}/${currentInsights.length} lu`;
}


// --- Audio Player ---
const globalAudio = document.getElementById('globalAudioElement');
const playPauseBtn = document.getElementById('playerPlayPauseBtn');
const visualizer = document.getElementById('audioVisualizer');

async function playTrack(index) {
    if (index >= currentInsights.length) return; // End of playlist
    
    const insight = currentInsights[index];
    const stickyPlayer = document.getElementById('stickyPlayer');
    
    // Update UI active track
    document.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
    const trackDiv = document.getElementById(`track-${index}`);
    if (trackDiv) trackDiv.classList.add('active');
    
    document.getElementById('playerInsightTitle').textContent = insight.title;
    stickyPlayer.classList.remove('hidden');
    playPauseBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    if (currentPlayingIndex === index && !globalAudio.paused) {
        globalAudio.pause();
        return;
    }
    
    currentPlayingIndex = index;
    
    try {
        if (!audioCache.has(insight.title)) {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: insight.text })
            });
            
            if (!res.ok) throw new Error("Erreur vocale (Vérifiez votre clé sur Vercel)");
            const blob = await res.blob();
            audioCache.set(insight.title, URL.createObjectURL(blob));
        }
        
        globalAudio.src = audioCache.get(insight.title);
        await globalAudio.play();
    } catch (e) {
        alert(e.message);
        playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

globalAudio.addEventListener('play', () => {
    playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    visualizer.classList.remove('hidden');
});

globalAudio.addEventListener('pause', () => {
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    visualizer.classList.add('hidden');
});

globalAudio.addEventListener('ended', () => {
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    visualizer.classList.add('hidden');
    
    // Save progress when track finishes naturally
    saveProgress(currentBook.title, currentInsights[currentPlayingIndex].title);
    
    // Auto-play next track
    if (currentPlayingIndex + 1 < currentInsights.length) {
        playTrack(currentPlayingIndex + 1);
    }
});

playPauseBtn.addEventListener('click', () => {
    if (globalAudio.paused) globalAudio.play();
    else globalAudio.pause();
});
