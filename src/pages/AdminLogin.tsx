import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/admin/dashboard');
    } catch (e: any) {
      toast({ title: "Anmeldefehler", description: e.message || "Anmeldung fehlgeschlagen.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="w-fit mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          <CardTitle className="font-display text-xl">Verwaltung — Anmeldung</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>E-Mail</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Passwort</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Wird angemeldet..." : "Anmelden"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
