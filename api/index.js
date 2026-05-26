// Vercel serverless function entry point
// These explicit path.resolve calls with literal strings ensure
// Node File Trace (NFT) statically detects and bundles these files.
const path = require('path');
const _nft_index = path.resolve(__dirname, '../index.html');
const _nft_github = path.resolve(__dirname, '../github-login.html');
const _nft_google = path.resolve(__dirname, '../google-login.html');
const _nft_db = path.resolve(__dirname, '../app.db');
const _nft_database = path.resolve(__dirname, '../database.js');

// NFT hints for image assets — ensures Vercel bundles these into the serverless function
const _nft_img1 = path.resolve(__dirname, '../images/verified_badges_mockup.png');
const _nft_img2 = path.resolve(__dirname, '../images/proctor_session_mockup.png');
const _nft_img3 = path.resolve(__dirname, '../images/ai_evaluation_mockup.png');
const _nft_img4 = path.resolve(__dirname, '../images/hero_dashboard_mockup.png');
const _nft_img5 = path.resolve(__dirname, '../images/hero-bg.png');
const _nft_img6 = path.resolve(__dirname, '../images/dashboard-illustration.png');
const _nft_img7 = path.resolve(__dirname, '../images/login-illustration.png');
const _nft_img8 = path.resolve(__dirname, '../images/proctoring-illustration.png');
const _nft_img9 = path.resolve(__dirname, '../images/web_design_challenge.png');

const app = require('../server.js');
module.exports = app;
