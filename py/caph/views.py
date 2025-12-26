from django.shortcuts import render
from django.http.response import HttpResponse
import subprocess

# 禁用csrf验证
from django.views.decorators.csrf import csrf_exempt

def chatpage(r):
    return render(r,'index.html')

@csrf_exempt
def run_cmd(r):
    # 在新窗口中运行命令（允许用户交互）并返回输出
    command = r.POST.get('command', '')
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    r=f'返回代码:\n{result.returncode}\n标准输出:\n{result.stdout}\n标准错误:\n{result.stderr}'
    print(r)
    return HttpResponse(r)