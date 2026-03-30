import { spawnCloudflared, type CloudflaredProcess } from "./cloudflared.js";

export interface TunnelInfo {
  url: string;
  close: () => void;
}

export async function openTunnel(port: number): Promise<TunnelInfo> {
  const cf = await spawnCloudflared(port);

  // Convert https:// to wss:// for WebSocket
  const wsUrl = cf.url
    .replace("https://", "wss://")
    .replace("http://", "ws://");

  return {
    url: wsUrl,
    close: () => cf.kill(),
  };
}
