#!/bin/bash
cd "/Users/lyuhoyun/Documents/GitHub/Visualization Tool"
git add WORKLOG.md README.md
git diff --cached --quiet || git commit -m "auto: update worklog/readme [skip ci]" && git push origin main
