import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IApiResponse } from '../interfaces/response.interface';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, IApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<IApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((res) => {
        // Bypass streaming, raw file downloads, HTML strings, or Buffer streams
        if (
          (res && res.isStream) ||
          typeof res === 'string' ||
          Buffer.isBuffer(res)
        ) {
          return res;
        }

        const isPaginated =
          res &&
          typeof res === 'object' &&
          'data' in res &&
          ('pagination' in res || 'meta' in res);

        let paginationPayload: any = undefined;
        if (isPaginated) {
          if (res.pagination) {
            paginationPayload = res.pagination;
          } else if (res.meta) {
            paginationPayload = {
              total_pages: res.meta.totalPages || res.meta.total_pages || 1,
              page: res.meta.currentPage || res.meta.page || 1,
              page_size: res.meta.itemsPerPage || res.meta.page_size || 10,
              total_items: res.meta.totalItems || res.meta.total_items || 0,
            };
          }
        }

        // Clean message resolution
        let message: string | null = null;
        if (res && typeof res === 'object' && 'message' in res && typeof res.message === 'string') {
          message = res.message;
        } else {
          const method = request.method?.toUpperCase();
          const url = (request.originalUrl || request.url || '').split('?')[0];

          if (url.includes('/auth/login')) message = 'Login successful.';
          else if (url.includes('/auth/refresh')) message = 'Token refreshed successfully.';
          else if (url.includes('/auth/logout')) message = 'Logged out successfully.';
          else if (url.includes('/auth/change-password')) message = 'Password updated successfully.';
          else if (url.includes('/auth/request-reset-password')) message = 'Password reset link sent successfully.';
          else if (url.includes('/auth/confirm-reset-password')) message = 'Password reset completed successfully.';
          else if (url.includes('/reset-password')) message = 'Password reset successfully.';
          else if (url.includes('/reassign')) message = 'Ticket reassigned successfully.';
          else if (url.includes('/escalate')) message = 'Ticket escalated successfully.';
          else if (url.includes('/comments')) message = 'Comment added successfully.';
          else if (url.includes('/status')) message = 'Status updated successfully.';
          else if (url.includes('/due-date')) message = 'Due date updated successfully.';
          else if (method === 'GET') {
            if (url.includes('/users')) message = 'Users retrieved successfully.';
            else if (url.includes('/tickets')) message = 'Tickets retrieved successfully.';
            else if (url.includes('/departments')) message = 'Departments retrieved successfully.';
            else if (url.includes('/categories')) message = 'Categories retrieved successfully.';
            else if (url.includes('/subcategories')) message = 'Subcategories retrieved successfully.';
            else if (url.includes('/reports')) message = 'Report data retrieved successfully.';
            else message = 'Data retrieved successfully.';
          } else if (method === 'POST') {
            if (url.includes('/users')) message = 'User created successfully.';
            else if (url.includes('/tickets')) message = 'Ticket created successfully.';
            else if (url.includes('/departments')) message = 'Department created successfully.';
            else if (url.includes('/categories')) message = 'Category created successfully.';
            else if (url.includes('/subcategories')) message = 'Subcategory created successfully.';
            else message = 'Resource created successfully.';
          } else if (method === 'PATCH' || method === 'PUT') {
            if (url.includes('/users')) message = 'User updated successfully.';
            else if (url.includes('/tickets')) message = 'Ticket updated successfully.';
            else if (url.includes('/departments')) message = 'Department updated successfully.';
            else if (url.includes('/categories')) message = 'Category updated successfully.';
            else if (url.includes('/subcategories')) message = 'Subcategory updated successfully.';
            else message = 'Resource updated successfully.';
          } else if (method === 'DELETE') {
            message = 'Resource deleted successfully.';
          } else {
            message = 'Operation completed successfully.';
          }
        }

        // Clean data resolution
        let dataPayload: any = isPaginated
          ? res.data
          : res?.data !== undefined
            ? res.data
            : res;

        // Prevent duplicate message key inside data object
        if (
          dataPayload &&
          typeof dataPayload === 'object' &&
          !Array.isArray(dataPayload) &&
          'message' in dataPayload
        ) {
          if (Object.keys(dataPayload).length === 1) {
            dataPayload = null;
          } else {
            const { message: _, ...rest } = dataPayload;
            dataPayload = rest;
          }
        }

        return {
          success: true,
          statusCode: response.statusCode,
          message,
          data: dataPayload !== undefined ? dataPayload : null,
          pagination: paginationPayload,
          path: request.originalUrl || request.url,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
