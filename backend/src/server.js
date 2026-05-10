require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { logger } = require('./logger');
const { getBrowser } = require('./browser');
const searchRoute = require('./routes/search');
const healthRoute = require('./routes/health');

const PORT = parseInt(process.env.PORT, 10) || 8787;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const app = express();
app.use(
  cors({
    origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN.split(',').map((s) => s.trim()),
  })
);
app.use(express.json());

app.use(searchRoute);
app.use(healthRoute);

app.use((err, req, res, _next) => {
  logger.error({ err: err.message, path: req.path }, 'unhandled error');
  res.status(500).json({ error: 'Internal error' });
});

(async () => {
  try {
    await getBrowser();
    app.listen(PORT, () => {
      logger.info({ port: PORT, allowedOrigin: ALLOWED_ORIGIN }, 'EmThaoJP backend listening');
    });
  } catch (err) {
    logger.error({ err: err.message }, 'failed to boot');
    process.exit(1);
  }
})();
