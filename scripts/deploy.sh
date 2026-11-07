#!/bin/sh
# Выкладка на https://ball-territory.ball-territory.workers.dev
# macOS не даёт workerd и esbuild читать ~/Desktop (они молча зависают), поэтому выкладываем из копии вне рабочего стола.
set -e
cd "$(dirname "$0")/.."
DST="$HOME/Library/Caches/ball-territory-deploy"
mkdir -p "$DST"
rsync -a --delete --exclude out --exclude .git --exclude .wrangler ./ "$DST/"
cd "$DST"
npx wrangler deploy
