import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useChatWidget } from "../chat/ChatWidgetContext"

const toPositiveIntOrNull = (value: string | null) => {
  const parsed = value ? Number(value) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const MessagesRoute = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { open } = useChatWidget()

  useEffect(() => {
    const resumeId = toPositiveIntOrNull(searchParams.get("resumeId"))
    const vacancyId = toPositiveIntOrNull(searchParams.get("vacancyId"))
    open({
      resumeId,
      vacancyId,
    })
    navigate("/dashboard", { replace: true })
  }, [navigate, open, searchParams])

  return (
    <div className="mx-auto max-w-[860px] px-4 py-12 text-sm text-slate-600">
      Opening messages...
    </div>
  )
}

export default MessagesRoute

