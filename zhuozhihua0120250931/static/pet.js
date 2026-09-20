/* ============================================================
   小绘 · 桌宠模块 v2
   —— 参考 DeepSeek 鲸鱼娘桌宠的互动设计重构
   功能：
     ① 视线跟随鼠标（平滑缓动，鼠标靠近会看向你）
     ② 拖拽 + 边缘吸附（靠近左缘吸附并转身，参考鲸鱼娘）
     ③ 单击反应 / 双击夸夸 / 长按摸头
     ④ 按时段问候 + 陪伴天数统计
     ⑤ 空闲状态机：眨眼 / 偶尔转头思考 / 长时间不动会打盹
     ⑥ 右键小菜单：戳一戳 / 夸夸我 / 回到原位 / 暂时隐身
     ⑦ 气泡带尾巴、多行自适应；位置跨页面记忆
   自包含：自动注入样式与 DOM，页面只需引入本脚本
   ============================================================ */
(function () {
    'use strict';
    if (window.__xiaohuiPetInited) return;
    window.__xiaohuiPetInited = true;

    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ================= 样式 ================= */
    var css = [
        '.pet-container{position:fixed;bottom:86px;right:20px;z-index:100;cursor:grab;user-select:none;perspective:800px;transition:left .4s cubic-bezier(.34,1.56,.64,1),top .4s cubic-bezier(.34,1.56,.64,1);}',
        '.pet-container.dragging{transition:none;cursor:grabbing;}',
        '.pet-container:active{cursor:grabbing;}',
        '.pet-3d-card{position:relative;transform-style:preserve-3d;animation:pet-float 3s ease-in-out infinite;}',
        '@keyframes pet-float{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}',
        '.pet-look{position:relative;transform-style:preserve-3d;will-change:transform;}',
        '.pet-image{width:120px;height:155px;object-fit:contain;object-position:bottom center;display:block;background:transparent;border:none;pointer-events:none;filter:drop-shadow(0 6px 15px rgba(255,107,157,.4)) drop-shadow(0 3px 8px rgba(196,77,255,.3));animation:pet-breath 3.2s ease-in-out infinite;transform-origin:center bottom;}',
        '@keyframes pet-breath{0%,100%{transform:scaleY(1) scaleX(1);}50%{transform:scaleY(1.012) scaleX(.996);}}',
        '.pet-container.dragging .pet-image{filter:drop-shadow(0 10px 22px rgba(255,107,157,.55)) drop-shadow(0 4px 10px rgba(196,77,255,.4));}',
        '.pet-name{position:absolute;top:-26px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,rgba(255,182,193,.92),rgba(221,160,221,.92));color:#fff;padding:3px 14px;border-radius:12px;font-family:\'ZCOOL KuaiLe\',cursive;font-size:13px;white-space:nowrap;box-shadow:0 2px 10px rgba(255,107,157,.4);z-index:3;}',
        '.pet-bubble{position:absolute;top:-58px;left:50%;transform:translateX(-50%) scale(0);background:rgba(255,255,255,.96);color:#666;padding:8px 14px;border-radius:14px;font-size:12px;line-height:1.6;max-width:230px;width:max-content;text-align:center;white-space:normal;box-shadow:0 4px 14px rgba(255,107,157,.3);transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .3s;z-index:4;pointer-events:none;opacity:0;}',
        '.pet-bubble::after{content:\'\';position:absolute;bottom:-8px;left:50%;margin-left:-6px;border:6px solid transparent;border-top-color:rgba(255,255,255,.96);}',
        '.pet-bubble.show{transform:translateX(-50%) scale(1);opacity:1;}',
        '.pet-bubble.align-left{left:auto;right:0;transform:translateX(0) scale(0);}',
        '.pet-bubble.align-left.show{transform:translateX(0) scale(1);}',
        '.pet-bubble.align-right{left:0;right:auto;transform:translateX(0) scale(0);}',
        '.pet-bubble.align-right.show{transform:translateX(0) scale(1);}',
        '.pet-bubble.zzz{background:rgba(240,244,255,.97);color:#8899cc;}',
        '.pet-bubble.zzz::after{border-top-color:rgba(240,244,255,.97);}',
        '.pet-ring{position:absolute;bottom:-5px;left:50%;transform:translateX(-50%) rotateX(75deg);width:85px;height:85px;border-radius:50%;border:3px solid transparent;border-top-color:#ff9ec7;border-right-color:#c44dff;border-bottom-color:#6b9dff;border-left-color:#ff9ec7;animation:ring-spin 3s linear infinite;box-shadow:0 0 15px rgba(255,158,199,.4);z-index:1;}',
        '@keyframes ring-spin{from{transform:translateX(-50%) rotateX(75deg) rotate(0deg);}to{transform:translateX(-50%) rotateX(75deg) rotate(360deg);}}',
        '.pet-container.bounce .pet-3d-card{animation:pet-bounce .5s ease;}',
        '@keyframes pet-bounce{0%{transform:translateY(0);}30%{transform:translateY(-20px) scale(1.06);}55%{transform:translateY(0);}75%{transform:translateY(-7px);}100%{transform:translateY(0);}}',
        '.pet-container.napping .pet-image{animation:pet-sleep 2.8s ease-in-out infinite;}',
        '@keyframes pet-sleep{0%,100%{transform:scaleY(1) scaleX(1);}50%{transform:scaleY(.982) scaleX(1.006);}}',
        '.pet-menu{position:absolute;right:-4px;bottom:calc(100% + 4px);min-width:104px;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);border-radius:12px;box-shadow:0 8px 24px rgba(255,107,157,.28);border:1px solid rgba(255,182,193,.45);overflow:hidden;z-index:5;padding:5px;}',
        '.pet-menu[hidden]{display:none;}',
        '.pet-menu-item{padding:7px 12px;font-size:12px;color:#666;border-radius:8px;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s;}',
        '.pet-menu-item:hover{background:rgba(255,182,193,.28);color:#ff6b9d;}',
        '.pet-container.pet-hidden{display:none !important;}',
        '@media print{.pet-container{display:none !important;}}',
        '@media (prefers-reduced-motion:reduce){.pet-3d-card,.pet-image,.pet-ring{animation:none !important;}.pet-container{transition:none !important;}}'
    ].join('\n');

    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    /* ================= DOM ================= */
    var root = document.getElementById('petContainer');
    if (!root) {
        root = document.createElement('div');
        document.body.appendChild(root);
    }
    root.id = 'petContainer';
    root.className = 'pet-container';
    root.innerHTML =
        '<div class="pet-menu" hidden>' +
        '  <div class="pet-menu-item" data-act="poke">戳一戳</div>' +
        '  <div class="pet-menu-item" data-act="praise">夸夸我</div>' +
        '  <div class="pet-menu-item" data-act="home">回到原位</div>' +
        '  <div class="pet-menu-item" data-act="hide">暂时隐身</div>' +
        '</div>' +
        '<div class="pet-3d-card">' +
        '  <div class="pet-name">小绘 ♡</div>' +
        '  <div class="pet-bubble" id="petBubble"></div>' +
        '  <div class="pet-look" id="petLook">' +
        '    <img src="static/pet_idle_open_t.png" class="pet-image" id="petImage" alt="小绘" draggable="false">' +
        '  </div>' +
        '  <div class="pet-ring"></div>' +
        '</div>';

    function q(sel) { return root.querySelector(sel); }
    var el = {
        container: root,
        card: q('.pet-3d-card'),
        look: q('.pet-look'),
        img: q('.pet-image'),
        bubble: q('.pet-bubble'),
        menu: q('.pet-menu')
    };

    /* ================= 帧 ================= */
    var FRAMES = {
        open: 'static/pet_idle_open_t.png',
        closed: 'static/pet_idle_closed_t.png',
        behind: 'static/pet_behind_t.png',
        thinking: 'static/pet_thinking_t.png'
    };
    var cur = 'open';
    function setFrame(n) {
        if (!FRAMES[n] || cur === n) return;
        cur = n;
        el.img.src = FRAMES[n];
    }

    /* ================= 台词 ================= */
    var LINES = {
        morning: ['早上好呀~新的一天也要元气满满！', '早安早安~小绘等你一晚上了♡', '早上好！记得吃早餐哦~'],
        noon: ['中午好呀~午饭吃了什么呀？', '午安~吃饱了才有力气干活哦', '中午好！要不要小憩一下？'],
        afternoon: ['下午好~加油加油！', '午后时光，也要开开心心的~', '下午好呀！累了就看看小绘♡'],
        evening: ['晚上好~今天辛苦啦！', '晚上好呀，小绘一直陪着你♡', '晚上好~放松一下吧！'],
        night: ['夜深了…早点休息哦，小绘守着你♡', '这么晚还在呀？要注意身体哦', '睡觉前…小绘陪你聊聊天~'],
        click: ['呜哇！吓了一跳~', '嘿嘿，找我有什么事呀？', '戳我干嘛呀~', '呀！好痒~', '在的在的！小绘在听~', '嘻嘻，我就知道你会来点我~'],
        praise: ['你最棒啦！✨', '哇，小绘超级崇拜你！', '这份努力一定会被看见的！', '你已经比昨天更厉害啦！'],
        pat: ['唔…好舒服~再摸摸嘛♡', '嘿嘿，摸头好评！', '咕噜咕噜~被摸头好开心！', '呜…蹭蹭你♡'],
        drag: ['嘿咻~要把我搬到哪里去呀？', '轻一点轻一点~', '好啦好啦，我就在这里陪你~', '唔…这个位置也不错！'],
        think: ['嗯…在想一个很复杂的问题…', '今天也在思考人生呢…', '悄悄告诉你，我在想晚上吃什么~'],
        nap: ['Zzz…小绘睡着了…', 'zzz…唔…谁在叫我…', 'Zzz…梦到小鱼干了…'],
        wake: ['呜哇！醒了醒了~', '唔…你回来啦！', '啊！被你发现小绘在偷懒…'],
        first: ['你好呀~我是小绘♡ 很高兴认识你！'],
        day: ['小绘已经陪你 {n} 天啦♡', '今天也是陪伴你的第 {n} 天~', '悄悄告诉你，小绘陪了你 {n} 天哦']
    };

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function greeting() {
        var h = new Date().getHours();
        var key = h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 13 ? 'noon' : h >= 13 && h < 18 ? 'afternoon' : h >= 18 && h < 23 ? 'evening' : 'night';
        return pick(LINES[key]);
    }

    function companionDays() {
        try {
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var first = localStorage.getItem('pet_first_visit');
            if (!first) {
                localStorage.setItem('pet_first_visit', String(today.getTime()));
                return 1;
            }
            var f = new Date(parseInt(first, 10));
            f.setHours(0, 0, 0, 0);
            return Math.max(1, Math.round((today - f) / 86400000) + 1);
        } catch (e) { return 1; }
    }

    /* ================= 气泡 ================= */
    var bubbleTimer = null;
    function show(t, dur, cls) {
        el.bubble.textContent = t;
        el.bubble.className = 'pet-bubble' + (cls ? ' ' + cls : '');
        void el.bubble.offsetWidth;
        el.bubble.classList.add('show');
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(function () {
            el.bubble.classList.remove('show');
        }, dur || 3200);
        // 防止气泡超出视口：靠近屏幕右缘时左对齐，靠近左缘时右对齐
        // 用 offsetWidth（布局宽度，不受 scale 过渡影响）计算最终位置
        setTimeout(function () {
            var w = el.bubble.offsetWidth;
            var pr = el.container.getBoundingClientRect();
            var centerX = pr.left + pr.width / 2;
            var vw = window.innerWidth;
            el.bubble.classList.remove('align-left', 'align-right');
            if (centerX + w / 2 > vw - 6) {
                el.bubble.classList.add('align-left');
            } else if (centerX - w / 2 < 6) {
                el.bubble.classList.add('align-right');
            }
        }, 30);
    }

    /* ================= 视线跟随 ================= */
    var look = { tx: 0, ty: 0, rx: 0, ry: 0, ttx: 0, tty: 0, trx: 0, try_: 0 };
    function applyLook() {
        var sx = el.container.classList.contains('face-left') ? -1 : 1;
        el.look.style.transform =
            'scaleX(' + sx + ') translate(' + look.tx.toFixed(1) + 'px,' + look.ty.toFixed(1) + 'px)' +
            ' rotateX(' + look.rx.toFixed(2) + 'deg) rotateY(' + look.ry.toFixed(2) + 'deg)';
    }
    function tickLook() {
        look.tx += (look.ttx - look.tx) * 0.12;
        look.ty += (look.tty - look.ty) * 0.12;
        look.rx += (look.trx - look.rx) * 0.12;
        look.ry += (look.try_ - look.ry) * 0.12;
        applyLook();
        requestAnimationFrame(tickLook);
    }
    function initLook() {
        document.addEventListener('mousemove', function (e) {
            var r = el.container.getBoundingClientRect();
            var cx = r.left + r.width / 2;
            var cy = r.top + r.height / 2;
            var dx = e.clientX - cx;
            var dy = e.clientY - cy;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 420) {
                look.ttx = 0; look.tty = 0; look.trx = 0; look.try_ = 0;
                return;
            }
            var k = Math.max(0, 1 - dist / 420);
            look.ttx = dx * 0.05 * k;
            look.tty = dy * 0.04 * k;
            look.trx = -dy * 0.013 * k;
            look.try_ = dx * 0.015 * k;
        });
        tickLook();
    }

    /* ================= 位置记忆 / 吸附 ================= */
    var SNAP = 110;
    function setFace(left) {
        if (left) el.container.classList.add('face-left');
        else el.container.classList.remove('face-left');
        applyLook();
    }
    function loadPos() {
        try {
            var saved = JSON.parse(localStorage.getItem('pet_position') || 'null');
            if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
                el.container.style.right = 'auto';
                el.container.style.bottom = 'auto';
                el.container.style.left = saved.left + 'px';
                el.container.style.top = saved.top + 'px';
                setFace(saved.left < window.innerWidth / 2);
            }
        } catch (e) {}
    }
    function savePos() {
        try {
            var r = el.container.getBoundingClientRect();
            localStorage.setItem('pet_position', JSON.stringify({ left: r.left, top: r.top }));
        } catch (e) {}
    }
    function snap() {
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var r = el.container.getBoundingClientRect();
        var left = r.left;
        var top = r.top;
        if (left < SNAP) {
            left = window.innerWidth < 900 ? 0 : 200;
            setFace(true);
        } else if (vw - (left + r.width) < SNAP) {
            left = vw - r.width;
            setFace(false);
        }
        if (vh - (top + r.height) < SNAP) top = vh - r.height - 72;
        if (top < 0) top = 0;
        el.container.style.left = left + 'px';
        el.container.style.top = top + 'px';
    }
    function resetHome() {
        try { localStorage.removeItem('pet_position'); } catch (e) {}
        el.container.style.left = 'auto';
        el.container.style.top = 'auto';
        el.container.style.right = '20px';
        el.container.style.bottom = '86px';
        setFace(false);
        show('小绘回来啦~♡');
    }

    /* ================= 拖拽 ================= */
    var drag = { on: false, sx: 0, sy: 0, lx: 0, ly: 0, moved: false, t: null };
    var patting = false, patDone = false;

    function startPat() {
        patting = true;
        patDone = false;
        setFrame('closed');
        show(pick(LINES.pat), 2600);
        burst();
    }
    function cancelPat() {
        if (patting) {
            patting = false;
            if (cur === 'closed') setFrame('open');
        }
    }

    function initDrag() {
        el.container.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (e.target.closest('.pet-menu')) return;
            closeMenu();
            var r = el.container.getBoundingClientRect();
            drag.on = true;
            drag.sx = e.clientX;
            drag.sy = e.clientY;
            drag.lx = r.left;
            drag.ly = r.top;
            drag.moved = false;
            el.container.classList.add('dragging');
            el.container.style.right = 'auto';
            el.container.style.bottom = 'auto';
            el.container.style.left = r.left + 'px';
            el.container.style.top = r.top + 'px';
            e.preventDefault();
            drag.t = setTimeout(function () {
                if (drag.on && !drag.moved) startPat();
            }, 600);
        });
        document.addEventListener('mousemove', function (e) {
            if (!drag.on) return;
            var dx = e.clientX - drag.sx;
            var dy = e.clientY - drag.sy;
            if (Math.abs(dx) + Math.abs(dy) > 6) {
                drag.moved = true;
                if (patting) cancelPat();
            }
            el.container.style.left = (drag.lx + dx) + 'px';
            el.container.style.top = (drag.ly + dy) + 'px';
        });
        document.addEventListener('mouseup', function () {
            if (!drag.on) return;
            drag.on = false;
            clearTimeout(drag.t);
            el.container.classList.remove('dragging');
            if (patting) {
                patting = false;
                patDone = true;
                setFrame('open');
                return;
            }
            if (drag.moved) {
                snap();
                show(pick(LINES.drag), 2600);
                savePos();
            }
        });
        // 触屏支持
        el.container.addEventListener('touchstart', function (e) {
            var t = e.touches[0];
            var r = el.container.getBoundingClientRect();
            drag.on = true;
            drag.sx = t.clientX;
            drag.sy = t.clientY;
            drag.lx = r.left;
            drag.ly = r.top;
            drag.moved = false;
            el.container.classList.add('dragging');
            el.container.style.right = 'auto';
            el.container.style.bottom = 'auto';
            el.container.style.left = r.left + 'px';
            el.container.style.top = r.top + 'px';
            e.preventDefault();
        }, { passive: false });
        document.addEventListener('touchmove', function (e) {
            if (!drag.on) return;
            var t = e.touches[0];
            var dx = t.clientX - drag.sx;
            var dy = t.clientY - drag.sy;
            if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
            el.container.style.left = (drag.lx + dx) + 'px';
            el.container.style.top = (drag.ly + dy) + 'px';
        }, { passive: true });
        document.addEventListener('touchend', function () {
            if (!drag.on) return;
            drag.on = false;
            el.container.classList.remove('dragging');
            if (drag.moved) {
                snap();
                show(pick(LINES.drag), 2600);
                savePos();
            }
        });
    }

    /* ================= 点击互动 ================= */
    var singleTimer = null;
    function initClick() {
        el.container.addEventListener('click', function (e) {
            if (e.target.closest('.pet-menu')) return;
            if (patDone) { patDone = false; return; }
            if (drag.moved) { drag.moved = false; return; }
            clearTimeout(singleTimer);
            singleTimer = setTimeout(function () {
                bounce();
                show(pick(LINES.click), 2600);
                burst();
            }, 240);
        });
        el.container.addEventListener('dblclick', function () {
            clearTimeout(singleTimer);
            setFrame('thinking');
            show(pick(LINES.praise), 3600);
            burst();
            setTimeout(function () { if (cur === 'thinking') setFrame('open'); }, 2600);
        });
    }

    function bounce() {
        el.container.classList.remove('bounce');
        void el.container.offsetWidth;
        el.container.classList.add('bounce');
        setTimeout(function () { el.container.classList.remove('bounce'); }, 520);
    }

    function burst() {
        var r = el.container.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height * 0.3;
        var chars = ['❤️', '💖', '✨', '💕'];
        for (var i = 0; i < 7; i++) {
            var p = document.createElement('div');
            p.textContent = chars[Math.floor(Math.random() * chars.length)];
            var ang = Math.random() * Math.PI * 2;
            var dist = 30 + Math.random() * 40;
            p.style.cssText =
                'position:fixed;left:' + cx + 'px;top:' + cy + 'px;' +
                'font-size:' + (11 + Math.random() * 9) + 'px;pointer-events:none;z-index:9999;' +
                'transition:all .7s cubic-bezier(.25,.46,.45,.94);opacity:1;';
            document.body.appendChild(p);
            requestAnimationFrame(function () {
                p.style.transform = 'translate(' + Math.cos(ang) * dist + 'px,' + (Math.sin(ang) * dist - 24) + 'px) scale(.2) rotate(' + (Math.random() * 360) + 'deg)';
                p.style.opacity = '0';
            });
            setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 750);
        }
    }

    /* ================= 状态机：眨眼 / 思考 / 打盹 ================= */
    var napping = false;
    function initIdle() {
        (function blinkLoop() {
            var d = 2600 + Math.random() * 3400;
            setTimeout(function () {
                if (cur === 'open' && !drag.on && !patting && !napping) {
                    setFrame('closed');
                    setTimeout(function () { if (!patting && !napping) setFrame('open'); }, 160);
                }
                blinkLoop();
            }, d);
        })();

        (function actionLoop() {
            var d = 16000 + Math.random() * 22000;
            setTimeout(function () {
                if (cur === 'open' && !drag.on && !patting && !napping) {
                    if (Math.random() < 0.5) {
                        setFrame('behind');
                        show(pick(LINES.think), 2400);
                        setTimeout(function () { if (cur === 'behind') setFrame('open'); }, 2500);
                    } else {
                        setFrame('thinking');
                        show(pick(LINES.think), 2400);
                        setTimeout(function () { if (cur === 'thinking') setFrame('open'); }, 2300);
                    }
                }
                actionLoop();
            }, d);
        })();

        var lastAct = Date.now();
        function onAct() {
            lastAct = Date.now();
            if (napping) wake();
        }
        ['mousemove', 'click', 'keydown', 'mousedown', 'touchstart', 'scroll'].forEach(function (ev) {
            document.addEventListener(ev, onAct, { passive: true });
        });

        (function napLoop() {
            setTimeout(function () {
                if (!napping && !drag.on && !patting && Date.now() - lastAct > 90000) {
                    napping = true;
                    el.container.classList.add('napping');
                    setFrame('closed');
                    show(pick(LINES.nap), 4000, 'zzz');
                }
                napLoop();
            }, 6000);
        })();
    }

    function wake() {
        napping = false;
        el.container.classList.remove('napping');
        setFrame('open');
        show(pick(LINES.wake), 2600);
    }

    /* ================= 右键菜单 ================= */
    function openMenu() { el.menu.hidden = false; }
    function closeMenu() { el.menu.hidden = true; }

    function initMenu() {
        el.container.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            openMenu();
        });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.pet-menu') && !e.target.closest('.pet-container')) closeMenu();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMenu();
        });
        el.menu.addEventListener('click', function (e) {
            var item = e.target.closest('.pet-menu-item');
            if (!item) return;
            var act = item.getAttribute('data-act');
            closeMenu();
            if (act === 'poke') {
                bounce();
                show(pick(LINES.click), 2600);
                burst();
            } else if (act === 'praise') {
                setFrame('thinking');
                show(pick(LINES.praise), 3600);
                burst();
                setTimeout(function () { if (cur === 'thinking') setFrame('open'); }, 2600);
            } else if (act === 'home') {
                resetHome();
            } else if (act === 'hide') {
                el.container.classList.add('pet-hidden');
            }
        });
    }

    /* ================= 欢迎 ================= */
    function welcome() {
        var d = companionDays();
        var msg = d === 1 ? pick(LINES.first) : greeting() + ' ' + pick(LINES.day).replace('{n}', d);
        show(msg, 4200);
    }

    /* ================= 初始化 ================= */
    function init() {
        loadPos();
        initIdle();
        initDrag();
        initClick();
        initMenu();
        if (!REDUCED) initLook();
        setTimeout(welcome, 700);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
