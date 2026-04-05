import { apiFetch } from "./client"
import type {
  VacancySubscription,
  VacancySubscriptionCreatePayload,
  VacancySubscriptionUpdatePayload,
} from "../types/vacancySubscription"

const BASE_PATH = "/worker/vacancy-subscriptions"

export const listVacancySubscriptions = () => apiFetch<VacancySubscription[]>(BASE_PATH)

export const createVacancySubscription = (payload: VacancySubscriptionCreatePayload) =>
  apiFetch<VacancySubscription>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  })

export const updateVacancySubscription = (
  subscriptionId: number,
  payload: VacancySubscriptionUpdatePayload,
) =>
  apiFetch<VacancySubscription>(`${BASE_PATH}/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })

export const setVacancySubscriptionActive = (subscriptionId: number, isActive: boolean) =>
  apiFetch<VacancySubscription>(`${BASE_PATH}/${subscriptionId}/active`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  })

export const deleteVacancySubscription = (subscriptionId: number) =>
  apiFetch<{ status: string }>(`${BASE_PATH}/${subscriptionId}`, {
    method: "DELETE",
  })
