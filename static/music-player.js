/* ============================================================
   Polaris 小站 · 音乐播放器（游客可见）
   ------------------------------------------------------------
   作用：页面右下角的小黄鸭按钮 + 底部常驻播放条。
   - 点小黄鸭：展开 / 收起播放条（切换视图时播放条常驻不断音）
   - 播放 / 暂停 / 上一首 / 下一首 / 点击进度跳转 / 音量调节
   - 播放状态统一跟随 <audio id="bgMusic"> 元素，切换视图不中断
   - 歌曲列表从云端音乐库（Supabase Storage）拉取
   ============================================================ */
(function(){
  var fab = document.getElementById('playerFab');
  var bar = document.getElementById('playerBar');
  var audio = document.getElementById('bgMusic');
  var playBtn = document.getElementById('playerPlay');
  var progress = document.getElementById('playerProgress');
  var fill = document.getElementById('playerFill');
  var curEl = document.getElementById('playerCur');
  var durEl = document.getElementById('playerDur');
  var volBar = document.getElementById('playerVolBar');
  var volFill = document.getElementById('playerVolFill');
  var volIcon = document.getElementById('playerVolIcon');
  var barTitle = document.getElementById('barTitle');
  var barArtist = document.getElementById('barArtist');
  var prevBtn = document.getElementById('playerPrev');
  var nextBtn = document.getElementById('playerNext');
  var duckImg = document.getElementById('fabDuck');
  var coverImg = document.getElementById('fabCover');

  function fmt(s){ if(!s||isNaN(s)) return '0:00'; var m=Math.floor(s/60), sec=Math.floor(s%60); return m+':'+String(sec).padStart(2,'0'); }

    /* 点击右下角小黄鸭：切换播放条的展开 / 收起状态 */
  fab.addEventListener('click', function(){
    if (bar.classList.contains('open')) {
      bar.classList.remove('open');
      fab.classList.remove('bar-open');
    } else {
      bar.classList.add('open');
      fab.classList.add('bar-open');
    }
  });

    /* 播放 / 暂停按钮：点击切换 <audio> 的播放与暂停 */
  playBtn.addEventListener('click', function(e){
    e.stopPropagation();
    if (audio.paused) {
      audio.play().catch(function(){});
    } else {
      audio.pause();
    }
  });

    /* 开始播放时：按钮变为暂停图标，小黄鸭隐藏、换成音乐封面 */
  audio.addEventListener('play', function(){
    playBtn.textContent = '\u23F8';
    fab.classList.add('playing');
    duckImg.style.display = 'none';
    coverImg.style.display = '';
  });
    /* 暂停时：按钮变回播放图标，封面隐藏、恢复小黄鸭 */
  audio.addEventListener('pause', function(){
    playBtn.textContent = '\u25B6';
    fab.classList.remove('playing');
    duckImg.style.display = '';
    coverImg.style.display = 'none';
  });
    /* 播放进度：实时刷新进度条宽度与「当前时间 / 总时长」文字 */
  audio.addEventListener('timeupdate', function(){
    if(audio.duration){ fill.style.width = (audio.currentTime/audio.duration*100)+'%'; }
    curEl.textContent = fmt(audio.currentTime);
    durEl.textContent = fmt(audio.duration);
  });
    /* 点击进度条：按点击位置跳转到对应时间点 */
  progress.addEventListener('click', function(e){
    var r = progress.getBoundingClientRect();
    audio.currentTime = (e.clientX-r.left)/r.width * audio.duration;
  });
    /* 点击音量条：按点击位置设置音量并同步图标与填充宽度 */
  volBar.addEventListener('click', function(e){
    var r = volBar.getBoundingClientRect();
    audio.volume = (e.clientX-r.left)/r.width;
    volFill.style.width = (audio.volume*100)+'%';
    volIcon.textContent = audio.volume > 0.5 ? '\uD83D\uDD0A' : (audio.volume > 0 ? '\uD83D\uDD09' : '\uD83D\uDD07');
  });
  audio.volume = 0.7;
  volFill.style.width = '70%';

  var playlist = [];
  var currentIdx = 0;
  var STORAGE = 'https://ldprlyzawsgwjtgdwexz.supabase.co/storage/v1/object/public/music/';

    /* 载入指定下标的歌曲：切换音频源、标题、歌手与封面图（支持循环） */
  function loadTrack(i){
    if(!playlist.length) return;
    currentIdx = (i + playlist.length) % playlist.length;
    var m = playlist[currentIdx];
    audio.src = STORAGE + m.file_path;
    barTitle.textContent = m.title;
    barArtist.textContent = m.artist || '';
    var bc = document.getElementById('barCover');
    if(bc){ bc.src = m.cover ? STORAGE + m.cover : 'static/avatar.webp'; }
  }
    /* 切到下一首：多于一首时循环切歌，只有一首则从头重播 */
  function nextTrack(){
    if(playlist.length > 1) loadTrack(currentIdx + 1);
    else { audio.currentTime = 0; audio.play(); }
  }

    /* 一首播完自动切下一首；上一首 / 下一首按钮：切歌后立即播放 */
  audio.addEventListener('ended', nextTrack);
  if(prevBtn) prevBtn.addEventListener('click', function(e){ e.stopPropagation(); loadTrack(currentIdx - 1); audio.play().catch(function(){}); });
  if(nextBtn) nextBtn.addEventListener('click', function(e){ e.stopPropagation(); loadTrack(currentIdx + 1); audio.play().catch(function(){}); });

    /* 从云端音乐库拉取歌曲列表并载入第一首（游客进站即可播放） */
  window.loadMusicList = function() {
    return window.PolarisCloud.call('list_music').then(function(d){
      if(d && d.ok && d.list && d.list.length){
        playlist = d.list;
        loadTrack(0);
      }
    }).catch(function(){});
  };
  loadMusicList();
})();
