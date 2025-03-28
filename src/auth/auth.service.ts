import { UsersService } from '@/users/users.service';
import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RefreshTokenRepository } from './refresh-token.repository';
import { jwtPayloadInterface } from './types/jwt-payload.interface';
import { User } from '@/users/entities/user.entity';
import { VisitorService } from '@/visitor/visitor.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly visitorService: VisitorService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.getUserByEmail(email).catch(() => {
      throw new UnauthorizedException('Invalid credentials');
    });
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      return user;
    } else {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async login(user: User) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    } satisfies jwtPayloadInterface;
    let userInfo: User | null;
    try {
      userInfo = await this.usersService.getUserById(payload.id);
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Internal Server Error');
    }

    if (!userInfo) {
      console.error('Calling user in DB is not matching');
      throw new InternalServerErrorException('Internal Server Error');
    }

    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 후 만료
    await this.refreshTokenRepo.saveToken(user.email, refreshToken, expiresAt);

    const userIdentifier = user.email;
    await this.visitorService.upsertVisitorCount(userIdentifier);

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: refreshToken,
      name: userInfo.name,
      nickname: userInfo.nickname,
      email: userInfo.email,
    };
  }

  async refreshToken(token: string) {
    try {
      const storedToken = await this.refreshTokenRepo.findValidToken(token);
      if (!storedToken || new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.refreshTokenRepo.revokeToken(storedToken.id);

      const user = await this.usersService.getUserByEmail(
        storedToken.userEmail,
      );
      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
      } satisfies jwtPayloadInterface;
      const newRefreshToken = this.jwtService.sign(payload, {
        expiresIn: '7d',
      });
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await this.refreshTokenRepo.saveToken(
        user.email,
        newRefreshToken,
        expiresAt,
      );

      const userIdentifier = user.email;
      await this.visitorService.upsertVisitorCount(userIdentifier);

      return {
        access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
        refresh_token: newRefreshToken, // 새로운 리프레시 토큰 반환
      };
    } catch (error) {
      if (error.status === 401) {
        throw error;
      } else {
        throw new InternalServerErrorException('Problem with token processing');
      }
    }
  }

  async validateAccessToken(token: string): Promise<boolean> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'mysecretkey'),
      });
      return !!payload; // 유효한 토큰이면 true 반환
    } catch (error) {
      return false; // 토큰이 유효하지 않으면 false 반환
    }
  }
}
