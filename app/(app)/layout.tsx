import { AppShell } from "@/components/AppShell";

/** Protected workspace routes: AppShell shows a local sign-in screen when logged out. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
