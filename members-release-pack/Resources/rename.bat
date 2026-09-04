@echo off
setlocal enabledelayedexpansion

:: Étape 1 : renommer temporairement
set i=1
for %%f in (*) do (
    if /I not "%%f"=="rename.bat" (
        ren "%%f" "__tmp_!i!%%~xf"
        set /a i+=1
    )
)

:: Étape 2 : noms finaux
set i=1
for %%f in (__tmp_*) do (
    set num=00!i!
    set num=!num:~-2!
    ren "%%f" "swap_!num!%%~xf"
    set /a i+=1
)

echo Terminé.
pause