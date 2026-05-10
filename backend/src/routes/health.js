const express = require('express');
const { isConnected } = require('../browser');
const { cache } = require('../cache');

const router = express.Router();

router.get('/health', async (req, res) => {
  const browserConnected = await isConnected();
  res.json({
    status: 'ok',
    cacheEntries: cache.size,
    browserConnected,
  });
});

module.exports = router;
