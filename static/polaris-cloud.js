/* ============================================================
   Polaris 小站 · 云端数据客户端（Supabase Edge Function 封装）
   ------------------------------------------------------------
   部署前填写下方配置：
   fnUrl = Edge Function 的完整访问地址，形如
           https://xxxxxx.functions.supabase.co/polaris-api
   留空（''）时网站自动使用本地模式（localStorage），
   页面仍可正常浏览、管理内容、留言（数据只存本机浏览器）。

   安全模型：
   - 浏览内容：公开，无需登录
   - 留言 / 回复 / 点赞 / 投稿 / 友链申请：需登录（QQ邮箱注册的用户账号）
   - 审核、内容更新、音乐/相册管理：仅开发者（管理密钥），服务端校验
   - 登录凭证保存在 localStorage('polaris_user')，call() 会自动附带
   ============================================================ */
window.POLARIS_CLOUD_CONFIG = {
    fnUrl: 'https://ldprlyzawsgwjtgdwexz.supabase.co/functions/v1/super-function',
    anonKey: 'sb_publishable_vVhLivALBiNuxHUVRzfDmg_uDzYXlnr'
};

window.PolarisCloud = (function () {
    'use strict';

    var cfg = window.POLARIS_CLOUD_CONFIG || { fnUrl: 'https://ldprlyzawsgwjtgdwexz.supabase.co/functions/v1/super-function' };

    function enabled() {
        return typeof cfg.fnUrl === 'string' && cfg.fnUrl.length > 8;
    }

    function call(action, payload, timeoutMs) {
        if (!enabled()) return Promise.resolve({ ok: false, error: 'not-configured' });
        var body = { action: action };
        for (var k in payload) {
            if (Object.prototype.hasOwnProperty.call(payload, k)) body[k] = payload[k];
        }
        // 自动附带登录凭证（无需每个调用方手动传）
        try {
            var u = JSON.parse(localStorage.getItem('polaris_user') || 'null');
            if (u && u.token) body.token = u.token;
        } catch (e) {}
        return new Promise(function (resolve) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', cfg.fnUrl, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            if (cfg.anonKey) {
                xhr.setRequestHeader('apikey', cfg.anonKey);
                xhr.setRequestHeader('Authorization', 'Bearer ' + cfg.anonKey);
            }
            xhr.timeout = timeoutMs || 15000;
            xhr.onload = function () {
                try {
                    var r = JSON.parse(xhr.responseText);
                    resolve(r && typeof r === 'object' ? r : { ok: false, error: 'bad-response' });
                } catch (e) {
                    resolve({ ok: false, error: 'bad-response' });
                }
            };
            xhr.onerror = function () { resolve({ ok: false, error: 'network' }); };
            xhr.ontimeout = function () { resolve({ ok: false, error: 'timeout' }); };
            xhr.send(JSON.stringify(body));
        });
    }

    /* ---------- 内容 ---------- */
    function loadContentAsync() {
        return call('read_content');
    }
    function saveContentAsync(data, password) {
        return call('update_content', { data: data, password: password || '' });
    }
    function resetContentAsync(password) {
        return call('reset_content', { password: password || '' });
    }

    /* ---------- 口令 ---------- */
    function verifyPasswordAsync(password) {
        return call('verify_password', { password: password || '' });
    }
    function changePasswordAsync(password, newPassword) {
        return call('change_password', { password: password || '', new_password: newPassword || '' });
    }

    /* ---------- 用户账号 ---------- */
    function registerAsync(email, password, nickname, avatar) {
        return call('register', { email: email, password: password, nickname: nickname, avatar: avatar || '' });
    }
    function loginAsync(email, password) {
        return call('login', { email: email, password: password });
    }
    function developerLoginAsync(password) {
        return call('developer_login', { password: password });
    }
    function updateProfileAsync(patch) {
        return call('update_profile', patch);
    }

    /* ---------- 留言 ---------- */
    function loadMessagesAsync() {
        return call('read_messages');
    }
    function addMessageAsync(msg) {
        return call('add_message', msg);
    }
    function addReplyAsync(id, reply) {
        return call('add_reply', { id: id, name: reply.name, message: reply.message, time: reply.time, avatar: reply.avatar || '' });
    }
    function likeAsync(id, delta) {
        return call('like_message', { id: id, delta: delta });
    }
    /* 登录用户点赞：后端按账号去重，再点取消，返回 { liked, likes } */
    function toggleLikeAsync(id) {
        return call('like_message', { id: id });
    }
    function deleteMessageAsync(id, password) {
        return call('delete_message', { id: id, password: password || '' });
    }

    function uploadAttachmentAsync(file, onProgress) {
        if (!enabled()) return Promise.resolve({ ok: false, error: 'not-configured' });
        var supabaseUrl = cfg.fnUrl.split('/functions/')[0];
        var ext = file.name.split('.').pop();
        var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
        var path = 'submissions/' + Date.now() + '_' + safeName;
        var headers = {
            'apikey': cfg.anonKey,
            'Authorization': 'Bearer ' + cfg.anonKey,
            'Content-Type': 'application/octet-stream',
            'x-upsert': 'true'
        };
        return fetch(supabaseUrl + '/storage/v1/object/' + path, {
            method: 'POST',
            headers: headers,
            body: file
        }).then(function (resp) {
            if (!resp.ok) return resp.text().then(function (txt) { return { ok: false, error: 'upload-failed: ' + txt.slice(0, 200) }; });
            return { ok: true, path: path, name: file.name, size: file.size };
        }).catch(function () { return { ok: false, error: 'network' }; });
    }

    function submitPostAsync(post) { return call('submit_post', post, 15000); }
    function listPostsAsync(password) { return call('list_posts', { password: password || '' }); }
    function deletePostAsync(id, password) { return call('delete_post', { id: id, password: password || '' }); }
    function publishPostAsync(id, password) { return call('publish_post', { id: id, password: password || '' }); }

    return {
        enabled: enabled,
        call: call,
        loadContentAsync: loadContentAsync,
        saveContentAsync: saveContentAsync,
        resetContentAsync: resetContentAsync,
        verifyPasswordAsync: verifyPasswordAsync,
        changePasswordAsync: changePasswordAsync,
        registerAsync: registerAsync,
        loginAsync: loginAsync,
        developerLoginAsync: developerLoginAsync,
        updateProfileAsync: updateProfileAsync,
        loadMessagesAsync: loadMessagesAsync,
        addMessageAsync: addMessageAsync,
        addReplyAsync: addReplyAsync,
        likeAsync: likeAsync,
        toggleLikeAsync: toggleLikeAsync,
        deleteMessageAsync: deleteMessageAsync,
        uploadAttachmentAsync: uploadAttachmentAsync,
        submitPostAsync: submitPostAsync,
        listPostsAsync: listPostsAsync,
        deletePostAsync: deletePostAsync,
        publishPostAsync: publishPostAsync
    };
})();
