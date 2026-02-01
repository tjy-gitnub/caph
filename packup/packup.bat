@echo off
echo 开始打包
if not exist "..\pack" mkdir "..\pack"
if not exist "..\pack\_" mkdir "..\pack\_"

rem 只复制指定语言的 .pak
if not exist "..\pack\_\locales" mkdir "..\pack\_\locales"
setlocal enabledelayedexpansion
set "LANGS=en-US zh-CN zh-TW"
set "SUFS=. _FEMININE _MASCULINE _NEUTER"

for %%L in (%LANGS%) do (
    for %%S in (%SUFS%) do (
        set "SF=%%S"
        if "!SF!"=="." set "SF="
        set "FNAME=%%L!SF!.pak"
        if exist "..\viewer\Webapp\Webapp\bin\Release\locales\!FNAME!" (
            copy /y "..\viewer\Webapp\Webapp\bin\Release\locales\!FNAME!" "..\pack\_\locales\" >nul
        )
    )
)

endlocal

rem 复制 Release 下的文件
robocopy "..\viewer\Webapp\Webapp\bin\Release" "..\pack\_" /XF *.config *.pdb *.xml *.application *.manifest *.log /XD "..\viewer\Webapp\Webapp\bin\Release\locales"

@REM 准备启动代码
copy /y .\django.spec ..\py\django.spec

cd ..\py
@REM 打包 django
pyinstaller django.spec --noconfirm
copy /y .\dist\django.exe ..\pack\_\django.exe

echo py打包完成

@REM 清理临时文件
rd /s /q build
rd /s /q dist
del django.spec

@REM 移出主程序
move ..\pack\_\Webapp.exe ..\pack\Caph.exe

pause