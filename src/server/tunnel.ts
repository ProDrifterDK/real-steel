import localtunnel from "localtunnel";

export interface TunnelInfo {
  url: string;
  close: () => void;
}

export async function openTunnel(port: number): Promise<TunnelInfo> {
  const tunnel = await localtunnel({ port });

  tunnel.on("error", (err: Error) => {
    console.error("Tunnel error:", err.message);
  });

  tunnel.on("close", () => {
    console.error("Tunnel closed unexpectedly");
  });

  return {
    url: tunnel.url.replace("https://", "wss://").replace("http://", "ws://"),
    close: () => tunnel.close(),
  };
}
