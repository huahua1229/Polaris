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
  var duckImg = document.getElementById('fabDuck');
  var coverImg = document.getElementById('fabCover');

  function fmt(s){ if(!s||isNaN(s)) return '0:00'; var m=Math.floor(s/60), sec=Math.floor(s%60); return m+':'+String(sec).padStart(2,'0'); }

  fab.addEventListener('click', function(){
    if (bar.classList.contains('open')) {
      bar.classList.remove('open');
      fab.classList.remove('bar-open');
    } else {
      bar.classList.add('open');
      fab.classList.add('bar-open');
    }
  });

  playBtn.addEventListener('click', function(e){
    e.stopPropagation();
    if (audio.paused) {
      audio.play().catch(function(){});
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play', function(){
    playBtn.textContent = '\u23F8';
    fab.classList.add('playing');
    duckImg.style.display = 'none';
    coverImg.style.display = '';
  });
  audio.addEventListener('pause', function(){
    playBtn.textContent = '\u25B6';
    fab.classList.remove('playing');
    duckImg.style.display = '';
    coverImg.style.display = 'none';
  });
  audio.addEventListener('timeupdate', function(){
    if(audio.duration){ fill.style.width = (audio.currentTime/audio.duration*100)+'%'; }
    curEl.textContent = fmt(audio.currentTime);
    durEl.textContent = fmt(audio.duration);
  });
  progress.addEventListener('click', function(e){
    var r = progress.getBoundingClientRect();
    audio.currentTime = (e.clientX-r.left)/r.width * audio.duration;
  });
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

  function loadTrack(i){
    if(!playlist.length) return;
    currentIdx = (i + playlist.length) % playlist.length;
    var m = playlist[currentIdx];
    audio.src = STORAGE + m.file_path;
    barTitle.textContent = m.title;
    barArtist.textContent = m.artist || '';
    var bc = document.getElementById('barCover');
    if(bc){ bc.src = m.cover ? STORAGE + m.cover : 'static/avatar.png'; }
  }
  function nextTrack(){
    if(playlist.length > 1) loadTrack(currentIdx + 1);
    else { audio.currentTime = 0; audio.play(); }
  }

  audio.addEventListener('ended', nextTrack);

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
