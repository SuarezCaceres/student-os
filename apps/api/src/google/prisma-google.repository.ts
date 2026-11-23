import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  GoogleConnectionRecord,
  GoogleRepository,
  OAuthStateRecord,
  SaveConnectionInput,
} from './google.repository';

@Injectable()
export class PrismaGoogleRepository implements GoogleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveConnection(input: SaveConnectionInput): Promise<void> {
    await this.prisma.googleConnection.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        refreshTokenEnc: input.refreshTokenEnc,
        keyVersion: input.keyVersion,
        scopes: input.scopes,
        accountEmail: input.accountEmail,
        connectedAt: input.connectedAt,
        needsReauth: false,
      },
      update: {
        refreshTokenEnc: input.refreshTokenEnc,
        keyVersion: input.keyVersion,
        scopes: input.scopes,
        accountEmail: input.accountEmail,
        connectedAt: input.connectedAt,
        needsReauth: false,
      },
    });
  }

  async getConnection(userId: string): Promise<GoogleConnectionRecord | null> {
    const row = await this.prisma.googleConnection.findUnique({ where: { userId } });
    if (!row) return null;
    return {
      userId: row.userId,
      refreshTokenEnc: row.refreshTokenEnc,
      keyVersion: row.keyVersion,
      scopes: row.scopes,
      accountEmail: row.accountEmail,
      connectedAt: row.connectedAt,
      needsReauth: row.needsReauth,
    };
  }

  async updateRefreshToken(userId: string, refreshTokenEnc: string, keyVersion: number): Promise<void> {
    await this.prisma.googleConnection.updateMany({ where: { userId }, data: { refreshTokenEnc, keyVersion } });
  }

  async markNeedsReauth(userId: string): Promise<void> {
    await this.prisma.googleConnection.updateMany({ where: { userId }, data: { needsReauth: true } });
  }

  async deleteConnection(userId: string): Promise<boolean> {
    const result = await this.prisma.googleConnection.deleteMany({ where: { userId } });
    return result.count > 0;
  }

  async createOAuthState(record: OAuthStateRecord, now: Date): Promise<void> {
    // Limpieza oportunista de estados caducados (no hay cron en Render free).
    await this.prisma.googleOAuthState.deleteMany({ where: { expiresAt: { lt: now } } });
    await this.prisma.googleOAuthState.create({
      data: {
        id: record.id,
        userId: record.userId,
        codeVerifierEnc: record.codeVerifierEnc,
        redirectTo: record.redirectTo,
        expiresAt: record.expiresAt,
      },
    });
  }

  async consumeOAuthState(id: string): Promise<OAuthStateRecord | null> {
    const row = await this.prisma.googleOAuthState.findUnique({ where: { id } });
    if (!row) return null;
    // deleteMany devuelve cuantas filas borro: si dos callbacks compiten por el mismo state, solo uno gana.
    const deleted = await this.prisma.googleOAuthState.deleteMany({ where: { id } });
    if (deleted.count !== 1) return null;
    return this.toRecord(row);
  }

  async peekOAuthState(id: string): Promise<OAuthStateRecord | null> {
    const row = await this.prisma.googleOAuthState.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async deleteOAuthStatesForUser(userId: string): Promise<void> {
    await this.prisma.googleOAuthState.deleteMany({ where: { userId } });
  }

  private toRecord(row: {
    id: string;
    userId: string;
    codeVerifierEnc: string;
    redirectTo: string;
    expiresAt: Date;
  }): OAuthStateRecord {
    return {
      id: row.id,
      userId: row.userId,
      codeVerifierEnc: row.codeVerifierEnc,
      redirectTo: row.redirectTo,
      expiresAt: row.expiresAt,
    };
  }
}
