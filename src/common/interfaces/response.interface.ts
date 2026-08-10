import { IPaginationMeta } from './pagination.interface';

export interface IApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T | null;
  pagination?: IPaginationMeta;
  path: string;
  timestamp: string;
}

