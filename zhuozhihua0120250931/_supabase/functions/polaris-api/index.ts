// ============================================================
// Polaris 小站 · Supabase Edge Function「polaris-api」
// 部署：Supabase 控制台 → Edge Functions → 新建函数（名称固定 polaris-api）
// 环境变量：SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY
//   （SUPABASE_URL 自动注入；SERVICE_ROLE_KEY 需在
//    Edge Functions → Secrets 中手动添加，值为
//    Project Settings → API → service_role key）
// 前端调用地址：https://<项目ref>.functions.supabase.co/polaris-api
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

// ---------- 口令哈希（PBKDF2-SHA256，纯 Web Crypto，无第三方依赖） ----------
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

// ---------- 口令校验（返回 { ok, hash, salt } 或 { ok:false }） ----------
async function verifyPw(sb, password) {
  if (!password) return { ok: false };
  const { data: rows, error } = await sb.from('admin_auth').select('password_hash, salt').eq('id', 1).maybeSingle();
  if (error || !rows) return { ok: false };
  const hash = await hashPassword(password, rows.salt);
  if (!safeEqual(hash, rows.password_hash)) return { ok: false };
  return { ok: true, hash, salt: rows.salt };
}

// ---------- 业务路由 ----------
async function handle(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 204, headers: corsHeaders });
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

    /* ===== 公开写入（访客留言 / 回复 / 点赞） ===== */
    case 'add_message': {
      const name = String(body.name || '').slice(0, 50);
      const message = String(body.message || '').slice(0, 2000);
      const time = Number(body.time) || Date.now();
      if (!message) return json({ ok: false, error: 'empty' });
      const id = String(body.id || (time + '_' + Math.random().toString(36).slice(2, 11)));
      const { error } = await sb.from('guestbook_messages').insert({ id, name, message, time, likes: 0, replies: [] });
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
