import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  papel: string;
  master: boolean;
  email?: string;
  nome?: string;
  ativo?: boolean;
  [key: string]: unknown;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
