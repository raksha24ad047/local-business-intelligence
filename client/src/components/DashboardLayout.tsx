import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BarChart3, Boxes, BrainCircuit, ClipboardList, FileBarChart, LayoutDashboard, LogOut, PanelLeft, Settings2, ShoppingBag, UsersRound } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/workspace?view=dashboard" },
  { icon: BarChart3, label: "Sales analytics", path: "/workspace?view=sales" },
  { icon: ShoppingBag, label: "Products", path: "/workspace?view=products" },
  { icon: Boxes, label: "Inventory", path: "/workspace?view=inventory" },
  { icon: UsersRound, label: "Customers", path: "/workspace?view=customers" },
  { icon: BrainCircuit, label: "Forecast & insights", path: "/workspace?view=insights" },
  { icon: FileBarChart, label: "Reports", path: "/workspace?view=reports" },
];

const SIDEBAR_WIDTH_KEY = "lumenledger-sidebar-width";
const DEFAULT_WIDTH = 256;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()), [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f4f3ee] flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-[0_22px_80px_rgba(26,32,44,.12)]">
          <div className="mb-8 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl bg-[#d9f25a] text-[#1c261f] font-black">L</div><span className="font-display text-xl font-semibold">lumenledger</span></div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Your numbers, finally useful.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Sign in to open your private business workspace.</p>
          <Button onClick={() => startLogin()} className="mt-8 h-12 w-full rounded-xl bg-[#1c2a2a] text-white hover:bg-[#304342]">Continue with Manus</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const activeMenuItem = menuItems.find((item) => location === item.path) ?? menuItems[0];

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const next = Math.min(360, Math.max(220, event.clientX - left));
      setSidebarWidth(next);
    };
    const up = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0 bg-[#182525] text-[#f3f5eb]" disableTransition={isResizing}>
          <SidebarHeader className="h-20 justify-center border-b border-white/10 px-4">
            <div className="flex items-center gap-3">
              <button onClick={toggleSidebar} className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#d9f25a] text-[#182525] transition-transform active:scale-95" aria-label="Toggle navigation"><PanelLeft className="size-4" /></button>
              {!isCollapsed && <div><div className="font-display text-lg font-semibold tracking-tight">lumenledger</div><div className="text-[10px] uppercase tracking-[.22em] text-[#a5b4aa]">Business intelligence</div></div>}
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2 py-5">
            <div className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[.22em] text-[#7e9388]">Workspace</div>
            <SidebarMenu className="gap-1">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className={`h-11 rounded-xl font-medium transition-colors ${isActive ? "bg-[#d9f25a] text-[#182525] hover:bg-[#d9f25a]" : "text-[#bcc9bf] hover:bg-white/10 hover:text-white"}`}><item.icon className="size-[17px]" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>;
              })}
            </SidebarMenu>
            <div className="mt-8 px-3 pb-3 text-[10px] font-semibold uppercase tracking-[.22em] text-[#7e9388]">Configure</div>
            <SidebarMenu><SidebarMenuItem><SidebarMenuButton isActive={location === "/workspace?view=settings"} onClick={() => setLocation("/workspace?view=settings")} tooltip="Business settings" className={`h-11 rounded-xl font-medium ${location === "/workspace?view=settings" ? "bg-white/10 text-white" : "text-[#bcc9bf] hover:bg-white/10 hover:text-white"}`}><Settings2 className="size-[17px]" /><span>Business settings</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="border-t border-white/10 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/10"><Avatar className="size-9 border-0 bg-[#d9f25a] text-[#182525]"><AvatarFallback className="bg-[#d9f25a] font-bold text-[#182525]">{user?.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-semibold text-white">{user?.name ?? "Workspace owner"}</p><p className="mt-1 truncate text-xs text-[#8ea198]">{user?.email ?? "Signed in"}</p></div></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600"><LogOut className="mr-2 size-4" />Sign out</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize hover:bg-[#d9f25a]/40 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} />
      </div>
      <SidebarInset className="bg-[#f4f3ee]">
        {isMobile && <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-[#e3e5db] bg-[#f4f3ee]/95 px-4 backdrop-blur"><SidebarTrigger className="size-9 rounded-lg bg-white" /><span className="font-display font-semibold">{activeMenuItem.label}</span></div>}
        <main className="min-h-screen px-4 py-5 sm:px-7 lg:px-10 lg:py-8">{children}</main>
      </SidebarInset>
    </>
  );
}
