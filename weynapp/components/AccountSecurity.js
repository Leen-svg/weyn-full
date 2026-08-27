"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "./PasswordInput";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AccountSecurity({ email }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailErr, setEmailErr] = useState(null);

  const [confirmText, setConfirmText] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState(null);

  async function changePassword(e) {
    e.preventDefault();
    setPwBusy(true);
    setPwErr(null);
    setPwMsg(null);
    const supabase = createClient();
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) {
      setPwErr("Current password is incorrect.");
      setPwBusy(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPwErr(error.message);
    else {
      setPwMsg("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    }
    setPwBusy(false);
  }

  // Supabase sends a confirmation link to the new address; the change only
  // lands once that link is opened, so the copy has to say so.
  async function changeEmail(e) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailErr(null);
    setEmailMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) setEmailErr(error.message);
    else {
      setEmailMsg(`Confirmation sent to ${newEmail.trim()}. Open it to finish the change — your address stays the same until you do.`);
      setNewEmail("");
    }
    setEmailBusy(false);
  }

  async function deleteAccount() {
    setDelBusy(true);
    setDelErr(null);
    const response = await fetch("/api/account", { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setDelErr(body.error || "Couldn't delete your account. Try again.");
      setDelBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Email address</CardTitle>
          <CardDescription>The address you sign in with.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="account-email-current">{email || "No email on this account"}</p>
          <form onSubmit={changeEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-email">New email address</Label>
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            {emailErr && <p className="text-sm text-destructive">{emailErr}</p>}
            {emailMsg && <p className="text-sm text-muted-foreground">{emailMsg}</p>}
            <Button type="submit" disabled={emailBusy || !newEmail.trim() || newEmail.trim() === email}>
              {emailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send confirmation"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>You&apos;ll stay logged in on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <PasswordInput id="current-password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password-settings">New password</Label>
              <PasswordInput id="new-password-settings" required minLength={6} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            {pwErr && <p className="text-sm text-destructive">{pwErr}</p>}
            {pwMsg && <p className="text-sm text-muted-foreground">{pwMsg}</p>}
            <Button type="submit" disabled={pwBusy || !currentPassword || newPassword.length < 6}>
              {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>Permanently deletes your profile, saves, reviews, posts, and group memberships. This can&apos;t be undone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
            <Input id="delete-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
          </div>
          {delErr && <p className="text-sm text-destructive">{delErr}</p>}
          <Button type="button" variant="destructive" disabled={delBusy || confirmText !== "DELETE"} onClick={deleteAccount}>
            {delBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete my account"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
