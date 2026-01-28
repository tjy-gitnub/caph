import os, json, re, sys, hashlib, shutil
try:
    import markdown2
except Exception:
    print("请先安装 markdown2: pip install markdown2")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = SCRIPT_DIR  # guide 根目录
OUT = os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'static', 'guide.js'))
IMG_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..', 'static', 'images'))

md_link_re = re.compile(r'href=["\']([^"\']+?\.md)(#[^"\']*)?["\']', re.IGNORECASE)
md_name_re = re.compile(r'<!--\s*name\s*=\s*(.*?)\s*-->', re.IGNORECASE)
img_tag_re = re.compile(r'(<img\s+[^>]*src=["\'])([^"\']+)(["\'])', re.IGNORECASE)

# 缓存：源绝对路径 -> dest filename
_copied_map = {}

def read_info(folder):
    p = os.path.join(folder, 'info.json')
    if os.path.isfile(p):
        try:
            return json.load(open(p, 'r', encoding='utf-8'))
        except:
            return {}
    return {}

def _ensure_image(src_ref, rel_path):
    # src_ref: 原始 img src（可能相对），rel_path: md 文件相对路径（如 "sub/a.md"）
    src_ref = src_ref.strip()
    # 忽略外部和 data URI
    if src_ref.startswith('http://') or src_ref.startswith('https://') or src_ref.startswith('data:') or src_ref.startswith('mailto:'):
        return src_ref
    # 规范化相对路径（相对于 ROOT）
    # 如果以 / 开头，则视为相对于 ROOT 的路径（去掉前导 /）
    if src_ref.startswith('/'):
        norm = src_ref.lstrip('/')
    else:
        norm = os.path.normpath(os.path.join(os.path.dirname(rel_path), src_ref)).replace('\\','/')
    src_abs = os.path.join(ROOT, norm)
    if not os.path.isfile(src_abs):
        # 找不到文件，返回原引用（前端显示会有 broken image）
        return src_ref
    os.makedirs(IMG_DIR, exist_ok=True)
    src_stat = os.path.getsize(src_abs)
    # 缓存检测
    if src_abs in _copied_map:
        return '/static/images/' + _copied_map[src_abs]
    orig_name = os.path.basename(norm)
    dest_name = orig_name
    dest_path = os.path.join(IMG_DIR, dest_name)
    if os.path.exists(dest_path):
        dest_size = os.path.getsize(dest_path)
        if dest_size == src_stat:
            # 同名同大小，认为相同文件，复用
            _copied_map[src_abs] = dest_name
            return '/static/images/' + dest_name
        else:
            # 同名但大小不同，生成带 hash 的文件名避免覆盖
            with open(src_abs, 'rb') as f:
                md5 = hashlib.md5(f.read()).hexdigest()[:8]
            name, ext = os.path.splitext(orig_name)
            dest_name = f"{name}_{md5}{ext}"
            dest_path = os.path.join(IMG_DIR, dest_name)
            # 若目标已存在且大小相同则复用，否则复制
            if os.path.exists(dest_path):
                if os.path.getsize(dest_path) == src_stat:
                    _copied_map[src_abs] = dest_name
                    return '/static/images/' + dest_name
            shutil.copy2(src_abs, dest_path)
            _copied_map[src_abs] = dest_name
            return '/static/images/' + dest_name
    else:
        # 目标不存在，直接复制
        shutil.copy2(src_abs, dest_path)
        _copied_map[src_abs] = dest_name
        return '/static/images/' + dest_name

def md_to_html(md_text, rel_path):
    # 移除 name 注释后再转换（该注释用于树显示）
    text = md_name_re.sub('', md_text)
    html = markdown2.markdown(text, extras=['fenced_code', 'wiki-tables', 'code-friendly', 'smarty-pants', 'cuddled-lists', 'codehilite', 'tables', 'strike'])
    # 处理图片：将本地图片复制到 static/images，并替换 src
    def img_repl(m):
        pre = m.group(1)
        src = m.group(2)
        post = m.group(3)
        new_src = _ensure_image(src, rel_path)
        return pre + new_src + post
    html = img_tag_re.sub(img_repl, html)
    # 把 .md 链接替换为 data-mdpath，保留锚点
    def link_repl(m):
        target = m.group(1)
        anchor = m.group(2) or ''
        norm = os.path.normpath(os.path.join(os.path.dirname(rel_path), target)).replace('\\','/')
        return 'href="#" data-mdpath="{}{}"'.format(norm, anchor)
    html = md_link_re.sub(link_repl, html)
    return html

def build_tree(folder, rel=''):
    node = {}
    info = read_info(folder)
    node['info'] = info if isinstance(info, dict) else {}
    node['info'].setdefault('name', os.path.basename(folder) or '/')
    node['path'] = rel.replace('\\','/')
    node['files'] = []
    node['children'] = []
    for name in sorted(os.listdir(folder), key=str.lower):
        fp = os.path.join(folder, name)
        if os.path.isdir(fp):
            node['children'].append(build_tree(fp, os.path.join(rel, name)))
        elif os.path.isfile(fp) and name.lower().endswith('.md'):
            rel_path = os.path.normpath(os.path.join(rel, name)).replace('\\','/')
            try:
                text = open(fp, 'r', encoding='utf-8').read()
            except:
                text = open(fp, 'r', encoding='gbk', errors='ignore').read()
            # 提取 title（<!-- name=xxx -->），保留文件名为 name
            m = md_name_re.search(text)
            title = m.group(1).strip() if m else os.path.splitext(name)[0]
            html = md_to_html(text, rel_path)
            node['files'].append({
                'name': os.path.splitext(name)[0],  # 文件名用于导航
                'title': title,                    # 用于在树中显示
                'path': rel_path,
                'html': html
            })
    return node

def main():
    # 不记录根 folder 本身：将根下的文件与子文件夹分别列出
    root_node = {'files': [], 'children': []}
    for name in sorted(os.listdir(ROOT), key=str.lower):
        fp = os.path.join(ROOT, name)
        if os.path.isdir(fp):
            root_node['children'].append(build_tree(fp, name))
        elif os.path.isfile(fp) and name.lower().endswith('.md'):
            rel_path = os.path.normpath(os.path.join('', name)).replace('\\','/')
            try:
                text = open(fp, 'r', encoding='utf-8').read()
            except:
                text = open(fp, 'r', encoding='gbk', errors='ignore').read()
            m = md_name_re.search(text)
            title = m.group(1).strip() if m else os.path.splitext(name)[0]
            html = md_to_html(text, rel_path)
            root_node['files'].append({
                'name': os.path.splitext(name)[0],
                'title': title,
                'path': rel_path,
                'html': html
            })

    js = 'window.GUIDE_DATA = ' + json.dumps(root_node, ensure_ascii=False, indent=2) + ';'
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)
    print("written", OUT)

if __name__ == '__main__':
    main()
