import { apiFetch } from './client'

export interface CreditPackage {
  id: number
  code: string
  name: string
  credits: number
  price_uah: number
  is_active: boolean
}

export interface CreatePaymentOrderRequest {
  package_code: string
  idempotency_key: string
}

export interface CreatePaymentOrderResponse {
  order_id: number
  provider: string
  provider_order_id: string
  status: string
  amount_uah: number
  package_code: string
  package_credits: number
  checkout_url: string
  checkout_fields: Record<string, string | number>
}

export interface CreditsBalance {
  credits: number
}

export const paymentsApi = {
  getPackages: () => apiFetch<CreditPackage[]>('/payments/packages'),
  createOrder: (data: CreatePaymentOrderRequest) =>
    apiFetch<CreatePaymentOrderResponse>('/payments/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getBalance: () => apiFetch<CreditsBalance>('/payments/balance'),
}
