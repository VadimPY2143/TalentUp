const Footer = () => {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] text-white">
      <div className="pointer-events-none absolute -left-8 top-0 h-24 w-24 rounded-full bg-orange-400/20 blur-2xl" />
      <div className="pointer-events-none absolute -right-8 bottom-0 h-24 w-24 rounded-full bg-cyan-300/20 blur-2xl" />

      <div className="relative mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-white/75 md:flex-row">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-white/10 text-xs text-white">
            ✓
          </span>
          Перевірено TalentUp
        </div>
        <div>© 2026 TalentUp. All rights reserved.</div>
      </div>
    </footer>
  )
}

export default Footer
