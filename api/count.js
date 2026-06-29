import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const [views, photos] = await Promise.all([
      kv.get('views').catch(function() { return 0; }),
      kv.get('photos').catch(function() { return 0; })
    ]);
    return res.json({ views: views || 0, photos: photos || 0 });
  }

  if (req.method === 'POST') {
    var type = req.body.type, amount = req.body.amount || 1;
    var c = await kv.incrby(type, amount);
    return res.json({ count: c });
  }

  res.status(405).end();
}
