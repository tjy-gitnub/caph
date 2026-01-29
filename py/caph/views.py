from django.shortcuts import render
from django.http.response import HttpResponse
import subprocess
from webbrowser import open as open_in_browser

from django.views.decorators.csrf import csrf_exempt

# os.system('cls' if os.name == 'nt' else 'clear')
print('\n\n\n\033c', end='')
print('服务端已启动。\n')
print('-'*20,'服务端日志','-'*20+'\n')

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
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    r=f'返回代码:\n{result.returncode}\n标准输出:\n{result.stdout}\n标准错误:\n{result.stderr}'
    print(r)
    return HttpResponse(r)

@csrf_exempt
def open_url(r):
    # 打开指定URL
    url = r.POST.get('url', '')
    open_in_browser(url)
    return HttpResponse('URL 已打开')