import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT', 'minio'),
      port: parseInt(this.configService.get('MINIO_PORT', '9000')),
      useSSL: this.configService.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.bucketName = this.configService.get('MINIO_BUCKET', 'ocr-documents');
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
        console.log(`Bucket "${this.bucketName}" created successfully`);
      }
    } catch (error) {
      console.error('Error creating bucket:', error);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.minioClient.listBuckets();
      return true;
    } catch {
      return false;
    }
  }

  async uploadFile(
    fileName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.minioClient.putObject(
      this.bucketName,
      fileName,
      buffer,
      buffer.length,
      { 'Content-Type': contentType },
    );
    return fileName;
  }

  async getFile(fileName: string): Promise<Buffer> {
    const stream = await this.minioClient.getObject(this.bucketName, fileName);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async deleteFile(fileName: string): Promise<void> {
    await this.minioClient.removeObject(this.bucketName, fileName);
  }

  async getPresignedUrl(fileName: string, expiry = 3600): Promise<string> {
    return this.minioClient.presignedGetObject(
      this.bucketName,
      fileName,
      expiry,
    );
  }

  async fileExists(fileName: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.bucketName, fileName);
      return true;
    } catch (error) {
      return false;
    }
  }
}
