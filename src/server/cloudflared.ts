import { execSync, spawn, type ChildProcess } from "child_process";
import { createWriteStream, chmodSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir, platform, arch } from "os";
import https from "https";

export interface InstallInfo {
  description: string;
  url?: string;
  installDir?: string;
}

const CLOUDFLARED_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

export function parseCloudflaredUrl(line: string): string | null {
  const match = line.match(CLOUDFLARED_URL_REGEX);
  return match ? match[0] : null;
}

export function isCloudflaredInstalled(): boolean {
  try {
    execSync("cloudflared --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function getInstallCommand(
  os: string = platform(),
  cpuArch: string = arch()
): InstallInfo {
  if (os === "darwin") {
    return {
      description: "brew install cloudflared",
    };
  }

  const archMap: Record<string, string> = {
    x64: "amd64",
    arm64: "arm64",
  };
  const cfArch = archMap[cpuArch] || "amd64";

  if (os === "win32") {
    return {
      description: `Download cloudflared-windows-${cfArch}.exe`,
      url: `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-${cfArch}.exe`,
    };
  }

  // Linux
  const installDir = join(homedir(), ".local", "bin");
  return {
    description: `Download cloudflared-linux-${cfArch} to ${installDir}`,
    url: `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${cfArch}`,
    installDir,
  };
}

export async function installCloudflared(): Promise<boolean> {
  const os = platform();
  const info = getInstallCommand();

  if (os === "darwin") {
    try {
      execSync("brew install cloudflared", { stdio: "inherit" });
      return isCloudflaredInstalled();
    } catch {
      return false;
    }
  }

  if (!info.url || !info.installDir) return false;

  // Linux: download binary
  const dir = info.installDir;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const dest = join(dir, "cloudflared");

  return new Promise((resolve) => {
    const download = (url: string) => {
      https.get(url, (res) => {
        // Follow redirects (GitHub releases use 302)
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (res.headers.location) {
            download(res.headers.location);
            return;
          }
        }
        if (res.statusCode !== 200) {
          resolve(false);
          return;
        }
        const file = createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          chmodSync(dest, 0o755);
          resolve(isCloudflaredInstalled());
        });
        file.on("error", () => resolve(false));
      }).on("error", () => resolve(false));
    };
    download(info.url!);
  });
}

export interface CloudflaredProcess {
  url: string;
  process: ChildProcess;
  kill: () => void;
}

export function spawnCloudflared(port: number): Promise<CloudflaredProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill("SIGINT");
        reject(new Error("Timed out waiting for cloudflared tunnel URL (30s)"));
      }
    }, 30000);

    proc.stderr?.on("data", (data: Buffer) => {
      if (resolved) return;
      const line = data.toString();
      const url = parseCloudflaredUrl(line);
      if (url) {
        resolved = true;
        clearTimeout(timeout);
        resolve({
          url,
          process: proc,
          kill: () => proc.kill("SIGINT"),
        });
      }
    });

    proc.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Failed to start cloudflared: ${err.message}`));
      }
    });

    proc.on("close", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`cloudflared exited with code ${code} before providing a URL`));
      }
    });
  });
}
