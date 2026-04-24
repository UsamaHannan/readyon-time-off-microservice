import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { LoginPayload, RegisterDto } from '../common/dto';

const mockUsersService = () => ({
  findOneByEmail: jest.fn(),
  create: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn(() => 'test_token'),
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useFactory: mockUsersService },
        { provide: JwtService, useFactory: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
  });

  describe('validateUser', () => {
    it('should return user info without password on success', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      usersService.findOneByEmail.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        passwordHash: hashedPassword,
      });

      const result = await service.validateUser('test@test.com', 'password123');
      expect(result).toBeDefined();
      expect(result!.passwordHash).toBeUndefined();
      expect(result!.email).toBe('test@test.com');
    });

    it('should return null if password does not match', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      usersService.findOneByEmail.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        passwordHash: hashedPassword,
      });

      const result = await service.validateUser('test@test.com', 'wrong_pass');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return an access_token', () => {
      const user = { id: '1', email: 'test@test.com', role: 'EMPLOYEE' };
      const result = service.login(user as LoginPayload);
      expect(result.access_token).toBe('test_token');
    });
  });

  describe('register', () => {
    it('should throw UnauthorizedException if email is taken', async () => {
      usersService.findOneByEmail.mockResolvedValue({ id: '1' });
      await expect(
        service.register({ email: 'taken@test.com' } as RegisterDto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
