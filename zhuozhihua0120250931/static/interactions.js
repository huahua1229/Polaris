/* ============================================
   Polaris 的小站 - 互动特效模块
   结合二次元樱花风格的趣味交互
   ============================================ */

(function() {
    'use strict';

    /* ========== 1. 鼠标樱花跟随特效 ========== */
    function initMouseTrail() {
        const trailContainer = document.createElement('div');
        trailContainer.id = 'mouseTrailContainer';
        trailContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9998;overflow:hidden;';
        document.body.appendChild(trailContainer);

        const sakuraChars = ['🌸', '🌺', '✿', '❀', '💮'];
        let lastTrailTime = 0;

        document.addEventListener('mousemove', function(e) {
            const now = Date.now();
            if (now - lastTrailTime < 60) return; // 限制频率
            lastTrailTime = now;

            const petal = document.createElement('div');
            petal.textContent = sakuraChars[Math.floor(Math.random() * sakuraChars.length)];
            petal.style.cssText = `
                position: absolute;
                left: ${e.clientX + (Math.random() - 0.5) * 20}px;
                top: ${e.clientY + (Math.random() - 0.5) * 20}px;
                font-size: ${10 + Math.random() * 8}px;
                opacity: 0.8;
                pointer-events: none;
                animation: sakuraTrailFade 1.2s ease-out forwards;
                transform: rotate(${Math.random() * 360}deg);
            `;
            trailContainer.appendChild(petal);

            setTimeout(() => {
                if (petal.parentNode) petal.parentNode.removeChild(petal);
            }, 1300);
        });

        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes sakuraTrailFade {
                0% { opacity: 0.9; transform: translateY(0) rotate(0deg) scale(1); }
                100% { opacity: 0; transform: translateY(40px) rotate(180deg) scale(0.3); }
            }
        `;
        document.head.appendChild(style);
    }

    /* ========== 2. 点击爆发爱心/樱花特效 ========== */
    function initClickBurst() {
        document.addEventListener('click', function(e) {
            // 避免在输入框、按钮等交互元素上触发
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
                e.target.tagName === 'BUTTON' || e.target.closest('button') ||
                e.target.closest('a') || e.target.closest('.pet-container') ||
                e.target.closest('.music-player')) {
                return;
            }

            const burstChars = ['❤️', '💖', '💕', '🌸', '✨', '💫'];
            const count = 8 + Math.floor(Math.random() * 5);

            for (let i = 0; i < count; i++) {
                const particle = document.createElement('div');
                particle.textContent = burstChars[Math.floor(Math.random() * burstChars.length)];
                const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
                const distance = 50 + Math.random() * 60;
                const dx = Math.cos(angle) * distance;
                const dy = Math.sin(angle) * distance - 30; // 稍微向上

                particle.style.cssText = `
                    position: fixed;
                    left: ${e.clientX}px;
                    top: ${e.clientY}px;
                    font-size: ${12 + Math.random() * 10}px;
                    pointer-events: none;
                    z-index: 9999;
                    transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    opacity: 1;
                `;
                document.body.appendChild(particle);

                // 触发动画
                requestAnimationFrame(() => {
                    particle.style.transform = `translate(${dx}px, ${dy}px) scale(0.3) rotate(${Math.random() * 360}deg)`;
                    particle.style.opacity = '0';
                });

                setTimeout(() => {
                    if (particle.parentNode) particle.parentNode.removeChild(particle);
                }, 900);
            }
        });
    }

    /* ========== 3. 页面标题变化彩蛋 ========== */
    function initTitleChange() {
        const originalTitle = document.title;
        const awayTitle = '小绘等你回来~🌸';
        const backTitle = '欢迎回来~小绘一直在♡';

        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                document.title = awayTitle;
            } else {
                document.title = backTitle;
                setTimeout(() => {
                    document.title = originalTitle;
                }, 2000);
            }
        });
    }

    /* ========== 4. 控制台彩蛋 ========== */
    function initConsoleEasterEgg() {
        const asciiArt = `
🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸
  欢迎来到Polaris 的小站~
  我是小绘♡ 会一直陪着你的哦
  发现控制台的你，一定是个程序员吧~
  加油加油！你是最棒的！✨
🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸🌸
`;
        console.log('%c' + asciiArt, 'color: #ff6b9d; font-size: 14px; font-family: monospace;');
        console.log('%c💡 小提示：点击页面空白处有惊喜哦~', 'color: #c44dff; font-size: 13px;');
        console.log('%c🌸 鼠标移动会有樱花飘落哦~', 'color: #ff9ec7; font-size: 13px;');
    }

    /* ========== 5. 复制内容提示 ========== */
    function initCopyTip() {
        document.addEventListener('copy', function() {
            showFloatingTip('已复制啦~小绘帮你收好♡');
        });
    }

    // 浮动提示工具函数
    function showFloatingTip(text) {
        const tip = document.createElement('div');
        tip.textContent = text;
        tip.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            background: linear-gradient(135deg, rgba(255,158,199,0.95), rgba(196,77,255,0.95));
            color: #fff;
            padding: 10px 24px;
            border-radius: 20px;
            font-family: 'ZCOOL KuaiLe', cursive;
            font-size: 14px;
            z-index: 10000;
            opacity: 0;
            transition: all 0.4s ease;
            box-shadow: 0 4px 15px rgba(255,107,157,0.4);
            pointer-events: none;
        `;
        document.body.appendChild(tip);

        requestAnimationFrame(() => {
            tip.style.opacity = '1';
            tip.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(() => {
            tip.style.opacity = '0';
            tip.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => {
                if (tip.parentNode) tip.parentNode.removeChild(tip);
            }, 400);
        }, 2000);
    }

    /* ========== 6. 滚动淡入动画 ========== */
    function initScrollReveal() {
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .reveal-element {
                opacity: 0;
                transform: translateY(30px);
                transition: opacity 0.8s ease, transform 0.8s ease;
            }
            .reveal-element.revealed {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);

        // 给主要内容卡片添加reveal类
        const selectors = ['.content-card', '.resume-card', '.project-card', '.blog-card',
                          '.message-card', '.side-card', '.award-card', '.timeline-item'];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach((el, idx) => {
                el.classList.add('reveal-element');
                el.style.transitionDelay = (idx % 4) * 0.1 + 's';
            });
        });

        // 使用IntersectionObserver
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

            document.querySelectorAll('.reveal-element').forEach(el => observer.observe(el));
        } else {
            // 降级：直接显示
            document.querySelectorAll('.reveal-element').forEach(el => el.classList.add('revealed'));
        }
    }

    /* ========== 7. 页面加载完成欢迎提示 ========== */
    function initWelcomeTip() {
        window.addEventListener('load', function() {
            setTimeout(() => {
                const tips = [
                    '欢迎来到Polaris 的小站~🌸',
                    '小绘在这里等你很久啦♡',
                    '今天也要开开心心的哦~✨',
                    '有什么想了解的都可以看看~',
                    '记得听听背景音乐哦🎵'
                ];
                showFloatingTip(tips[Math.floor(Math.random() * tips.length)]);
            }, 800);
        });
    }

    /* ========== 8. 右键菜单彩蛋 ========== */
    function initContextMenuEasterEgg() {
        // 不阻止默认右键，只是在右键时显示小提示
        document.addEventListener('contextmenu', function() {
            // 不阻止默认菜单，只是一个小彩蛋
        });
    }

    /* ========== 初始化所有互动功能 ========== */
    function init() {
        try { initMouseTrail(); } catch(e) { console.warn('鼠标跟随特效初始化失败:', e); }
        try { initClickBurst(); } catch(e) { console.warn('点击爆发特效初始化失败:', e); }
        try { initTitleChange(); } catch(e) { console.warn('标题变化彩蛋初始化失败:', e); }
        try { initConsoleEasterEgg(); } catch(e) {}
        try { initCopyTip(); } catch(e) { console.warn('复制提示初始化失败:', e); }
        try { initScrollReveal(); } catch(e) { console.warn('滚动淡入初始化失败:', e); }
        try { initWelcomeTip(); } catch(e) {}
    }

    // DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
