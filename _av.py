# -*- coding: utf-8 -*-
"""批量压缩 avatars 目录 jpg -> 160px webp，落盘替换"""
import subprocess, json, os, urllib.request, sys, time

AV = r"C:\Users\Admin\Desktop\个人网站开发\static\avatars"
files = ["erii","mingfei","zihang","caesar","nuonuo","ling","zhisheng","angre"]

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=120)
    return p.returncode, (p.stdout or "") + (p.stderr or "")

for name in files:
    src = os.path.join(AV, name + ".jpg")
    if not os.path.exists(src):
        print("skip missing:", src); continue
    rc, out = run(["mediakit-cli","image","resize-image",
                   "--image-url", src, "--resize-long","160","--output-format","webp"])
    if rc != 0:
        print(name, "FAIL rc=%d" % rc, out[-300:]); continue
    url = None
    try:
        data = json.loads(out)
        url = data.get("image_url")
    except Exception as e:
        # 输出可能是包裹 JSON，尝试找 "image_url"
        import re
        m = re.search(r'"image_url"\s*:\s*"([^"]+)"', out)
        if m: url = m.group(1)
        else: print(name, "PARSE FAIL", out[-300:]); continue
    if not url:
        print(name, "NO URL", out[-300:]); continue
    dst = os.path.join(AV, name + ".webp")
    try:
        with urllib.request.urlopen(url, timeout=60) as r, open(dst, "wb") as f:
            f.write(r.read())
        print(name, "OK -> %.1fKB" % (os.path.getsize(dst)/1024))
    except Exception as e:
        print(name, "DOWNLOAD FAIL", str(e)[:200])
    time.sleep(0.3)
print("done")
