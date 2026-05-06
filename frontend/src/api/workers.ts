import { apiFetch } from "./client"
import type { EmployerWorkerProfile } from "../types/workerProfile"

export const getWorkerProfileForEmployer = (workerUserId: number) => {
  return apiFetch<EmployerWorkerProfile>(`/employer/workers/${workerUserId}/profile`)
}
