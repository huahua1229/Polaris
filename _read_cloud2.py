# -*- coding: utf-8 -*-
import json, urllib.request

URL = 'https://ldprlyzawsgwjtgdwexz.supabase.co/functions/v1/super-function'
body = json.dumps({"action": "read_content", "password": "zhuozhihua123"}).encode('utf-8')
req = urllib.request.Request(URL, data=body, headers={
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sb_publishable_vVhLivALBiNuxHUVRzfDmg_uDzYXlnr',
})
with urllib.request.urlopen(req, timeout=30) as r:
    data = json.loads(r.read().decode('utf-8'))
# 递归找包含 award 的键
def find_keys(obj, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = path + '/' + k
            if 'award' in k.lower():
                print('KEY:', p, '=>', json.dumps(v, ensure_ascii=False)[:300])
            find_keys(v, p)
    elif isinstance(obj, list):
        for i, v in enumerate(obj[:50]):
            find_keys(v, path + '[%d]' % i)
find_keys(data)
# 顶层结构概览
print('顶层 keys:', list(data.keys()) if isinstance(data, dict) else type(data))
d = data.get('data') if isinstance(data, dict) else None
if isinstance(d, dict):
    print('data keys:', list(d.keys()))
    for k in d:
        v = d[k]
        print('  ', k, type(v).__name__, (str(v)[:120] if not isinstance(v, dict) else json.dumps(v, ensure_ascii=False)[:120]))
