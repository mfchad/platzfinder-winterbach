import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, LogOut } from "lucide-react";
import MembersTab from "@/components/admin/MembersTab";
import AdminBookingsTab from "@/components/admin/AdminBookingsTab";
import SpecialBookingsTab from "@/components/admin/SpecialBookingsTab";
import RulesTab from "@/components/admin/RulesTab";

const TABS = [
  { key: "members", label: "Mitglieder" },
  { key: "bookings", label: "Buchungen" },
  { key: "special", label: "Sonderbuchungen" },
  { key: "rules", label: "Regelwerk" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("members");

  useEffect(() => {
    const checkAdmin = async (s: any) => {
      if (!s) { navigate('/admin'); return; }
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: s.user.id,
        _role: 'admin',
      });
      if (!isAdmin) {
        await supabase.auth.signOut();
        navigate('/admin');
        return;
      }
      setSession(s);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s) { setSession(null); navigate('/admin'); return; }
      checkAdmin(s);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => checkAdmin(s));
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
        {/* Pill-style segmented navigation */}
        <div className="mb-6 flex flex-nowrap overflow-x-auto scrollbar-hide bg-muted/60 rounded-full p-1 gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "members" && <MembersTab />}
        {activeTab === "bookings" && <AdminBookingsTab />}
        {activeTab === "special" && <SpecialBookingsTab />}
        {activeTab === "rules" && <RulesTab />}
      </main>
    </div>
  );
}
