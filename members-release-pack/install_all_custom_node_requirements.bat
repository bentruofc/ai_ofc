@echo off
setlocal enabledelayedexpansion

REM ---- Locate ComfyUI portable root (folder containing python_embeded) ----
set "DIR=%~dp0"
set "PYEXE="
set "CUSTOM_NODES="

for /L %%i in (1,1,6) do (
    if exist "!DIR!python_embeded\python.exe" (
        set "PYEXE=!DIR!python_embeded\python.exe"
        set "CUSTOM_NODES=!DIR!ComfyUI\custom_nodes"
        goto :found
    )
    set "DIR=!DIR!..\"
)

echo [ERROR] Could not find python_embeded\python.exe by walking up from:
echo         %~dp0
echo Place this script anywhere inside ComfyUI_windows_portable and try again.
pause
exit /b 1

:found
echo ============================================================
echo  ComfyUI custom-node requirements installer
echo ============================================================
echo  Python:       !PYEXE!
echo  custom_nodes: !CUSTOM_NODES!
echo ============================================================
echo.

if not exist "!CUSTOM_NODES!" (
    echo [ERROR] custom_nodes folder not found at: !CUSTOM_NODES!
    pause
    exit /b 1
)

REM ---- Clone extra custom nodes if missing ----
call :clone_node "https://github.com/pythongosssss/ComfyUI-Custom-Scripts" "ComfyUI-Custom-Scripts"

set /a TOTAL=0
set /a OK=0
set /a FAIL=0
set "FAILED_NODES="

for /d %%D in ("!CUSTOM_NODES!\*") do (
    if exist "%%D\requirements.txt" (
        set /a TOTAL+=1
        echo.
        echo === [!TOTAL!] %%~nxD ===
        REM Force-reinstall only for aiorbust node to ensure correct versions
        if /i "%%~nxD"=="aiorbust-OFM-pack-Monthly" (
            "!PYEXE!" -m pip install -r "%%D\requirements.txt" --force-reinstall
        ) else (
            "!PYEXE!" -m pip install -r "%%D\requirements.txt"
        )
        if errorlevel 1 (
            set /a FAIL+=1
            set "FAILED_NODES=!FAILED_NODES! %%~nxD"
        ) else (
            set /a OK+=1
        )
    )
)

echo.
echo ============================================================
echo  Done.   processed=!TOTAL!   ok=!OK!   failed=!FAIL!
if !FAIL! gtr 0 echo  Failed:!FAILED_NODES!
echo ============================================================
pause
endlocal
exit /b 0

REM ---- Subroutine: clone a repo into custom_nodes if missing ----
:clone_node
set "REPO_URL=%~1"
set "REPO_NAME=%~2"
if exist "!CUSTOM_NODES!\!REPO_NAME!" (
    echo [skip] !REPO_NAME! already present
    goto :eof
)
where git >nul 2>nul
if errorlevel 1 (
    echo [warn] git not found in PATH - cannot clone !REPO_NAME!
    goto :eof
)
echo.
echo === Cloning !REPO_NAME! ===
git clone "!REPO_URL!" "!CUSTOM_NODES!\!REPO_NAME!"
goto :eof
