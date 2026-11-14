#!/bin/bash
# Draait alle tests (ongeveer 13 minuten). Gebruik: bash tests/alles.sh > /tmp/alles.txt
# Nodig: Playwright (PLAYWRIGHT=pad naar playwright/index.mjs in de tests) en Chrome.
cd "$(dirname "$0")/.."
pkill -f http.server; sleep 0.5
(python3 -m http.server 8177 >/dev/null 2>&1 &)
sleep 1
for t in 15 16 17; do echo "=== stap$t"; timeout 400 node tests/test_stap$t.mjs http://localhost:8177/ 2>&1 | grep -E "FOUT|ok [0-9]|Error" | head -5; done
pkill -f http.server
for t in tests/*.mjs; do case $t in *test_stap*|*balans*|*koningsim*) continue;; esac; pkill -f http.server; sleep 0.3; r=$(timeout 400 node $t 2>&1); echo "=== $t"; echo "$r" | grep -E "FOUT|Error|fouten|goed|ok [0-9]" | head -6; done
