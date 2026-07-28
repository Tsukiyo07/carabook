const googleTTS = require('google-tts-api');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: "Missing text" });
        }

        // google-tts-api getAllAudioUrls découpe automatiquement le texte
        // s'il dépasse 200 caractères et renvoie un tableau d'URLs.
        const urls = googleTTS.getAllAudioUrls(text, {
            lang: 'fr',
            slow: false,
            host: 'https://translate.google.com',
            splitPunct: ',.?!'
        });

        res.status(200).json({ urls });
    } catch (error) {
        console.error("TTS Error:", error);
        res.status(500).json({ error: "Erreur de génération vocale." });
    }
}
