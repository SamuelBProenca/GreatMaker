import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ImageStorage {
  put(key: string, data: Uint8Array): void;
  read(key: string): Buffer;
  delete(key: string): void;
}
export class DiskImageStorage implements ImageStorage {
  constructor(private directory: string) { mkdirSync(directory, { recursive: true }); }
  private path(key: string) {
    if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(key)) throw new Error("Invalid managed storage key");
    return resolve(this.directory, key);
  }
  put(key: string, data: Uint8Array) { writeFileSync(this.path(key), data, { flag: "wx", mode: 0o600 }); }
  read(key: string) { return readFileSync(this.path(key)); }
  delete(key: string) {
    try { unlinkSync(this.path(key)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
}
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_SESSION_BYTES = 50 * 1024 * 1024;
export function detectImage(data: Uint8Array): { mime: string; extension: string } | null {
  const b = Buffer.from(data);
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && b.toString("ascii", 12, 16) === "IHDR") return { mime: "image/png", extension: "png" };
  if (b.length >= 12 && b[0] === 255 && b[1] === 216 && b[2] === 255 && b[b.length - 2] === 255 && b[b.length - 1] === 217) return { mime: "image/jpeg", extension: "jpg" };
  if (b.length >= 20 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" && b.readUInt32LE(4) + 8 === b.length) return { mime: "image/webp", extension: "webp" };
  return null;
}
