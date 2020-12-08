declare module 'le-acme-core' {
  import { Server } from "https";
  interface LeOptions {
    app: any;
    debug?: boolean;
    email: string;
    agreeTos: boolean;
    approveDomains: (string | string[])[] | (() => (string | string[])[] | Promise<(string | string[])[]>)
    configDir: string;
    server: 'staging' | 'production';
  }
  interface LE {
    create(opts: LeOptions): LE;
    listen(portHttp?: number, portHttps?: number): Server;
  }

  const instance: LE;
  export default instance;
}
