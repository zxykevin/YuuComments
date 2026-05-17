@echo off
setlocal

cd /d "%~dp0"

echo.
echo ==^> Installing dependencies
call pnpm install
if errorlevel 1 goto :failed

echo.
echo ==^> Creating local config
call pnpm setup
if errorlevel 1 goto :failed

echo.
echo ==^> Logging in to Cloudflare
call pnpm exec wrangler login
if errorlevel 1 goto :failed

echo.
echo ==^> Deploying backend
call pnpm deploy:backend
if errorlevel 1 goto :failed

echo.
echo Backend deployment finished successfully.
goto :done

:failed
echo.
echo Deployment stopped because a command failed.

:done
echo.
pause
endlocal
