@echo off
REM Code Quality Check Script for Windows
REM Runs all code quality tools and saves output to a temporary file

setlocal enabledelayedexpansion

REM Create timestamp for output file
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set timestamp=%mydate%_%mytime%

REM Ensure tmp directory exists
if not exist "tmp" mkdir tmp

set outputfile=tmp\code-quality-%timestamp%.txt

echo Papa's Books - Code Quality Report > %outputfile%
echo Generated: %date% %time% >> %outputfile%
echo Working Directory: %cd% >> %outputfile%
echo. >> %outputfile%

echo.
echo Running code quality checks...
echo.

REM TypeScript Type Check
echo ================================================================================ >> %outputfile%
echo TypeScript Type Check >> %outputfile%
echo ================================================================================ >> %outputfile%
echo Command: npx tsc --noEmit >> %outputfile%
echo Started: %date% %time% >> %outputfile%
echo ================================================================================ >> %outputfile%
echo.
echo Checking TypeScript types...
call npx tsc --noEmit >> %outputfile% 2>&1
if !errorlevel! equ 0 (
    echo ✓ TypeScript Type Check passed >> %outputfile%
    echo ✓ TypeScript Type Check passed
) else (
    echo ✗ TypeScript Type Check failed >> %outputfile%
    echo ✗ TypeScript Type Check failed
)
echo. >> %outputfile%

REM ESLint
echo ================================================================================ >> %outputfile%
echo ESLint >> %outputfile%
echo ================================================================================ >> %outputfile%
echo Command: npm run lint >> %outputfile%
echo Started: %date% %time% >> %outputfile%
echo ================================================================================ >> %outputfile%
echo.
echo Running ESLint...
call npm run lint >> %outputfile% 2>&1
if !errorlevel! equ 0 (
    echo ✓ ESLint passed >> %outputfile%
    echo ✓ ESLint passed
) else (
    echo ✗ ESLint failed >> %outputfile%
    echo ✗ ESLint failed
)
echo. >> %outputfile%

REM Markdown Lint
echo ================================================================================ >> %outputfile%
echo Markdown Lint >> %outputfile%
echo ================================================================================ >> %outputfile%
echo Command: npm run lint:md >> %outputfile%
echo Started: %date% %time% >> %outputfile%
echo ================================================================================ >> %outputfile%
echo.
echo Linting markdown files...
call npm run lint:md >> %outputfile% 2>&1
if !errorlevel! equ 0 (
    echo ✓ Markdown Lint passed >> %outputfile%
    echo ✓ Markdown Lint passed
) else (
    echo ✗ Markdown Lint failed >> %outputfile%
    echo ✗ Markdown Lint failed
)
echo. >> %outputfile%

REM Prettier Format Check
echo ================================================================================ >> %outputfile%
echo Prettier Format Check >> %outputfile%
echo ================================================================================ >> %outputfile%
echo Command: npm run format:check >> %outputfile%
echo Started: %date% %time% >> %outputfile%
echo ================================================================================ >> %outputfile%
echo.
echo Checking code formatting...
call npm run format:check >> %outputfile% 2>&1
if !errorlevel! equ 0 (
    echo ✓ Prettier Format Check passed >> %outputfile%
    echo ✓ Prettier Format Check passed
) else (
    echo ✗ Prettier Format Check failed >> %outputfile%
    echo ✗ Prettier Format Check failed
)
echo. >> %outputfile%

REM Knip
echo ================================================================================ >> %outputfile%
echo Knip (Unused Code Detection) >> %outputfile%
echo ================================================================================ >> %outputfile%
echo Command: npm run knip >> %outputfile%
echo Started: %date% %time% >> %outputfile%
echo ================================================================================ >> %outputfile%
echo.
echo Finding unused files, dependencies, and exports...
call npm run knip >> %outputfile% 2>&1
if !errorlevel! equ 0 (
    echo ✓ Knip passed >> %outputfile%
    echo ✓ Knip passed
) else (
    echo ✗ Knip failed >> %outputfile%
    echo ✗ Knip failed
)
echo. >> %outputfile%

REM Build Check
echo ================================================================================ >> %outputfile%
echo Build Check >> %outputfile%
echo ================================================================================ >> %outputfile%
echo Command: npm run build >> %outputfile%
echo Started: %date% %time% >> %outputfile%
echo ================================================================================ >> %outputfile%
echo.
echo Testing production build...
call npm run build >> %outputfile% 2>&1
if !errorlevel! equ 0 (
    echo ✓ Build Check passed >> %outputfile%
    echo ✓ Build Check passed
) else (
    echo ✗ Build Check failed >> %outputfile%
    echo ✗ Build Check failed
)
echo. >> %outputfile%

REM Summary
echo ================================================================================ >> %outputfile%
echo SUMMARY >> %outputfile%
echo ================================================================================ >> %outputfile%
echo Results saved to: %outputfile% >> %outputfile%
echo ================================================================================ >> %outputfile%

echo.
echo Full report saved to: %outputfile%
echo.

endlocal
