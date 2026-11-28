const fs = require('fs');
const path = require('path');

function readEnvTarget() {
  if (process.env.API_PROXY_TARGET) {
    return process.env.API_PROXY_TARGET;
  }
  const rootDir = __dirname;
  const envFile = path.join(rootDir, '.env');
  const exampleFile = path.join(rootDir, '.env.example');
  const targetFile = fs.existsSync(envFile) ? envFile : fs.existsSync(exampleFile) ? exampleFile : null;

  if (targetFile) {
    const content = fs.readFileSync(targetFile, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1 && trimmed.slice(0, eqIdx).trim() === 'API_PROXY_TARGET') {
        return trimmed.slice(eqIdx + 1).trim();
      }
    }
  }
  return 'http://localhost:5000';
}

const target = readEnvTarget();

module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    logLevel: 'warn',
  },
};
