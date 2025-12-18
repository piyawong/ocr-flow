import { UserRole } from '../user.entity';

export class RegisterDto {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  permissions?: string[];
}
