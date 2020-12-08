import path from 'path';
import LE from 'le-acme-core';

const DEFAULT_DIR = path.join(require('os').homedir(), '/letsencrypt/etc')
const concat = Array.prototype.concat
const noop = function () {}

type DomainList = Array<string | string[]>;
interface Options {
  email: string;
  agreeTos: boolean;
  domains: DomainList | (() => (DomainList | Promise<DomainList>));
  dir?: string;
  ports?: {
      http?: number,
      https?: number
  };
  debug?: boolean;
}

/**
 * Like nodes https.createServer but will automatically generate certificates from letsencrypt
 * falling back to self signed.
 *
 * @param {Object} opts
 * @param {Function} handler
 * @return {Server}
 */
export default function createServer (opts: Options, app?: any) {
  opts = opts || {}
  app = app || noop
  var handler = null
  var approveDomains = opts.domains
  var ports = opts.ports = opts.ports || {}
  if (!('http' in ports)) ports.http = 80
  if (!('https' in ports)) ports.https = 443
  if (!opts.email) throw new TypeError('AutoSNI: Email is required.')
  if (!opts.agreeTos) throw new TypeError('AutoSNI: Must agree to LE TOS.')
  if (Array.isArray(approveDomains)) {
    // Flatten nested domains.
    approveDomains = concat.apply([], approveDomains || [])
    if (!approveDomains.length) {
      throw new TypeError('AutoSNI: You must specify at least one domain.')
    }
  } else if (typeof approveDomains !== 'function') {
    throw new TypeError('AutoSNI: Domains option must be an array or a function.')
  }

  if (typeof app === 'function') {
    // Allow passing in handler function directly.
    handler = app
  } else if (typeof app.emit === 'function') {
    // Allow passing in another node server (forwards requests).
    handler = function (req: Request, res: Response) {
      app.emit('request', req, res)
    }
  } else {
    throw new TypeError('AutoSNI: Invalid app provided.')
  }

  return LE.create({
    app: handler,
    debug: opts.debug,
    email: opts.email,
    agreeTos: opts.agreeTos,
    approveDomains: approveDomains,
    configDir: opts.dir || DEFAULT_DIR,
    server: opts.debug ? 'staging' : 'production'
  }).listen(opts.ports.http, opts.ports.https)
}
