import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  /** Comprobacion de extremo a extremo del token: devuelve el usuario que ve la API. */
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
