import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateJournalDto, OpenCycleDto } from './ponds.dto';

@Injectable()
export class PondsService {
  constructor(private readonly prisma: PrismaService) {}

  list(ownerId: string) {
    return this.prisma.pond.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        cycles: {
          orderBy: { startedAt: 'desc' },
          include: {
            analysis: {
              select: { id: true, species: true, confidence: true, imageUrl: true },
            },
          },
        },
      },
    });
  }

  create(ownerId: string, name: string) {
    return this.prisma.pond.create({ data: { ownerId, name } });
  }

  async open(ownerId: string, pondId: string, dto: OpenCycleDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const pond = await tx.pond.findFirst({ where: { id: pondId, ownerId } });
        if (!pond) throw new NotFoundException('Không tìm thấy ao.');
        if (dto.analysisId) {
          const analysis = await tx.shrimpAnalysis.findFirst({
            where: { id: dto.analysisId, userId: ownerId },
            select: { id: true },
          });
          if (!analysis) throw new NotFoundException('Không tìm thấy ảnh nhận diện.');
        }
        return tx.cultureCycle.create({
          data: { pondId, activePondId: pondId, ...dto },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Ao đã có vụ nuôi đang hoạt động.');
        }
        if (error.code === 'P2003') {
          throw new ConflictException('Ao hoặc ảnh nhận diện vừa bị xóa.');
        }
      }
      throw error;
    }
  }

  async journal(ownerId: string, id: string, before?: string) {
    const cycle = await this.prisma.cultureCycle.findFirst({
      where: { id, pond: { ownerId } },
      select: { id: true },
    });
    if (!cycle) throw new NotFoundException('Không tìm thấy vụ nuôi.');
    const boundary = before
      ? await this.prisma.pondJournal.findFirst({
          where: { id: before, cycleId: id },
          select: { id: true, recordedAt: true },
        })
      : undefined;
    if (before && !boundary) throw new NotFoundException('Không tìm thấy mốc nhật ký.');
    const rows = await this.prisma.pondJournal.findMany({
      where: {
        cycleId: id,
        ...(boundary && {
          OR: [
            { recordedAt: { lt: boundary.recordedAt } },
            { recordedAt: boundary.recordedAt, id: { lt: boundary.id } },
          ],
        }),
      },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      take: 51,
    });
    const items = rows.slice(0, 50);
    return { items, next: rows.length > 50 ? items[49].id : null };
  }

  async addJournal(ownerId: string, id: string, dto: CreateJournalDto) {
    const hasWater = [dto.ph, dto.salinity, dto.temperature, dto.depth].some(
      (value) => value != null,
    );
    const hasFeed = dto.feedKg != null;
    if (
      (dto.kind === 'WATER' && (!hasWater || hasFeed)) ||
      (dto.kind === 'FEED' && (!hasFeed || hasWater)) ||
      ((dto.kind === 'CARE' || dto.kind === 'INCIDENT') &&
        (!dto.note || hasWater || hasFeed)) ||
      (dto.simulated && dto.kind !== 'WATER')
    ) {
      throw new BadRequestException('Nội dung không phù hợp với loại nhật ký.');
    }
    return this.prisma.$transaction(async (tx) => {
      // Lock the open cycle until the entry is saved so closing cannot race the write.
      const open = await tx.cultureCycle.updateMany({
        where: { id, pond: { ownerId }, endedAt: null },
        data: { endedAt: null },
      });
      if (!open.count) throw new NotFoundException('Không tìm thấy vụ đang hoạt động.');
      return tx.pondJournal.create({ data: { cycleId: id, ...dto } });
    });
  }

  async close(ownerId: string, id: string) {
    const result = await this.prisma.cultureCycle.updateMany({
      where: { id, pond: { ownerId }, endedAt: null },
      data: { endedAt: new Date(), activePondId: null },
    });
    if (!result.count) throw new NotFoundException('Không tìm thấy vụ đang hoạt động.');
  }
}
