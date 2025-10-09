import logo from '../public/brand/Bidi Contracting Logo.svg'

export default function Footer() {
  return (
    <footer className="bg-black text-white py-16 border-t-2 border-orange">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <img src={logo.src} alt="Bidi" className="h-8 w-8" />
              <span className="font-bidi text-2xl font-bold">Bidi</span>
            </div>
            <p className="text-gray-400 font-medium">
              Automated subcontractor search and bid collection for construction professionals.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</a></li>
              <li><a href="/pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
              <li><a href="/auth/login" className="text-gray-400 hover:text-white transition-colors">Login</a></li>
              <li><a href="/auth/signup" className="text-gray-400 hover:text-white transition-colors">Sign Up</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4">Contact</h3>
            <ul className="space-y-2">
              <li className="text-gray-400">weston@bidicontracting.com</li>
              <li className="text-gray-400">385-216-9587</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-gray-400 font-medium">
            © 2025 Bidi. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
