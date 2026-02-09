import { User, UserPlus, UserCheck } from "lucide-react";

export default function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs sm:text-sm mt-4">
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-sm bg-court-empty border border-border" />
        <span>Frei</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-sm bg-court-half" />
        <span>Halbbuchung (Partner gesucht)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-sm bg-court-full" />
        <span>Gebucht</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-sm bg-court-special" />
        <span>Abo / Gesperrt</span>
      </div>
    </div>
  );
}
