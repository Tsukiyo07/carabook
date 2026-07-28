// UI Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsSection = document.getElementById('resultsSection');
const detailsSection = document.getElementById('detailsSection');
const insightsSection = document.getElementById('insightsSection');
const backBtn = document.getElementById('backBtn');
const generateBtn = document.getElementById('generateBtn');
const loadingStatus = document.getElementById('loadingStatus');

// Modals & Settings
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const geminiKeyInput = document.getElementById('geminiKey');
const geminiModelInput = document.getElementById('geminiModel');
const elevenlabsKeyInput = document.getElementById('elevenlabsKey');
const voiceSelectInput = document.getElementById('voiceSelect');

// Detail Elements
const detailCover = document.getElementById('detailCover');
const detailTitle = document.getElementById('detailTitle');
const detailAuthor = document.getElementById('detailAuthor');
const detailDescription = document.getElementById('detailDescription');

// Player Elements
const audioElement = document.getElementById('audioElement');
const scriptContent = document.getElementById('scriptContent');
const playerBookTitle = document.getElementById('playerBookTitle');
const audioVisualizer = document.getElementById('audioVisualizer');

// State
let currentBook = null;
let apiKeys = {
    gemini: '',
    geminiModel: 'gemini-3.6-flash',
    elevenlabs: '',
    voiceId: 'IKne3meq5aSn9XLyUdCD' // Charlie default voice (plus naturel)
};

// --- Settings Management ---
function loadSettings() {
    const saved = localStorage.getItem('carabook_settings');
    if (saved) {
        apiKeys = JSON.parse(saved);
        geminiKeyInput.value = apiKeys.gemini || '';
        if (geminiModelInput) geminiModelInput.value = apiKeys.geminiModel || 'gemini-3.6-flash';
        elevenlabsKeyInput.value = apiKeys.elevenlabs || '';
        voiceSelectInput.value = apiKeys.voiceId || 'IKne3meq5aSn9XLyUdCD';
    }
}

function saveSettings() {
    apiKeys = {
        gemini: geminiKeyInput.value.trim(),
        geminiModel: geminiModelInput ? geminiModelInput.value : 'gemini-3.6-flash',
        elevenlabs: elevenlabsKeyInput.value.trim(),
        voiceId: voiceSelectInput.value.trim() || 'IKne3meq5aSn9XLyUdCD'
    };
    localStorage.setItem('carabook_settings', JSON.stringify(apiKeys));
    settingsModal.classList.add('hidden');
}

settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
saveSettingsBtn.addEventListener('click', saveSettings);

// --- OpenLibrary Books Search ---
async function searchBooks(query) {
    if (!query) return;
    resultsSection.innerHTML = '<div class="spinner" style="margin: 0 auto;"></div>';
    resultsSection.classList.remove('hidden');
    detailsSection.classList.add('hidden');
    insightsSection.classList.add('hidden');

    try {
        // Using OpenLibrary API which is completely free and doesn't have strict rate limits like Google Books
        const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`);
        if (!response.ok) throw new Error("Erreur serveur API");
        const data = await response.json();
        
        resultsSection.innerHTML = '';
        
        if (!data.docs || data.docs.length === 0) {
            resultsSection.innerHTML = '<p>Aucun livre trouvé.</p>';
            return;
        }

        data.docs.forEach(item => {
            if (!item.title) return;

            // OpenLibrary Covers
            const coverUrl = item.cover_i 
                ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` 
                : 'https://via.placeholder.com/128x192?text=Pas+de+couverture';
                
            const authors = item.author_name ? item.author_name.join(', ') : 'Auteur inconnu';
            
            const card = document.createElement('div');
            card.className = 'book-card';
            card.innerHTML = `
                <img src="${coverUrl}" alt="${item.title}">
                <div class="card-info">
                    <h4>${item.title}</h4>
                    <p>${authors}</p>
                </div>
            `;
            
            // On click, we will fetch full details to get the description
            card.addEventListener('click', () => fetchAndShowBookDetails(item, coverUrl, authors));
            resultsSection.appendChild(card);
        });

    } catch (error) {
        resultsSection.innerHTML = `<p style="color: red;">Erreur lors de la recherche : ${error.message}</p>`;
    }
}

