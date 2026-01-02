@echo off
echo 开始打包
if not exist "..\pack" mkdir "..\pack"
if not exist "..\pack\_" mkdir "..\pack\_"

rem 复制 runtimes 整个文件夹
robocopy "..\viewer\Webapp\Webapp\bin\Release\runtimes" "..\pack\_\runtimes" /E

rem 复制 Release 根目录下的文件，排除指定扩展名（不递归子目录）
robocopy "..\viewer\Webapp\Webapp\bin\Release" "..\pack\_" /XF *.config *.pdb *.xml *.application *.manifest /XD "..\viewer\Webapp\Webapp\bin\Release\runtimes"

@REM 复制启动代码
copy /y .\caph.spec ..\py\caph.spec
copy /y .\startup.py ..\py\caph.py
copy /y .\start.bat ..\pack\start.bat
cd ..\py
@REM 打包
pyinstaller caph.spec --noconfirm
copy /y .\dist\caph.exe ..\pack\_\caph.exe
echo py打包完成
@REM 清理临时文件
rd /s /q build
rd /s /q dist
del caph.spec
del caph.py
pause