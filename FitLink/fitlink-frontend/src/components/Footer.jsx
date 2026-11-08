export default function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden border-t border-white/40 bg-[#111827] py-16 text-slate-300">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-orange-500/10 to-transparent" />

      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-4 md:grid-cols-2 md:px-6 lg:grid-cols-4 lg:px-8">
        {/* Column 1: Logo + intro */}
        <div>
          <h3 className="font-display text-3xl font-bold tracking-[-0.08em]">
            <span className="text-orange-500">Fit</span>
            <span className="text-white">Link</span>
            <span className="text-orange-500">.</span>
          </h3>
          <p className="mt-3 max-w-xs text-sm leading-7 text-slate-400">
            Connect with personal trainers and discover training programs
            and nutrition guidance to reach your fitness goals.
          </p>
          <div className="mt-5 flex gap-3 text-slate-300">
            {/* Facebook */}
            <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:border-orange-400/40 hover:bg-orange-500/10 hover:text-orange-300">
              <i className="fab fa-facebook-f text-xl"></i>
            </a>
            {/* Instagram */}
            <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:border-orange-400/40 hover:bg-orange-500/10 hover:text-orange-300">
              <i className="fab fa-instagram text-xl"></i>
            </a>
            {/* YouTube */}
            <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:border-orange-400/40 hover:bg-orange-500/10 hover:text-orange-300">
              <i className="fab fa-youtube text-xl"></i>
            </a>
          </div>
        </div>

        {/* Column 2: Programs */}
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-white/90">Programs</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="/programs" className="hover:text-orange-300">Full Body Fat Loss</a></li>
            <li><a href="/programs" className="hover:text-orange-300">Muscle &amp; Strength</a></li>
            <li><a href="/programs" className="hover:text-orange-300">Online Coaching</a></li>
          </ul>
        </div>

        {/* Column 3: Support */}
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-white/90">Support</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="/contact" className="hover:text-orange-300">Contact &amp; Booking</a></li>
            <li><a href="/pricing" className="hover:text-orange-300">Pricing &amp; Packages</a></li>
            <li><a href="#" className="hover:text-orange-300">Frequently Asked Questions</a></li>
          </ul>
        </div>

        {/* Column 4: Contact */}
        <div>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-white/90">Contact Information</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span>📞</span> 1900 888 999
            </li>
            <li className="flex items-center gap-2">
              <span>✉️</span> support@fitlink.vn
            </li>
            <li className="flex items-center gap-2">
              <span>📍</span> Vietnam
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright */}
      <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-500 md:text-sm">
        © {new Date().getFullYear()} FitLink. All rights reserved.
      </div>
    </footer>
  );
}
