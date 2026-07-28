export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    try {
        const prompt = req.body.prompt;
        const model = 'gemini-3.6-flash'; // Fixed to the recommended model
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7 }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google API Error: ${errorText}`);
        }

        const data = await response.json();
        const rawText = data.candidates[0].content.parts.map(p => p.text).join('');
        
        // Clean markdown backticks if any
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        // Attempt to parse to ensure it's valid JSON before sending to client
        const parsedJson = JSON.parse(cleaned);

        return res.status(200).json(parsedJson);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || 'Error generating content' });
    }
}
