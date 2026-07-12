export type ApiResponse<T> = {
  data: T;
};

export type ApiErrorResponse = {
  timestamp: string;
  status: number;
  message: string;
  path: string;
  errors: string[];
};

export type ApiMessage = {
  message: string;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  numberOfElements: number;
};
