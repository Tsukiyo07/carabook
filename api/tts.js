const googleTTS = require('google-tts-api');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Texte manquant' });
        }

        const urls = googleTTS.getAllAudioUrls(text, {
            lang: 'fr',
            slow: false,
            host: 'https://translate.google.com',
            splitPunct: ',.?!'
        });

        return res.status(200).json({ urls });

    } catch (error) {
        console.error("TTS Error:", error);
        return res.status(500).json({ error: error.message || 'Error generating TTS' });
    }
}
