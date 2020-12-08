import path from 'path';

function makeConfig (baseDir: string) {
  const staticDir = path.resolve(baseDir, './static/');

  return {
    staticDir,
    deployDir: path.resolve(baseDir, './deploys/'),
    liveDir: path.resolve(staticDir, './live'),
    domain: process.env.DOMAIN || 'test.com',
    timeout: 60 * 24 * 7, // 7 days (in minutes)
    token: process.env.UTOPIA_TOKEN || '',
    email: 'himself@alexanderjank.de',
    certDirPath: path.resolve(baseDir, './certs/')
  }
}

export const config = makeConfig(path.resolve(__dirname));
