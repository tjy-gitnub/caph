from django.shortcuts import render
from django.http.response import HttpResponse, JsonResponse
from subprocess import run as sp_run
from webbrowser import open as open_in_browser

from django.views.decorators.csrf import csrf_exempt
import os
import shutil
from pathlib import Path
import time

DOC_DIR = (Path.home()/'Documents') if (Path.home()/'Documents').exists() else Path.home()
DESKTOP_DIR = (Path.home()/'Desktop') if (Path.home()/'Desktop').exists() else Path.home()
ALLOWED_READ_EXT = {'.txt', '.md', '.py', '.json', '.csv', '.log', '.cfg', '.ini', '.html', '.js', '.css', '.xml', '.cpp', '.java', '.bat', '.sh'}
MAX_READ_SIZE = 2 * 1024 * 1024  # 2MB

def _safe_resolve(p):
    try:
        p = Path(p)
        if not p.is_absolute():
            p = (Path('.').resolve() / p).resolve()
        print(str(p))
        p=Path(os.path.expandvars(p))
        if p.is_relative_to(Path('.').resolve()):
            return p
        else:
            return None
    except Exception:
        return None

print('-'*20,'服务端日志','-'*20+'\n')

# 根目录限制（防止越权），根据需要调整
ROOT_DIR = Path("e:/caph").resolve()

ALLOWED_READ_EXTS = {'.txt', '.md', '.py', '.json', '.cfg', '.ini', '.log', '.csv', '.html', '.js', '.css'}

def make_response(text, status=200):
    return HttpResponse(text, status=status, headers={'Access-Control-Allow-Origin': '*'})


def ready(r):
    return HttpResponse('well',headers={'Access-Control-Allow-Origin': '*'})

def chatpage(r):
    # 0/0
    return render(r,'index.html')
def guidepage(r):
    # 0/0
    return render(r,'guide.html')

@csrf_exempt
def run_cmd(r):
    # 运行命令并返回输出
    command = r.POST.get('command', '')
    result = sp_run(command, shell=True, capture_output=True, text=True)
    r=f'返回代码:\n{result.returncode}\n标准输出:\n{result.stdout}\n标准错误:\n{result.stderr}'
    print(r)
    return HttpResponse(r)

@csrf_exempt
def open_url(r):
    # 打开指定URL
    url = r.POST.get('url', '')
    open_in_browser(url)
    return HttpResponse('URL 已打开')

# 文件操作实现

@csrf_exempt
def create_file(r):
    # content = r.POST.get('content','')
    os.chdir(r.POST.get('cwd',DOC_DIR))
    path = _safe_resolve(r.POST.get('path',''))
    if not path:
        return HttpResponse('[错误：路径越出工作目录]')
    # 创建父目录
    path.parent.mkdir(parents=True, exist_ok=True)
    # 创建文件
    path.touch(exist_ok=True)
    if r.POST.get('content',''):
        path.write_text(r.POST.get('content',''),encoding='utf-8')
    return HttpResponse(f'{path} 已创建')
        
