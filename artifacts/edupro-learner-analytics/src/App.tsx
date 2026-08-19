import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Check,
  CircleHelp,
  Download,
  Filter,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const CSV_URL = `${import.meta.env.BASE_URL ?? '/'}data/users.csv`.replace('//', '/');

type User = {
  UserID: string;
  UserName: string;
  Age: number;
  Gender: string;
  Email: string;
  ageBand: AgeBand;
};

type AgeBand = 'Under 18' | '18–24' | '25–34' | '35–44' | '45–54' | '55+';
type LoadingState = 'loading' | 'ready' | 'error';

const AGE_BANDS: AgeBand[] = ['Under 18', '18–24', '25–34', '35–44', '45–54', '55+'];
const BAND_COLORS = ['#ef775f', '#f7c957', '#1f817b', '#5a83bd', '#8063a4', '#e09168'];

function ageBand(age: number): AgeBand {
  if (age < 18) return 'Under 18';
  if (age < 25) return '18–24';
  if (age < 35) return '25–34';
  if (age < 45) return '35–44';
  if (age < 55) return '45–54';
  return '55+';
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

function parseUsers(csv: string): User[] {
  const rows = parseCsv(csv);
  const header = rows.shift()?.map((value) => value.replace(/^\uFEFF/, '').trim()) ?? [];
  const column = (name: string) => header.findIndex((value) => value.toLowerCase() === name.toLowerCase());
  const idIndex = column('UserID');
  const nameIndex = column('UserName');
  const ageIndex = column('Age');
  const genderIndex = column('Gender');
  const emailIndex = column('Email');
  return rows
    .map((row) => {
      const Age = Number(row[ageIndex]);
      const Gender = row[genderIndex]?.trim() || 'Not specified';
      return {
        UserID: row[idIndex]?.trim() || 'Unknown',
        UserName: row[nameIndex]?.trim() || 'Unnamed learner',
        Age,
        Gender,
        Email: row[emailIndex]?.trim() || 'No email supplied',
        ageBand: ageBand(Age),
      };
    })
    .filter((user) => user.UserID !== 'Unknown' && Number.isFinite(user.Age));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function percent(value: number, total: number) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [loadState, setLoadState] = useState<LoadingState>('loading');
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedBands, setSelectedBands] = useState<AgeBand[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const loadUsers = () => {
    setLoadState('loading');
    setLoadError('');
    fetch(CSV_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load learner roster (${response.status})`);
        return response.text();
      })
      .then((csv) => {
        const parsed = parseUsers(csv);
        if (!parsed.length) throw new Error('The supplied Users file did not contain usable learner rows.');
        setUsers(parsed);
        setLoadState('ready');
      })
      .catch((error: Error) => {
        setLoadError(error.message);
        setLoadState('error');
      });
  };

  useEffect(() => { loadUsers(); }, []);

  const genders = useMemo(() => Array.from(new Set(users.map((user) => user.Gender))).sort(), [users]);
  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !needle || [user.UserName, user.UserID, user.Email].some((value) => value.toLowerCase().includes(needle));
      const matchesBand = !selectedBands.length || selectedBands.includes(user.ageBand);
      const matchesGender = !selectedGenders.length || selectedGenders.includes(user.Gender);
      return matchesSearch && matchesBand && matchesGender;
    });
  }, [users, search, selectedBands, selectedGenders]);

  const ageCounts = useMemo(() => AGE_BANDS.map((band) => ({
    band,
    count: filteredUsers.filter((user) => user.ageBand === band).length,
  })), [filteredUsers]);
  const genderCounts = useMemo(() => genders.map((gender) => ({
    gender,
    count: filteredUsers.filter((user) => user.Gender === gender).length,
  })).sort((a, b) => b.count - a.count), [filteredUsers, genders]);
  const averageAge = useMemo(() => {
    if (!filteredUsers.length) return 0;
    return filteredUsers.reduce((sum, user) => sum + user.Age, 0) / filteredUsers.length;
  }, [filteredUsers]);
  const ageRange = useMemo(() => {
    if (!filteredUsers.length) return '—';
    const ages = filteredUsers.map((user) => user.Age);
    return `${Math.min(...ages)}–${Math.max(...ages)}`;
  }, [filteredUsers]);
  const hasFilters = Boolean(search || selectedBands.length || selectedGenders.length);

  const toggleBand = (band: AgeBand) => {
    setSelectedBands((current) => current.includes(band) ? current.filter((item) => item !== band) : [...current, band]);
  };
  const toggleGender = (gender: string) => {
    setSelectedGenders((current) => current.includes(gender) ? current.filter((item) => item !== gender) : [...current, gender]);
  };
  const clearFilters = () => {
    setSearch('');
    setSelectedBands([]);
    setSelectedGenders([]);
  };
  const downloadCsv = () => {
    const headers = ['UserID', 'UserName', 'Age', 'Gender', 'Email', 'AgeBand'];
    const csv = [headers, ...filteredUsers.map((user) => [user.UserID, user.UserName, user.Age, user.Gender, user.Email, user.ageBand])]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `edupro-learners-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="noise-overlay min-h-[100dvh] bg-background text-foreground">
      <div className="flex min-h-[100dvh]">
        <aside className="hidden w-[238px] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
          <SidebarContent />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1520px] px-4 pb-12 sm:px-7 lg:px-10">
            <header className="flex h-[76px] items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setMobileFiltersOpen((open) => !open)} className="focus-ring rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden" data-testid="button-open-mobile-menu" aria-label="Open navigation">
                  <Menu size={20} />
                </button>
                <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                  <span>Workspace</span><span className="text-border">/</span><span className="font-semibold text-foreground">Learner intelligence</span>
                </div>
                <div className="flex items-center gap-2 sm:hidden">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-sidebar text-xs font-extrabold">EP</span>
                  <span className="font-bold tracking-tight">EduPro</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden items-center gap-2 sm:flex"><span className="h-2 w-2 animate-[pulse-dot_2s_ease-in-out_infinite] rounded-full bg-primary" />Local file analysis</span>
                <button type="button" onClick={loadUsers} className="focus-ring flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-semibold text-foreground transition hover:border-primary/40 hover:bg-muted" data-testid="button-refresh-data">
                  <RefreshCw size={14} className={loadState === 'loading' ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Reload data</span>
                </button>
              </div>
            </header>

            <section className="animate-rise relative overflow-hidden border-b border-border pb-8 pt-9">
              <div className="pointer-events-none absolute -right-10 -top-14 hidden h-56 w-56 rounded-full border-[28px] border-secondary/20 lg:block" />
              <div className="pointer-events-none absolute right-16 top-16 hidden h-3 w-3 rounded-full bg-accent lg:block" />
              <div className="max-w-3xl">
                <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                  <BarChart3 size={15} /> Learner intelligence / 01
                </div>
                <h1 className="max-w-2xl text-3xl font-bold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-5xl" style={{ fontFamily: 'var(--app-font-serif)' }}>
                  See who is in the room.
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                  A clear read of the supplied learner roster — built for decisions about reach, representation, and who needs to be counted next.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-primary" /> Source: Users.csv</span>
                <span className="flex items-center gap-2"><Users size={15} className="text-primary" /> {loadState === 'ready' ? `${formatNumber(users.length)} learner records` : 'Reading learner records'}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider">Updated from supplied file</span>
              </div>
            </section>

            {loadState === 'loading' && <LoadingView />}
            {loadState === 'error' && <ErrorView message={loadError} onRetry={loadUsers} />}
            {loadState === 'ready' && (
              <>
                <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Learners in view" value={formatNumber(filteredUsers.length)} detail={hasFilters ? `${percent(filteredUsers.length, users.length)} of full roster` : 'Full supplied roster'} icon={<Users size={17} />} accent="teal" />
                  <MetricCard label="Average age" value={averageAge ? `${averageAge.toFixed(1)} yrs` : '—'} detail={filteredUsers.length ? `Observed range ${ageRange}` : 'No matching learners'} icon={<BarChart3 size={17} />} accent="gold" />
                  <MetricCard label="Age bands represented" value={formatNumber(ageCounts.filter((item) => item.count > 0).length)} detail={`of ${AGE_BANDS.length} defined bands`} icon={<LayoutDashboard size={17} />} accent="coral" />
                  <MetricCard label="Gender values" value={formatNumber(genderCounts.length)} detail="As labelled in Users.csv" icon={<CircleHelp size={17} />} accent="blue" />
                </section>

                <DataCoverageNotice />

                <section className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start">
                  <FilterPanel
                    genders={genders}
                    selectedBands={selectedBands}
                    selectedGenders={selectedGenders}
                    onToggleBand={toggleBand}
                    onToggleGender={toggleGender}
                    onClear={clearFilters}
                    mobileOpen={mobileFiltersOpen}
                    onCloseMobile={() => setMobileFiltersOpen(false)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Signal view</p>
                        <h2 className="mt-1 text-lg font-bold tracking-tight">Demographic shape</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setMobileFiltersOpen(true)} className="focus-ring flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground lg:hidden" data-testid="button-show-filters"><SlidersHorizontal size={14} /> Filters</button>
                        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">{formatNumber(filteredUsers.length)} shown</span>
                      </div>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                      <AgeDistribution counts={ageCounts} total={filteredUsers.length} />
                      <GenderComposition counts={genderCounts} total={filteredUsers.length} />
                    </div>
                  </div>
                </section>

                <RosterTable users={filteredUsers} search={search} onSearch={setSearch} onDownload={downloadCsv} onClear={clearFilters} hasFilters={hasFilters} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent() {
  return (
    <>
      <div className="flex h-[76px] items-center gap-3 border-b border-sidebar-border px-6">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-sm font-extrabold text-sidebar">EP</span>
        <div><p className="font-bold tracking-tight">EduPro</p><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-sidebar-foreground/50">Intelligence</p></div>
      </div>
      <div className="flex-1 px-3 py-6">
        <p className="px-3 font-mono text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/40">Workspace</p>
        <nav className="mt-3 space-y-1">
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent px-3 py-3 text-sm font-semibold text-sidebar-primary-foreground" data-testid="nav-learner-intelligence"><LayoutDashboard size={17} className="text-sidebar-primary" /> Learner intelligence</div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground/60"><BookOpen size={17} /> Coverage map <span className="ml-auto font-mono text-[9px]">SOON</span></div>
          <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-sidebar-foreground/60"><BarChart3 size={17} /> Saved views <span className="ml-auto font-mono text-[9px]">SOON</span></div>
        </nav>
        <div className="mt-12 rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-sidebar-primary"><ShieldCheck size={15} /> Data boundary</div>
          <p className="mt-2 text-xs leading-5 text-sidebar-foreground/60">Only supplied learner identity and demographic fields are analysed here.</p>
        </div>
      </div>
      <div className="border-t border-sidebar-border px-6 py-5 text-[10px] text-sidebar-foreground/40">
        EDU-ROSTER / V1.0<br /><span className="font-mono tracking-wider">PUBLIC EDUCATION SIGNALS</span>
      </div>
    </>
  );
}

function MetricCard({ label, value, detail, icon, accent }: { label: string; value: string; detail: string; icon: ReactNode; accent: 'teal' | 'gold' | 'coral' | 'blue' }) {
  const color = { teal: 'text-primary bg-primary/10', gold: 'text-[#9b7414] bg-secondary/25', coral: 'text-accent bg-accent/10', blue: 'text-[#4d72a6] bg-[#4d72a6]/10' }[accent];
  return <article className="animate-rise rounded-2xl border border-border bg-card p-5 shadow-[0_5px_20px_hsl(224_31%_16%_/_0.03)]">
    <div className="flex items-start justify-between"><p className="text-xs font-semibold text-muted-foreground">{label}</p><span className={`grid h-8 w-8 place-items-center rounded-lg ${color}`}>{icon}</span></div>
    <p className="mt-5 text-2xl font-bold tracking-[-0.04em]" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>
    <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
  </article>;
}

function DataCoverageNotice() {
  return <aside className="mt-5 flex gap-3 rounded-2xl border border-secondary/60 bg-secondary/15 p-4 sm:items-center" data-testid="notice-data-coverage">
    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-sidebar"><AlertTriangle size={16} /></span>
    <div className="flex-1"><p className="text-sm font-bold text-foreground">Coverage boundary</p><p className="mt-1 text-xs leading-5 text-muted-foreground">This view uses <strong className="font-semibold text-foreground">Users.csv</strong> only. Enrollment, course category, level, course type, and transaction analyses are unavailable because those tables were not supplied. No course metrics are inferred.</p></div>
    <span className="hidden rounded-full border border-secondary/70 px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-wider text-[#876711] sm:block">Transparent by design</span>
  </aside>;
}

function FilterPanel({ genders, selectedBands, selectedGenders, onToggleBand, onToggleGender, onClear, mobileOpen, onCloseMobile }: { genders: string[]; selectedBands: AgeBand[]; selectedGenders: string[]; onToggleBand: (band: AgeBand) => void; onToggleGender: (gender: string) => void; onClear: () => void; mobileOpen: boolean; onCloseMobile: () => void }) {
  return <aside className={`${mobileOpen ? 'block' : 'hidden'} fixed inset-0 z-40 bg-sidebar p-5 text-sidebar-foreground md:relative md:inset-auto md:z-auto md:block md:w-[214px] md:shrink-0 md:rounded-2xl md:bg-card md:p-5 md:text-foreground md:shadow-[0_5px_20px_hsl(224_31%_16%_/_0.03)]`}>
    <div className="flex items-center justify-between border-b border-sidebar-border pb-4 md:border-border">
      <div className="flex items-center gap-2"><Filter size={15} className="text-secondary md:text-primary" /><span className="text-sm font-bold">Filters</span></div>
      <div className="flex items-center gap-3"><button type="button" onClick={onClear} className="text-[10px] font-bold uppercase tracking-wider text-secondary md:text-primary" data-testid="button-clear-filters">Clear all</button><button type="button" onClick={onCloseMobile} className="rounded-md p-1 md:hidden" data-testid="button-close-mobile-filters" aria-label="Close filters"><X size={18} /></button></div>
    </div>
    <FilterGroup title="Age band">
      {AGE_BANDS.map((band) => <FilterOption key={band} label={band} checked={selectedBands.includes(band)} onClick={() => onToggleBand(band)} dark={mobileOpen} testId={`filter-age-${band.replaceAll('–', '-').replaceAll(' ', '-').toLowerCase()}`} />)}
    </FilterGroup>
    <FilterGroup title="Gender">
      {genders.map((gender) => <FilterOption key={gender} label={gender} checked={selectedGenders.includes(gender)} onClick={() => onToggleGender(gender)} dark={mobileOpen} testId={`filter-gender-${gender.replaceAll(' ', '-').toLowerCase()}`} />)}
    </FilterGroup>
    <p className="mt-6 border-t border-sidebar-border pt-4 text-[10px] leading-4 text-sidebar-foreground/50 md:border-border md:text-muted-foreground">Filters update the demographic view and roster together.</p>
  </aside>;
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mt-6"><p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{title}</p><div className="space-y-1">{children}</div></div>;
}

function FilterOption({ label, checked, onClick, dark, testId }: { label: string; checked: boolean; onClick: () => void; dark: boolean; testId: string }) {
  return <button type="button" onClick={onClick} className={`filter-chip focus-ring flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium ${checked ? (dark ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-primary/10 text-primary') : (dark ? 'text-sidebar-foreground/70 hover:bg-sidebar-accent' : 'text-muted-foreground hover:bg-muted')}`} data-testid={testId} aria-pressed={checked}>
    <span className={`grid h-4 w-4 place-items-center rounded border ${checked ? (dark ? 'border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground' : 'border-primary bg-primary text-primary-foreground') : (dark ? 'border-sidebar-foreground/30' : 'border-border')}`}>{checked && <Check size={11} strokeWidth={3} />}</span>{label}
  </button>;
}

function AgeDistribution({ counts, total }: { counts: { band: AgeBand; count: number }[]; total: number }) {
  const max = Math.max(...counts.map((item) => item.count), 1);
  return <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">01 / Distribution</p><h3 className="mt-2 text-base font-bold">Learners by age band</h3></div><span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] text-muted-foreground">n = {formatNumber(total)}</span></div>
    <div className="mt-7 space-y-4" data-testid="chart-age-distribution">
      {counts.map((item, index) => <div key={item.band} className="grid grid-cols-[64px_1fr_45px] items-center gap-3 text-xs"><span className="font-medium text-muted-foreground">{item.band}</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="bar-fill h-full rounded-full" style={{ width: `${(item.count / max) * 100}%`, backgroundColor: BAND_COLORS[index] }} /></div><span className="text-right font-mono text-[11px] font-medium text-foreground">{formatNumber(item.count)}</span></div>)}
    </div>
    <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-[11px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-secondary" /> Bars scale to the largest observed band</div>
  </article>;
}

function GenderComposition({ counts, total }: { counts: { gender: string; count: number }[]; total: number }) {
  const palette = ['#1f817b', '#ef775f', '#5a83bd', '#8063a4', '#e09168', '#f7c957'];
  let cursor = 0;
  const stops = counts.map((item, index) => { const start = cursor; cursor += total ? item.count / total * 360 : 0; return `${palette[index % palette.length]} ${start}deg ${cursor}deg`; }).join(', ');
  return <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
    <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">02 / Composition</p><h3 className="mt-2 text-base font-bold">Gender as supplied</h3></div><CircleHelp size={16} className="text-muted-foreground" /></div>
    <div className="mt-7 flex items-center gap-6">
      <div className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${stops || 'hsl(var(--muted)) 0deg 360deg'})` }} data-testid="chart-gender-composition"><div className="grid h-[82px] w-[82px] place-items-center rounded-full bg-card text-center"><strong className="text-xl tracking-[-0.05em]">{formatNumber(total)}</strong><span className="font-mono text-[9px] uppercase text-muted-foreground">records</span></div></div>
      <div className="min-w-0 flex-1 space-y-3">{counts.slice(0, 5).map((item, index) => <div key={item.gender} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-2 truncate"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />{item.gender}</span><span className="font-mono text-[10px] text-muted-foreground">{percent(item.count, total)}</span></div>)}{counts.length > 5 && <p className="text-[10px] text-muted-foreground">+ {counts.length - 5} additional values</p>}</div>
    </div>
    <p className="mt-6 border-t border-border pt-4 text-[11px] leading-4 text-muted-foreground">Labels are preserved exactly as provided; no categories are imputed.</p>
  </article>;
}

function RosterTable({ users, search, onSearch, onDownload, onClear, hasFilters }: { users: User[]; search: string; onSearch: (value: string) => void; onDownload: () => void; onClear: () => void; hasFilters: boolean }) {
  return <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
    <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">03 / Roster detail</p><h2 className="mt-2 text-lg font-bold">Learner records</h2><p className="mt-1 text-xs text-muted-foreground">Search and export the current filtered view.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => onSearch(event.target.value)} type="search" placeholder="Name, ID, or email" className="focus-ring h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground sm:w-56" data-testid="input-learner-search" aria-label="Search learners" /></label>
        <button type="button" onClick={onDownload} className="focus-ring flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:brightness-110" data-testid="button-download-csv"><Download size={15} /> Download CSV</button>
      </div>
    </div>
    {users.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-6 py-3 font-bold">Learner</th><th className="px-4 py-3 font-bold">Age band</th><th className="px-4 py-3 font-bold">Age</th><th className="px-4 py-3 font-bold">Gender</th><th className="px-6 py-3 font-bold">Email</th></tr></thead><tbody className="divide-y divide-border">{users.slice(0, 100).map((user) => <tr key={user.UserID} className="transition hover:bg-muted/40" data-testid={`row-learner-${user.UserID}`}><td className="px-6 py-3.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/40 text-[10px] font-extrabold text-[#80600b]">{initials(user.UserName)}</span><div><p className="font-bold text-foreground">{user.UserName}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{user.UserID}</p></div></div></td><td className="px-4 py-3.5"><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{user.ageBand}</span></td><td className="px-4 py-3.5 font-mono text-muted-foreground">{user.Age}</td><td className="px-4 py-3.5 text-muted-foreground">{user.Gender}</td><td className="px-6 py-3.5 text-muted-foreground">{user.Email}</td></tr>)}</tbody></table>{users.length > 100 && <p className="border-t border-border px-6 py-3 text-xs text-muted-foreground">Showing first 100 rows. Download CSV includes all {formatNumber(users.length)} filtered records.</p>}</div> : <div className="grid min-h-56 place-items-center px-6 text-center"><div><div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground"><Search size={18} /></div><p className="mt-3 text-sm font-bold">No learners match these filters</p><p className="mt-1 text-xs text-muted-foreground">Try a different search or clear the active filters.</p>{hasFilters && <button type="button" onClick={onClear} className="focus-ring mt-4 rounded-lg border border-border px-3 py-2 text-xs font-bold text-primary" data-testid="button-clear-empty-filters">Clear filters</button>}</div></div>}
  </section>;
}

function LoadingView() {
  return <div className="mt-7 space-y-5" aria-label="Loading learner data" data-testid="status-loading"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 rounded-2xl skeleton" />)}</div><div className="grid gap-4 lg:grid-cols-2"><div className="h-80 rounded-2xl skeleton" /><div className="h-80 rounded-2xl skeleton" /></div></div>;
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="mt-7 rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center" data-testid="status-error"><AlertTriangle className="mx-auto text-destructive" size={26} /><h2 className="mt-3 font-bold">Learner roster unavailable</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p><button type="button" onClick={onRetry} className="focus-ring mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground" data-testid="button-retry-load"><RefreshCw size={14} /> Try again</button></div>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
