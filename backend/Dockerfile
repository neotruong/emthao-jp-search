# Keep this tag in lockstep with `playwright` in package.json. Mismatch
# triggers "Executable doesn't exist at /ms-playwright/..." at boot because
# the npm module looks for a binary path the base image's Chromium release
# doesn't ship. See https://github.com/microsoft/playwright/issues — this
# bit us once on first Render deploy (Playwright 1.49 image vs npm 1.59.1).
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

CMD ["node", "src/server.js"]
