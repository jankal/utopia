import path from 'path';

function makeConfig (baseDir: string) {
  const staticDir = path.resolve(baseDir, './static/');

  return {
    staticDir,
    deployDir: path.resolve(baseDir, './deploys/'),
    liveDir: path.resolve(staticDir, './live'),
    domain: process.env.DOMAIN || 'test.com',
    timeout: 600 // minutes
  }
}

export const config = makeConfig(path.resolve(__dirname));
