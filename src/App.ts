import express, { Request } from 'express';
import util from 'util';
import fs from 'fs';
import fileUpload from 'express-fileupload';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import vhost from 'vhost';
import { config } from './config';
import { deployService } from './DeployService';
import { deployController } from './DeployController';
import createServer from './createServer';
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

    const appServer = createServer({
        email: config.email,
        agreeTos: true,
        debug: true,
        domains: () => [
          config.domain,
          ...deployService.getDeploys()
            .filter((d): d is Deploy => typeof d !== 'undefined')
            .map((d: Deploy) => {
              return `${d.id}.${config.domain}`;
            })
        ],
        dir: "~/letsencrypt/etc",
        ports: {
          http: 80, // Optionally override the default http port.
          https: 443 // // Optionally override the default https port.
        }
      },
      this.app
    );
    appServer.once("listening", ()=> {
      console.log("App-server started.");
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
    this.manager.post('/deploys', deployController.post);
    this.manager.get('/deploys', deployController.get);
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
