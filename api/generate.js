export default async function handler(req, res) {
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
RÈGLE ABSOLUE : Tu dois IMPÉRATIVEMENT conserver les termes techniques originaux, les noms propres et les concepts clés tels qu'ils sont connus dans le livre (même s'ils sont en anglais ou très spécifiques), sans les traduire grossièrement ou les simplifier.

Tu DOIS répondre EXCLUSIVEMENT avec un objet JSON valide, sans balises markdown.
Format attendu :
{
  "insights": [
    {
      "title": "Nom du vrai Chapitre / Partie",
      "text": "Script oral d'environ 80-100 mots résumant ce chapitre précis. Ton passionnant et direct."
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
