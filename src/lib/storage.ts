// Local-disk file storage. Swap this module for S3/GCS in production; the rest of the app only uses these 3 functions.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const root = () => path.resolve(process.env.STORAGE_DIR || "./storage");

export async function saveFile(tenantId: string, fileName: string, data: Buffer) {
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(-120);
  const key = path.join(tenantId, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${safe}`);
  const full = path.join(root(), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return key;
}

export async function readFile(key: string) {
  const full = path.join(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("Bad storage key");
  return fs.readFile(full);
}

export async function deleteFile(key: string) {
  await fs.rm(path.join(root(), key), { force: true });
}
