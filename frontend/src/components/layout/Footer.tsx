const Footer = () => {
  return (
    <footer className="bg-navy-900 text-white">
      <div className="mx-auto flex max-w-[1120px] flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-white/70 md:flex-row">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs">✓</span>
          Перевірено TalentUp
        </div>
        <div>© 2026 TalentUp. All rights reserved.</div>
      </div>
    </footer>
  )
}

export default Footer
