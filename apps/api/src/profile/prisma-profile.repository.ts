import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ProfileRepository, ProfileRow } from './profile.repository';

@Injectable()
export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(userId: string): Promise<ProfileRow> {
    try {
      const profile = await this.prisma.profile.upsert({
        where: { id: userId },
        create: { id: userId },
        update: {},
        select: { id: true, createdAt: true },
      });
      return profile;
    } catch (error) {
      // Dos primeras peticiones simultaneas: la perdedora choca con la clave unica; el perfil ya existe.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.profile.findUniqueOrThrow({
          where: { id: userId },
          select: { id: true, createdAt: true },
        });
      }
      throw error;
    }
  }

  async getLastSyncAt(userId: string): Promise<Date | null> {
    const state = await this.prisma.userSyncState.findUnique({
      where: { userId },
      select: { lastSyncAt: true },
    });
    return state?.lastSyncAt ?? null;
  }
}
