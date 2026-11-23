import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { JwtVerifierService } from './jwt-verifier.service';
import { SupabaseJwtGuard } from './supabase-jwt.guard';

/**
 * Autenticacion con Supabase JWT. Global: los modulos de dominio no necesitan importarlo.
 * El guard se registra como global (APP_GUARD) en `AppModule`, tras el ThrottlerGuard.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [JwtVerifierService, SupabaseJwtGuard],
  exports: [JwtVerifierService, SupabaseJwtGuard],
})
export class AuthModule {}
