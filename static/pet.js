/* ============================================================
   绘梨衣 · 头像开关 v3
   —— 可拖动的圆形头像，拉动松手时弹出对话气泡
   自包含：自动注入样式与 DOM，页面只需引入本脚本
   ============================================================ */
(function () {
    'use strict';
    if (window.__xiaohuiPetInited) return;
    window.__xiaohuiPetInited = true;

    var css = [
        '.erii-fab{position:fixed;bottom:96px;right:20px;z-index:100;width:58px;height:58px;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;',
        'border-radius:50%;border:3px solid #ff9ec7;padding:0;background:transparent;',
        'box-shadow:0 0 0 3px rgba(196,77,255,.35),0 6px 18px rgba(196,77,255,.45);',
        'animation:eriiFloat 3s ease-in-out infinite;',
        'transition:left .35s cubic-bezier(.34,1.56,.64,1),top .35s cubic-bezier(.34,1.56,.64,1);}',
        '@keyframes eriiFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}',
        '.erii-fab.dragging{cursor:grabbing;animation:none;transition:none;transform:scale(1.15);box-shadow:0 0 0 5px rgba(255,158,199,.5),0 10px 24px rgba(196,77,255,.55);}',
        '.erii-fab img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;pointer-events:none;}',
        '.erii-bubble{position:absolute;bottom:calc(100% + 12px);right:0;transform:scale(0);transform-origin:bottom right;',
        'background:rgba(255,255,255,.96);color:#666;padding:8px 14px;border-radius:14px;font-size:12px;line-height:1.6;',
        'max-width:220px;width:max-content;text-align:center;white-space:normal;box-shadow:0 4px 14px rgba(255,107,157,.3);',
        'transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .3s;z-index:4;pointer-events:none;opacity:0;}',
        '.erii-bubble::after{content:"";position:absolute;bottom:-7px;right:14px;border:7px solid transparent;border-top-color:rgba(255,255,255,.96);}',
        '.erii-bubble.show{transform:scale(1);opacity:1;}',
        '@media (prefers-reduced-motion:reduce){.erii-fab{animation:none !important;transition:none !important;}}'
    ].join('\n');
    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    var root = document.createElement('div');
    root.id = 'eriiFab';
    root.className = 'erii-fab';
    root.innerHTML =
        '<img src="static/avatar.png" alt="小绘" draggable="false">' +
        '<div class="erii-bubble" id="eriiBubble"></div>';
    document.body.appendChild(root);
    var bubble = root.querySelector('.erii-bubble');

    /* ================= 台词 ================= */
    var LINES = {
        morning: ['早上好呀~新的一天也要元气满满！', '早安~记得吃早餐哦~'],
        noon: ['中午好呀~午饭吃了什么？', '午安~吃饱了才有力气干活~'],
        afternoon: ['下午好~加油加油！', '午后时光，也要开心呀~'],
        evening: ['晚上好~今天辛苦啦！', '晚上好~放松一下吧~'],
        night: ['夜深了…早点休息哦', '这么晚还在呀？注意身体哦'],
        drag: ['嘿咻~要把我拉到哪里去呀？', '轻一点轻一点~', '唔…这个位置也不错！', '嘻嘻，被你拉住啦~', '好啦好啦，我就在这陪你~'],
        first: ['你好呀~我是小绘♡ 拉住我聊聊吧~']
    };
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    function greeting() {
        var h = new Date().getHours();
        var key = h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 13 ? 'noon' : h >= 13 && h < 18 ? 'afternoon' : h >= 18 && h < 23 ? 'evening' : 'night';
        return pick(LINES[key]);
    }

    /* ================= 气泡 ================= */
    var bubbleTimer = null;
    function show(t, dur) {
        bubble.textContent = t;
        bubble.classList.remove('show');
        void bubble.offsetWidth;
        bubble.classList.add('show');
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(function () { bubble.classList.remove('show'); }, dur || 2800);
    }

    /* ================= 位置记忆 / 边缘吸附 ================= */
    function loadPos() {
        try {
            var s = JSON.parse(localStorage.getItem('erii_fab_pos') || 'null');
            if (s && typeof s.left === 'number' && typeof s.top === 'number') {
                root.style.right = 'auto'; root.style.bottom = 'auto';
                root.style.left = s.left + 'px'; root.style.top = s.top + 'px';
            }
        } catch (e) {}
    }
    function savePos() {
        try {
            var r = root.getBoundingClientRect();
            localStorage.setItem('erii_fab_pos', JSON.stringify({ left: r.left, top: r.top }));
        } catch (e) {}
    }
    function snap() {
        var vw = window.innerWidth, vh = window.innerHeight;
        var r = root.getBoundingClientRect();
        var left = r.left, top = r.top;
        if (vw - (left + r.width) < 80) left = vw - r.width - 12;
        else if (left < 80) left = 12;
        if (vh - (top + r.height) < 100) top = vh - r.height - 100;
        if (top < 10) top = 10;
        root.style.left = left + 'px';
        root.style.top = top + 'px';
    }

    /* ================= 拖拽（松手触发气泡） ================= */
    var drag = { on: false, sx: 0, sy: 0, lx: 0, ly: 0, moved: false };

    function beginDrag(x, y) {
        var r = root.getBoundingClientRect();
        drag.on = true; drag.sx = x; drag.sy = y;
        drag.lx = r.left; drag.ly = r.top; drag.moved = false;
        root.classList.add('dragging');
        root.style.right = 'auto'; root.style.bottom = 'auto';
        root.style.left = r.left + 'px'; root.style.top = r.top + 'px';
    }
    function moveDrag(x, y) {
        if (!drag.on) return;
        var dx = x - drag.sx, dy = y - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
        root.style.left = (drag.lx + dx) + 'px';
        root.style.top = (drag.ly + dy) + 'px';
    }
    function endDrag() {
        if (!drag.on) return;
        drag.on = false;
        root.classList.remove('dragging');
        if (drag.moved) {
            snap();
            savePos();
            show(pick(LINES.drag), 2800);
        }
    }

    root.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        beginDrag(e.clientX, e.clientY);
        e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) { moveDrag(e.clientX, e.clientY); });
    document.addEventListener('mouseup', endDrag);

    root.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        beginDrag(t.clientX, t.clientY);
        e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', function (e) {
        if (!drag.on) return;
        var t = e.touches[0];
        moveDrag(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchend', endDrag);

    /* ================= 初始化 ================= */
    loadPos();
    setTimeout(function () { show(greeting(), 3600); }, 800);
})();
