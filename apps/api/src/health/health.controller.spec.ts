import { HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';
import { DB_READY_TIMEOUT_MS, HealthService } from './health.service';

/** Prisma falso: solo `$queryRaw`, que es lo unico que usa la comprobacion de la base. */
function fakePrisma(queryRaw: jest.Mock): PrismaService {
  return { $queryRaw: queryRaw } as unknown as PrismaService;
}

function fakeResponse(): Response & { status: jest.Mock } {
  const res = { status: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & { status: jest.Mock };
}

describe('HealthController', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    jest.useRealTimers();
  });

  function build(queryRaw: jest.Mock): HealthController {
    return new HealthController(new HealthService(fakePrisma(queryRaw)));
  }

  describe('GET /health', () => {
    it('responde status, uptime y version sin consultar la base', () => {
      const queryRaw = jest.fn();
      const body = build(queryRaw).check();
      expect(body).toEqual({ status: 'ok', uptime: expect.any(Number), version: expect.any(String) });
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('responde 200 con db ok cuando SELECT 1 responde', async () => {
      const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
      const res = fakeResponse();

      const body = await build(queryRaw).ready(res);

      expect(body).toEqual({ status: 'ok', db: 'ok' });
      expect(res.status).not.toHaveBeenCalled();
      expect(queryRaw).toHaveBeenCalledTimes(1);
      const [sqlParts] = queryRaw.mock.calls[0] as [TemplateStringsArray];
      expect(sqlParts.join('')).toBe('SELECT 1');
    });

    it('responde 503 sin detalles cuando la base falla', async () => {
      const secreto = 'postgresql://postgres:SUPER-SECRETO@db.example.com:5432/postgres no responde';
      const queryRaw = jest.fn().mockRejectedValue(new Error(secreto));
      const res = fakeResponse();

      const body = await build(queryRaw).ready(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(body).toEqual({ status: 'error', db: 'error' });
      expect(JSON.stringify(body)).not.toContain('SUPER-SECRETO');
    });

    it('no escribe en el log el mensaje del error de la base', async () => {
      const queryRaw = jest.fn().mockRejectedValue(new Error('password=SUPER-SECRETO host=db.example.com'));

      await build(queryRaw).ready(fakeResponse());

      expect(warn).toHaveBeenCalledTimes(1);
      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).not.toContain('SUPER-SECRETO');
      expect(logged).not.toContain('db.example.com');
    });

    it('responde 503 si la base no contesta a tiempo', async () => {
      jest.useFakeTimers();
      const queryRaw = jest.fn().mockReturnValue(new Promise(() => undefined));
      const res = fakeResponse();

      const pending = build(queryRaw).ready(res);
      await jest.advanceTimersByTimeAsync(DB_READY_TIMEOUT_MS);
      const body = await pending;

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(body).toEqual({ status: 'error', db: 'error' });
    });
  });
});
