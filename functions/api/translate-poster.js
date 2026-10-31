// Cloudflare Pages Function: POST /api/translate-poster
// Gemini Key is read from the secret GEMINI_API_KEY (never put it in index.html).

const PROMPT = `You are an expert Chinese-to-Khmer translator for drama and movie titles.
Look at the poster image. Find the MAIN Chinese drama title (ignore actor names, slogans and small text).
Return JSON only:
- chinese_title: the main Chinese title exactly as printed
- khmer_title: a natural, short, poetic Khmer title suitable for a drama poster (correct Khmer spelling)
- literal_meaning: a literal word-by-word meaning, written in Khmer
- alternatives: 3 other Khmer title options
- notes: a short note in Khmer about any uncertainty (blurry text, multiple possible titles); empty string if none`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    chinese_title: { type: 'STRING' },
    khmer_title: { type: 'STRING' },
    literal_meaning: { type: 'STRING' },
    alternatives: { type: 'ARRAY', items: { type: 'STRING' } },
    notes: { type: 'STRING' }
  },
  required: ['chinese_title', 'khmer_title', 'literal_meaning', 'alternatives', 'notes']
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) return json({ error: 'Server មិនទាន់ដាក់ GEMINI_API_KEY ទេ' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'សំណើមិនត្រឹមត្រូវ' }, 400); }
  const { imageBase64, mimeType } = body || {};
  if (!imageBase64 || !['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
    return json({ error: 'រូបភាពមិនត្រឹមត្រូវ' }, 400);
  }

  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.4 }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) return json({ error: data?.error?.message || 'Gemini error' }, 502);

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ error: 'Gemini មិនឆ្លើយតប សូមសាកម្ដងទៀត' }, 502);
    return json(JSON.parse(text));
  } catch (e) {
    return json({ error: 'Server error: ' + e.message }, 500);
  }
}
