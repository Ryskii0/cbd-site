import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const storeDir = path.join(root, 'store');
const storeFile = path.join(storeDir, 'submissions.json');
const profileFile = path.join(storeDir, 'profiles.json');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';

await mkdir(storeDir, { recursive: true });
if (!existsSync(storeFile)) await writeFile(storeFile, '[]', 'utf8');
if (!existsSync(profileFile)) await writeFile(profileFile, '[]', 'utf8');

async function readItems() {
  try { return JSON.parse(await readFile(storeFile, 'utf8')); }
  catch { return []; }
}
async function writeItems(items) { await writeFile(storeFile, JSON.stringify(items, null, 2), 'utf8'); }
async function readProfiles() { try { return JSON.parse(await readFile(profileFile, 'utf8')); } catch { return []; } }
async function writeProfiles(items) { await writeFile(profileFile, JSON.stringify(items, null, 2), 'utf8'); }
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
async function body(req) {
  let raw = ''; for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
function cleanLinks(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((x) => x && x.url).map((x) => ({ label: String(x.label || '打开链接').slice(0, 120), url: String(x.url).slice(0, 2000) }));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (url.pathname === '/api/profile' && req.method === 'GET') return send(res, 200, await readProfiles());
  if (url.pathname === '/api/profile' && req.method === 'POST') {
    try { const input = await body(req); if (!input.name) return send(res, 400, { error:'请填写昵称' }); const profiles = await readProfiles(); const profile = { name:String(input.name).trim().slice(0,80), updatedAt:new Date().toISOString() }; const index=profiles.findIndex((x)=>x.name===profile.name); if(index>=0) profiles[index]=profile; else profiles.push(profile); await writeProfiles(profiles); return send(res, 201, profile); } catch { return send(res, 400, { error:'个人信息保存失败' }); }
  }
  if (url.pathname === '/api/submissions' && req.method === 'GET') {
    const status = url.searchParams.get('status');
    const items = await readItems();
    return send(res, 200, status ? items.filter((x) => x.status === status) : items);
  }
  if (url.pathname === '/api/submissions' && req.method === 'POST') {
    try {
      const input = await body(req);
      if (!input.title || !input.category || !input.reason) return send(res, 400, { error: '请填写资源名称、类别和作者原话' });
      const items = await readItems();
      const item = { id: `sub_${Date.now()}`, title: String(input.title).slice(0, 200), category: String(input.category), shareType: input.shareType || 'content', contributor: String(input.contributor || '新朋友').trim().slice(0, 80), url: input.url ? String(input.url).slice(0, 2000) : '', links: cleanLinks(input.links), reason: String(input.reason).slice(0, 10000), status: 'pending', submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      items.unshift(item); await writeItems(items); return send(res, 201, item);
    } catch { return send(res, 400, { error: '提交内容格式不正确' }); }
  }
  const match = url.pathname.match(/^\/api\/submissions\/([^/]+)$/);
  if (match && req.method === 'PATCH') {
    try {
      const items = await readItems(); const index = items.findIndex((x) => x.id === match[1]);
      if (index < 0) return send(res, 404, { error: '找不到这条提交' });
      const input = await body(req); items[index] = { ...items[index], ...input, status: input.status || items[index].status, updatedAt: new Date().toISOString() }; await writeItems(items); return send(res, 200, items[index]);
    } catch { return send(res, 400, { error: '更新失败' }); }
  }
  const filePath = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, ''));
  if (!filePath.startsWith(root) || !existsSync(filePath)) return send(res, 404, { error: 'Not found' });
  const ext = path.extname(filePath); const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };
  send(res, 200, await readFile(filePath), types[ext] || 'application/octet-stream');
});
server.listen(port, host, () => console.log(`CBD Share server running at http://localhost:${port}`));
