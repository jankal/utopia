import { config } from './config';
import { deployService, metaFileExtension } from './DeployService';
import util from 'util';
import path from 'path';
import extract from 'extract-zip';
import fs from 'fs';
import fileType from 'file-type';
import { randomString } from './randomString';
import { Request, Response } from 'express';

export class DeployController {
  public async post(req: Request, res: Response) {
    if (!req.files) {
      res.status(400).send();
      return;
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
    await util.promisify(fs.writeFile)(deployMetaFilePath, JSON.stringify({
      id: deployId,
      md5: deployPackage.md5,
      createdAt: new Date().toISOString()
    }));

    if (Object.prototype.hasOwnProperty.call(req.query, 'env') && typeof req.query.env === 'string') {
      switch(req.query.env) {
        case 'live':
          await deployService.deployToLive(currentDeployPath);
        break;

        case 'test':
        default:
          await deployService.deployToTest(currentDeployPath, deployId);
        break;
      }
    } else {
      await deployService.deployToTest(currentDeployPath, deployId);
    }

    res.status(201);
    res.send(JSON.stringify({
      deployId
    }));

    return;
  }

  get(req: Request, res: Response) {
    res.json(Object.values(deployService.getDeploys()));
  }
}

export const deployController = new DeployController();
