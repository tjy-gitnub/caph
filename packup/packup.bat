@echo off
echo 开始打包
if not exist "..\pack" mkdir "..\pack"
if not exist "..\pack\_" mkdir "..\pack\_"

rem 只复制指定语言的 .pak 文件（文件名保留，不保留原路径）
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


rem 复制 Release 根目录下的文件，排除指定扩展名（不递归子目录）
robocopy "..\viewer\Webapp\Webapp\bin\Release" "..\pack\_" /XF *.config *.pdb *.xml *.application *.manifest *.log /XD "..\viewer\Webapp\Webapp\bin\Release\locales"

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