#!/bin/bash
echo "Starting AffiliateHunter backend..."
cd "$(dirname "$0")"
npm install
node src/index.js
