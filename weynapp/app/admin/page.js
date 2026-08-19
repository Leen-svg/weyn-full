import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import AdminClient from "@/components/AdminClient";

export const metadata = { title: "Admin, Weyn", robots: "noindex" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login?next=/admin");
  return <AdminClient />;
}
