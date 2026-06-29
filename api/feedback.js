import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    if (req.query.key !== process.env.FEEDBACK_ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
    var data = await kv.lrange('feedback_list', 0, -1);
    var items = data.map(function(s) {
      try { return JSON.parse(s); } catch (e) { return null; }
    }).filter(Boolean);
    return res.json(items);
  }

  if (req.method === 'POST') {
    var type = req.body.type, title = req.body.title, desc = req.body.desc, email = req.body.email || '';
    if (!title || !desc) return res.status(400).json({ error: 'title and desc required' });
    await kv.rpush('feedback_list', JSON.stringify({ type: type || 'suggestion', title: title, desc: desc, email: email, ts: new Date().toISOString() }));
    return res.json({ ok: true });
  }

  res.status(405).end();
}
