import { config } from './config';
import { deployService, metaFileExtension } from './DeployService';
import path from 'path';
import extract from 'extract-zip';
import fs from 'fs/promises';
import fileType from 'file-type';
import { randomString } from './randomString';
import { Request, Response } from 'express';
import { app } from './App';

export class DeployController {
  public async post(req: Request, res: Response) {
    if (!req.files) {
      res.status(400).send();
      return;
    }

    if (config.token !== '') {
      if (!req.query.token || req.query.token !== config.token) {
        res.status(403);
        return;
      }
    }

    const deployId = randomString();
    const deployPackage = req.files.file;

    const deployZipPath = path.resolve(config.deployDir, `./${deployId}.zip`);
    await deployPackage.mv(deployZipPath);
    if ((await fileType.fromFile(deployZipPath))?.mime !== 'application/zip') {
      res.status(400).send();
      return;
    }

    const currentDeployPath = path.resolve(config.deployDir, `./${deployId}/`);
    await extract(deployZipPath, { dir: currentDeployPath });

    const deployMetaFilePath = path.resolve(config.deployDir, `./${deployId}${metaFileExtension}`)
    await fs.writeFile(deployMetaFilePath, JSON.stringify({
      id: deployId,
      md5: deployPackage.md5,
      createdAt: new Date().toISOString()
    }));

    let target: 'test' | 'live' = 'test';

    if (Object.prototype.hasOwnProperty.call(req.query, 'env') && typeof req.query.env === 'string' && req.query.env === 'live') {
      target = 'live';
    }

    switch(target) {
      case 'live':
        await deployService.deployToLive(currentDeployPath);
      break;

      case 'test':
        await deployService.deployToTest(currentDeployPath, deployId);
      break;
    }

    res.status(201);
    res.send(JSON.stringify({
      deployId
    }));

    if (target === 'test') {
      app.obtainCertFor(deployId + '.' + config.domain, deployId);
    }

    return;
  }

  get(req: Request, res: Response) {
    res.json(Object.values(deployService.getDeploys()));
  }
}

export const deployController = new DeployController();
