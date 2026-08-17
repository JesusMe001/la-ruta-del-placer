import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsString, MinLength } from 'class-validator';

class LoginDto {
  @IsString() hotelSlug: string; // 'lilax'
  @IsString() username: string;
  @IsString() @MinLength(4) password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.hotelSlug, dto.username, dto.password);
  }
}
