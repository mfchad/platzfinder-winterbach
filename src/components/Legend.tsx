export default function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs sm:text-sm mt-4 px-2 py-3 rounded-lg" style={{ background: '#FAFBFE', borderTop: '1px solid hsl(var(--background))' }}>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded" style={{ background: 'white', border: '1px solid hsl(var(--slot-free-border))' }} />
        <span className="text-muted-foreground">Frei</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded" style={{ background: 'hsl(var(--slot-half-bg))', border: '1.5px dashed hsl(var(--slot-half-border))' }} />
        <span className="text-muted-foreground">Halbbuchung</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded" style={{ background: 'hsl(var(--club-royal))' }} />
        <span className="text-muted-foreground">Gebucht</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded" style={{ background: 'hsl(var(--club-ruby))' }} />
        <span className="text-muted-foreground">Abo / Gesperrt</span>
      </div>
    </div>
  );
}
