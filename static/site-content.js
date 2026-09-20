/* ============================================================
   Polaris 小站 · 站点内容数据层
   - 所有动态板块内容集中在这里（默认数据）
   - 作者通过「内容管理」面板修改后存入 localStorage
   - 页面渲染时优先读取 localStorage，无修改则用默认数据
   ============================================================ */
window.PolarisSite = (function () {
    'use strict';
    var KEY = 'polaris_site_content_v1';

    var DEFAULTS = {
        profile: {
            name: 'Polaris',
            bio: '在代码与山海之间寻找平衡',
            greet: '每一条留言我都会认真看~',
            phone: '15112318680',
            email: '2728817118@qq.com',
            location: '珠海',
            age: '19 岁',
            status: '在校学生',
            interests: '🎮 打游戏,⛰️ 爬山,🌊 看海,🎵 听音乐,🤖 大模型,📊 数据挖掘',
            awards: '✦ 泰迪杯 全国专科组 三等奖（2026）\n✦ 泰迪杯 广东省专科组 二等奖（2026）\n✦ 全国大学生数学建模竞赛 参与'
        },
        about: '你好！我是 Polaris，一名来自广东科学技术职业学院大模型应用专业的大学生。我热爱人工智能与数据挖掘技术，曾获 2026 年（第 14 届）泰迪杯数据挖掘挑战赛全国专科组三等奖与广东省专科组二等奖，并参与全国大学生数学建模竞赛。课余时间喜欢打游戏、爬山、看海、听音乐，在代码与山海之间寻找平衡。这个网站是我的个人主页，记录学习历程、项目作品与生活点滴，希望能在这里和你成为朋友~',
        skills: [
            { name: 'HTML / CSS', sub: '前端基础', pct: 90 },
            { name: 'JavaScript', sub: '交互与动效', pct: 85 },
            { name: 'Python', sub: '数据分析 / 大模型', pct: 80 },
            { name: 'Vue / React', sub: '前端框架', pct: 75 },
            { name: 'UI 设计', sub: '视觉与原型', pct: 70 },
            { name: '其他技能', sub: '持续学习中', pct: 50 }
        ],
        homeProjects: [
            { title: '项目名称 1', desc: '基于 Vue3 + TypeScript 的 Web 应用，前端开发方向。' },
            { title: '项目名称 2', desc: '基于 Python 的自然语言处理项目，AI 应用方向。' },
            { title: '项目名称 3', desc: '移动端 APP UI 设计，视觉与交互方向。' }
        ],
        timeline: [
            { time: '2026.06', role: '泰迪杯数据挖掘挑战赛', desc: '作品「秦直道」的路线规划，获全国专科组三等奖、广东省专科组二等奖。' },
            { time: '在校', role: '全国大学生数学建模竞赛', desc: '参与全国大学生数学建模竞赛，具体时间及成果（待补充）。' },
            { time: '20XX.XX', role: '学生会 / 社团经历（待补充）', desc: '担任职务、组织活动、取得成果等经历描述，等你来补充~' }
        ],
        honors: [
            { name: '泰迪杯 全国专科组 三等奖', tag: '2026 年（第 14 届）数据挖掘挑战赛', img: 'static/award_teddy_national.png' },
            { name: '泰迪杯 广东省专科组 二等奖', tag: '2026 年（第 14 届）数据挖掘挑战赛', img: 'static/award_teddy_guangdong.png' }
        ],
        resumeIntro: '广东科学技术职业学院大模型应用专业在校学生，19 岁，热爱人工智能与数据挖掘技术。曾获 2026 年（第 14 届）泰迪杯数据挖掘挑战赛全国专科组三等奖、广东省专科组二等奖（作品：「秦直道」的路线规划），参与全国大学生数学建模竞赛。具备扎实的数据分析基础和大模型应用能力，学习能力强，乐于探索新技术。课余时间喜欢打游戏、爬山、看海、听音乐，在代码与山海之间寻找平衡。',
        education: [
            { time: '在校', role: '广东科学技术职业学院', sub: '大模型应用 · 大专', desc: '🏆 2026 年（第 14 届）泰迪杯数据挖掘挑战赛 全国专科组 三等奖\n🏆 2026 年（第 14 届）泰迪杯数据挖掘挑战赛 广东省专科组 二等奖\n📝 作品：「秦直道」的路线规划\n🏆 参与全国大学生数学建模竞赛\n主修课程、GPA 等（待补充）' }
        ],
        experience: [
            { company: '公司名称（待补充）', time: '20XX.XX - 至今', role: '职位名称 · 部门', desc: '工作职责与业绩：负责 XXX 项目的开发与维护；优化 XXX 性能，提升 XXX 指标 XX%；带领 X 人团队完成 XXX 项目。' },
            { company: '公司名称（可选）', time: '20XX.XX - 20XX.XX', role: '职位名称', desc: '工作职责与业绩（待补充）' }
        ],
        resumeProjects: [
            { ico: '🖥️', tags: '技术标签,角色', title: '项目名称 1（待补充）', desc: '项目简介：这是一个 XXX 项目，主要功能包括 XXX。我在项目中担任 XXX 角色，负责 XXX 模块的开发。项目成果：XXX。' },
            { ico: '🧠', tags: '技术标签,角色', title: '项目名称 2（待补充）', desc: '项目简介：这是一个 XXX 项目，主要功能包括 XXX。我在项目中担任 XXX 角色，负责 XXX 模块的开发。项目成果：XXX。' },
            { ico: '🎨', tags: '技术标签,角色', title: '项目名称 3（待补充）', desc: '项目简介：这是一个 XXX 项目，主要功能包括 XXX。我在项目中担任 XXX 角色，负责 XXX 模块的开发。项目成果：XXX。' }
        ],
        selfEval: [
            '性格特点：开朗乐观，喜欢与人交流（待补充）',
            '学习能力：学习能力强，乐于探索新技术（待补充）',
            '团队协作：善于团队合作（待补充）',
            '职业态度：认真负责，追求极致（待补充）',
            '兴趣爱好：🎮 打游戏、⛰️ 爬山、🌊 看海、🎵 听音乐'
        ],
        projects: [
            { title: '项目名称 1', ico: '🖥️', tags: 'Vue,TypeScript,前端', cat: 'frontend', catLabel: '前端', stars: 128, desc: '项目简介：这是一个基于 Vue3 + TypeScript 的 Web 应用，实现了 XXX 功能，采用 XXX 架构设计，支持 XXX 特性（内容待补充）。' },
            { title: '项目名称 2', ico: '🧠', tags: 'Python,AI,NLP', cat: 'ai', catLabel: 'Python', stars: 86, desc: '项目简介：基于 Python 的自然语言处理项目，使用 XXX 模型，实现了 XXX 功能，准确率达到 XX%（内容待补充）。' },
            { title: '项目名称 3', ico: '🎨', tags: 'UI设计,Figma', cat: 'ui', catLabel: '设计', stars: 52, desc: '项目简介：移动端 APP UI 设计项目，包含 XX 个页面，采用 XXX 设计风格，获得 XXX 设计奖（内容待补充）。' },
            { title: '项目名称 4', ico: '⚙️', tags: 'React,Node.js,全栈', cat: 'frontend course', catLabel: 'JavaScript', stars: 34, desc: '项目简介：全栈 Web 应用，前端 React + 后端 Node.js，实现了 XXX 功能，支持用户注册登录、数据管理（内容待补充）。' },
            { title: '项目名称 5', ico: '📊', tags: '数据分析,Pandas,可视化', cat: 'ai course', catLabel: 'Python', stars: 21, desc: '项目简介：数据分析项目，使用 Pandas 处理 XX 数据，Matplotlib / ECharts 可视化，得出 XXX 结论（内容待补充）。' },
            { title: '项目名称 6', ico: '📱', tags: '小程序,微信', cat: 'course', catLabel: '小程序', stars: 15, desc: '项目简介：微信小程序项目，实现了 XXX 功能，用户量达到 XXX，获得 XXX 奖项（内容待补充）。' }
        ],
        blogArticles: [
            { title: 'Vue3 组合式 API 最佳实践总结', date: '2026-09-10', cat: 'frontend', catLabel: '前端', tags: 'Vue', cover: 'Vue', grad: '', excerpt: '本文总结了 Vue3 组合式 API 的使用经验，包括 setup 函数、响应式数据、生命周期钩子、自定义 Hooks 等方面的最佳实践，结合实际项目案例进行详细讲解，帮助你写出更清晰、更易维护的 Vue3 代码。' },
            { title: '从零开始搭建一个 AI 聊天助手', date: '2026-09-05', cat: 'python', catLabel: 'Python', tags: 'Python AI', cover: 'AI', grad: 'a8e6cf,88d8b0', excerpt: '本文详细介绍了如何使用 Python Flask 框架和大语言模型 API 搭建一个 AI 聊天助手，包括后端接口设计、前端页面开发、上下文记忆功能实现等完整流程，一步步带你从零开始。' },
            { title: '数据结构与算法学习笔记（一）', date: '2026-08-28', cat: 'notes', catLabel: '学习笔记', tags: '算法 数据结构', cover: '算法', grad: 'ffd3a5,fd6585', excerpt: '本篇笔记整理了常见数据结构（数组、链表、栈、队列、树、图）的核心概念和经典算法，配合 LeetCode 例题进行详细解析，帮助大家打好算法基础，循序渐进地提升解题能力。' },
            { title: '大学生活感悟：那些成长的瞬间', date: '2026-08-20', cat: 'life', catLabel: '生活', tags: '大学生活', cover: '随笔', grad: 'a18cd1,fbc2eb', excerpt: '回顾大学时光，有欢笑也有泪水，有迷茫也有收获。这篇文章记录了我大学生活中的一些成长瞬间和感悟，希望能给正在读大学的你一些启发，一起在成长的路上互相陪伴。' }
        ]
    };

    function clone(o) {
        return o === undefined ? undefined : JSON.parse(JSON.stringify(o));
    }

    function load() {
        try {
            var raw = localStorage.getItem(KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                // 浅合并：新版本字段缺失时回退默认
                var merged = clone(DEFAULTS);
                for (var k in parsed) {
                    if (parsed.hasOwnProperty(k) && merged.hasOwnProperty(k)) merged[k] = parsed[k];
                }
                return merged;
            }
        } catch (e) { /* 数据损坏时回退默认 */ }
        return clone(DEFAULTS);
    }

    function save(c) {
        localStorage.setItem(KEY, JSON.stringify(c));
    }

    function reset() {
        localStorage.removeItem(KEY);
    }

    /* ---------- 作者口令 ---------- */
    var PASSWORD_KEY = 'polaris_admin_password';
    var DEFAULT_PASSWORD = 'zhuozhihua@123';
    function getPassword() {
        if (window.PolarisCloud && window.PolarisCloud.enabled()) return ''; // 云端模式：口令仅存服务器
        try { return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD; }
        catch (e) { return DEFAULT_PASSWORD; }
    }
    function setPassword(pw) {
        if (window.PolarisCloud && window.PolarisCloud.enabled()) return false; // 云端模式走服务器
        try { localStorage.setItem(PASSWORD_KEY, pw); return true; }
        catch (e) { return false; }
    }

    /* ============ 云端（Supabase）异步接口，未配置/失败自动回退本地 ============ */
    function cloudEnabled() {
        return !!(window.PolarisCloud && window.PolarisCloud.enabled());
    }

    function mergeDefaults(data) {
        if (!data || typeof data !== 'object') return clone(DEFAULTS);
        var merged = clone(DEFAULTS);
        for (var k in data) {
            if (data.hasOwnProperty(k) && merged.hasOwnProperty(k)) merged[k] = data[k];
        }
        return merged;
    }

    /* 读取内容：云端优先，失败/未配置回退本地缓存（同步 load 的异步版本） */
    function loadAsync() {
        var local = load();
        if (!cloudEnabled()) return Promise.resolve(local);
        return window.PolarisCloud.loadContentAsync().then(function (r) {
            if (r && r.ok && r.data) {
                var merged = mergeDefaults(r.data);
                save(merged); // 同步一份到本地缓存，保证离线可看
                return merged;
            }
            return local;
        }).catch(function () { return local; });
    }

    /* 保存内容（作者操作）：云端模式需要口令，成功后再写本地缓存 */
    function saveAsync(c, password) {
        if (cloudEnabled()) {
            return window.PolarisCloud.saveContentAsync(c, password || '').then(function (r) {
                if (r && r.ok) { save(c); return { ok: true }; }
                return { ok: false, error: r && r.error };
            });
        }
        save(c);
        return Promise.resolve({ ok: true });
    }

    /* 口令校验（异步）：云端走服务器，本地模式走本地比对 */
    function verifyPasswordAsync(pw) {
        if (cloudEnabled()) {
            return window.PolarisCloud.verifyPasswordAsync(pw).then(function (r) {
                return { ok: !!(r && r.ok) };
            });
        }
        return Promise.resolve({ ok: pw === getPassword() });
    }

    /* 修改口令（异步）：云端模式需当前口令，成功后更新本地缓存 */
    function changePasswordAsync(currentPw, newPw) {
        if (cloudEnabled()) {
            return window.PolarisCloud.changePasswordAsync(currentPw || '', newPw || '').then(function (r) {
                if (r && r.ok) {
                    try { localStorage.setItem(PASSWORD_KEY, newPw); } catch (e) { }
                    return { ok: true };
                }
                return { ok: false, error: r && r.error };
            });
        }
        if (setPassword(newPw)) return Promise.resolve({ ok: true });
        return Promise.resolve({ ok: false });
    }

    /* 恢复默认（作者操作） */
    function resetAsync(password) {
        if (cloudEnabled()) {
            return window.PolarisCloud.resetContentAsync(password || '').then(function (r) {
                if (r && r.ok) { reset(); return { ok: true }; }
                return { ok: false, error: r && r.error };
            });
        }
        reset();
        return Promise.resolve({ ok: true });
    }

    return {
        KEY: KEY,
        DEFAULTS: DEFAULTS,
        load: load,
        save: save,
        reset: reset,
        clone: clone,
        PASSWORD_KEY: PASSWORD_KEY,
        DEFAULT_PASSWORD: DEFAULT_PASSWORD,
        getPassword: getPassword,
        setPassword: setPassword,
        cloudEnabled: cloudEnabled,
        loadAsync: loadAsync,
        saveAsync: saveAsync,
        verifyPasswordAsync: verifyPasswordAsync,
        changePasswordAsync: changePasswordAsync,
        resetAsync: resetAsync
    };
})();
