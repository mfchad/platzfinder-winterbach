import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, LogOut } from "lucide-react";
import MembersTab from "@/components/admin/MembersTab";
import AdminBookingsTab from "@/components/admin/AdminBookingsTab";
import SpecialBookingsTab from "@/components/admin/SpecialBookingsTab";
import RulesTab from "@/components/admin/RulesTab";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) navigate('/admin');
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) navigate('/admin');
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-accent text-accent-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-display text-lg sm:text-xl font-bold">Verwaltung</h1>
          </div>
          <Button size="sm" onClick={handleLogout} className="bg-primary text-primary-foreground hover:bg-primary/80">
            <LogOut className="h-4 w-4 mr-1" /> Abmelden
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="members">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="members">Mitglieder</TabsTrigger>
            <TabsTrigger value="bookings">Buchungen</TabsTrigger>
            <TabsTrigger value="special">Sonderbuchungen</TabsTrigger>
            <TabsTrigger value="rules">Regelwerk</TabsTrigger>
          </TabsList>

          <TabsContent value="members"><MembersTab /></TabsContent>
          <TabsContent value="bookings"><AdminBookingsTab /></TabsContent>
          <TabsContent value="special"><SpecialBookingsTab /></TabsContent>
          <TabsContent value="rules"><RulesTab /></TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