searchBtn.addEventListener('click', () => searchBooks(searchInput.value));
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBooks(searchInput.value);
});

// --- Book Details ---
async function fetchAndShowBookDetails(item, coverUrl, authors) {
    // Generate a default description, or attempt to fetch from works API
    let description = "Description non fournie par la base de données. L'IA générera le résumé en se basant sur le titre et l'auteur.";
    
    // Attempt to fetch detailed description from OpenLibrary Works API
    try {
        if (item.key) {
            const res = await fetch(`https://openlibrary.org${item.key}.json`);
            if (res.ok) {
                const detailedData = await res.json();
                if (detailedData.description) {
                    description = typeof detailedData.description === 'string' 
                        ? detailedData.description 
                        : (detailedData.description.value || description);
                }
            }
        }
    } catch(e) {
        console.warn("Could not fetch detailed description", e);
    }

    currentBook = {
        title: item.title,
        authors: authors,
        description: description
    };
    
    detailCover.src = coverUrl;
    detailTitle.textContent = item.title;
    detailAuthor.textContent = authors;
    detailDescription.textContent = description;
    
    resultsSection.classList.add('hidden');
    detailsSection.classList.remove('hidden');
    document.getElementById('insightsSection').classList.add('hidden');
    generateBtn.classList.remove('hidden');
    loadingStatus.classList.add('hidden');
}

backBtn.addEventListener('click', () => {
    detailsSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
});

// --- Generation Process ---
generateBtn.addEventListener('click', async () => {
    if (!apiKeys.gemini || !apiKeys.elevenlabs) {
        alert("Veuillez renseigner vos clés API Gemini et ElevenLabs dans les paramètres.");
        settingsModal.classList.remove('hidden');
        return;
    }

    generateBtn.classList.add('hidden');
    loadingStatus.classList.remove('hidden');
    document.getElementById('insightsSection').classList.add('hidden');

    try {
        // 1. Generate JSON Script via Gemini
        document.getElementById('statusText').textContent = "Génération des insights (Gemini)...";
        const insightsData = await generateScriptWithGemini(currentBook);
        
        // 2. Build UI
        buildInsightsUI(insightsData, currentBook);

        loadingStatus.classList.add('hidden');
        document.getElementById('insightsSection').classList.remove('hidden');
        
    } catch (error) {
        alert(`Erreur lors de la génération : ${error.message}`);
        generateBtn.classList.remove('hidden');
        loadingStatus.classList.add('hidden');
    }
});

