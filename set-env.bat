@echo off
echo Setting up VoxTube environment variables...

set FFMPEG_PATH=D:\Development\ffmpeg-7.1.1-essentials_build\bin\ffmpeg.exe
set FFPROBE_PATH=D:\Development\ffmpeg-7.1.1-essentials_build\bin\ffprobe.exe

echo FFMPEG_PATH=%FFMPEG_PATH%
echo FFPROBE_PATH=%FFPROBE_PATH%

echo.
echo Environment variables set for this session.
echo Now run: npm run dev
echo.
pause 