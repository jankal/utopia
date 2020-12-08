import { Deploy } from "./Deploy";
import fs from 'fs/promises';
import path from 'path';
import { config } from './config';
import { isDeployMetaData } from "./DeployMetaData";

export const metaFileExtension = '.meta.json';

export class DeployService {
  private activeDeploys: { [id: string]: Deploy | undefined } = {};

  private addDeploy(deploySpec: Deploy) {
    this.activeDeploys[deploySpec.id] = deploySpec;
  }

  public deployExists(deployId: string) {
    return Object.keys(this.activeDeploys)
      .includes(deployId);
  }

  public getDeploy(deployId: string) {
    return this.activeDeploys[deployId] || null;
  }

  public getDeploys() {
    return Object.values(this.activeDeploys);
  }

  async discoverDeploys() {
    await this.removeOldDeploys();
    const deploys = await fs.readdir(config.staticDir);
    for (const deployId of deploys) {
      if (deployId === 'live') {
        continue;
      }

      const deployLink = path.resolve(config.staticDir, `./${deployId}/`);
      this.addDeploy({
        id: deployId,
        staticPath: deployLink
      });
    }
  }

  public async deployToLive(currentDeployPath: string) {
    const liveDirStats = await fs.lstat(config.liveDir);
    if (!liveDirStats.isSymbolicLink()) {
      await fs.rmdir(config.liveDir);
    } else {
      await fs.unlink(config.liveDir);
    }
    await fs.symlink(currentDeployPath, config.liveDir);
  }

  public async deployToTest(currentDeployPath: string, deployId: string) {
    const deployLink = path.resolve(config.staticDir, `./${deployId}/`);
    await fs.symlink(currentDeployPath, deployLink);

    this.addDeploy({
      id: deployId,
      staticPath: deployLink
    });
  }

  public async removeOldDeploys() {
    const deployMetaFiles = (await fs.readdir(config.deployDir))
      .filter((name) => name.substr(name.length - metaFileExtension.length, metaFileExtension.length) === metaFileExtension);
    for (const deployMetaFileName of deployMetaFiles) {
      const metaData = JSON.parse(
        (await fs.readFile(path.resolve(config.deployDir, deployMetaFileName))).toString()
      );
      if (isDeployMetaData(metaData)) {
        const metaCreatedAtDate = new Date(metaData.createdAt)

        const linkPath = path.resolve(config.staticDir, `./${metaData.id}/`);
        if (new Date().getSeconds() - metaCreatedAtDate.getSeconds() > config.timeout * 60 && this.symbolicLinkExists(linkPath)) {
          await fs.unlink(linkPath);
          await fs.rmdir(path.resolve(config.deployDir, `./${metaData.id}/`));
          await fs.rm(path.resolve(config.deployDir, `./${metaData.id}.zip`));

          // clean meta-file
          await fs.rm(path.resolve(config.deployDir, `./${metaData.id}${metaFileExtension}`));
        }
      }
    }

    setTimeout(() => this.removeOldDeploys(), 60 * 1000);
  }

  async symbolicLinkExists(path: string) {
    try {
      const lstatResult = await fs.lstat(path);
      return lstatResult.isSymbolicLink();
    } catch(e) {
      return false;
    }
  }
}

export const deployService = new DeployService();
