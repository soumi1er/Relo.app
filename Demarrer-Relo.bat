@echo off
chcp 65001 >nul
title Relo
cd /d "%~dp0desktop"
if not exist "node_modules\electron\cli.js" (
    echo [ERREUR] Relo n'est pas installe. Lancez Installer-Relo.bat.
    pause
    exit /b 1
)
call npx electron .
