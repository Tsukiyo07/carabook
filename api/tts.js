const googleTTS = require('google-tts-api');

function chunkTextByWords(text, maxLength) {
    const chunks = [];
    let currentChunk = '';
    const words = text.split(/\s+/);
    
    for (const word of words) {
        if ((currentChunk + ' ' + word).trim().length <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + word;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = word;
        }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: "Missing text" });
        }

        // Custom chunking to absolutely guarantee < 200 chars per request (Google limit)
        const safeChunks = chunkTextByWords(text, 190);
        
        const urls = safeChunks.map(chunk => {
            return {
                url: googleTTS.getAudioUrl(chunk, {
                    lang: 'fr',
                    slow: false,
                    host: 'https://translate.google.com',
                }),
                shortText: chunk
            };
        });

        res.status(200).json({ urls });
    } catch (error) {
        console.error("TTS Error:", error);
        res.status(500).json({ error: "Erreur de génération vocale." });
    }
}
