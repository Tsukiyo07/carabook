function chunkTextByWords(text, maxLength) {
    const chunks = [];
    let currentChunk = '';
    const words = text.split(/\s+/);
    for (const word of words) {
        if (!word) continue;
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

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "Missing text" });
        const safeChunks = chunkTextByWords(text, 190).filter(c => c.trim().length > 0);
        const urls = safeChunks.map(chunk => {
            const encodedText = encodeURIComponent(chunk);
            return {
                url: `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=fr&client=tw-ob`,
                shortText: chunk
            };
        });
        res.status(200).json({ urls });
    } catch (error) {
        res.status(500).json({ error: "Erreur TTS: " + error.message });
    }
}
