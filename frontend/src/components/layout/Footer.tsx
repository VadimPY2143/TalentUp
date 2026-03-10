const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-white/75 md:flex-row">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-navy-800 text-xs text-white">
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
