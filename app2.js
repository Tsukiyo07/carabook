// App State
let currentBook = null;
let currentInsights = null;
let apiKeys = {
    gemini: '',
    geminiModel: 'gemini-3.6-flash',
    elevenlabs: '',
    voiceId: 'IKne3meq5aSn9XLyUdCD'
};

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
    loadSettings();
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

// --- Settings ---
function loadSettings() {
    const saved = localStorage.getItem('carabook_settings');
    if (saved) {
        apiKeys = JSON.parse(saved);
        document.getElementById('geminiKey').value = apiKeys.gemini || '';
        document.getElementById('geminiModel').value = apiKeys.geminiModel || 'gemini-3.6-flash';
        document.getElementById('elevenlabsKey').value = apiKeys.elevenlabs || '';
        document.getElementById('voiceSelect').value = apiKeys.voiceId || 'IKne3meq5aSn9XLyUdCD';
    }
}

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    apiKeys = {
        gemini: document.getElementById('geminiKey').value.trim(),
        geminiModel: document.getElementById('geminiModel').value,
        elevenlabs: document.getElementById('elevenlabsKey').value.trim(),
        voiceId: document.getElementById('voiceSelect').value.trim() || 'IKne3meq5aSn9XLyUdCD'
    };
    localStorage.setItem('carabook_settings', JSON.stringify(apiKeys));
    document.getElementById('settingsModal').classList.add('hidden');
});

document.getElementById('settingsBtn').addEventListener('click', () => document.getElementById('settingsModal').classList.remove('hidden'));
document.getElementById('closeSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').classList.add('hidden'));

// --- Home Data (Fake Trending) ---
async function loadHomeData() {
    // Just fetch some standard queries for home screen
    fetchCarouselData('steve jobs', 'featuredBook', true);
    fetchCarouselData('bestseller', 'trendingBooks');
    fetchCarouselData('psychology', 'selfHelpBooks');
}

async function fetchCarouselData(query, containerId, isFeatured = false) {
    try {
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${isFeatured ? 1 : 5}&language=fre`);
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
                    <img src="${coverUrl}" alt="Cover">
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
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`);
        const data = await res.json();
        
        searchResults.innerHTML = '';
        if (data.docs.length === 0) {
            searchResults.innerHTML = '<div class="empty-state"><p>Aucun résultat.</p></div>';
            return;
        }

        data.docs.forEach(item => {
            if (!item.title) return;
            const coverUrl = item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : 'https://via.placeholder.com/128x192?text=No+Cover';
            const authors = item.author_name ? item.author_name.join(', ') : 'Inconnu';
            
            const card = document.createElement('div');
            card.style.background = 'var(--bg-card)';
            card.style.borderRadius = 'var(--radius-md)';
            card.style.overflow = 'hidden';
            card.style.cursor = 'pointer';
            
            card.innerHTML = `
                <img src="${coverUrl}" style="width:100%; height:200px; object-fit:cover;">
                <div style="padding:1rem;">
                    <h4 style="font-size:1rem; margin-bottom:0.2rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</h4>
                    <p style="font-size:0.8rem; color:var(--text-secondary);">${authors}</p>
                </div>
            `;
            card.onclick = () => openBookDetails(item, coverUrl, authors);
            searchResults.appendChild(card);
        });
    } catch (e) {
        searchResults.innerHTML = '<p>Erreur.</p>';
    }
}

// --- Book Details Modal ---
async function openBookDetails(item, coverUrl, authors) {
    document.getElementById('modalCover').src = coverUrl;
    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalAuthor').textContent = authors;
    document.getElementById('modalDescription').textContent = "Chargement de la description...";
    
    currentBook = { title: item.title, authors: authors, description: "" };
    bookModal.classList.remove('hidden');

    try {
        if (item.key) {
            const res = await fetch(`https://openlibrary.org${item.key}.json`);
            if (res.ok) {
                const data = await res.json();
                let desc = typeof data.description === 'string' ? data.description : (data.description?.value || "L'IA générera un résumé basé sur le titre.");
                document.getElementById('modalDescription').textContent = desc.substring(0, 300) + '...';
                currentBook.description = desc;
            }
        }
    } catch(e) {}
}

document.getElementById('closeBookModal').addEventListener('click', () => {
    bookModal.classList.add('hidden');
});

// --- AI Generation & Reader ---
document.getElementById('generateBtn').addEventListener('click', async () => {
    if (!apiKeys.gemini || !apiKeys.elevenlabs) {
        alert("Veuillez renseigner vos clés API dans les paramètres.");
        document.getElementById('settingsModal').classList.remove('hidden');
        return;
    }

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
        alert("Erreur: " + e.message);
        document.getElementById('loadingStatus').classList.add('hidden');
        document.getElementById('generateBtn').classList.remove('hidden');
    }
});

document.getElementById('closeReaderBtn').addEventListener('click', () => {
    readerModal.classList.add('hidden');
    const globalAudio = document.getElementById('globalAudioElement');
    globalAudio.pause();
});

async function generateInsights(book) {
    const prompt = `Tu es une application mobile premium de résumés de livres.
    Analyse ce livre et donne-moi 3 à 5 Insights clés.
    Livre: ${book.title}
    Auteur: ${book.authors}
    Description: ${book.description}
    
    Tu DOIS répondre EXCLUSIVEMENT avec un objet JSON valide, sans balises markdown autour (pas de \`\`\`json).
    Format :
    {
      "introduction": "Phrase d'accroche",
      "insights": [
        {
          "title": "Titre du chapitre",
          "text": "Script oral d'environ 100 mots.",
          "takeaways": ["Point 1", "Point 2"]
        }
      ]
    }`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${apiKeys.geminiModel}:generateContent?key=${apiKeys.gemini}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7 }
        })
    });

    if (!response.ok) throw new Error("Erreur API Gemini");
    const data = await response.json();
    const rawText = data.candidates[0].content.parts.map(p => p.text).join('');
    
    try {
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        throw new Error("L'IA a mal formaté la réponse.");
    }
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
            <button class="primary-btn-large" style="margin-top:1.5rem;" onclick="playAudioForInsight(${i})">
                <i class="fa-solid fa-play"></i> Écouter ce passage
            </button>
        `;
        container.appendChild(div);
    });
}

// --- Audio Player Logic ---
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
            const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${apiKeys.voiceId}?output_format=mp3_44100_128`, {
                method: 'POST',
                headers: { 'Accept': 'audio/mpeg', 'xi-api-key': apiKeys.elevenlabs, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: insight.text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: { stability: 0.35, similarity_boost: 0.85 }
                })
            });
            if (!res.ok) throw new Error("Erreur ElevenLabs");
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
