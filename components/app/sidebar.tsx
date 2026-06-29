'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  HeartHandshake,
  Bug,
} from 'lucide-react'
import { FormularioBug } from '@/components/app/formulario-bug'

const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard, id: 'tour-panel' },
  { href: '/inventario', label: 'Inventario', icon: Package, id: 'tour-inventario' },
  { href: '/ingresos', label: 'Ingresos', icon: ArrowDownToLine, id: 'tour-ingresos' },
  { href: '/egresos', label: 'Egresos', icon: ArrowUpFromLine, id: 'tour-egresos' },
  { href: '/solicitudes', label: 'Solicitudes', icon: ClipboardList, id: 'tour-solicitudes' },
  { href: '/historial', label: 'Historial', icon: History, id: 'tour-historial' },
  { href: '/reportes', label: 'Reportes', icon: FileBarChart, id: 'tour-reportes' },
  { href: '/personas', label: 'Personas', icon: Users, id: 'tour-personas' },
  { href: '/destinos', label: 'Destinos', icon: MapPin, id: 'tour-destinos' },
  { href: '/equipo', label: 'Equipo', icon: UserPlus, id: 'tour-equipo' },
  { href: '/voluntarios', label: 'Voluntarios', icon: HeartHandshake, id: 'tour-voluntarios' },
]

const adminItems = [
  { href: '/admin/panel', label: 'Panel general', icon: LayoutGrid },
  { href: '/admin/centros', label: 'Centros', icon: Building2 },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { href: '/admin/bugs', label: 'Bugs reportados', icon: Bug },
]

interface SidebarProps {
  rol: string
}

export function Sidebar({ rol }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex h-full w-56 flex-col border-r bg-sidebar">
      <div id="tour-brand" className="px-4 py-5 border-b">
        <p className="font-bold text-sm text-sidebar-foreground">Ayuda Humanitaria</p>
        <p className="text-xs text-muted-foreground mt-0.5">Venezuela</p>
      </div>



      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, id }) => (
          <Link
            key={href}
            id={id}
            href={href}
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

        {rol === 'administrador_sistema' && (
          <>
            <div id="tour-admin" className="pt-3 pb-1 px-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Administración</p>
            </div>

            {adminItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
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
          </>
        )}
      </nav>

      <div className="border-t px-2 py-3 space-y-0.5">
        <FormularioBug />
        <button
          onClick={cerrarSesion}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
