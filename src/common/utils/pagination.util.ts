import { IPaginatedResult } from '../interfaces/pagination.interface';

export class PaginationUtil {
  static buildPaginatedResult<T>(
    items: T[],
    totalItems: number,
    page: number,
    limit: number,
  ): IPaginatedResult<T> {
    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      data: items,
      pagination: {
        total_pages: totalPages,
        page,
        page_size: limit,
        total_items: totalItems,
      },
    };
  }
}
