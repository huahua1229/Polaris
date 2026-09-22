// ===== 音乐库管理 =====
(function(){
  function getPw(){ return localStorage.getItem('polaris_pw') || ''; }
  function listMusic(){
    var box = document.getElementById('muList');
    if(!box) return;
    box.innerHTML = '<div style="color:#aaa;font-size:13px;">加载中...</div>';
    window.PolarisCloud.call('list_music').then(function(d){
      if(!d.ok || !d.list || !d.list.length){ box.innerHTML = '<div style="color:#aaa;font-size:13px;">暂无音乐，请上传</div>'; return; }
      box.innerHTML = '';
      d.list.forEach(function(m){
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #f0d; border-color:rgba(255,182,193,.4);border-radius:8px;';
        row.innerHTML = '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;">'+m.title+'</div><div style="font-size:11px;color:#999;">'+(m.artist||'')+'</div></div>';
        var del = document.createElement('button');
        del.textContent = '删除';
        del.style.cssText = 'padding:4px 10px;font-size:12px;border:none;border-radius:6px;background:#ffe0e0;color:#e66;cursor:pointer;';
        del.onclick = function(){
          var musicId = m.id;
          customConfirm('确定删除这首音乐吗？删除后不可恢复。', '删除音乐').then(function(yes){
            if(!yes) return;
            window.PolarisCloud.call('delete_music',{id:musicId, password:getPw()}).then(function(res){
              if(res&&res.ok){ toast('已删除','success'); listMusic(); window.loadMusicList(); } else { toast('删除失败','error'); }
            }).catch(function(){ toast('网络错误','error'); });
          });
        };
        row.appendChild(del);
        box.appendChild(row);
      });
    });
  }

  var MUS_OBJ='https://ldprlyzawsgwjtgdwexz.supabase.co/storage/v1/object/music/';
  var MUS_AUTH='Bearer sb_publishable_vVhLivALBiNuxHUVRzfDmg_uDzYXlnr';
  function uploadMusic(){
    var title = document.getElementById('mu_title').value.trim();
    var artist = document.getElementById('mu_artist').value.trim();
    var file = document.getElementById('mu_file').files[0];
    var tip = document.getElementById('muTip');
    if(!title || !file){ alert('请填写歌名并选择文件'); return; }
    var fileName = 'music_' + Date.now() + '.mp3';
    tip.textContent = '读取文件...';
    var reader = new FileReader();
    reader.onload = function(){
      var b64 = String(reader.result).split(',')[1] || '';
      tip.textContent = '上传中...';
      window.PolarisCloud.call('upload_music_file',{name:fileName, data:b64, content_type:file.type||'audio/mpeg', password:getPw()}).then(function(r){
        if(!r || !r.ok) throw new Error('上传失败:' + (r && r.error || ''));
        return window.PolarisCloud.call('add_music',{title:title, artist:artist, file_path:fileName, cover:'', password:getPw()});
      }).then(function(d){
        if(d && d.ok){
          tip.textContent = '上传成功！';
          document.getElementById('mu_title').value=''; document.getElementById('mu_artist').value='';
          document.getElementById('mu_file').value='';
          listMusic();
        } else { tip.textContent = '保存记录失败'; }
      }).catch(function(e){ tip.textContent = '出错: ' + (e && e.message || e); });
    };
    reader.onerror = function(){ tip.textContent = '文件读取失败'; };
    reader.readAsDataURL(file);
  }

  document.getElementById('muUpload').addEventListener('click', uploadMusic);
  document.getElementById('muRefresh').addEventListener('click', listMusic);
  window.listMusic = listMusic;

  /* 相册下拉加载 */
  var alSel = document.getElementById('al_albumId');
  function loadAlbumOptions() {
    if (!alSel || !window.PolarisCloud || !window.PolarisCloud.enabled()) return;
    window.PolarisCloud.call('list_albums', {}).then(function (r) {
      if (!r || !r.ok) return;
      alSel.innerHTML = '';
      (r.albums || []).forEach(function (al) {
        var opt = document.createElement('option');
        opt.value = al.id;
        opt.textContent = al.title + (al.is_public ? '（公开）' : '（私密）');
        alSel.appendChild(opt);
      });
    });
  }
  loadAlbumOptions();

  /* 相册管理列表 */
  function loadAlbumManage() {
    var box = document.getElementById('alManage');
    if (!box) return;
    if (!window.PolarisCloud || !window.PolarisCloud.enabled()) return;
    window.PolarisCloud.call('list_albums', {}).then(function (r) {
      if (!r || !r.ok) return;
      box.innerHTML = '<div class="af-title" style="margin-bottom:8px;">已有相册管理</div>';
      (r.albums || []).forEach(function (al) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,.5);border-radius:8px;margin-bottom:6px;';
        row.innerHTML = '<span>' + al.title + (al.is_public ? '（公开）' : '（私密）') + '</span>';
        var delBtn = document.createElement('button');
        delBtn.className = 'af-add';
        delBtn.style.cssText = 'padding:4px 12px;margin:0;';
        delBtn.textContent = '删除';
        delBtn.onclick = function () {
          var albumTitle = al.title, albumId = al.id;
          customConfirm('确定删除「' + albumTitle + '」吗？相册和里面的照片将一起删除，不可恢复。', '删除相册').then(function(yes){
            if(!yes) return;
            window.PolarisCloud.call('delete_album', {id: albumId}).then(function (r2) {
              if (r2 && r2.ok) { toast('已删除','success'); window.albumCache=null; loadAlbumManage(); loadAlbumOptions(); if(window.loadAlbums) window.loadAlbums(); }
              else toast('删除失败：' + window.PolarisAuth.errText(r2 && r2.error),'error');
            }).catch(function(){ toast('网络错误','error'); });
          });
        };
        var phBtn = document.createElement('button');
        phBtn.className='af-add'; phBtn.style.cssText='padding:4px 12px;margin:0 6px 0 0;';
        phBtn.textContent='管理照片';
        phBtn.onclick = function(){ openPhotosAdmin(al.id, box); };
        row.appendChild(phBtn);
        row.appendChild(delBtn);
        box.appendChild(row);
      });
    });
  }
  function openPhotosAdmin(albumId, rootBox){
    window.PolarisCloud.call('list_photos',{albumId:albumId, password:getPw()}).then(function(r){
      if(!r||!r.ok){ alert('加载照片失败：'+(r&&r.error||'')); return; }
      var old=document.getElementById('photoAdminBox'); if(old) old.remove();
      var box=document.createElement('div'); box.id='photoAdminBox';
      box.style.cssText='margin:8px 0 10px;padding:10px;border:1px solid #f0d;border-radius:10px;background:rgba(255,255,255,.6);';
      box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:13px;font-weight:600;">该相册照片（点右上角删除）</span><button id="paClose" style="padding:7px 18px;font-size:13px;border:1px solid #f8bbd0;background:#fff;border-radius:8px;cursor:pointer;color:#c2185b;transition:all .2s;">收起</button></div>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;" id="paGrid"></div>';
      (rootBox||document.getElementById('alManage')).appendChild(box);
      box.querySelector('#paClose').onclick=function(){ box.remove(); };
      var grid=box.querySelector('#paGrid');
      var list=r.photos||[];
      if(!list.length){ grid.innerHTML='<div style="color:#aaa;font-size:12px;">暂无照片</div>'; }
      list.forEach(function(ph){
        var cell=document.createElement('div'); cell.style.cssText='position:relative;';
        cell.innerHTML='<img src="'+ph.url+'" style="width:100%;height:80px;object-fit:cover;border-radius:6px;">'+
          '<button style="position:absolute;top:4px;right:4px;background:rgba(220,60,60,.85);color:#fff;border:none;border-radius:4px;padding:2px 6px;font-size:11px;cursor:pointer;">删</button>';
        cell.querySelector('button').onclick=function(){
          customConfirm('确定删除这张照片吗？','删除照片').then(function(yes){
            if(!yes) return;
            window.PolarisCloud.call('delete_photo',{id:ph.id, password:getPw()}).then(function(res){
              if(res&&res.ok){ toast('已删除','success'); cell.remove(); }
              else toast('删除失败','error');
            });
          });
        };
        grid.appendChild(cell);
      });
    });
  }
  loadAlbumManage();

  /* 创建相册 */
  var alCreate = document.getElementById('alCreate');
  if (alCreate) {
    alCreate.onclick = function () {
      var title = document.getElementById('al_new_title').value.trim();
      var desc = document.getElementById('al_new_desc').value.trim();
      var isPub = document.getElementById('al_new_type').value === '1';
      var pw = document.getElementById('al_new_pw').value;
      if (!title) { alert('请填相册名称'); return; }
      window.PolarisCloud.call('create_album', {
        title: title, description: desc, is_public: isPub, album_password: pw
      }).then(function (r) {
        if (r && r.ok) { toast('相册创建成功','success'); window.albumCache=null; loadAlbumOptions(); loadAlbumManage(); if(window.loadAlbums) window.loadAlbums(); }
        else alert('创建失败：' + ((r && r.error) ? window.PolarisAuth.errText(r.error) : '请确认已用开发者账号登录'));
      });
    };
  }
})();
