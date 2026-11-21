"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { accountMode, getSupabase } from "./client";

export function AccountGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!accountMode);
  const [user, setUser] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!accountMode) return;
    try {
      const client = getSupabase();
      client.auth.getSession().then(({ data, error }) => {
        if (error) setNotice(error.message);
        setUser(data.session?.user.email ?? null);
        setReady(true);
      });
      const { data } = client.auth.onAuthStateChange((event, session) => {
        setUser(session?.user.email ?? null);
        setReady(true);
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        if (event === "SIGNED_OUT") setRecovery(false);
      });
      return () => data.subscription.unsubscribe();
    } catch (error) {
      queueMicrotask(() => {
        setNotice(error instanceof Error ? error.message : "การตั้งค่าไม่ครบ");
        setReady(true);
      });
    }
  }, []);
  async function act(action: "login" | "signup" | "reset" | "update" | "logout") {
    setBusy(true);
    setNotice("");
    try {
      const auth = getSupabase().auth;
      const result = action === "signup"
        ? await auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        : action === "reset"
          ? await auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
          : action === "update"
            ? await auth.updateUser({ password })
            : action === "logout"
              ? await auth.signOut()
              : await auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (action === "signup") setNotice("ส่งคำขอสมัครแล้ว กรุณาตรวจอีเมลเพื่อยืนยันบัญชี");
      if (action === "reset") setNotice("กรุณาตรวจอีเมลสำหรับเปลี่ยนรหัสผ่าน");
      if (action === "update") { setRecovery(false); setPassword(""); }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
    } finally { setBusy(false); }
  }
  if (!accountMode) return <>{children}</>;
  if (!ready) return <main className="workspace" role="status">กำลังตรวจบัญชี…</main>;
  if (user && !recovery) return <div key={user}>
    <div className="account-bar"><span>{user}</span><Button disabled={busy} variant="outline" onClick={() => act("logout")}>ออกจากระบบ</Button>{notice && <p role="alert">{notice}</p>}</div>
    {children}
  </div>;
  return <main className="workspace account-form">
    <h1>{recovery ? "ตั้งรหัสผ่านใหม่" : "เข้าสู่ระบบ AI Data Analyst"}</h1>
    <form onSubmit={(event) => { event.preventDefault(); void act(recovery ? "update" : "login"); }}>
      {!recovery && <label>อีเมล<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
      <label>รหัสผ่าน<input type="password" required minLength={8} autoComplete={recovery ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <Button disabled={busy} type="submit">{recovery ? "บันทึกรหัสผ่าน" : "เข้าสู่ระบบ"}</Button>
      {!recovery && <><Button disabled={busy || !email || password.length < 8} type="button" variant="outline" onClick={() => act("signup")}>สมัครสมาชิก</Button>
      <Button disabled={busy || !email} type="button" variant="outline" onClick={() => act("reset")}>ลืมรหัสผ่าน</Button></>}
    </form>
    {notice && <p role="status">{notice}</p>}
  </main>;
}
