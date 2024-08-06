declare module 'httpolyglot' {
    import { Server as HTTPServer } from 'http';
    import { ServerOptions as HTTPSServerOptions } from 'https';
  
    interface HttpolyglotServerOptions extends HTTPSServerOptions {}
  
    function createServer(
      options: HttpolyglotServerOptions,
      requestListener?: (req: IncomingMessage, res: ServerResponse) => Server<typeof IncomingMessage, typeof ServerResponse>
    ): HTTPServer;
  
    export = createServer;
  }
  