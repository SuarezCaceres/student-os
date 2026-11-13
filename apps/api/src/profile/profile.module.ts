import { Module } from '@nestjs/common';
import { PrismaProfileRepository } from './prisma-profile.repository';
import { ProfileController } from './profile.controller';
import { PROFILE_REPOSITORY } from './profile.repository';
import { ProfileService } from './profile.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, { provide: PROFILE_REPOSITORY, useClass: PrismaProfileRepository }],
  exports: [ProfileService],
})
export class ProfileModule {}
