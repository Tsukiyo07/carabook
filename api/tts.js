export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'ELEVENLABS_API_KEY is not configured on the server.' });
    }

    try {
        const { text, voiceId } = req.body;
        const targetVoiceId = voiceId || 'IKne3meq5aSn9XLyUdCD'; // Default to Charlie

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.35,
                    similarity_boost: 0.85
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ElevenLabs API Error: ${errorText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        
        // Return audio file directly
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.byteLength);
        res.send(Buffer.from(audioBuffer));

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || 'Error generating audio' });
    }
}
