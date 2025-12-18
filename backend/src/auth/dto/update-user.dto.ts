import { UserRole } from '../user.entity';

export class UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  permissions?: string[];
}
