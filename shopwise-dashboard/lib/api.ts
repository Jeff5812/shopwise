// Client for shopwise-backend's dashboard-facing write API.
// Reads still go straight to Supabase (see lib/supabase.ts) — this is only for actions
// that change data, so the order/stock rules in shopwise-backend/db.py stay the single
// source of truth instead of being reimplemented here.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ? JSON.stringify(body.detail) : detail;
    } catch {
      // response wasn't JSON, stick with statusText
    }
    throw new ApiError(detail, response.status);
  }

  return response.json();
}

export function confirmOrder(orderId: string) {
  return request(`/orders/${orderId}/confirm`, { method: 'POST' });
}

export function cancelOrder(orderId: string) {
  return request(`/orders/${orderId}/cancel`, { method: 'POST' });
}

export function updateStock(variantId: string, stockQuantity: number) {
  return request(`/inventory/${variantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ stock_quantity: stockQuantity }),
  });
}

export function resolveReviewItem(itemId: string) {
  return request(`/review-queue/${itemId}/resolve`, { method: 'POST' });
}
