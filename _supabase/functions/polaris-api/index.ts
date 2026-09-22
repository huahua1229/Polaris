// ============================================================
// Polaris 小站 · Supabase Edge Function「super-function」
// 部署：Supabase 控制台 → Edge Functions → super-function → 编辑代码 → 粘贴本文件 → Deploy
// 依赖数据表：site_content / admin_auth / guestbook_messages / posts_queue /
//           friend_requests / music / albums / album_photos / users / message_likes
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TOKEN_SECRET = SERVICE_KEY || 'polaris-static-fallback-secret';
const PBKDF2_ITERATIONS = 60000;
const TOKEN_TTL_USER = 7 * 24 * 3600 * 1000;       // 普通用户登录 7 天
const TOKEN_TTL_DEV = 30 * 24 * 3600 * 1000;       // 开发者登录 30 天
const QQ_RE = /^\d{5,12}@qq\.com$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/* ---------------- 密码哈希 ---------------- */
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyPw(sb, password) {
  if (!password) return { ok: false };
  const { data: rows, error } = await sb.from('admin_auth').select('password_hash, salt').eq('id', 1).maybeSingle();
  if (error || !rows) return { ok: false };
  const hash = await hashPassword(password, rows.salt);
  if (!safeEqual(hash, rows.password_hash)) return { ok: false };
  return { ok: true, hash, salt: rows.salt };
}

/* ---------------- 无状态登录 Token（HMAC 签名） ---------------- */
function b64urlFromStr(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromBytes(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function strFromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
}
async function hmacSign(payloadB64) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return b64urlFromBytes(sig);
}
async function signToken(obj) {
  const p = b64urlFromStr(JSON.stringify(obj));
  const s = await hmacSign(p);
  return p + '.' + s;
}
async function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  let expect;
  try { expect = await hmacSign(parts[0]); } catch { return null; }
  if (!safeEqual(expect, parts[1])) return null;
  let obj;
  try { obj = JSON.parse(strFromB64url(parts[0])); } catch { return null; }
  if (!obj || !obj.exp || obj.exp < Date.now()) return null;
  return obj;
}
async function issueUserToken(user) {
  const token = await signToken({
    sub: String(user.id), email: user.email, nick: user.nickname,
    role: 'user', exp: Date.now() + TOKEN_TTL_USER,
  });
  return { token, email: user.email, nickname: user.nickname, role: 'user', avatar: user.avatar || '' };
}

/* 要求登录用户（普通用户或开发者），返回身份；失败返回 null */
async function requireUser(body) {
  const u = await verifyToken(body.token);
  if (!u) return null;
  return { id: u.sub, email: u.email, nickname: u.nick, role: u.role };
}
/* 要求开发者：developer token 或旧管理口令，二者其一即可 */
async function requireAdmin(sb, body) {
  const u = await verifyToken(body.token);
  if (u && u.role === 'developer') return { ok: true };
  const p = await verifyPw(sb, body.password);
  return { ok: p.ok };
}

