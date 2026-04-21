import type { NavigateFunction } from "react-router-dom"
import { ApiError } from "../api/client"

export interface InsufficientCreditsInfo {
  message: string
  requiredCredits: number
  currentCredits: number
  missingCredits: number
}

interface PaymentRedirectOptions {
  info: InsufficientCreditsInfo
  feature?: string
  returnTo?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const toSafeInt = (value: unknown): number | null => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return Math.max(0, Math.trunc(parsed))
}

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : ""

const isValidReturnPath = (value: string): boolean =>
  value.startsWith("/") && !value.startsWith("//")

export const normalizeReturnTo = (value?: string | null, fallback = "/dashboard"): string => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return fallback
  }
  return isValidReturnPath(normalized) ? normalized : fallback
}

export const extractInsufficientCreditsInfo = (error: unknown): InsufficientCreditsInfo | null => {
  if (!(error instanceof ApiError) || error.status !== 402 || !isRecord(error.detail)) {
    return null
  }

  const message = normalizeText(error.detail.message)
  if (message && message.toLowerCase() !== "not enough credits") {
    return null
  }

  const requiredCredits = toSafeInt(error.detail.required_credits)
  const currentCredits = toSafeInt(error.detail.current_credits)
  if (requiredCredits === null || currentCredits === null) {
    return null
  }

  return {
    message: message || "Not enough credits",
    requiredCredits,
    currentCredits,
    missingCredits: Math.max(0, requiredCredits - currentCredits),
  }
}

export const isInsufficientCreditsError = (error: unknown): boolean =>
  Boolean(extractInsufficientCreditsInfo(error))

export const buildPaymentRedirectQuery = ({ info, feature, returnTo }: PaymentRedirectOptions): string => {
  const params = new URLSearchParams()
  params.set("reason", "insufficient_credits")
  params.set("required", String(info.requiredCredits))
  params.set("current", String(info.currentCredits))
  params.set("missing", String(info.missingCredits))

  const normalizedFeature = normalizeText(feature)
  if (normalizedFeature) {
    params.set("feature", normalizedFeature)
  }

  const normalizedReturn = normalizeReturnTo(returnTo)
  if (normalizedReturn) {
    params.set("return_to", normalizedReturn)
  }

  return params.toString()
}

export const buildPaymentRedirectPath = (options: PaymentRedirectOptions): string => {
  const query = buildPaymentRedirectQuery(options)
  return query ? `/payment?${query}` : "/payment"
}

interface RedirectOnInsufficientCreditsOptions {
  error: unknown
  navigate: NavigateFunction
  feature?: string
  returnTo?: string
}

export const redirectToPaymentOnInsufficientCredits = ({
  error,
  navigate,
  feature,
  returnTo,
}: RedirectOnInsufficientCreditsOptions): boolean => {
  const info = extractInsufficientCreditsInfo(error)
  if (!info) {
    return false
  }

  navigate(
    buildPaymentRedirectPath({
      info,
      feature,
      returnTo,
    }),
  )
  return true
}

