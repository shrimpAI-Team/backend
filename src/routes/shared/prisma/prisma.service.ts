import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from 'src/generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Lấy chuỗi kết nối từ biến môi trường
    const connectionString = process.env.DATABASE_URL;

    // Khởi tạo Pool connection và Adapter
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    // Truyền adapter vào class cha (PrismaClient)
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
