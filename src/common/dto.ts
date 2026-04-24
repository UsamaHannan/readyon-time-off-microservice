import { UserRole } from '../database/entities/user.entity';
import { TimeOffType } from '../database/entities/time-off-request.entity';

export class RegisterDto {
  email: string;
  password?: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export class LoginPayload {
  email: string;
  id: string;
  role: UserRole;
}

export class CreateLocationDto {
  locationId: string;
  name: string;
}

export class CreateTimeOffRequestDto {
  locationId: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  days: number;
}

export class AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}
