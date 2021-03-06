import express, { Request } from 'express';
import util from 'util';
import fs from 'fs/promises';
import fileUpload from 'express-fileupload';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import vhost from 'vhost';
import { config } from './config';
import { deployService } from './DeployService';
import { deployController } from './DeployController';
import http from 'http';
import https from 'https';
import tls from 'tls';
import path from 'path';
import { exec } from 'child_process';

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
    https.createServer({
      SNICallback: (servername: string, cb: (err: Error | null, ctx: tls.SecureContext) => void) => this.findCert(servername, cb)
    }, this.app).listen(443, () => {
      console.log('Server is listening on 443.')
    });
    http.createServer(async (req, res) => {
      const hostname = req.headers.host as string;
      const certPath = path.resolve(config.certDirPath(hostname), 'fullchain.pem');
      try {
        await fs.stat(certPath);
      } catch (e) {
        return this.app(req, res);
      }

      res.statusCode = 302;
      res.setHeader('location', `https://${req.headers.host}`);
      res.end();
    }).listen(80, () => {
      console.log('Server is listening on 80.');
      this.obtainCertFor(config.domain, 'live');
    });
  }

  async obtainCertFor(hostname: string, deployId: string) {
    const certPath = path.resolve(config.certDirPath(hostname), 'fullchain.pem');
    try {
      await fs.stat(certPath);
      return;
    } catch (e) {
      let webRootPath: string;
      if (deployId !== 'live') {
        webRootPath = path.resolve(config.deployDir, `./${deployId}/`);
      } else {
        const staticLivePath = path.resolve(config.staticDir, './live');
        if ((await fs.lstat(staticLivePath)).isSymbolicLink()) {
          webRootPath = await fs.readlink(staticLivePath);
        } else {
          webRootPath = staticLivePath;
        }
      }

      const certbotInfo = await util.promisify(exec)(`/usr/bin/certbot certonly -q -d ${hostname} --webroot --preferred-challenges http --agree-tos --email ${config.email} --webroot-path ${webRootPath}`);
      console.log(certbotInfo.stdout);
      console.error(certbotInfo.stderr);
    }
  }

  async findCert (servername: string, cb: (err: Error | null, ctx: tls.SecureContext) => void) {
    const domainExp = new RegExp('^(.*)\.' + config.domain + '$');
    let regexpResult: RegExpExecArray | null;
    let deployId: string | null = null;
    if (regexpResult = domainExp.exec(servername)) {
      deployId = regexpResult[0];
    }
    if (servername === config.domain || deployId) {
      const certPath = path.resolve(config.certDirPath(servername), 'fullchain.pem');
      try {
        await fs.stat(certPath)
      } catch (e) {
        cb(new Error('Host not found!'), tls.createSecureContext());
      }

      const keyPath = path.resolve(config.certDirPath(servername), 'privkey.pem');

      const cert = await fs.readFile(certPath);
      const key = await fs.readFile(keyPath);
      return cb(null, tls.createSecureContext({
        cert,
        key
      }));
    }

    cb(new Error('Host not found!'), tls.createSecureContext());
  }

  async ensureBaseDirs() {
    for (const dir of [config.deployDir, config.staticDir, config.liveDir]) {
      try {
        await fs.stat(dir);
      } catch (e) {
        await fs.mkdir(dir);
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

export const app = new App();
