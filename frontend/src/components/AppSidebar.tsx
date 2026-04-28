import { Link, useLocation } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Home, Network, ListTree, Lock, Hash, Key, Users, Shield, Sigma } from "lucide-react";
import { PA_LIST, PARTS, type PAPart } from "@/lib/pa-data";

const partIcon: Record<PAPart, typeof Home> = {
  Prelude: Sigma,
  Symmetric: Lock,
  Hashing: Hash,
  "Public-Key": Key,
  MPC: Users,
};

export function AppSidebar() {
  const location = useLocation();
  const path = location.pathname;
  const isActive = (p: string) => path === p;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono font-bold">
            λ
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">PoIS</span>
            <span className="text-[10px] font-mono text-muted-foreground">CS8.401</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/")} tooltip="Home">
                  <Link to="/"><Home /><span>Home</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/clique")} tooltip="Minicrypt Clique">
                  <Link to="/clique"><Network /><span>Minicrypt Clique</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/assignments")} tooltip="All Assignments">
                  <Link to="/assignments"><ListTree /><span>All Assignments</span></Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {PARTS.map((part) => {
          const Icon = partIcon[part.key];
          const items = PA_LIST.filter((p) => p.part === part.key);
          return (
            <SidebarGroup key={part.key}>
              <SidebarGroupLabel className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {part.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((pa) => (
                    <SidebarMenuItem key={pa.n}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(`/pa/${pa.n}`)}
                        tooltip={`PA#${pa.n} ${pa.title}`}
                      >
                        <Link to="/pa/$n" params={{ n: String(pa.n) }}>
                          <span className="font-mono text-[10px] w-7 shrink-0 text-muted-foreground">
                            PA#{pa.n}
                          </span>
                          <span className="truncate">{pa.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-mono text-muted-foreground group-data-[collapsible=icon]:hidden">
          <Shield className="h-3 w-3" /> gruvbox · katex
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
