/* ============================================================
   Polaris 账号体系（QQ邮箱注册/登录 + 开发者登录）
   登录态存 localStorage('polaris_user')，PolarisCloud.call 自动附带 token
   ============================================================ */
window.PolarisAuth = (function(){
  var KEY='polaris_user', listeners=[];
  function getUser(){ try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){return null;} }
  function isLoggedIn(){ var u=getUser(); return !!(u&&u.token); }
  function isDeveloper(){ var u=getUser(); return !!u&&u.role==='developer'; }
  function cloud(){ return !!(window.PolarisCloud&&window.PolarisCloud.enabled()); }
  function onChange(f){ listeners.push(f); }
  function emit(u){ for(var i=0;i<listeners.length;i++){ try{listeners[i](u||getUser());}catch(e){console.error(e);} } }
  function setUser(u){ try{localStorage.setItem(KEY,JSON.stringify(u));}catch(e){} emit(u); }
  function afterAuth(r,pw){
    setUser(r);
    if(r.role==='developer'&&pw){ try{
      sessionStorage.setItem('polaris_admin_ok','1');
      sessionStorage.setItem('polaris_admin_pw',pw);
      sessionStorage.setItem('polaris_pw',pw);
      localStorage.setItem('polaris_pw',pw);
    }catch(e){} }
  }
  /* ===== 头像系统 ===== */
  var AVATAR_POOL=[
    {src:'static/avatars/erii.jpg',name:'绘梨衣'},
    {src:'static/avatars/mingfei.jpg',name:'路明非'},
    {src:'static/avatars/zihang.jpg',name:'楚子航'},
    {src:'static/avatars/caesar.jpg',name:'恺撒'},
    {src:'static/avatars/nuonuo.jpg',name:'诺诺'},
    {src:'static/avatars/ling.jpg',name:'零'},
    {src:'static/avatars/zhisheng.jpg',name:'源稚生'},
    {src:'static/avatars/angre.jpg',name:'昂热'}
  ];
  var regAvatarSel=AVATAR_POOL[0].src;
  function curAv(){ var u=getUser(); return (u&&u.avatar)||''; }
  function avUrl(a){ if(!a) return ''; if(a.charAt(0)==='<') return ''; return a; }
  function buildAvatarGrid(container, current, onPick){
    container.innerHTML='';
    AVATAR_POOL.forEach(function(a){
      var b=document.createElement('div');
      b.className='av-cell'+(current===a.src?' sel':'');
      b.innerHTML='<img src="'+a.src+'" alt="'+a.name+'" title="'+a.name+'">';
      b.onclick=function(){ regAvatarSel=a.src; var s=container.querySelectorAll('.av-cell'); for(var i=0;i<s.length;i++) s[i].classList.remove('sel'); b.classList.add('sel'); onPick&&onPick(a.src); };
      container.appendChild(b);
    });
  }
  function compressImage(file, cb){
    var img=new Image(); var url=URL.createObjectURL(file);
    img.onload=function(){
      var c=document.createElement('canvas'); var sz=160; c.width=sz; c.height=sz;
      var ctx=c.getContext('2d');
      var s=Math.min(img.width,img.height), sx=(img.width-s)/2, sy=(img.height-s)/2;
      ctx.drawImage(img,sx,s,s,0,0,sz,sz);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/jpeg',0.85));
    };
    img.onerror=function(){ URL.revokeObjectURL(url); alert('图片读取失败'); };
    img.src=url;
  }
  function register(e,p,n,av){ return PolarisCloud.registerAsync(e,p,n,av).then(function(r){ if(r&&r.ok&&r.token) afterAuth(r); return r;}); }
  function login(e,p){ return PolarisCloud.loginAsync(e,p).then(function(r){ if(r&&r.ok&&r.token) afterAuth(r); return r;}); }
  function developerLogin(p){ return PolarisCloud.developerLoginAsync(p).then(function(r){ if(r&&r.ok&&r.token) afterAuth(r,p); return r;}); }
  function updateProfile(patch){
    return PolarisCloud.updateProfileAsync(patch).then(function(r){
      if(r&&r.ok&&r.token){ var u=getUser(); u.nickname=r.nickname||u.nickname; u.avatar=(r.avatar!==undefined?r.avatar:u.avatar); u.token=r.token; setUser(u); }
      return r;
    });
  }
  function logout(){
    try{
      localStorage.removeItem(KEY);
      sessionStorage.removeItem('polaris_admin_ok');
      sessionStorage.removeItem('polaris_admin_pw');
      sessionStorage.removeItem('polaris_pw');
      localStorage.removeItem('polaris_pw');
    }catch(e){}
    emit(null);
    if((location.hash||'').indexOf('review')>=0) location.hash='#home';
  }
  function errText(c){
    return ({'exists':'该邮箱已注册，请直接登录','not-found':'账号不存在，请先注册','bad-pw':'密码错误',
      'weak':'密码至少需要 6 位','bad-email':'请填写正确的邮箱地址（例如 name@example.com）','bad-nick':'请填写昵称',
      'auth':'请先登录','empty':'信息没有填写完整','network':'连接失败，请检查网络或用系统浏览器打开','timeout':'响应较慢，请重试或切换网络','db':'服务器繁忙，请稍后重试'})[c] || '操作失败，请稍后重试';
  }

  /* ---------- 弹窗 DOM ---------- */
  var mask, loginCard, settingCard, busy=false;
  function ensureDom(){
    if(mask) return;
    mask=document.createElement('div'); mask.id='authMask';
    mask.innerHTML =
      '<div class="auth-box" id="loginCard">'+
        '<div class="auth-tabs">'+
          '<button type="button" class="auth-tab" data-tab="login">登录</button>'+
          '<button type="button" class="auth-tab" data-tab="register">注册</button>'+
          '<button type="button" class="auth-tab" data-tab="dev">开发者</button>'+
        '</div>'+
        '<div class="auth-field" data-f="email"><label>邮箱（账号）</label><input id="auEmail" type="email" inputmode="email" placeholder="例如 name@example.com" autocomplete="username"></div>'+
        '<div class="auth-field" data-f="nick" style="display:none"><label>昵称</label><input id="auNick" maxlength="20" placeholder="展示在留言/投稿上的名字"></div>'+
        '<div class="auth-field" data-f="avatar" style="display:none"><label>选择头像</label><div class="avatar-picker" id="regAvatars"></div><input type="file" id="regAvUpload" accept="image/*" style="display:none"><button type="button" class="av-upload" id="regAvUploadBtn">上传自定义头像</button></div>'+
        '<div class="auth-field" data-f="pw"><label>密码</label><input id="auPw" type="password" placeholder="至少 6 位" autocomplete="current-password"></div>'+
        '<div class="auth-field" data-f="pw2" style="display:none"><label>确认密码</label><input id="auPw2" type="password" placeholder="再输入一次密码"></div>'+
        '<div class="auth-field" data-f="devpw" style="display:none"><label>开发者密钥</label><input id="auDevPw" type="password" placeholder="请输入管理密钥"></div>'+
        '<div class="auth-err" id="auErr"></div>'+
        '<button type="button" class="auth-submit" id="auSubmit">登 录</button>'+
        '<div class="auth-switch" id="auSwitch"></div>'+
'<div class="auth-hint">邮箱仅作为登录账号，无需验证真实性；<a href="javascript:void(0)" onclick="forgotPassword()" style="color:#e75480;">忘记密码？</a></div>'+
      '</div>'+
      '<div class="auth-box" id="settingCard" style="display:none">'+
        '<div class="auth-user-head">'+
          '<div class="auth-user-av" id="setAv">🌸</div>'+
          '<div><div class="auth-user-name" id="setName"></div><div class="auth-user-mail" id="setMail"></div></div>'+
        '</div>'+
        '<div class="auth-sec-title">修改昵称</div>'+
        '<div class="auth-field"><input id="setNick" maxlength="20" placeholder="新昵称"></div>'+
        '<button type="button" class="auth-submit" id="setNickBtn">保存昵称</button>'+
        '<div class="auth-sec-title">我的头像</div>'+
        '<div class="auth-field"><div class="avatar-picker" id="setAvatars"></div></div>'+
        '<input type="file" id="setAvUpload" accept="image/*" style="display:none">'+
        '<button type="button" class="av-upload" id="setAvUploadBtn">上传自定义头像</button>'+
        '<div class="auth-sec-title">修改密码</div>'+
        '<div class="auth-field"><input id="setOldPw" type="password" placeholder="当前密码"></div>'+
        '<div class="auth-field"><input id="setNewPw" type="password" placeholder="新密码（至少 6 位）"></div>'+
        '<button type="button" class="auth-submit" id="setPwBtn">保存密码</button>'+
        '<div class="auth-err" id="setErr"></div>'+
        '<button type="button" class="auth-logout" id="setLogout">退出登录</button>'+
      '</div>';
    document.body.appendChild(mask);
    loginCard=document.getElementById('loginCard');
    settingCard=document.getElementById('settingCard');
    mask.addEventListener('click',function(e){ if(e.target===mask) closeAll(); });
    var tabs=mask.querySelectorAll('.auth-tab');
    for(var i=0;i<tabs.length;i++){ (function(b){ b.addEventListener('click',function(){ switchTab(b.getAttribute('data-tab')); }); })(tabs[i]); }
    document.getElementById('auSubmit').addEventListener('click',submitLogin);
    document.getElementById('setNickBtn').addEventListener('click',saveNick);
    document.getElementById('setPwBtn').addEventListener('click',savePw);
    document.getElementById('setLogout').addEventListener('click',function(){ logout(); closeAll(); toast('已退出登录','success'); });
    ['auEmail','auNick','auPw','auPw2','auDevPw'].forEach(function(id){
      document.getElementById(id).addEventListener('keydown',function(e){ if(e.key==='Enter') submitLogin(); });
    });
    var rub=document.getElementById('regAvUploadBtn'), rup=document.getElementById('regAvUpload');
    if(rup && !rup.dataset.bound){ rup.dataset.bound='1';
      rup.onchange=function(){ if(this.files&&this.files[0]) compressImage(this.files[0],function(d){ regAvatarSel=d; var c=document.getElementById('regAvatars'); if(c){ c.querySelectorAll('.av-cell').forEach(function(x){x.classList.remove('sel');}); var im=document.createElement('div'); im.className='av-cell sel'; im.innerHTML='<img src="'+d+'" alt="自定义">'; c.appendChild(im); } }); };
      rub.onclick=function(){ rup.click(); };
    }
  }
  var curTab='login';
  function switchTab(tab){
    curTab=tab;
    var tabs=mask.querySelectorAll('.auth-tab');
    for(var i=0;i<tabs.length;i++) tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab')===tab);
    function show(name,ons){ mask.querySelectorAll('[data-f]').forEach(function(f){ f.style.display = ons.indexOf(f.getAttribute('data-f'))>=0?'':'none'; }); }
    var sw=document.getElementById('auSwitch'), btn=document.getElementById('auSubmit'), err=document.getElementById('auErr');
    err.textContent='';
    if(tab==='login'){ show('login',['email','pw']); btn.textContent='登 录'; sw.innerHTML='还没有账号？<a id="swReg">去注册</a>'; document.getElementById('swReg').onclick=function(){switchTab('register');}; }
    else if(tab==='register'){ show('register',['email','nick','avatar','pw','pw2']); btn.textContent='注 册'; setTimeout(function(){ buildAvatarGrid(document.getElementById('regAvatars'),regAvatarSel,function(){}); },0); sw.innerHTML='已有账号？<a id="swLogin">去登录</a>'; document.getElementById('swLogin').onclick=function(){switchTab('login');}; }
    else { show('dev',['devpw']); btn.textContent='开发者登录'; sw.innerHTML='普通访客请使用<a id="swLogin2">登录 / 注册</a>'; document.getElementById('swLogin2').onclick=function(){switchTab('login');}; }
  }
  function setErr(s){ document.getElementById('auErr').textContent=s||''; }
  function submitLogin(){
    if(busy) return;
    var errEl=document.getElementById('auErr'), btn=document.getElementById('auSubmit');
    if(curTab==='dev'){
      var pw=document.getElementById('auDevPw').value;
      if(!pw){ errEl.textContent='请输入开发者密钥'; return; }
      busy=true; btn.disabled=true; btn.textContent='验证中...';
      developerLogin(pw).then(function(r){
        busy=false; btn.disabled=false; btn.textContent='开发者登录';
        if(r&&r.ok){ closeAll(); toast('开发者登录成功','success'); emit(getUser()); if((location.hash||'').indexOf('review')>=0) location.reload(); }
        else errEl.textContent=errText(r&&r.error);
      }).catch(function(){ busy=false; btn.disabled=false; btn.textContent='开发者登录'; errEl.textContent=errText('network'); });
      return;
    }
    var email=document.getElementById('auEmail').value.trim();
    var pwd=document.getElementById('auPw').value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)){ errEl.textContent=errText('bad-email'); return; }
    if(pwd.length<6){ errEl.textContent=errText('weak'); return; }
    if(curTab==='register'){
      var nick=document.getElementById('auNick').value.trim();
      var pwd2=document.getElementById('auPw2').value;
      if(!nick){ errEl.textContent=errText('bad-nick'); return; }
      if(pwd!==pwd2){ errEl.textContent='两次输入的密码不一致'; return; }
      busy=true; btn.disabled=true; btn.textContent='提交中...';
      register(email,pwd,nick,regAvatarSel).then(function(r){
        busy=false; btn.disabled=false; btn.textContent='注 册';
        if(r&&r.ok){ closeAll(); toast('注册成功，欢迎 '+nick,'success'); emit(getUser()); }
        else errEl.textContent=errText(r&&r.error);
      }).catch(function(){ busy=false; btn.disabled=false; btn.textContent='注 册'; errEl.textContent=errText('network'); });
    } else {
      busy=true; btn.disabled=true; btn.textContent='登录中...';
      login(email,pwd).then(function(r){
        busy=false; btn.disabled=false; btn.textContent='登 录';
        if(r&&r.ok){ closeAll(); toast('登录成功，欢迎回来~','success'); emit(getUser()); }
        else errEl.textContent=errText(r&&r.error);
      }).catch(function(){ busy=false; btn.disabled=false; btn.textContent='登 录'; errEl.textContent=errText('network'); });
    }
  }
  function openSettings(){
    ensureDom();
    var u=getUser(); if(!u){ openLogin('login'); return; }
    loginCard.style.display='none'; settingCard.style.display=''; mask.classList.add('show');
    document.getElementById('setName').textContent=u.nickname||'';
    document.getElementById('setMail').textContent=u.role==='developer'?'开发者账号':u.email;
    document.getElementById('setNick').value=u.nickname||'';
    var avEl=document.getElementById('setAv');
    if(u.avatar){ avEl.innerHTML='<img src="'+u.avatar+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">'; }
    else { avEl.textContent='🌸'; }
    document.getElementById('setOldPw').value=''; document.getElementById('setNewPw').value=''; document.getElementById('setErr').textContent='';
    var u2=getUser();
    setTimeout(function(){
      buildAvatarGrid(document.getElementById('setAvatars'),(u2&&u2.avatar)||'',function(src){
        updateProfile({avatar:src}).then(function(r){ if(r&&r.ok){ toast('头像已更新','success'); emit(getUser()); openSettings(); } else toast('头像更新失败','error'); });
      });
      var up=document.getElementById('setAvUpload'); var ub=document.getElementById('setAvUploadBtn');
      if(up && !up.dataset.bound){ up.dataset.bound='1';
        up.onchange=function(){ if(this.files&&this.files[0]) compressImage(this.files[0],function(d){ updateProfile({avatar:d}).then(function(r){ if(r&&r.ok){ toast('头像已更新','success'); emit(getUser()); openSettings(); } else toast('头像更新失败','error'); }); }); };
        ub.onclick=function(){ up.click(); };
      }
    },0);
  }
  function saveNick(){
    var nick=document.getElementById('setNick').value.trim(), errEl=document.getElementById('setErr');
    if(!nick){ errEl.textContent='昵称不能为空'; return; }
    var btn=document.getElementById('setNickBtn'); btn.disabled=true; btn.textContent='保存中...';
    updateProfile({nickname:nick}).then(function(r){
      btn.disabled=false; btn.textContent='保存昵称';
      if(r&&r.ok){ errEl.textContent=''; toast('昵称已更新','success'); emit(getUser()); openSettings(); }
      else errEl.textContent=errText(r&&r.error);
    }).catch(function(){ btn.disabled=false; btn.textContent='保存昵称'; errEl.textContent=errText('network'); });
  }
  function savePw(){
    var o=document.getElementById('setOldPw').value, n=document.getElementById('setNewPw').value, errEl=document.getElementById('setErr');
    if(n.length<6){ errEl.textContent=errText('weak'); return; }
    var btn=document.getElementById('setPwBtn'); btn.disabled=true; btn.textContent='保存中...';
    updateProfile({old_password:o,new_password:n}).then(function(r){
      btn.disabled=false; btn.textContent='保存密码';
      if(r&&r.ok){ errEl.textContent=''; toast('密码已更新','success'); document.getElementById('setOldPw').value=''; document.getElementById('setNewPw').value=''; }
      else errEl.textContent=errText(r&&r.error);
    }).catch(function(){ btn.disabled=false; btn.textContent='保存密码'; errEl.textContent=errText('network'); });
  }
  function openLogin(tab){ ensureDom(); settingCard.style.display='none'; loginCard.style.display=''; mask.classList.add('show'); switchTab(tab||'login'); setTimeout(function(){ var el=document.getElementById('auEmail'); if(el&&curTab!=='dev') el.focus(); },80); }
  function closeAll(){ if(mask) mask.classList.remove('show'); }

  /* ---------- 根据登录态刷新界面 ---------- */
  function rowOf(id){ var el=document.getElementById(id); return el?el.closest('.form-row'):null; }
  function ensureTip(panelEl,id,text){
    if(!panelEl) return null;
    var bar=document.getElementById(id);
    if(!bar){
      bar=document.createElement('div'); bar.className='login-tip-bar'; bar.id=id;
      bar.innerHTML=text+' <button type="button">去登录 / 注册</button>';
      bar.querySelector('button').addEventListener('click',function(){ openLogin('login'); });
      var firstRow=panelEl.querySelector('.form-row');
      if(firstRow) panelEl.insertBefore(bar,firstRow); else panelEl.insertBefore(bar,panelEl.firstChild);
    }
    return bar;
  }
  function applyAuthUI(){
    var u=getUser(), in_=!!(u&&u.token), dev=isDeveloper();
    var navR=document.getElementById('navReview'); if(navR) navR.style.display=dev?'':'none';
    var adm=document.getElementById('adminEntry'); if(adm) adm.style.display=dev?'':'none';
    var ent=document.getElementById('authEntry');
    if(ent){
      if(!in_) ent.textContent='👤 登录 / 注册';
      else if(dev) ent.textContent='✨ '+(u.nickname||'Polaris')+'（开发者）';
      else ent.textContent='🌸 '+(u.nickname||'我的账号');
    }
    if(cloud()){
      ['guestEmail','guestName','sbName','sbEmail','frEmail'].forEach(function(id){ var r=rowOf(id); if(r) r.style.display='none'; });
      var gm=document.getElementById('guestMessage');
      if(gm){ if(!in_){ gm.setAttribute('data-needlogin','1'); gm.setAttribute('readonly','readonly'); gm.setAttribute('placeholder','登录后即可留言~'); } else { gm.removeAttribute('data-needlogin'); gm.removeAttribute('readonly'); gm.setAttribute('placeholder','说点什么吧~'); } }
      var tipG=ensureTip(gm?gm.closest('section'):null,'tipGuest','登录后即可发表留言、点赞和回复～');
      var sbBtn=document.getElementById('sbSubmitBtn');
      var tipS=ensureTip(sbBtn?sbBtn.closest('section'):null,'tipSubmit','登录后即可投稿，署名会自动使用你的昵称～');
      var frBtn=document.getElementById('frSubmitBtn');
      var tipF=ensureTip(frBtn?frBtn.closest('section'):null,'tipFriend','登录后即可申请友链～');
      [tipG,tipS,tipF].forEach(function(b){ if(b) b.classList.toggle('show',!in_); });
    }
  }
  document.addEventListener('focusin',function(e){
    if(e.target&&e.target.hasAttribute&&e.target.hasAttribute('data-needlogin')&&!isLoggedIn()){ e.target.blur(); openLogin('login'); }
  });
  function init(){ ensureDom(); applyAuthUI(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
  onChange(function(){ applyAuthUI(); });

  return { getUser:getUser, isLoggedIn:isLoggedIn, isDeveloper:isDeveloper, cloud:cloud,
    onChange:onChange, register:register, login:login, developerLogin:developerLogin,
    updateProfile:updateProfile, logout:logout, openLogin:openLogin, openSettings:openSettings,
    applyAuthUI:applyAuthUI, errText:errText };
})();
document.addEventListener('DOMContentLoaded',function(){
  var ent=document.getElementById('authEntry');
  if(ent) ent.addEventListener('click',function(){ if(PolarisAuth.isLoggedIn()) PolarisAuth.openSettings(); else PolarisAuth.openLogin('login'); });
});
