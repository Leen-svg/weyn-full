"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Heart, Users, ShieldCheck, LogOut, Trophy, Eye, MessagesSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { safeUrl } from "@/lib/sanitize";

export default function ProfileMenu({ userId, displayName, avatarUrl, points, isAdmin }) {
  const router = useRouter();
  const initials = (displayName || "?").slice(0, 2).toUpperCase();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="profile-menu-trigger flex items-center gap-2 rounded-full border-0 bg-white py-1 pr-3 pl-1 shadow-[0_6px_18px_rgba(31,48,68,.1)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_9px_24px_rgba(31,48,68,.14)]"
          />
        }
      >
        <Avatar className="h-7 w-7">
          <AvatarImage src={safeUrl(avatarUrl)} alt="" />
          <AvatarFallback className="text-xs font-bold">{initials}</AvatarFallback>
        </Avatar>
        <span className="points-badge">{points} pts</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-10 w-10">
            <AvatarImage src={safeUrl(avatarUrl)} alt="" />
            <AvatarFallback className="text-sm font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{displayName || "Your profile"}</div>
            <div className="mt-0.5 text-xs font-bold" style={{ color: "var(--purple)" }}>🏅 {points} pts</div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          <User className="h-4 w-4" /> Edit profile
        </DropdownMenuItem>
        {userId && (
          <DropdownMenuItem render={<Link href={`/u/${userId}`} target="_blank" />}>
            <Eye className="h-4 w-4" /> View public profile
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href="/wishlist" />}>
          <Heart className="h-4 w-4" /> Wishlist
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/rewards" />}>
          <Trophy className="h-4 w-4" /> Rewards
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/friends" />}>
          <Users className="h-4 w-4" /> Friends
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/groups" />}>
          <MessagesSquare className="h-4 w-4" /> Groups
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldCheck className="h-4 w-4" /> Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} variant="destructive">
          <LogOut className="h-4 w-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

