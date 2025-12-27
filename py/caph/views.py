from django.shortcuts import render
from django.http.response import HttpResponse
import subprocess

from django.views.decorators.csrf import csrf_exempt

def chatpage(r):
    return render(r,'index.html')

@csrf_exempt
def run_cmd(r):
    # 运行命令并返回输出
    command = r.POST.get('command', '')
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    r=f'返回代码:\n{result.returncode}\n标准输出:\n{result.stdout}\n标准错误:\n{result.stderr}'
    print(r)
    return HttpResponse(r)