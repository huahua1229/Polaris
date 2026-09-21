// ============================================================
// Polaris 小站 · Supabase Edge Function「super-function」
// 部署：Supabase 控制台 → Edge Functions → super-function → 编辑代码 → 粘贴本文件 → Deploy
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PBKDF2_ITERATIONS = 60000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

async function handle(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'bad-json' }, 400); }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const action = body.action || '';

  switch (action) {
    /* ===== 公开读取 ===== */
    case 'read_content': {
      const { data, error } = await sb.from('site_content').select('data').eq('id', 1).maybeSingle();
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, data: data ? data.data : null });
    }
    case 'read_messages': {
      const { data, error } = await sb.from('guestbook_messages').select('*').order('time', { ascending: false });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, messages: data || [] });
    }

    /* ===== 公开写入：留言 ===== */
    case 'add_message': {
      const name = String(body.name || '').slice(0, 50);
      const email = String(body.email || '').slice(0, 100);
      const message = String(body.message || '').slice(0, 2000);
      const time = Number(body.time) || Date.now();
      if (!message) return json({ ok: false, error: 'empty' });
      const id = String(body.id || (time + '_' + Math.random().toString(36).slice(2, 11)));
      const { error } = await sb.from('guestbook_messages').insert({ id, name, email, message, time, likes: 0, replies: [] });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, id });
    }
    case 'add_reply': {
      const id = String(body.id || '');
      const name = String(body.name || '').slice(0, 50);
      const message = String(body.message || '').slice(0, 500);
      const time = Number(body.time) || Date.now();
      if (!id || !message) return json({ ok: false, error: 'empty' });
      const { data: row, error: e1 } = await sb.from('guestbook_messages').select('replies').eq('id', id).maybeSingle();
      if (e1 || !row) return json({ ok: false, error: 'not-found' });
      const replies = Array.isArray(row.replies) ? row.replies : [];
      replies.push({ name, message, time });
      const { error } = await sb.from('guestbook_messages').update({ replies }).eq('id', id);
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'like_message': {
      const id = String(body.id || '');
      const delta = body.delta === -1 ? -1 : 1;
      if (!id) return json({ ok: false, error: 'empty' });
      const { data: row, error: e1 } = await sb.from('guestbook_messages').select('likes').eq('id', id).maybeSingle();
      if (e1 || !row) return json({ ok: false, error: 'not-found' });
      const likes = Math.max(0, (Number(row.likes) || 0) + delta);
      const { error } = await sb.from('guestbook_messages').update({ likes }).eq('id', id);
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, likes });
    }

    /* ===== 公开写入：投稿 ===== */
    case 'submit_post': {
      const name = String(body.name || '').slice(0, 50);
      const email = String(body.email || '').slice(0, 100);
      const type = body.type === 'blog' ? 'blog' : 'project';
      const title = String(body.title || '').slice(0, 100);
      const summary = String(body.desc || '').slice(0, 500);
      const content = String(body.content || '').slice(0, 5000);
      const tags = String(body.tags || '').slice(0, 100);
      const attachment_path = String(body.attachment_path || '').slice(0, 300);
      const attachment_name = String(body.attachment_name || '').slice(0, 200);
      const attachment_size = Number(body.attachment_size || 0);
      if (!name || !email || !title || !content) return json({ ok: false, error: 'empty' });
      const id = 'post_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const { error } = await sb.from('posts_queue').insert({ id, name, email, type, title, summary, content, tags, attachment_path, attachment_name, attachment_size });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }

    /* ===== 作者操作（需口令） ===== */
    case 'verify_password': {
      const r = await verifyPw(sb, body.password);
      return json({ ok: r.ok });
    }
    case 'update_content': {
      const r = await verifyPw(sb, body.password);
      if (!r.ok) return json({ ok: false, error: 'auth' });
      const data = body.data;
      if (!data || typeof data !== 'object') return json({ ok: false, error: 'bad-data' });
      const { error } = await sb.from('site_content')
        .upsert({ id: 1, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'reset_content': {
      const r = await verifyPw(sb, body.password);
      if (!r.ok) return json({ ok: false, error: 'auth' });
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
      const r = await verifyPw(sb, body.password);
      if (!r.ok) return json({ ok: false, error: 'auth' });
      const { error } = await sb.from('guestbook_messages').delete().eq('id', String(body.id || ''));
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }

    /* ===== 投稿审核 ===== */
    case 'list_posts': {
      const r = await verifyPw(sb, body.password);
      if (!r.ok) return json({ ok: false, error: 'auth' });
      const { data, error } = await sb.from('posts_queue').select('*').order('created_at', { ascending: false });
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true, posts: data || [] });
    }
    case 'delete_post': {
      const r = await verifyPw(sb, body.password);
      if (!r.ok) return json({ ok: false, error: 'auth' });
      const { error } = await sb.from('posts_queue').delete().eq('id', String(body.id || ''));
      if (error) return json({ ok: false, error: 'db' });
      return json({ ok: true });
    }
    case 'publish_post': {
      const r = await verifyPw(sb, body.password);
      if (!r.ok) return json({ ok: false, error: 'auth' });
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
