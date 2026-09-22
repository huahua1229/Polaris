# -*- coding: utf-8 -*-
import io
p = r'C:\Users\Admin\Desktop\zhuozhihua0120250931\index.html'
t = io.open(p, encoding='utf-8').read()

# 在 </body> 前加临时测试代码
old = '</body>'
new = """<script>
window.addEventListener('load', function(){
    setTimeout(function(){
        if(typeof customConfirm === 'function'){
            customConfirm('测试确认框是否显示', '测试');
        } else {
            alert('customConfirm 未定义');
        }
    }, 2000);
});
</script>
</body>"""
t = t.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(t)
print('OK')
