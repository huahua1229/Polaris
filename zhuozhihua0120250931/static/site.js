/* ============================================================
   Polaris 小站 · 全局交互与动效（网易云式体验）
   - 所有 init 函数幂等：支持「内容管理」重渲染后通过 PolarisFx.refresh() 重新初始化
   ============================================================ */
(function () {
    'use strict';
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- 顶部问候 ---------- */
    function initGreeting() {
        var el = document.getElementById('topGreeting');
        if (!el) return;
        var h = new Date().getHours();
        var msg = h < 6 ? '夜深了，注意休息~' :
                  h < 12 ? '早上好，新的一天加油~' :
                  h < 14 ? '中午好，记得吃饭哦~' :
                  h < 18 ? '下午好，来杯下午茶吧~' :
                  '晚上好，愿你有个好心情~';
        el.textContent = msg;
    }

    /* ---------- 樱花飘落 ---------- */
    function initSakura() {
        var c = document.getElementById('sakuraContainer');
        if (!c || c.dataset.ready) return;
        c.dataset.ready = '1';
        var s = ['🌸', '🌺', '✿', '❀'];
        for (var i = 0; i < 20; i++) {
            var d = document.createElement('div');
            d.className = 'sakura';
            d.textContent = s[Math.floor(Math.random() * s.length)];
            d.style.left = Math.random() * 100 + '%';
            d.style.fontSize = (11 + Math.random() * 11) + 'px';
            d.style.animationDuration = (8 + Math.random() * 11) + 's';
            d.style.animationDelay = (Math.random() * 16) + 's';
            d.style.opacity = (0.35 + Math.random() * 0.45).toFixed(2);
            c.appendChild(d);
        }
    }

    /* ---------- 音乐播放器（全局常驻，跨页记忆） ---------- */
    function initPlayer() {
        var audio = document.getElementById('bgMusic');
        var bar = document.getElementById('playerBar');
        var playBtn = document.getElementById('playerPlay');
        var progress = document.getElementById('playerProgress');
        var fill = document.getElementById('playerFill');
        var cur = document.getElementById('playerCur');
        var dur = document.getElementById('playerDur');
        var volIcon = document.getElementById('playerVolIcon');
        var volBar = document.getElementById('playerVolBar');
        var volFill = document.getElementById('playerVolFill');
        if (!audio || !playBtn) return;

        var saveTimer = null;
        function fmt(s) {
            if (isNaN(s) || !isFinite(s)) return '0:00';
            var m = Math.floor(s / 60), sec = Math.floor(s % 60);
            return m + ':' + (sec < 10 ? '0' : '') + sec;
        }
        function syncUI() {
            var playing = !audio.paused;
            if (bar) bar.classList.toggle('playing', playing);
            if (playBtn) {
                playBtn.classList.toggle('playing', playing);
                playBtn.innerHTML = playing ? '⏸' : '▶';
            }
        }
        function saveProgress() { localStorage.setItem('musicCurrentTime', audio.currentTime); }
        function togglePlay() {
            if (audio.paused) { audio.play().catch(function () { }); }
            else { audio.pause(); }
            localStorage.setItem('musicPlaying', audio.paused ? '0' : '1');
            syncUI();
        }

        playBtn.addEventListener('click', togglePlay);
        audio.addEventListener('timeupdate', function () {
            if (audio.duration) {
                fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
                cur.textContent = fmt(audio.currentTime);
            }
            if (!saveTimer) saveTimer = setTimeout(function () { saveProgress(); saveTimer = null; }, 2000);
        });
        audio.addEventListener('loadedmetadata', function () { dur.textContent = fmt(audio.duration); });
        audio.addEventListener('play', syncUI);
        audio.addEventListener('pause', function () { syncUI(); saveProgress(); });
        audio.addEventListener('ended', function () { localStorage.setItem('musicCurrentTime', 0); syncUI(); });
        if (progress) progress.addEventListener('click', function (e) {
            var r = progress.getBoundingClientRect();
            if (audio.duration) {
                audio.currentTime = (e.clientX - r.left) / r.width * audio.duration;
                saveProgress();
            }
        });
        if (volBar) {
            var volume = parseFloat(localStorage.getItem('musicVolume') || '0.7');
            audio.volume = volume;
            volFill.style.width = (volume * 100) + '%';
            volBar.addEventListener('click', function (e) {
                var r = volBar.getBoundingClientRect();
                volume = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                audio.volume = volume;
                volFill.style.width = (volume * 100) + '%';
                volIcon.textContent = volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';
                localStorage.setItem('musicVolume', volume);
            });
            volIcon.addEventListener('click', function () {
                if (audio.volume > 0) {
                    localStorage.setItem('musicPrevVol', audio.volume);
                    audio.volume = 0; volFill.style.width = '0%'; volIcon.textContent = '🔇';
                } else {
                    var pv = parseFloat(localStorage.getItem('musicPrevVol') || '0.7');
                    audio.volume = pv; volFill.style.width = (pv * 100) + '%';
                    volIcon.textContent = pv < 0.5 ? '🔉' : '🔊';
                }
            });
        }
        var savedTime = parseFloat(localStorage.getItem('musicCurrentTime') || '0');
        var savedPlaying = localStorage.getItem('musicPlaying') === '1';
        if (audio.readyState >= 1) { audio.currentTime = savedTime; }
        else { audio.addEventListener('loadedmetadata', function () { audio.currentTime = savedTime; }, { once: true }); }
        if (savedPlaying) {
            var tryPlay = function () {
                audio.play().then(syncUI).catch(function () { syncUI(); });
            };
            var autoPlayed = false;
            document.addEventListener('click', function once() {
                if (!autoPlayed && audio.paused) { tryPlay(); autoPlayed = true; }
            }, { once: true });
        }
        syncUI();
    }

    /* ---------- 入场动效（逐项错落，幂等） ---------- */
    function initReveal() {
        var items = document.querySelectorAll('.anim-in');
        if (!items.length) return;
        if (reduceMotion || !('IntersectionObserver' in window)) {
            items.forEach(function (el) { el.classList.add('run'); });
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en, i) {
                if (en.isIntersecting) {
                    var el = en.target;
                    var delay = (el.getAttribute('data-delay') || i % 4) * 80;
                    el.style.animationDelay = delay + 'ms';
                    el.classList.add('run');
                    io.unobserve(el);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
        items.forEach(function (el) { io.observe(el); });
    }

    /* ---------- 卡片 3D 倾斜跟随鼠标（防重绑） ---------- */
    function initTilt() {
        if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return;
        var cards = document.querySelectorAll('.tilt');
        cards.forEach(function (card) {
            if (card.dataset.tiltBound) return;
            card.dataset.tiltBound = '1';
            card.addEventListener('mousemove', function (e) {
                var r = card.getBoundingClientRect();
                var px = (e.clientX - r.left) / r.width - 0.5;
                var py = (e.clientY - r.top) / r.height - 0.5;
                card.style.transform = 'translateY(-5px) rotateX(' + (-py * 5).toFixed(2) + 'deg) rotateY(' + (px * 5).toFixed(2) + 'deg)';
            });
            card.addEventListener('mouseleave', function () { card.style.transform = ''; });
        });
    }

    /* ---------- 数字滚动（幂等） ---------- */
    function initCounters() {
        var nums = document.querySelectorAll('.count-num');
        if (!nums.length) return;
        function run(el) {
            var target = parseFloat(el.getAttribute('data-target'));
            var suffix = el.getAttribute('data-suffix') || '';
            var dur = 1100, t0 = null;
            function step(ts) {
                if (!t0) t0 = ts;
                var p = Math.min((ts - t0) / dur, 1);
                var eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(target * eased) + suffix;
                if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }
        if (reduceMotion || !('IntersectionObserver' in window)) {
            nums.forEach(function (el) { el.textContent = el.getAttribute('data-target') + (el.getAttribute('data-suffix') || ''); });
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
            });
        }, { threshold: 0.4 });
        nums.forEach(function (el) { io.observe(el); });
    }

    /* ---------- 技能条生长（幂等） ---------- */
    function initSkills() {
        var fills = document.querySelectorAll('.skill-fill');
        if (!fills.length) return;
        function run(el) {
            var pct = el.getAttribute('data-pct') || '0';
            el.style.setProperty('--fw', pct + '%');
            el.style.width = pct + '%';
        }
        if (reduceMotion || !('IntersectionObserver' in window)) {
            fills.forEach(run);
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
            });
        }, { threshold: 0.5 });
        fills.forEach(function (el) { io.observe(el); });
    }

    /* ---------- 滚动进度条 + 回到顶部 ---------- */
    function initScrollFx() {
        var bar = document.getElementById('scrollBar');
        var backTop = document.getElementById('backTop');
        var ticking = false;
        function update() {
            var h = document.documentElement;
            var max = h.scrollHeight - h.clientHeight;
            var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
            if (bar) bar.style.width = pct + '%';
            if (backTop) backTop.classList.toggle('show', h.scrollTop > 320);
            ticking = false;
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
        if (backTop) backTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }

    /* ---------- 移动端抽屉 ---------- */
    function initDrawer() {
        var burger = document.getElementById('hamburger');
        var nav = document.getElementById('sideNav');
        var mask = document.getElementById('maskLayer');
        if (!burger || !nav) return;
        function close() { nav.classList.remove('open'); if (mask) mask.classList.remove('show'); }
        burger.addEventListener('click', function () { nav.classList.toggle('open'); if (mask) mask.classList.toggle('show'); });
        if (mask) mask.addEventListener('click', close);
        nav.querySelectorAll('.nav-item').forEach(function (a) { a.addEventListener('click', close); });
    }

    /* ---------- 过滤器（项目页，实时查询卡片，支持重渲染） ---------- */
    function initFilters() {
        var btns = document.querySelectorAll('.filter-btn[data-filter]');
        if (!btns.length) return;
        btns.forEach(function (btn) {
            if (btn.dataset.fb) return;
            btn.dataset.fb = '1';
            btn.addEventListener('click', function () {
                btns.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                var f = btn.getAttribute('data-filter');
                document.querySelectorAll('#projectGrid [data-cat]').forEach(function (card) {
                    var cats = (card.getAttribute('data-cat') || '').split(' ');
                    var show = f === 'all' || cats.indexOf(f) >= 0;
                    card.classList.toggle('hide', !show);
                });
            });
        });
    }

    /* ---------- 博客搜索 / 分类 / 标签筛选（支持重渲染） ---------- */
    function initBlogFilters() {
        var searchInput = document.getElementById('blogSearch');
        var searchBtn = document.getElementById('blogSearchBtn');
        var empty = document.getElementById('articleEmpty');

        function apply() {
            var items = document.querySelectorAll('.article-item');
            var kw = (searchInput ? searchInput.value.trim() : '').toLowerCase();
            var activeCat = document.querySelector('.category-list a.active');
            var activeTag = document.querySelector('.tag.active');
            var cat = activeCat ? activeCat.getAttribute('data-cat') : '';
            var tag = activeTag ? activeTag.getAttribute('data-tag') : '';
            var visible = 0;
            items.forEach(function (it) {
                var text = (it.textContent || '').toLowerCase();
                var ok = true;
                if (kw && text.indexOf(kw) < 0) ok = false;
                if (cat && it.getAttribute('data-cat') !== cat) ok = false;
                if (tag && (it.getAttribute('data-tags') || '').split(' ').indexOf(tag) < 0) ok = false;
                it.style.display = ok ? '' : 'none';
                if (ok) visible++;
            });
            if (empty) empty.style.display = visible ? 'none' : 'block';
        }
        if (searchBtn && !searchBtn.dataset.sb) {
            searchBtn.dataset.sb = '1';
            searchBtn.addEventListener('click', apply);
            if (searchInput) searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') apply(); });
        }
        document.querySelectorAll('.category-list a[data-cat]').forEach(function (a) {
            if (a.dataset.cb) return;
            a.dataset.cb = '1';
            a.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelectorAll('.category-list a[data-cat]').forEach(function (x) { x.classList.remove('active'); });
                a.classList.add('active');
                document.querySelectorAll('.tag[data-tag]').forEach(function (t) { t.classList.remove('active'); });
                apply();
            });
        });
        document.querySelectorAll('.tag[data-tag]').forEach(function (t) {
            if (t.dataset.tb) return;
            t.dataset.tb = '1';
            t.addEventListener('click', function () {
                document.querySelectorAll('.tag[data-tag]').forEach(function (x) { x.classList.remove('active'); });
                t.classList.add('active');
                document.querySelectorAll('.category-list a[data-cat]').forEach(function (c) { c.classList.remove('active'); });
                apply();
            });
        });
    }

    /* ---------- Toast 轻提示（占位反馈） ---------- */
    function initToast() {
        var toast = document.createElement('div');
        toast.id = 'siteToast';
        toast.style.cssText =
            'position:fixed;left:50%;bottom:92px;transform:translateX(-50%) translateY(16px);' +
            'background:rgba(255,255,255,.94);color:#c44dff;font-size:13px;font-family:\'ZCOOL KuaiLe\',cursive;' +
            'padding:10px 22px;border-radius:18px;border:1.5px solid rgba(255,182,193,.55);' +
            'box-shadow:0 6px 24px rgba(255,107,157,.3);z-index:9999;opacity:0;pointer-events:none;' +
            'transition:all .3s cubic-bezier(.34,1.56,.64,1);';
        document.body.appendChild(toast);
        var timer = null;
        function show(msg) {
            toast.textContent = msg;
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
            clearTimeout(timer);
            timer = setTimeout(function () {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(16px)';
            }, 1800);
        }
        document.addEventListener('click', function (e) {
            var t = e.target.closest('[data-toast]');
            if (t) show(t.getAttribute('data-toast') || '功能开发中~');
        });
    }

    /* ---------- 博客文章展开 + 最新文章跳转（防重绑，支持重渲染） ---------- */
    function initBlogExpand() {
        var items = document.querySelectorAll('.article-item');
        items.forEach(function (it) {
            if (it.dataset.be) return;
            it.dataset.be = '1';
            it.addEventListener('click', function () {
                it.classList.toggle('expanded');
                var arrow = it.querySelector('.article-arrow');
                if (arrow) arrow.style.transform = it.classList.contains('expanded') ? 'rotate(90deg)' : '';
            });
        });
        var recents = document.querySelectorAll('.recent-list a[data-target]');
        recents.forEach(function (a) {
            if (a.dataset.rb) return;
            a.dataset.rb = '1';
            a.addEventListener('click', function (e) {
                e.preventDefault();
                var target = document.getElementById(a.getAttribute('data-target'));
                if (!target) return;
                target.classList.add('expanded');
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });
    }

    /* ---------- 重渲染后刷新入口（内容管理保存时调用） ---------- */
    function refresh() {
        initReveal();
        initTilt();
        initCounters();
        initSkills();
        initFilters();
        initBlogFilters();
        initBlogExpand();
    }

    document.addEventListener('DOMContentLoaded', function () {
        initGreeting();
        initSakura();
        initPlayer();
        initScrollFx();
        initDrawer();
        initToast();
        refresh();
    });

    window.PolarisFx = { refresh: refresh };
})();
