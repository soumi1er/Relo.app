@echo off
chcp 65001 >nul
title Relo - Installation
color 0A

echo ============================================
echo   Installation de Relo (premiere fois)
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe sur cet ordinateur.
    echo.
    echo Relo a besoin de Node.js pour fonctionner ^(c'est gratuit^).
    echo Une page va s'ouvrir pour le telecharger.
    echo.
    echo IMPORTANT : une fois Node.js installe, redemarrez votre
    echo ordinateur, puis relancez ce fichier.
    echo.
    start https://nodejs.org/fr/download
    pause
    exit /b 1
)

echo [OK] Node.js est installe.
echo.

echo ----------------------------------------------
echo Etape 1/4 : installation du serveur (backend)
echo ----------------------------------------------
cd /d "%~dp0backend"
if not exist "data" mkdir "data"
if not exist ".env" (
    >".env" echo DATABASE_URL="file:../data/relo.db"
    >>".env" echo JWT_EXPIRES_IN="8h"
    >>".env" echo PORT=4000
    >>".env" echo MOYENNE_PASSAGE=10
    >>".env" echo OPENAI_API_KEY=""
    >>".env" echo OPENAI_API_BASE="https://api.openai.com/v1"
    >>".env" echo OPENAI_MODEL="gpt-5-mini"
    >>".env" echo PDF_MAX_BODY="50mb"
    >>".env" echo PDF_IMPORT_USE_IA="true"
)
set "DATABASE_URL=file:../data/relo.db"
call npm install
if %errorlevel% neq 0 (
    echo [ERREUR] L'installation du serveur a echoue.
    pause
    exit /b 1
)

echo.
echo ----------------------------------------------
echo Etape 2/4 : preparation de la base de donnees
echo ----------------------------------------------
call npx prisma generate
if %errorlevel% neq 0 (
    echo [ERREUR] La generation Prisma a echoue.
    pause
    exit /b 1
)
call npx prisma db push
if %errorlevel% neq 0 (
    echo [ERREUR] La preparation de la base de donnees a echoue.
    pause
    exit /b 1
)

call npm run build
if %errorlevel% neq 0 (
    echo [ERREUR] La construction du serveur a echoue.
    pause
    exit /b 1
)

echo.
echo ----------------------------------------------
echo Etape 3/4 : installation de l'application
echo ----------------------------------------------
cd /d "%~dp0desktop"
call npm install
if %errorlevel% neq 0 (
    echo [ERREUR] L'installation de l'application a echoue.
    pause
    exit /b 1
)

call npm run build
if %errorlevel% neq 0 (
    echo [ERREUR] La construction de l'application a echoue.
    pause
    exit /b 1
)

echo.
echo ----------------------------------------------
echo Etape 4/4 : creation du raccourci sur le bureau
echo ----------------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$desktop = [Environment]::GetFolderPath('Desktop'); if (-not $desktop -or -not (Test-Path $desktop)) { $desktop = Join-Path $env:USERPROFILE 'Desktop'; }; $s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'Relo.lnk')); $s.TargetPath = 'cmd.exe'; $s.Arguments = '/c ""%~dp0Demarrer-Relo.bat""'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'Relo - Gestion scolaire'; $s.Save(); if (Test-Path (Join-Path $desktop 'Relo.lnk')) { Write-Host '[OK] Raccourci Relo cree sur le Bureau.' } else { Write-Host '[ERREUR] Le raccourci Relo n''a pas pu etre cree.' }"

echo.
echo ============================================
echo   Installation terminee !
echo ============================================
echo.
if exist "%USERPROFILE%\Desktop\Relo.lnk" (
    echo Un raccourci "Relo" a ete cree sur votre Bureau.
) else (
    echo [ATTENTION] Le raccourci n'a pas ete cree automatiquement.
    echo Vous pouvez lancer Relo avec Demarrer-Relo.bat.
)
echo Utilisez-le desormais pour lancer l'application.
echo.
echo Lancement de Relo maintenant...
timeout /t 3 >nul

call "%~dp0Demarrer-Relo.bat"
