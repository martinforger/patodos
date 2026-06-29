'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Users,
  UserPlus,
  MapPin,
  LayoutDashboard,
  Building2,
  LogOut,
  History,
  FileBarChart,
  LayoutGrid,
  Menu,
  HeartHandshake,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/inventario', label: 'Inventario', icon: Package },
  { href: '/ingresos', label: 'Ingresos', icon: ArrowDownToLine },
  { href: '/egresos', label: 'Egresos', icon: ArrowUpFromLine },
  { href: '/solicitudes', label: 'Solicitudes', icon: ClipboardList },
  { href: '/historial', label: 'Historial', icon: History },
  { href: '/reportes', label: 'Reportes', icon: FileBarChart },
  { href: '/personas', label: 'Personas', icon: Users },
  { href: '/destinos', label: 'Destinos', icon: MapPin },
  { href: '/equipo', label: 'Equipo', icon: UserPlus },
  { href: '/voluntarios', label: 'Voluntarios', icon: HeartHandshake },
]

const adminItems = [
  { href: '/admin/panel', label: 'Panel general', icon: LayoutGrid },
  { href: '/admin/centros', label: 'Centros', icon: Building2 },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-md p-2 text-foreground hover:bg-muted transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-4 py-5 border-b">
            <SheetTitle className="text-left text-sm font-bold">Ayuda Humanitaria</SheetTitle>
            <p className="text-xs text-muted-foreground -mt-1">Venezuela</p>
          </SheetHeader>

          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  pathname === href
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}

            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Administración</p>
            </div>

            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  pathname.startsWith(href)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="border-t px-2 py-3">
            <button
              onClick={cerrarSesion}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