async function handle(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'bad-json' }, 400); }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const action = body.action || '';

  switch (action) {
    /* ============ 用户账号 ============ */
    case 'register': {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const nickname = String(body.nickname || '').trim().slice(0, 20);
      const avatar = String(body.avatar || '').slice(0, 60000);
      if (!QQ_RE.test(email)) return json({ ok: false, error: 'bad-email' });
      if (password.length < 6) return json({ ok: false, error: 'weak' });
      if (!nickname) return json({ ok: false, error: 'bad-nick' });
      const { data: exist } = await sb.from('users').select('id').eq('email', email).maybeSingle();
      if (exist) return json({ ok: false, error: 'exists' });
      const salt = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      const password_hash = await hashPassword(password, salt);
      const { data: ins, error } = await sb.from('users')
        .insert({ email, password_hash, salt, nickname, avatar }).select('*').single();
      if (error || !ins) return json({ ok: false, error: 'db' });
      return json({ ok: true, ...(await issueUserToken(ins)) });
    }

    case 'login': {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!QQ_RE.test(email) || !password) return json({ ok: false, error: 'bad-input' });
      const { data: user, error } = await sb.from('users').select('*').eq('email', email).maybeSingle();
      if (error || !user) return json({ ok: false, error: 'not-found' });
      const hash = await hashPassword(password, user.salt);
      if (!safeEqual(hash, user.password_hash)) return json({ ok: false, error: 'bad-pw' });
      return json({ ok: true, ...(await issueUserToken(user)) });
    }

    case 'developer_login': {
      const r = await verifyPw(sb, body.password);
      if (!r.ok) return json({ ok: false, error: 'bad-pw' });
      const token = await signToken({
        sub: 'developer', email: 'developer', nick: 'Polaris',
        role: 'developer', exp: Date.now() + TOKEN_TTL_DEV,
      });
      return json({ ok: true, token, email: 'developer', nickname: 'Polaris', role: 'developer' });
    }

    case 'update_profile': {
      const u = await requireUser(body);
      if (!u || u.role !== 'user') return json({ ok: false, error: 'auth' });
      const newNick = String(body.nickname || '').trim().slice(0, 20);
      const oldPw = String(body.old_password || '');
      const newPw = String(body.new_password || '');
      const { data: user, error } = await sb.from('users').select('*').eq('id', u.id).maybeSingle();
      if (error || !user) return json({ ok: false, error: 'not-found' });
      const patch = {};
      if (newNick) patch.nickname = newNick;
      if (body.avatar !== undefined) patch.avatar = String(body.avatar || '').slice(0, 60000);
      if (newPw) {
        if (newPw.length < 6) return json({ ok: false, error: 'weak' });
        const oldHash = await hashPassword(oldPw, user.salt);
        if (!safeEqual(oldHash, user.password_hash)) return json({ ok: false, error: 'bad-pw' });
        const salt = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        patch.salt = salt;
        patch.password_hash = await hashPassword(newPw, salt);
      }
      if (Object.keys(patch).length) {
        const { error: e2 } = await sb.from('users').update(patch).eq('id', u.id);
        if (e2) return json({ ok: false, error: 'db' });
      }
      const fresh = { ...user, ...patch };
      return json({ ok: true, ...(await issueUserToken(fresh)) });
    }

    /* ===== 公开读取 ===== */
    case 'read_content': {
      const { data, error } = await sb.from('site_content').select('data').eq('id', 1).maybeSingle();
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, data: data ? data.data : null });
    }
    case 'read_messages': {
      const { data, error } = await sb.from('guestbook_messages').select('*').order('time', { ascending: false });
      if (error) return json({ ok: false, error: 'db' });
      const out = { ok: true, messages: data || [] };
      const u = await requireUser(body);
      if (u && u.role === 'user') {
        const { data: likes } = await sb.from('message_likes').select('message_id').eq('user_id', u.id);
        out.liked_ids = (likes || []).map((x) => x.message_id);
      }
      return json(out);
    }

    /* ===== 留言（需登录） ===== */
    case 'add_message': {
      const u = await requireUser(body);
      if (!u) return json({ ok: false, error: 'auth' });
      const message = String(body.message || '').slice(0, 2000);
      const time = Number(body.time) || Date.now();
      if (!message) return json({ ok: false, error: 'empty' });
      const id = String(body.id || (time + '_' + Math.random().toString(36).slice(2, 11)));
      const name = u.nickname || '匿名访客';
      const email = u.role === 'developer' ? '' : u.email;
      const { error } = await sb.from('guestbook_messages').insert({ id, name, email, message, time, likes: 0, replies: [], avatar: String(body.avatar || '').slice(0,60000) });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, id });
    }
    case 'add_reply': {
      const u = await requireUser(body);
      if (!u) return json({ ok: false, error: 'auth' });
      const id = String(body.id || '');
      const message = String(body.message || '').slice(0, 500);
      const time = Number(body.time) || Date.now();
      if (!id || !message) return json({ ok: false, error: 'empty' });
      const { data: row, error: e1 } = await sb.from('guestbook_messages').select('replies').eq('id', id).maybeSingle();
      if (e1 || !row) return json({ ok: false, error: 'not-found' });
      const replies = Array.isArray(row.replies) ? row.replies : [];
      replies.push({ name: u.nickname || '匿名访客', message, time, avatar: String(body.avatar || '').slice(0,60000) });
      const { error } = await sb.from('guestbook_messages').update({ replies }).eq('id', id);
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'like_message': {
      const u = await requireUser(body);
      if (!u) return json({ ok: false, error: 'auth' });
      const id = String(body.id || '');
      if (!id) return json({ ok: false, error: 'empty' });
      const uid = u.role === 'developer' ? 'developer' : u.id;
      const { data: row, error: e1 } = await sb.from('guestbook_messages').select('likes').eq('id', id).maybeSingle();
      if (e1 || !row) return json({ ok: false, error: 'not-found' });
      const { data: existing } = await sb.from('message_likes')
        .select('user_id').eq('user_id', uid).eq('message_id', id).maybeSingle();
      let liked;
      let likes = Number(row.likes) || 0;
      if (existing) {
        await sb.from('message_likes').delete().eq('user_id', uid).eq('message_id', id);
        liked = false; likes = Math.max(0, likes - 1);
      } else {
        const { error: insE } = await sb.from('message_likes').insert({ user_id: uid, message_id: id });
        if (insE && !String(insE.code || '').includes('23505')) return json({ ok: false, error: 'db' });
        liked = true; likes = likes + 1;
      }
      await sb.from('guestbook_messages').update({ likes }).eq('id', id);
      return json({ ok: true, liked, likes });
    }

    /* ===== 投稿（需登录） ===== */
    case 'submit_post': {
      const u = await requireUser(body);
      if (!u) return json({ ok: false, error: 'auth' });
      const type = body.type === 'blog' ? 'blog' : 'project';
      const title = String(body.title || '').slice(0, 100);
      const summary = String(body.desc || '').slice(0, 500);
      const content = String(body.content || '').slice(0, 50000);
      const tags = String(body.tags || '').slice(0, 100);
      const attachment_path = String(body.attachment_path || '').slice(0, 300);
      const attachment_name = String(body.attachment_name || '').slice(0, 200);
      const attachment_size = Number(body.attachment_size || 0);
      if (!title || !content) return json({ ok: false, error: 'empty' });
      const id = 'post_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const { error } = await sb.from('posts_queue').insert({
        id, name: u.nickname, email: u.role === 'developer' ? '' : u.email,
        type, title, summary, content, tags, attachment_path, attachment_name, attachment_size,
      });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }

    /* ===== 作者内容操作（开发者 token 或管理口令） ===== */
    case 'verify_password': {
      const r = await verifyPw(sb, body.password);
      return json({ ok: r.ok });
    }
    case 'update_content': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const data = body.data;
      if (!data || typeof data !== 'object') return json({ ok: false, error: 'bad-data' });
      const { error } = await sb.from('site_content')
        .upsert({ id: 1, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'reset_content': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { error } = await sb.from('site_content').delete().eq('id', 1);
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'change_password': {
      const r = await verifyPw(sb, body.password);
      if (!r.ok) return json({ ok: false, error: 'auth' });
      const npw = String(body.new_password || '');
      if (npw.length < 4) return json({ ok: false, error: 'too-short' });
      const salt = 'polaris_salt_' + Math.random().toString(36).slice(2, 10);
      const hash = await hashPassword(npw, salt);
      const { error } = await sb.from('admin_auth').update({ password_hash: hash, salt }).eq('id', 1);
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'delete_message': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const mid = String(body.id || '');
      await sb.from('message_likes').delete().eq('message_id', mid);
      const { error } = await sb.from('guestbook_messages').delete().eq('id', mid);
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }

    /* ===== 投稿审核 ===== */
    case 'list_posts': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { data, error } = await sb.from('posts_queue').select('*').order('created_at', { ascending: false });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, posts: data || [] });
    }
    case 'delete_post': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { error } = await sb.from('posts_queue').delete().eq('id', String(body.id || ''));
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'publish_post': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const id = String(body.id || '');
      const { data: post, error: e1 } = await sb.from('posts_queue').select('*').eq('id', id).maybeSingle();
      if (e1 || !post) return json({ ok: false, error: 'not-found' });
      const { data: cur } = await sb.from('site_content').select('data').eq('id', 1).maybeSingle();
      const data = (cur && cur.data) ? cur.data : {};
      if (post.type === 'blog') {
        data.blogArticles = Array.isArray(data.blogArticles) ? data.blogArticles : [];
        data.blogArticles.unshift({
          title: post.title,
          date: new Date().toISOString().slice(0, 10),
          cat: 'guest', catLabel: '投稿',
          tags: post.tags || '投稿',
          cover: '投稿', grad: 'ffd3a5,fd6585',
          excerpt: post.summary || (post.content || '').slice(0, 80),
          content: post.content,
          author: post.name,
          attachment: post.attachment_path ? { name: post.attachment_name, path: post.attachment_path, size: post.attachment_size } : null
        });
      } else {
        data.projects = Array.isArray(data.projects) ? data.projects : [];
        var pDesc = (post.summary || (post.content || '').slice(0, 100)) + '（投稿人：' + post.name + '）';
        if (post.attachment_name) pDesc += ' [附件: ' + post.attachment_name + ']';
        data.projects.unshift({
          title: post.title, ico: '📌', tags: post.tags || '投稿',
          cat: 'guest', catLabel: '投稿', stars: 0,
          desc: pDesc,
          attachment: post.attachment_path ? { name: post.attachment_name, path: post.attachment_path, size: post.attachment_size } : null
        });
      }
      await sb.from('site_content').upsert({ id: 1, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      await sb.from('posts_queue').delete().eq('id', id);
      return json({ ok: true });
    }

    /* ===== 友链申请（需登录） ===== */
    case 'submit_friend_request': {
      const u = await requireUser(body);
      if (!u) return json({ ok: false, error: 'auth' });
      const name = String(body.name || '').slice(0, 50);
      const url = String(body.url || '').slice(0, 200);
      const description = String(body.desc || '').slice(0, 200);
      const avatar = String(body.avatar || '').slice(0, 300);
      if (!name || !url || !description) return json({ ok: false, error: 'empty' });
      const id = 'fr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const { error } = await sb.from('friend_requests').insert({
        id, name, url, description, avatar, email: u.role === 'developer' ? '' : u.email,
      });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'list_friend_requests': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { data, error } = await sb.from('friend_requests').select('*').order('created_at', { ascending: false });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, requests: data || [] });
    }
    case 'approve_friend_request': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const id = String(body.id || '');
      const { data: req, error: e1 } = await sb.from('friend_requests').select('*').eq('id', id).maybeSingle();
      if (e1 || !req) return json({ ok: false, error: 'not-found' });
      const { data: cur } = await sb.from('site_content').select('data').eq('id', 1).maybeSingle();
      const data = (cur && cur.data) ? cur.data : {};
      data.friends = Array.isArray(data.friends) ? data.friends : [];
      data.friends.push({ name: req.name, url: req.url, desc: req.description, avatar: req.avatar || '' });
      await sb.from('site_content').upsert({ id: 1, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      await sb.from('friend_requests').delete().eq('id', id);
      return json({ ok: true });
    }
    case 'reject_friend_request': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { error } = await sb.from('friend_requests').delete().eq('id', String(body.id || ''));
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }

    /* ===== 音乐库 ===== */
    case 'list_music': {
      const { data, error } = await sb.from('music').select('*').order('sort_order', { ascending: true });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, list: data || [] });
    }
    case 'add_music': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { error } = await sb.from('music').insert({
        title: String(body.title || '未命名').slice(0, 100),
        artist: String(body.artist || '').slice(0, 50),
        file_path: String(body.file_path || '').slice(0, 300),
        cover: String(body.cover || '').slice(0, 60000),
        sort_order: Number(body.sort_order || 0),
      });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'delete_music': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { error } = await sb.from('music').delete().eq('id', String(body.id || ''));
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }

    /* ===== 相册 ===== */
    case 'list_albums': {
      const { data, error } = await sb.from('albums').select('id,title,description,is_public,cover_url,sort_order').order('sort_order');
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, albums: data || [] });
    }
    case 'verify_album_password': {
      const { data, error } = await sb.from('albums').select('id,password').eq('id', String(body.albumId || '')).single();
      if (error || !data) return json({ ok: false, error: 'db' });
      if (data.password === body.password) return json({ ok: true });
      return json({ ok: false, error: 'wrong' });
    }
    case 'list_photos': {
      const albumId = String(body.albumId || '');
      const { data: album } = await sb.from('albums').select('is_public,password').eq('id', albumId).maybeSingle();
      if (album && !album.is_public) {
        const adm = await requireAdmin(sb, body);
        if (!adm.ok && album.password !== body.password) return json({ ok: false, error: 'auth' });
      }
      const { data, error } = await sb.from('album_photos').select('id,url,caption,sort_order').eq('album_id', albumId).order('sort_order');
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, photos: data || [] });
    }
    case 'add_photo': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { error } = await sb.from('album_photos').insert({ album_id: Number(body.albumId), url: body.url, caption: body.caption || '' });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'delete_photo': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { error } = await sb.from('album_photos').delete().eq('id', String(body.id || ''));
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'create_album': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { error } = await sb.from('albums').insert({
        title: String(body.title || '未命名').slice(0, 50),
        description: String(body.description || '').slice(0, 200),
        is_public: body.is_public !== false,
        password: body.is_public === false ? String(body.album_password || body.password || '') : '',
      });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'delete_album': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      await sb.from('album_photos').delete().eq('album_id', String(body.id || ''));
      const { error } = await sb.from('albums').delete().eq('id', String(body.id || ''));
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }

    /* ===== 密码重置（用户申请 -> 站长审核） ===== */
    case 'request_reset_password': {
      const email = String(body.email || '').trim().toLowerCase();
      if (!QQ_RE.test(email)) return json({ ok: false, error: 'bad-email' });
      const { data: user } = await sb.from('users').select('id').eq('email', email).maybeSingle();
      if (!user) return json({ ok: false, error: 'no-user' });
      const { data: dup } = await sb.from('password_reset_requests').select('id').eq('email', email).eq('status', 'pending').maybeSingle();
      if (dup) return json({ ok: true, note: 'already-pending' });
      const id = 'rr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      await sb.from('password_reset_requests').insert({ id, email, status: 'pending', created_at: new Date().toISOString() });
      return json({ ok: true });
    }
    case 'list_reset_requests': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const { data, error } = await sb.from('password_reset_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, requests: data || [] });
    }
    case 'approve_reset': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      const id = String(body.id || '');
      const newPw = String(body.new_password || '');
      if (newPw.length < 6) return json({ ok: false, error: 'weak' });
      const { data: req } = await sb.from('password_reset_requests').select('*').eq('id', id).maybeSingle();
      if (!req || req.status !== 'pending') return json({ ok: false, error: 'not-found' });
      const salt = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      const hash = await hashPassword(newPw, salt);
      const { error: e1 } = await sb.from('users').update({ password_hash: hash, salt }).eq('email', req.email);
      if (e1) return json({ ok: false, error: 'db' });
      await sb.from('password_reset_requests').update({ status: 'approved', handled_at: new Date().toISOString() }).eq('id', id);
      return json({ ok: true });
    }
    case 'reject_reset': {
      const adm = await requireAdmin(sb, body);
      if (!adm.ok) return json({ ok: false, error: 'auth' });
      await sb.from('password_reset_requests').update({ status: 'rejected', handled_at: new Date().toISOString() }).eq('id', String(body.id || ''));
      return json({ ok: true });
    }

    default:
      return json({ ok: false, error: 'unknown-action' }, 400);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(handle);
