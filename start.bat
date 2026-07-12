@echo off
cd /d "%~dp0"
echo.
echo  Tokyo Streets 3D — starting local server...
echo  PC browser: http://127.0.0.1:8765
echo  phone/iPad: use this PC's LAN IP :8765
echo.
start "" "http://127.0.0.1:8765"
python -m http.server 8765 --bind 127.0.0.1
