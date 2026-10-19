#!/bin/bash
cd "$(dirname "$0")"
bash scripts/start.sh
result=$?
if [ "$result" -ne 0 ]; then read -r -p 'Press Return to close this window.'; fi
exit "$result"
