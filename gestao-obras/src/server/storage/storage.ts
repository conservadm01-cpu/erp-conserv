import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";
import { signDownloadToken } from "./download-token";

export type DownloadRequest = { key: string; fileName: string; mimeType: string; userId: string };

/** Armazenamento privado de arquivos. Nenhum adaptador expõe links públicos permanentes. */
export interface FileStorage {
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  read(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  /** URL temporária para download. */
  downloadUrl(req: DownloadRequest): Promise<string>;
}

function appDownloadUrl(req: DownloadRequest) {
  const token = signDownloadToken({ k: req.key, n: req.fileName, m: req.mimeType, u: req.userId }, env().DOWNLOAD_URL_TTL_SECONDS);
  return `/api/files/${token}`;
}

/** Disco local (desenvolvimento ou servidor único). Arquivos servidos só pela aplicação, com token. */
class LocalStorage implements FileStorage {
  private root = path.resolve(env().STORAGE_LOCAL_DIR);
  private resolve(key: string) {
    if (!/^[a-z0-9/-]+$/i.test(key) || key.includes("..")) throw new Error("Chave de armazenamento inválida.");
    return path.join(this.root, key);
  }
  async put(key: string, bytes: Uint8Array) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, bytes, { mode: 0o600, flag: "wx" });
  }
  async read(key: string) {
    return new Uint8Array(await readFile(this.resolve(key)));
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
  async downloadUrl(req: DownloadRequest) {
    return appDownloadUrl(req);
  }
}

/** Testes. */
export class MemoryStorage implements FileStorage {
  readonly files = new Map<string, Uint8Array>();
  async put(key: string, bytes: Uint8Array) {
    if (this.files.has(key)) throw new Error("Chave já existe.");
    this.files.set(key, bytes);
  }
  async read(key: string) {
    const f = this.files.get(key);
    if (!f) throw new Error("Arquivo não encontrado.");
    return f;
  }
  async delete(key: string) {
    this.files.delete(key);
  }
  async downloadUrl(req: DownloadRequest) {
    return appDownloadUrl(req);
  }
}

/** Serviço compatível com S3 (AWS S3, MinIO, etc.), com criptografia no servidor e URL pré-assinada. */
class S3Storage implements FileStorage {
  private client = new S3Client({
    region: env().S3_REGION,
    endpoint: env().S3_ENDPOINT,
    forcePathStyle: env().S3_FORCE_PATH_STYLE,
    credentials: env().S3_ACCESS_KEY_ID ? { accessKeyId: env().S3_ACCESS_KEY_ID!, secretAccessKey: env().S3_SECRET_ACCESS_KEY ?? "" } : undefined,
  });
  private bucket = env().S3_BUCKET!;
  async put(key: string, bytes: Uint8Array, mimeType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: mimeType, ServerSideEncryption: "AES256" }));
  }
  async read(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return new Uint8Array(await res.Body!.transformToByteArray());
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async downloadUrl(req: DownloadRequest) {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: req.key,
      ResponseContentType: req.mimeType,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(req.fileName)}`,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: env().DOWNLOAD_URL_TTL_SECONDS });
  }
}

let instance: FileStorage | undefined;

export function getStorage(): FileStorage {
  if (instance) return instance;
  const d = env().STORAGE_DRIVER;
  instance = d === "s3" ? new S3Storage() : d === "memory" ? new MemoryStorage() : new LocalStorage();
  return instance;
}

export function setStorage(s: FileStorage) {
  instance = s;
}
