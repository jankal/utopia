import express from 'express';
import fileUpload from 'express-fileupload';
import extract from 'extract-zip';
import path from 'path';
import fs from 'fs';
import util from 'util';
import { randomString } from './randomString';
import vhost from 'vhost';
import bodyParser from 'body-parser';
import fileType from 'file-type';

const domain = 'zeraton.de';
const deployDir = path.resolve(__dirname, './deploys/');
const staticDir = path.resolve(__dirname, './static/');
const liveDir = path.resolve(staticDir, './live');

async function ensureBaseDirs() {
  for (const dir of [deployDir, staticDir, liveDir]) {
    try {
      await util.promisify(fs.stat)(dir);
    } catch (e) {
      await util.promisify(fs.mkdir)(dir);
    }
  }
}

const manager = express();
const app = express();

manager.use(fileUpload({
  debug: true,
  useTempFiles: true
}));

manager.use(bodyParser.json());
manager.use(bodyParser.urlencoded({extended: true}));

async function deployToLive(currentDeployPath: string) {
  const liveDirStats = await util.promisify(fs.lstat)(liveDir);
  if (!liveDirStats.isSymbolicLink()) {
    await util.promisify(fs.rmdir)(liveDir);
  }
  await util.promisify(fs.symlink)(currentDeployPath, liveDir);
}

async function deployToTest(currentDeployPath: string, deployId: string) {
  const deployLink = path.resolve(staticDir, `./${deployId}/`);
  await util.promisify(fs.symlink)(currentDeployPath, deployLink);
  app.use(vhost(deployId + domain, express.static(deployLink)));
}

manager.post('/deploy', async (req, res) => {
  if (!req.files) {
    res.status(400).send();
    return;
  }

  const deployId = randomString();
  const deployPackage = req.files.file;

  const deployZipPath = path.resolve(deployDir, `./${deployId}.zip`);
  console.log(deployZipPath);
  await deployPackage.mv(deployZipPath);
  if ((await fileType.fromFile(deployZipPath))?.mime !== 'application/zip') {
    res.status(400).send();
    return;
  }

  const currentDeployPath = path.resolve(deployDir, `./${deployId}/`);
  await extract(deployZipPath, { dir: currentDeployPath })

  if (Object.prototype.hasOwnProperty.call(req.query, 'env') && typeof req.query.env === 'string') {
    switch(req.query.env) {
      case 'live':
        await deployToLive(currentDeployPath);
      break;

      case 'test':
      default:
        await deployToTest(currentDeployPath, deployId);
      break;
    }
  } else {
    await deployToTest(currentDeployPath, deployId);
  }

  res.status(201);
  res.send('Deployed!');

  return;
});

(async () => {
  await ensureBaseDirs();
  manager.listen(2242, () => {
    console.log('Manager is listening on 2242.')
  });

  const deploys = await util.promisify(fs.readdir)(staticDir);
  for (const deployId of deploys) {
    if (deployId === 'live') {
      continue;
    }

    const deployLink = path.resolve(staticDir, `./${deployId}/`);
    app.use(vhost(deployId + domain, express.static(deployLink)));
  }

  app.use(vhost(domain, express.static(liveDir)));

  app.listen(8080, () => {
    console.log('Server is listening on 8080.')
  });
})();