function buildInsightsUI(data, book) {
    document.getElementById('insightsBookTitle').textContent = book.title;
    document.getElementById('insightsIntro').textContent = data.introduction || "Découvrez les concepts clés de ce livre.";
    
    const container = document.getElementById('insightsContainer');
    container.innerHTML = ''; // Clear previous

    if (!data.insights || !Array.isArray(data.insights)) return;

    data.insights.forEach((insight, index) => {
        const card = document.createElement('div');
        card.className = 'insight-card';
        
        // Takeaways list
        let takeawaysHTML = '';
        if (insight.takeaways && insight.takeaways.length > 0) {
            takeawaysHTML = `
                <div class="insight-takeaways">
                    <h5>À retenir</h5>
                    <ul>
                        ${insight.takeaways.map(t => `<li>${t}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="insight-header">
                <h3 class="insight-title">${index + 1}. ${insight.title}</h3>
                <button class="play-insight-btn" data-index="${index}" title="Écouter ce chapitre">
                    <i class="fa-solid fa-play"></i>
                </button>
            </div>
            <div class="insight-text">${insight.text}</div>
            ${takeawaysHTML}
        `;
        
        // Setup play button logic for this specific insight
        const playBtn = card.querySelector('.play-insight-btn');
        playBtn.addEventListener('click', () => playInsightAudio(insight, card, playBtn));
        
        container.appendChild(card);
    });
}

// Map to store generated audio blobs to avoid regenerating
const audioCache = new Map();

async function playInsightAudio(insight, cardElement, btnElement) {
    const globalAudio = document.getElementById('globalAudioElement');
    const icon = btnElement.querySelector('i');

    // If currently playing this card, pause it
    if (cardElement.classList.contains('playing') && !globalAudio.paused) {
        globalAudio.pause();
        icon.className = 'fa-solid fa-play';
        cardElement.classList.remove('playing');
        return;
    }

    // Reset all other cards
    document.querySelectorAll('.insight-card').forEach(c => {
        c.classList.remove('playing');
        c.querySelector('.play-insight-btn i').className = 'fa-solid fa-play';
    });

    cardElement.classList.add('playing');
    icon.className = 'fa-solid fa-spinner fa-spin'; // Loading state

    try {
        let audioUrl;
        
        // Check cache first
        if (audioCache.has(insight.title)) {
            audioUrl = audioCache.get(insight.title);
        } else {
            // Generate audio
            const audioBlob = await generateAudioWithElevenLabs(insight.text);
            audioUrl = URL.createObjectURL(audioBlob);
            audioCache.set(insight.title, audioUrl);
        }

        globalAudio.src = audioUrl;
        await globalAudio.play();
        icon.className = 'fa-solid fa-pause';
        
        globalAudio.onended = () => {
            cardElement.classList.remove('playing');
            icon.className = 'fa-solid fa-play';
        };
        globalAudio.onpause = () => {
            icon.className = 'fa-solid fa-play';
        };

    } catch (error) {
        alert("Erreur audio: " + error.message);
        cardElement.classList.remove('playing');
        icon.className = 'fa-solid fa-play';
    }
}

// --- API Calls ---

async function generateScriptWithGemini(bookInfo) {
    const prompt = `Tu es un expert qui crée des résumés de livres d'excellente qualité, structurés pour une application mobile premium (style StoryShots).
    Analyse le livre suivant et extrais 3 à 5 "Insights" (idées/chapitres clés).
    
    Livre: ${bookInfo.title}
    Auteur: ${bookInfo.authors || 'Inconnu'}
    Description: ${bookInfo.description || 'Pas de description'}
    
    Tu DOIS répondre EXCLUSIVEMENT avec un objet JSON valide, sans balises markdown autour (pas de \`\`\`json).
    Le format JSON doit être exactement celui-ci :
    {
      "introduction": "Une phrase d'accroche captivante sur le livre.",
      "insights": [
        {
          "title": "Titre accrocheur du chapitre/concept",
          "text": "Le texte du script narratif (environ 100 mots) expliquant ce concept. Parle d'une voix dynamique et orale, sans didascalies.",
          "takeaways": [
            "Point clé à retenir 1",
            "Point clé à retenir 2"
          ]
        }
      ]
    }`;

    const modelToUse = apiKeys.geminiModel || 'gemini-3.6-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKeys.gemini}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7
            }
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Erreur Gemini API");
    }

    const data = await response.json();
    const parts = data.candidates[0].content.parts;
    const rawText = parts.map(p => p.text).join('');
    
    try {
        // Clean markdown backticks if Gemini still added them
        const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error("Erreur de parsing JSON:", rawText);
        throw new Error("L'IA n'a pas renvoyé un format valide. Veuillez réessayer.");
    }
}

async function generateAudioWithElevenLabs(text) {
    const voiceId = apiKeys.voiceId || 'IKne3meq5aSn9XLyUdCD';
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': apiKeys.elevenlabs,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
                stability: 0.35, // Plus bas = plus naturel et expressif
                similarity_boost: 0.85
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Erreur ElevenLabs API (${response.status})`);
    }

    return await response.blob();
}

// Init
loadSettings();
