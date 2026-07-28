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

// --- Home Data (Fake Trending) ---
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
                    <img src="${coverUrl}" alt="Cover" loading="lazy">
                    <h4>${item.title}</h4>
                    <p>${authors}</p>
                `;
                card.onclick = () => openBookDetails(item, coverUrl, authors);
                container.appendChild(card);
            }
        });
    } catch (e) {
        console.error("Home data error", e);
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
    } catch (e) {
        searchResults.innerHTML = '<p style="color:red; text-align:center;">Erreur lors de la recherche.</p>';
    }
}

// --- Book Details Modal ---
async function openBookDetails(item, coverUrl, authors) {
    document.getElementById('modalCover').src = coverUrl;
    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalAuthor').textContent = authors;
    document.getElementById('modalDescription').textContent = "Recherche des détails de l'ouvrage...";
    
    currentBook = { title: item.title, authors: authors, description: "" };
    bookModal.classList.remove('hidden');

    try {
        if (item.key) {
            const res = await fetch(`https://openlibrary.org${item.key}.json`);
            if (res.ok) {
                const data = await res.json();
                let desc = typeof data.description === 'string' ? data.description : (data.description?.value || "Ce livre ne possède pas de description dans la base de données. L'IA générera les insights à partir de son titre.");
                document.getElementById('modalDescription').textContent = desc;
                currentBook.description = desc;
            }
        }
    } catch(e) {}
}

document.getElementById('closeBookModal').addEventListener('click', () => {
    bookModal.classList.add('hidden');
});

// --- AI Generation (VIA BACKEND) ---
document.getElementById('generateBtn').addEventListener('click', async () => {
    document.getElementById('generateBtn').classList.add('hidden');
    document.getElementById('loadingStatus').classList.remove('hidden');

    try {
        const insightsData = await generateInsights(currentBook);
        currentInsights = insightsData;
        buildReader(insightsData, currentBook);
        
        document.getElementById('loadingStatus').classList.add('hidden');
        document.getElementById('generateBtn').classList.remove('hidden');
        
        bookModal.classList.add('hidden');
        readerModal.classList.remove('hidden');
    } catch (e) {
        alert("Erreur de génération : " + e.message);
        document.getElementById('loadingStatus').classList.add('hidden');
        document.getElementById('generateBtn').classList.remove('hidden');
    }
});

document.getElementById('closeReaderBtn').addEventListener('click', () => {
    readerModal.classList.add('hidden');
    const globalAudio = document.getElementById('globalAudioElement');
    globalAudio.pause();
    document.getElementById('stickyPlayer').classList.add('hidden');
});

async function generateInsights(book) {
    const prompt = `Tu es une application premium de résumés de livres (comme Blinkist ou StoryShots).
    Analyse ce livre et donne-moi 3 à 5 Insights clés (idées principales).
    Livre: ${book.title}
    Auteur: ${book.authors}
    Description: ${book.description}
    
    Tu DOIS répondre EXCLUSIVEMENT avec un objet JSON valide, sans balises markdown.
    Format attendu :
    {
      "introduction": "Phrase d'accroche captivante",
      "insights": [
        {
          "title": "Titre du chapitre",
          "text": "Script oral d'environ 80-100 mots. Ton passionnant et direct.",
          "takeaways": ["Point clé 1", "Point clé 2"]
        }
      ]
    }`;

    // Appelle le backend Vercel (sécurisé)
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erreur serveur");
    }
    
    return await response.json();
}

function buildReader(data, book) {
    document.getElementById('readerBookTitle').textContent = book.title;
    document.getElementById('readerIntro').textContent = data.introduction;
    
    const container = document.getElementById('insightsContainer');
    container.innerHTML = '';
    
    data.insights.forEach((insight, i) => {
        const div = document.createElement('div');
        div.className = 'insight-item';
        div.innerHTML = `
            <h3>${i+1}. ${insight.title}</h3>
            <p>${insight.text}</p>
            <div class="takeaways">
                <h5>À retenir</h5>
                <ul>${insight.takeaways.map(t => `<li>${t}</li>`).join('')}</ul>
            </div>
            <button class="primary-btn-large" style="margin-top:2rem;" onclick="playAudioForInsight(${i})">
                <i class="fa-solid fa-play"></i> Écouter l'Insight
            </button>
        `;
        container.appendChild(div);
    });
}

// --- Audio Player Logic (VIA BACKEND) ---
const audioCache = new Map();
let currentPlayingIndex = -1;

async function playAudioForInsight(index) {
    const insight = currentInsights.insights[index];
    const globalAudio = document.getElementById('globalAudioElement');
    const stickyPlayer = document.getElementById('stickyPlayer');
    const playPauseBtn = document.getElementById('playerPlayPauseBtn');
    
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
            // Appelle le backend Vercel pour masquer la clé API
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: insight.text,
                    voiceId: 'IKne3meq5aSn9XLyUdCD' // Charlie voice
                })
            });
            
            if (!res.ok) throw new Error("Erreur de génération vocale (vérifiez la clé API ElevenLabs sur Vercel)");
            
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

const globalAudio = document.getElementById('globalAudioElement');
const playPauseBtn = document.getElementById('playerPlayPauseBtn');
const visualizer = document.getElementById('audioVisualizer');

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
});
playPauseBtn.addEventListener('click', () => {
    if (globalAudio.paused) globalAudio.play();
    else globalAudio.pause();
});
