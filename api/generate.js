module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    try {
        const { type, bookTitle, bookAuthors, bookDesc } = req.body;
        const model = 'gemini-3.6-flash';
        
        let prompt = "";
        
        if (type === 'pitch') {
            prompt = `Tu es une application premium de résumés audios.
Livre: ${bookTitle}
Auteur: ${bookAuthors}
Description: ${bookDesc}

Écris un PITCH de 3 phrases très percutantes pour donner envie d'écouter le résumé complet de ce livre.
Le ton doit être moderne, direct, et intrigant (façon teaser Netflix).
Tu DOIS répondre EXCLUSIVEMENT avec un objet JSON valide, sans balises markdown.
Format attendu:
{ "pitch": "Ton pitch super captivant ici." }`;
        } else {
            prompt = `Tu es une application premium de résumés de livres.
Livre: ${bookTitle}
Auteur: ${bookAuthors}

TA MISSION : Tu dois diviser ton résumé en respectant LE VRAI CHAPITRAGE (ou les vraies parties principales) de ce livre.
Ne génère pas un résumé générique, mais base-toi sur la véritable structure de l'œuvre.
RÈGLE ABSOLUE : Tu dois IMPÉRATIVEMENT conserver les noms propres et les concepts clés tels qu'ils sont connus dans le livre. Tu peux tout à fait les traduire en français pour que l'écoute soit fluide et naturelle, à condition que la traduction soit exacte et couramment utilisée.

ATTENTION A LA LONGUEUR : Le podcast final doit durer environ 15 minutes. 
Par conséquent, le texte de chaque chapitre doit être TRÈS détaillé (environ 300 à 450 mots par chapitre). 
N'hésite surtout pas à raconter les anecdotes du livre, à donner les exemples concrets utilisés par l'auteur et à développer la philosophie de chaque idée en profondeur. Ne survole pas le sujet.

Tu DOIS répondre EXCLUSIVEMENT avec un objet JSON valide, sans balises markdown.
Format attendu :
{
  "insights": [
    {
      "title": "Nom du vrai Chapitre / Partie",
      "text": "Script oral de 300 à 450 mots résumant ce chapitre en profondeur (avec exemples et anecdotes). Ton passionnant et captivant."
    }
  ]
}`;
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedJson = JSON.parse(cleaned);

        return res.status(200).json(parsedJson);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message || 'Error generating content' });
    }
}
