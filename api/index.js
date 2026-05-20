// Vercel serverless function entry point
// These explicit path.resolve calls with literal strings ensure
// Node File Trace (NFT) statically detects and bundles these files.
const path = require('path');
const _nft_index = path.resolve(__dirname, '../index.html');
const _nft_github = path.resolve(__dirname, '../github-login.html');
const _nft_google = path.resolve(__dirname, '../google-login.html');
const _nft_db = path.resolve(__dirname, '../app.db');
const _nft_database = path.resolve(__dirname, '../database.js');

const app = require('../server.js');
module.exports = app;
