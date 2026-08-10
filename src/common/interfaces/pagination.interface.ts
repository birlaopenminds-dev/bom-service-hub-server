export interface IPaginationMeta {
  total_pages: number;
  page: number;
  page_size: number;
  total_items: number;
}

export interface IPaginatedResult<T> {
  data: T[];
  pagination: IPaginationMeta;
}
