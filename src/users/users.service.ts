import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../database/entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findOneById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(userData.passwordHash || 'temp', salt);

    const newUser = this.usersRepository.create({
      ...userData,
      passwordHash: hash,
      role: userData.role || UserRole.EMPLOYEE,
    });

    return this.usersRepository.save(newUser);
  }
}
