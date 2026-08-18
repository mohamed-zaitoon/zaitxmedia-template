#!/usr/bin/env bash
# ZAITX Media Admin — Native Linux Desktop Launcher
APP_NAME="ZAITX Media Admin"
URL="https://admin.zaitxmedia.com"

# Check if google-chrome or chromium or firefox is installed
if command -v google-chrome &> /dev/null; then
  exec google-chrome --app="$URL" --name="$APP_NAME" --class="ZAITXAdmin" "$@"
elif command -v chromium-browser &> /dev/null; then
  exec chromium-browser --app="$URL" --name="$APP_NAME" --class="ZAITXAdmin" "$@"
elif command -v chromium &> /dev/null; then
  exec chromium --app="$URL" --name="$APP_NAME" --class="ZAITXAdmin" "$@"
else
  exec xdg-open "$URL"
fi
