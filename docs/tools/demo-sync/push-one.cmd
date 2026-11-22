@echo off
rem Push theme files from the repo to one theme.
rem usage: push-one.cmd <store-subdomain> <theme-id> <file> [file ...]
setlocal
for %%I in ("%~dp0..\..\..") do set ROOT=%%~fI
set STORE=%~1
set THEME=%~2
shift
shift
set ONLY=
:args
if "%~1"=="" goto run
set ONLY=%ONLY% --only %~1
shift
goto args
:run
cd /d "%ROOT%"
call shopify.cmd theme push --store %STORE%.myshopify.com --theme %THEME% --path "%ROOT%" --nodelete %ONLY% --allow-live
