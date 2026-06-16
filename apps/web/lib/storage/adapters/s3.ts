/**
 * AWS S3 (and S3-compatible: Cloudflare R2, MinIO) storage adapter.
 *
 * One object per (environment, key, version) holds the framed sealed blob:
 *   {prefix}/{projectPublicId}/{env}/{key}/{version}.bin
 * The object body is opaque ciphertext + AEAD material — no plaintext. Health
 * check is HeadBucket.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { BlobRef, S3AdapterConfig, SealedBlob, StorageAdapter, StorageTestResult } from "../types";
import { frameBlob, unframeBlob } from "../frame";

const DEFAULT_PREFIX = "vaultlier";

export class S3Adapter implements StorageAdapter {
  readonly type = "S3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(
    config: S3AdapterConfig,
    private readonly projectPublicId: string,
  ) {
    this.bucket = config.bucket;
    this.prefix = config.prefix?.replace(/\/+$/, "") || DEFAULT_PREFIX;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private objectKey(ref: BlobRef): string {
    return `${this.prefix}/${this.projectPublicId}/${ref.environment}/${ref.keyName}/${ref.version}.bin`;
  }

  async put(ref: BlobRef, blob: SealedBlob): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(ref),
        Body: frameBlob(blob),
        ContentType: "application/octet-stream",
      }),
    );
  }

  async get(ref: BlobRef): Promise<SealedBlob | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(ref) }),
      );
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return unframeBlob(bytes);
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async remove(ref: BlobRef): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(ref) }),
      );
    } catch (err) {
      if (isNotFound(err)) return;
      throw err;
    }
  }

  async test(): Promise<StorageTestResult> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: describeError(err) };
    }
  }
}

function isNotFound(err: unknown): boolean {
  const name = (err as { name?: string })?.name;
  const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode;
  return name === "NoSuchKey" || name === "NotFound" || status === 404;
}

function describeError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  const message = (err as { message?: string })?.message;
  return name ? `${name}: ${message ?? ""}`.trim() : String(message ?? err);
}
