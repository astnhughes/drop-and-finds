#!/bin/zsh
# Copies the app into the home server's folder, so the iPad gets the newest version.
#
# Why a copy? macOS doesn't let a background helper read the Documents folder
# without asking, so the server works from its own folder instead.
#
# Only the files listed here are copied. The private key folder, the vision
# file and git's own files never go near the server.

set -e
PROJECT="${0:A:h:h}"                                        # the project folder
HOME_SERVER="$HOME/Library/Application Support/DropAndFinds"
SITE="$HOME_SERVER/site"

mkdir -p "$SITE/icons"
for file in index.html style.css app.js sw.js guide.json manifest.webmanifest; do
  cp "$PROJECT/$file" "$SITE/$file"
done
cp "$PROJECT"/icons/*.png "$SITE/icons/"

# The server program itself. If it changed, restart the server so it's used.
if ! cmp -s "$PROJECT/server/serve.py" "$HOME_SERVER/serve.py"; then
  cp "$PROJECT/server/serve.py" "$HOME_SERVER/serve.py"
  launchctl kickstart -k "gui/$(id -u)/com.dropandfinds.server" 2>/dev/null || true
fi

echo "Home server updated: $(grep -o 'app.js?v=[0-9]*' "$SITE/index.html")"
