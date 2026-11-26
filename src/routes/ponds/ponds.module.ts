import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { CreateJournalDto, CreatePondDto, OpenCycleDto } from './ponds.dto';
import { PondsService } from './ponds.service';

@Controller('ponds')
class PondsController {
  constructor(private readonly ponds: PondsService) {}

  @Get()
  list(@CurrentUser('id') ownerId: string) {
    return this.ponds.list(ownerId);
  }

  @Post()
  create(@CurrentUser('id') ownerId: string, @Body() dto: CreatePondDto) {
    return this.ponds.create(ownerId, dto.name);
  }

  @Post(':pondId/cycles')
  open(
    @CurrentUser('id') ownerId: string,
    @Param('pondId', ParseUUIDPipe) pondId: string,
    @Body() dto: OpenCycleDto,
  ) {
    return this.ponds.open(ownerId, pondId, dto);
  }

  @Get('cycles/:id/journal')
  journal(
    @CurrentUser('id') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before', new ParseUUIDPipe({ optional: true })) before?: string,
  ) {
    return this.ponds.journal(ownerId, id, before);
  }

  @Post('cycles/:id/journal')
  addJournal(
    @CurrentUser('id') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateJournalDto,
  ) {
    return this.ponds.addJournal(ownerId, id, dto);
  }

  @Post('cycles/:id/close')
  @HttpCode(204)
  close(@CurrentUser('id') ownerId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.ponds.close(ownerId, id);
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [PondsController],
  providers: [PondsService],
})
export class PondsModule {}
