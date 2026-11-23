#!/usr/bin/env python3
"""The home server for Drop & Finds.

It does two jobs:
  1. Hands the app's files to any device on the home Wi-Fi that asks for them.
  2. Keeps a copy of each season's map picture, so old seasons still have
     their map after the game moves on. (On the public site the iPad keeps
     these itself, but Safari only allows that on a secure address.)

It only ever reads. Nobody can change or upload anything through it, and it
only hands out files from one folder, the "site" folder given when it starts.

Run it like this:   python3 serve.py /path/to/site 8642
"""

import json
import os
import sys
import threading
import time
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

MAP_SERVICE = 'https://fortnite-api.com'
CHECK_EVERY = 6 * 60 * 60  # look for a new game version every 6 hours


class AppFiles(SimpleHTTPRequestHandler):
    """Hands out files from the site folder, with a few safety rules."""

    def end_headers(self):
        # Tell the iPad to always check for a newer copy of each file,
        # so a changed app shows up the next time it's opened.
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def send_head(self):
        # Never hand out hidden files or folders (names starting with a dot).
        parts = self.path.split('?', 1)[0].split('/')
        if any(part.startswith('.') for part in parts):
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        # Don't show a list of what's in a folder.
        self.send_error(404)
        return None

    def do_POST(self):
        self.send_error(405)

    do_PUT = do_DELETE = do_PATCH = do_POST

    def log_message(self, fmt, *args):
        # One short line per request, with the time, in the log file.
        sys.stderr.write('%s %s %s\n' % (time.strftime('%Y-%m-%d %H:%M:%S'),
                                           self.client_address[0], fmt % args))


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'drop-and-finds-home-server'})
    with urllib.request.urlopen(request, timeout=120) as answer:
        return answer.read()


def keep_season_picture(site):
    """If the game has a new version, save this season's map picture."""
    folder = os.path.join(site, 'season-maps')
    os.makedirs(folder, exist_ok=True)

    # The version looks like "++Fortnite+Release-43.10-CL-123". The 43 is the season.
    build = json.loads(fetch(MAP_SERVICE + '/v2/aes'))['data']['build']
    season = build.split('Release-')[1].split('.')[0]
    if not season.isdigit():
        return

    picture = os.path.join(folder, season + '.png')
    note = os.path.join(folder, season + '.build')
    if os.path.exists(picture) and os.path.exists(note) and open(note).read() == build:
        return  # already have this exact version's picture

    try:
        data = fetch(MAP_SERVICE + '/images/map_4096.png?v=' + build)  # the big one
    except Exception:
        data = fetch(MAP_SERVICE + '/images/map.png?v=' + build)       # the normal one

    # Write to a spare name first, then swap, so a half-saved picture is never served.
    spare = picture + '.part'
    with open(spare, 'wb') as out:
        out.write(data)
    os.replace(spare, picture)
    with open(note, 'w') as out:
        out.write(build)
    sys.stderr.write('%s saved the season %s map (%d bytes)\n'
                     % (time.strftime('%Y-%m-%d %H:%M:%S'), season, len(data)))


def picture_keeper(site):
    while True:
        try:
            keep_season_picture(site)
        except Exception as problem:  # no internet, service down: try again later
            sys.stderr.write('%s could not check the map: %s\n'
                             % (time.strftime('%Y-%m-%d %H:%M:%S'), problem))
        time.sleep(CHECK_EVERY)


def main():
    site = os.path.abspath(sys.argv[1])
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8642
    if not os.path.isfile(os.path.join(site, 'index.html')):
        sys.exit('No index.html in ' + site)

    threading.Thread(target=picture_keeper, args=(site,), daemon=True).start()
    server = ThreadingHTTPServer(('0.0.0.0', port), partial(AppFiles, directory=site))
    sys.stderr.write('%s serving %s on port %d\n' % (time.strftime('%Y-%m-%d %H:%M:%S'), site, port))
    server.serve_forever()


if __name__ == '__main__':
    main()
