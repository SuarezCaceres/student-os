import { Controller, Get, Header } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth';
import { ProfileService, type ProfileView } from './profile.service';

// Rutas protegidas por defecto (guard global de Supabase JWT).
@Controller('profile')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  /** Datos de cuenta del usuario del JWT. Crea el `Profile` en la primera llamada. */
  @Get()
  @Header('Cache-Control', 'no-store')
  get(@CurrentUser() user: AuthUser): Promise<ProfileView> {
    return this.profiles.get(user.id, user.email);
  }
}
