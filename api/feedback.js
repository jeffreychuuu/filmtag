import { kv } from '@vercel/kv';

var env = process.env.VERCEL_ENV || 'development';
var suffix = env === 'production' ? '' : '_' + env;
function k(key) { return key + suffix; }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    if (req.query.key !== process.env.FEEDBACK_ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
    var newKey = k('feedback_list');
    var newData = await kv.lrange(newKey, 0, -1);
    var oldData = suffix ? await kv.lrange('feedback_list', 0, -1).catch(function() { return []; }) : [];
    var all = suffix ? newData.concat(oldData) : newData;
    if (suffix && oldData.length) {
      for (var i = 0; i < all.length; i++) await kv.rpush(k('feedback_list'), all[i]);
      await kv.del('feedback_list');
    }
    var items = all.map(function(s) {
      try { return JSON.parse(s); } catch (e) { return null; }
    }).filter(Boolean);
    return res.json(items);
  }

  if (req.method === 'POST') {
    var type = req.body.type, title = req.body.title, desc = req.body.desc, email = req.body.email || '';
    if (!title || !desc) return res.status(400).json({ error: 'title and desc required' });
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await kv.rpush(k('feedback_list'), JSON.stringify({ id: id, type: type || 'suggestion', title: title, desc: desc, email: email, ts: new Date().toISOString() }));
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (req.query.key !== process.env.FEEDBACK_ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
    var idToDel = req.query.id;
    if (!idToDel) return res.status(400).json({ error: 'id required' });
    var newKey = k('feedback_list');
    var newData = await kv.lrange(newKey, 0, -1);
    var oldData = suffix ? await kv.lrange('feedback_list', 0, -1).catch(function() { return []; }) : [];
    var all = suffix ? newData.concat(oldData) : newData;
    var filtered = all.map(function(s) { try { return JSON.parse(s); } catch (e) { return null; } }).filter(function(item) { return item && item.id !== idToDel; });
    await kv.del(newKey);
    if (suffix) await kv.del('feedback_list').catch(function() {});
    for (var i = 0; i < filtered.length; i++) await kv.rpush(newKey, JSON.stringify(filtered[i]));
    return res.json({ ok: true });
  }

  res.status(405).end();
}
