#!/usr/bin/env bash
# Manual Chrome Downloader for Render
if [[ ! -d $PUPPETEER_CACHE_DIR ]]; then
  echo "...Downloading Chrome manually..."
  node -e "require('puppeteer').createBrowserFetcher().download('113.0.5672.63')"
else
  echo "...Chrome already exists in cache..."
fi
