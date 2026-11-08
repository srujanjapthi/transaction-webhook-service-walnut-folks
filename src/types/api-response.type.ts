import type { ErrorCode } from "../constants/error-codes.js";

export interface ApiSuccess<T> {
  type: "resource";
  success: true;
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

export interface ApiListSuccess<T> {
  type: "list";
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

export interface MessageSuccess {
  type: "message";
  message: string;
}

export type SuccessResponse<T> =
  ApiSuccess<T> | ApiListSuccess<T> | MessageSuccess;

export interface ApiErrorDetail {
  field?: string;
  code: string;
  message: string;
}

export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiError {
  success: false;
  error: ApiErrorPayload;
}
