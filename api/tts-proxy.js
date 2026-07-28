export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const text = req.method === 'POST' ? req.body.text : req.query.text;
        if (!text) {
            return res.status(400).json({ error: "Missing text" });
        }

        const encodedText = encodeURIComponent(text);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=fr&client=tw-ob`;

        const googleRes = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!googleRes.ok) {
            throw new Error(`Google TTS API returned ${googleRes.status}`);
        }

        const arrayBuffer = await googleRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).send(buffer);

    } catch (error) {
        console.error("TTS Proxy Error:", error);
        res.status(500).json({ error: "TTS Proxy Error: " + error.message });
    }
}
