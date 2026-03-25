declare module "localtunnel" {
  interface Tunnel {
    url: string;
    on(event: string, cb: (...args: any[]) => void): void;
    close(): void;
  }
  interface Options {
    port: number;
    subdomain?: string;
  }
  export default function localtunnel(opts: Options): Promise<Tunnel>;
}
