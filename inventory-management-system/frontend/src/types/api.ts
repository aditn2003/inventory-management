export interface ApiError {
  detail: string | { msg: string; type: string }[];
}

export function getErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred.';
  
  const axiosError = error as { response?: { data?: ApiError } };
  if (axiosError?.response?.data) {
    const detail = axiosError.response.data.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((e) => e.msg).join(', ');
  }
  
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}
