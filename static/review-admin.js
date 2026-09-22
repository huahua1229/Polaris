(function(){
  var loginBox = document.getElementById('reviewLogin');
  var contentBox = document.getElementById('reviewContent');
  var loginBtn = document.getElementById('reviewLoginBtn');
  var pwInput = document.getElementById('reviewPw');
  if(!loginBox) return;

  function esc(s){ var d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

  function loadPosts(pw){
    var tip=document.getElementById('adminPostTip');
    var box=document.getElementById('adminPostList');
    window.PolarisCloud.listPostsAsync(pw).then(function(r){
      var posts=(r&&r.ok&&r.posts)?r.posts:[];
      tip.textContent='待审投稿 '+posts.length+' 条';
      if(!posts.length){ box.innerHTML='<div style="color:#aaa;font-size:13px;">暂无待审投稿</div>'; return; }
      box.innerHTML=posts.map(function(p){
        var d=new Date(p.created_at||Date.now());
        var ds=(d.getMonth()+1)+'-'+d.getDate()+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
        return '<div class="admin-item" style="padding:12px 14px;border:1px solid #fce4ec;border-radius:12px;background:#fff;">'+
          '<div style="font-size:12px;color:#888;">'+(p.type==='blog'?'📝 文章':'📌 项目')+' · '+esc(p.name)+' · '+esc(p.email)+' · '+ds+'</div>'+
          '<div style="font-weight:700;margin:6px 0;font-size:15px;">'+esc(p.title)+'</div>'+
          (p.summary?'<div style="font-size:13px;color:#666;margin:4px 0;">'+esc(p.summary)+'</div>':'')+
          '<div style="font-size:13px;margin-top:6px;max-height:300px;overflow:auto;color:#555;white-space:pre-wrap;word-break:break-word;line-height:1.7;">'+esc(p.content)+'</div>'+
          (p.attachment_name?'<div style="font-size:12px;margin-top:6px;color:#e75480;">📎 附件: <a href="'+PUB+esc(p.attachment_path)+'" target="_blank" download style="color:#e75480;text-decoration:underline;">'+esc(p.attachment_name)+'</a> ('+Math.round((p.attachment_size||0)/1024)+'KB)</div>':'')+
          '<div style="display:flex;gap:8px;margin-top:10px;">'+
            '<button type="button" class="form-submit" style="padding:8px 16px;font-size:13px;" data-pid="'+esc(p.id)+'" data-act="publish">✅ 通过并发布</button>'+
            '<button type="button" class="form-submit" style="padding:8px 16px;font-size:13px;background:#ff6b6b;" data-pid="'+esc(p.id)+'" data-act="reject">🗑 拒绝</button>'+
          '</div></div>';
      }).join('');
      box.querySelectorAll('button[data-pid]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var pid=this.getAttribute('data-pid');
          var act=this.getAttribute('data-act');
          var btnEl=this;
          var title = act==='publish' ? '通过投稿' : '拒绝投稿';
          var msg = act==='publish' ? '确定通过并发布这篇投稿吗？' : '确定拒绝并删除这篇投稿吗？删除后不可恢复。';
          customConfirm(msg, title).then(function(yes){
            if(!yes) return;
            btnEl.disabled=true;
            var fn=act==='publish'?window.PolarisCloud.publishPostAsync:window.PolarisCloud.deletePostAsync;
            fn(pid, pw).then(function(r){
              if(r&&r.ok){ toast(act==='publish'?'✅ 已发布':'🗑 已拒绝','success'); loadPosts(pw); }
              else { toast('操作失败，请重试','error'); btnEl.disabled=false; }
            }).catch(function(){ toast('网络错误','error'); btnEl.disabled=false; });
          });
        });
      });
    });
  }

  function loadFr(pw){
    var tip=document.getElementById('adminFrTip');
    var box=document.getElementById('adminFrList');
    window.PolarisCloud.call('list_friend_requests',{password:pw}).then(function(r){
      var reqs=(r&&r.ok&&r.requests)?r.requests:[];
      tip.textContent='待审友链申请 '+reqs.length+' 条';
      if(!reqs.length){ box.innerHTML='<div style="color:#aaa;font-size:13px;">暂无待审友链申请</div>'; return; }
      box.innerHTML=reqs.map(function(f){
        var d=new Date(f.created_at||Date.now());
        var ds=(d.getMonth()+1)+'-'+d.getDate()+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
        return '<div class="admin-item" style="padding:12px 14px;border:1px solid #fce4ec;border-radius:12px;background:#fff;">'+
          '<div style="font-size:12px;color:#888;">🔗 '+esc(f.name)+' · '+esc(f.email||'')+' · '+ds+'</div>'+
          '<div style="font-size:13px;margin:4px 0;"><a href="'+esc(f.url)+'" target="_blank" style="color:#e75480;">'+esc(f.url)+'</a></div>'+
          '<div style="font-size:13px;color:#666;">'+esc(f.description)+'</div>'+
          '<div style="display:flex;gap:8px;margin-top:10px;">'+
            '<button type="button" class="form-submit" style="padding:8px 16px;font-size:13px;" data-frid="'+esc(f.id)+'" data-fract="approve">✅ 通过并添加</button>'+
            '<button type="button" class="form-submit" style="padding:8px 16px;font-size:13px;background:#ff6b6b;" data-frid="'+esc(f.id)+'" data-fract="reject">🗑 拒绝</button>'+
          '</div></div>';
      }).join('');
      box.querySelectorAll('button[data-frid]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var frid=this.getAttribute('data-frid');
          var fract=this.getAttribute('data-fract');
          var self=this;
          var title = fract==='approve' ? '通过友链' : '拒绝友链';
          var msg = fract==='approve' ? '确定通过并添加为友链吗？' : '确定拒绝这条友链申请吗？删除后不可恢复。';
          customConfirm(msg, title).then(function(yes){
            if(!yes) return;
            self.disabled=true;
            window.PolarisCloud.call(fract==='approve'?'approve_friend_request':'reject_friend_request',{id:frid,password:pw}).then(function(r){
              if(r&&r.ok){ toast(fract==='approve'?'✅ 已添加友链':'🗑 已拒绝','success'); loadFr(pw); }
              else { toast('操作失败','error'); self.disabled=false; }
            }).catch(function(){ toast('网络错误','error'); self.disabled=false; });
          });
        });
      });
    });
  }

  function loadResets(pw){
    var tip=document.getElementById('adminResetTip');
    var box=document.getElementById('adminResetList');
    if(!tip||!box) return;
    window.PolarisCloud.call('list_reset_requests',{password:pw}).then(function(r){
      var reqs=(r&&r.ok&&r.requests)?r.requests:[];
      tip.textContent='待处理密码重置 '+reqs.length+' 条';
      if(!reqs.length){ box.innerHTML='<div style="color:#aaa;font-size:13px;">暂无申请</div>'; return; }
      box.innerHTML=reqs.map(function(x){
        var d=new Date(x.created_at||Date.now());
        var ds=d.getMonth()+1+'-'+d.getDate()+' '+d.getHours()+':'+String(d.getMinutes()).padStart(2,'0');
        return '<div class="admin-item" style="padding:12px 14px;border:1px solid #fce4ec;border-radius:12px;background:#fff;">'+
          '<div style="font-size:12px;color:#888;">🔑 '+esc(x.email||'')+' · '+ds+'</div>'+
          '<div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;">'+
            '<input type="text" data-rid="'+esc(x.id)+'" placeholder="输入新密码（至少6位）" style="flex:1;min-width:150px;padding:6px 10px;font-size:13px;border:1px solid #eee;border-radius:6px;">'+
            '<button class="form-submit" style="padding:6px 14px;font-size:12px;" data-a="ok" data-rid="'+esc(x.id)+'">✅ 批准并设密码</button>'+
            '<button class="form-submit" style="padding:6px 14px;font-size:12px;background:#ff6b6b;" data-a="no" data-rid="'+esc(x.id)+'">🗑 拒绝</button>'+
          '</div></div>';
      }).join('');
      box.querySelectorAll('button[data-rid]').forEach(function(btn){
        btn.onclick=function(){
          var rid=this.getAttribute('data-rid'); var act=this.getAttribute('data-a');
          if(act==='no'){
            customConfirm('确定拒绝这条重置申请吗？','拒绝申请').then(function(yes){
              if(!yes)return;
              window.PolarisCloud.call('reject_reset',{id:rid,password:pw}).then(function(r2){ if(r2&&r2.ok){toast('已拒绝','success');loadResets(pw);} });
            });
          } else {
            var inp=box.querySelector('input[data-rid="'+rid+'"]');
            var np=inp.value.trim();
            if(np.length<6){ alert('新密码至少 6 位'); return; }
            customConfirm('确定将该用户密码设为新密码并立即生效吗？','批准重置').then(function(yes){
              if(!yes)return;
              window.PolarisCloud.call('approve_reset',{id:rid,new_password:np,password:pw}).then(function(r2){
                if(r2&&r2.ok){ toast('已重置，把新密码告诉用户即可','success'); loadResets(pw); }
                else alert('失败：'+(r2&&r2.error||''));
              });
            });
          }
        };
      });
    });
  }
  function loadMsgs(pw){
    var tip=document.getElementById('adminMsgTip');
    var box=document.getElementById('adminMsgList');
    window.PolarisCloud.loadMessagesAsync().then(function(r){
      var msgs=(r&&r.ok&&r.messages)?r.messages:[];
      tip.textContent='共 '+msgs.length+' 条留言';
      if(!msgs.length){ box.innerHTML='<div style="color:#aaa;font-size:13px;">暂无留言</div>'; return; }
      box.innerHTML=msgs.map(function(m){
        return '<div class="admin-item" style="padding:10px 14px;border:1px solid #fce4ec;border-radius:12px;background:#fff;">'+
          '<div style="font-size:12px;color:#888;">'+esc(m.name||'匿名')+' · '+esc(m.email||'')+'</div>'+
          '<div style="font-size:13.5px;margin:6px 0;line-height:1.7;">'+esc(m.message)+'</div>'+
          '<button type="button" class="form-submit" style="padding:6px 14px;font-size:12px;background:#ff6b6b;" data-mid="'+esc(m.id)+'">🗑 删除</button>'+
          '</div>';
      }).join('');
      box.querySelectorAll('button[data-mid]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var mid=this.getAttribute('data-mid');
          var btnEl=this;
          customConfirm('确定删除这条留言吗？删除后不可恢复。', '删除留言').then(function(yes){
            if(!yes) return;
            btnEl.disabled=true;
            window.PolarisCloud.deleteMessageAsync(mid, pw).then(function(r){
              if(r&&r.ok){ toast('已删除','success'); loadMsgs(pw); }
              else { toast('删除失败','error'); btnEl.disabled=false; }
            }).catch(function(){ toast('网络错误','error'); btnEl.disabled=false; });
          });
        });
      });
    });
  }

  function adminPw(){ try{ return sessionStorage.getItem('polaris_admin_pw')||sessionStorage.getItem('polaris_pw')||localStorage.getItem('polaris_pw')||''; }catch(e){ return ''; } }
  function enterReview(pw){
    loginBox.style.display='none';
    contentBox.style.display='block';
    var nr=document.getElementById('navReview'); if(nr) nr.style.display='';
    loadPosts(pw);
    loadFr(pw);
    loadMsgs(pw);
    loadResets(pw);
  }

  loginBtn.addEventListener('click', function(){
    var pw=pwInput.value.trim();
    if(!pw){ toast('请输入开发者密钥','error'); return; }
    loginBtn.disabled=true; loginBtn.textContent='验证中...';
    window.PolarisAuth.developerLogin(pw).then(function(r){
      loginBtn.disabled=false; loginBtn.textContent='登录';
      if(r&&r.ok){ pwInput.value=''; toast('开发者登录成功','success'); enterReview(pw); }
      else { toast('密钥错误','error'); }
    }).catch(function(){ loginBtn.disabled=false; loginBtn.textContent='登录'; toast('网络异常，请稍后重试','error'); });
  });

  pwInput.addEventListener('keydown', function(e){ if(e.key==='Enter') loginBtn.click(); });

  // 已登录开发者直接进入审核台
  if(window.PolarisAuth && window.PolarisAuth.isDeveloper()){ enterReview(adminPw()); }
  // 开发者登录后或切换到审核页时自动进入
  if(window.PolarisAuth){
    PolarisAuth.onChange(function(u){
      if(u && u.role==='developer' && (location.hash||'').indexOf('review')>=0 && contentBox.style.display!=='block'){ enterReview(adminPw()); }
    });
  }
  window.addEventListener('hashchange', function(){
    if((location.hash||'').indexOf('review')>=0 && window.PolarisAuth && window.PolarisAuth.isDeveloper() && contentBox.style.display!=='block'){ enterReview(adminPw()); }
  });
})();
