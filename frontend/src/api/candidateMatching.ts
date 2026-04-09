import { apiFetch } from "./client"
import type {
  CandidateMatchJobResponse,
  CandidateMatchRunRequest,
  CandidateMatchRunResponse,
} from "../types/candidateMatching"

export const startCandidateMatching = (
  vacancyId: number,
  payload: CandidateMatchRunRequest,
) => {
  return apiFetch<CandidateMatchRunResponse>(`/vacancies/${vacancyId}/candidate-matching`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const getCandidateMatchingJob = (vacancyId: number, jobId: string) => {
  return apiFetch<CandidateMatchJobResponse>(`/vacancies/${vacancyId}/candidate-matching/${jobId}`)
}

export const getLatestCandidateMatchingJob = (vacancyId: number) => {
  return apiFetch<CandidateMatchJobResponse>(`/vacancies/${vacancyId}/candidate-matching`)
}
