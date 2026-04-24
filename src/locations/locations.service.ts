import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../database/entities/location.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationsRepository: Repository<Location>,
  ) {}

  async findAll(): Promise<Location[]> {
    return this.locationsRepository.find();
  }

  async findOne(id: string): Promise<Location | null> {
    return this.locationsRepository.findOne({ where: { id } });
  }

  async create(locationData: Partial<Location>): Promise<Location> {
    const location = this.locationsRepository.create(locationData);
    return this.locationsRepository.save(location);
  }
}