@csrf_exempt
def create_folder(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    path = _safe_resolve(r.POST.get('path',''))
    if not path:
        return HttpResponse('[错误：路径越出工作目录]')
    # 创建文件夹及其父目录
    path.mkdir(parents=True, exist_ok=True)
    return HttpResponse(f'文件夹 {path} 已创建')

@csrf_exempt
def delete_file_or_folder(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    path = _safe_resolve(r.POST.get('path',''))
    if not path:
        return HttpResponse('[错误：路径越出工作目录]')
    if not path.exists():
        return HttpResponse('[错误：目标不存在]')
    if path == Path('.').resolve():
        return HttpResponse('[错误：不能删除当前工作目录]')
    try:
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
        return HttpResponse(f'已删除 {path}')
    except Exception as e:
        return HttpResponse(f'[错误: {e}]')

@csrf_exempt
def move_file_or_folder(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    src = _safe_resolve(r.POST.get('src',''))
    dst = _safe_resolve(r.POST.get('dst','')) # 目标（文件或文件夹）
    if not src:
        return HttpResponse('[错误：源路径不允许]')
    if not src.exists():
        return HttpResponse('[错误：源路径不存在]')
    if src == Path('.').resolve():
        return HttpResponse('[错误：不能移动当前工作目录]')
    if not dst:
        return HttpResponse('[错误：目标路径不允许]')
    if not dst.parent.exists():
        dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        shutil.move(str(src), str(dst))
        return HttpResponse(f'已移动到 {dst}')
    except Exception as e:
        return HttpResponse(f'[错误: {e}]')

@csrf_exempt
def copy_file_or_folder(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    src = _safe_resolve(r.POST.get('src',''))
    dst = _safe_resolve(r.POST.get('dst','')) # 目标（文件或文件夹）
    if not src:
        return HttpResponse('[错误：源路径越出工作目录]')
    if not src.exists():
        return HttpResponse('[错误：源路径不存在]')
    if not dst:
        return HttpResponse('[错误：目标路径越出工作目录]')
    if dst.exists():
        return HttpResponse('[错误：目标已存在]')
    try:
        if src.is_dir():
            shutil.copytree(str(src), str(dst))
        else:
            shutil.copy2(str(src), str(dst))
        return HttpResponse(f'已复制到 {dst}')
    except Exception as e:
        return HttpResponse(f'[错误: {e}]')

def _is_valid_filename(name: str) -> bool:
    invalid_chars = set(r'\/:*?"<>|')
    if any(char in invalid_chars for char in name):
        return False
    if name.strip() == '' or name.endswith('.'):
        return False
    return True

@csrf_exempt
def rename_file_or_folder(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    src = _safe_resolve(r.POST.get('src',''))
    new_name:str = r.POST.get('new_name','')
    if not src:
        return HttpResponse('[错误：源路径越出工作目录]')
    if not src.exists():
        return HttpResponse('[错误：源路径不存在]')
    if src.parent.joinpath(new_name).exists():
        return HttpResponse(f'[错误：{new_name} 已存在]')
    # 防止重命名为非法名称
    if not _is_valid_filename(new_name):
        return HttpResponse('[错误：新名称非法]')
    try:
        dst = src.parent / new_name
        src.rename(dst)
        return HttpResponse(f'已重命名为 {dst}')
    except Exception as e:
        return HttpResponse(f'[错误: {e}]')

def _format_size(size_bytes):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.2f} PB"

@csrf_exempt
def get_file_or_folder_props(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    path = _safe_resolve(r.POST.get('path',''))
    if not path:
        return JsonResponse({'error': '路径越出工作目录'})
    if not path.exists():
        return JsonResponse({'error': '路径不存在'})
    if path.is_file():
        size = path.stat().st_size
    else:
        size = sum(f.stat().st_size for f in path.rglob('*') if f.is_file())
    # 转化为可读大小
    size = _format_size(size)
    props = {
        'path': str(path),
        # 'is_file': path.is_file(),
        # 'is_dir': path.is_dir(),
        'type': 'file' if path.is_file() else 'folder',
        'size': size,
        'mtime': time.ctime(path.stat().st_mtime),
        'ctime': time.ctime(path.stat().st_ctime),
    }
    return JsonResponse(props)

@csrf_exempt
def open_file(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    path = _safe_resolve(r.POST.get('path',''))

    if not path:
        return HttpResponse('[错误：路径越出工作目录]')
    if not path.exists():
        return HttpResponse('[错误：文件不存在]')
    try:
        os.startfile(str(path))
        return HttpResponse(f'{path} 已打开')
    except Exception as e:
        return HttpResponse(f'[错误: {e}]')
    

@csrf_exempt
def reveal_in_explorer(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    path = _safe_resolve(r.POST.get('path',''))
    if not path:
        return HttpResponse('[错误：路径越出工作目录]')
    if not path.exists():
        return HttpResponse('[错误：文件或文件夹不存在]')
    try:
        if path.is_dir():
            sp_run(['explorer', str(path.resolve())])
        else:
            sp_run(['explorer', '/select,', str(path.resolve())])
        return HttpResponse(f'已向用户展示 {path}')
    except Exception as e:
        return HttpResponse(f'[错误: {e}]')

@csrf_exempt
def read_file(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    path = _safe_resolve(r.POST.get('path',''))
    encoding = r.POST.get('encoding','utf-8')
    if not path:
        return HttpResponse('[错误：路径越出工作目录]')
    if not path.exists() or not path.is_file():
        return HttpResponse('[错误：文件不存在]')
    if path.suffix.lower() not in ALLOWED_READ_EXT:
        return HttpResponse('[错误：扩展名不允许读取]')
    if path.stat().st_size > MAX_READ_SIZE:
        return HttpResponse(f'[错误：文件过大（{_format_size(path.stat().st_size)}）]')
    try:
        content = path.read_text(encoding=encoding)
        return HttpResponse(content)
    except Exception as e:
        return HttpResponse(f'[错误: {e}]')
    
    

@csrf_exempt
def write_file(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    path = _safe_resolve(r.POST.get('path',''))
    content = r.POST.get('content','')
    encoding = r.POST.get('encoding','utf-8')
    if not path:
        return HttpResponse('[错误：路径越出工作目录]')
    try:
        # 创建父目录
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content,encoding=encoding)
        return HttpResponse(f'已写入到 {path}')
    except Exception as e:
        return HttpResponse(f'[错误: {e}]')
    
@csrf_exempt
def list_directory(r):
    os.chdir(r.POST.get('cwd',DOC_DIR))
    path = _safe_resolve(r.POST.get('path',''))
    if not path:
        return HttpResponse('[错误：路径越出工作目录]')
    if not path.exists() or not path.is_dir():
        return HttpResponse('[错误：目录不存在]')
    items = []
    for entry in path.iterdir():
        item = {
            'name': entry.name,
            'type': 'file' if entry.is_file() else 'folder',
            # 'mtime': time.ctime(entry.stat().st_mtime),
        }
        if entry.is_file():
            item['size'] = _format_size(entry.stat().st_size)
        items.append(item)
    return JsonResponse(items, safe=False) # safe=False 允许返回列表

@csrf_exempt
def change_directory(r):
    path=Path(os.path.expandvars(os.path.expanduser(r.POST.get('path','.'))))
    path = (Path('.').resolve() / path).resolve()
    if not path.exists() or not path.is_dir():
        return JsonResponse({'status': 'error', 'message': '[错误：目录不存在]'})
    return JsonResponse({'status': 'success', 'cwd': str(path)})