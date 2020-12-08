import express, { Request } from 'express';
import util from 'util';
import fs from 'fs';
import fileUpload from 'express-fileupload';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import path from 'path';
import vhost from 'vhost';
import { config } from './config';
import { deployService } from './DeployService';
import { Deploy } from './Deploy';

export class App {
  manager = express();
  app = express();

  async start() {
    await this.ensureBaseDirs();
    await deployService.discoverDeploys();

    await Promise.all([
      this.setupManager(),
      this.setupApp()
    ]);

    this.manager.listen(2242, () => {
      console.log('Manager is listening on 2242.')
    });
    this.app.listen(80, () => {
      console.log('Server is listening on 80.')
    });
  }

  async ensureBaseDirs() {
    for (const dir of [config.deployDir, config.staticDir, config.liveDir]) {
      try {
        await util.promisify(fs.stat)(dir);
      } catch (e) {
        await util.promisify(fs.mkdir)(dir);
      }
    }
  }

  setupManager() {
    this.manager.use(fileUpload({
      useTempFiles: true
    }));

    this.manager.use(bodyParser.json());
    this.manager.use(bodyParser.urlencoded({extended: true}));
  }

  setupApp() {
    this.app.use(morgan('combined'));

    this.app.use(vhost(config.domain, express.static(config.liveDir)));
    this.app.use(vhost('*.' + config.domain, (req: Request, res, next) => {
      const vhost = (req as any).vhost as string[];
      if (deployService.deployExists(vhost[0])) {
        return express.static(deployService.getDeploy(vhost[0])?.staticPath as string)(req, res, next);
      }

      res.status(404).send('Not found!');

      return;
    }))
  }
}
