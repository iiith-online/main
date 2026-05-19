import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  GitFork,
  Globe,
  Lock,
  Menu,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import "./index.css";

type SiteRecord = {
  id: string;
  url: string;
  title: string;
  description: string;
  image?: string;
  favicon?: string;
  hostname: string;
  createdAt: string;
};

type AdminStatus = {
  authenticated: boolean;
  configured: boolean;
};

type StatChipProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

type LinkRowProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
};

type SiteCardProps = {
  site: SiteRecord;
};

const heroStats = (siteCount: number, adminReady: boolean) => [
  {
    icon: Globe,
    label: "Sites",
    value: String(siteCount),
  },
  {
    icon: Sparkles,
    label: "Metadata",
    value: "Automatic",
  },
  {
    icon: Lock,
    label: "Mode",
    value: "Dark only",
  },
  {
    icon: Lock,
    label: "Admin",
    value: adminReady ? "Unlocked" : "Passcode",
  },
];

function StatChip({ icon: Icon, label, value }: StatChipProps) {
  return (
    <div className="rounded-2xl border border-[#30363d] bg-[#161b22] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8b949e]">
        <Icon className="h-4 w-4 text-[#58a6ff]" />
        <span>{label}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function LinkRow({ icon: Icon, title, description, href }: LinkRowProps) {
  const external = href.startsWith("http");
  const TrailingIcon = external ? ExternalLink : ArrowRight;

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex items-start gap-4 rounded-2xl border border-[#30363d] bg-[#0d1117] p-4 transition hover:border-[#58a6ff]/40 hover:bg-[#161b22]"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#30363d] bg-[#161b22] text-[#58a6ff]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <TrailingIcon className="h-4 w-4 shrink-0 text-[#8b949e] transition group-hover:text-[#58a6ff]" />
        </div>
        <p className="mt-1 text-sm leading-6 text-[#8b949e]">{description}</p>
      </div>
    </a>
  );
}

function getProtocolLabel(url: string) {
  try {
    return new URL(url).protocol.replace(":", "");
  } catch {
    return "https";
  }
}

function SiteCard({ site }: SiteCardProps) {
  const hostname = site.hostname.replace(/^www\./, "");
  const initial = site.title.trim().slice(0, 1).toUpperCase() || hostname.slice(0, 1).toUpperCase();
  const hasImage = Boolean(site.image);
  const hasFavicon = Boolean(site.favicon);
  const protocol = getProtocolLabel(site.url);

  return (
    <article className="overflow-hidden rounded-3xl border border-[#30363d] bg-[#161b22] shadow-[0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#58a6ff]/40 hover:shadow-[0_16px_48px_rgba(1,4,9,0.4)]">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-[#30363d] bg-[#0d1117]">
        {hasImage ? (
          <img
            src={site.image}
            alt={site.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(88,166,255,0.16),_transparent_55%),linear-gradient(135deg,_#161b22,_#0d1117)]">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#30363d] bg-[#0d1117] text-2xl font-semibold text-white">
              {initial}
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-[#30363d] bg-[#0d1117]/90 px-3 py-1 text-xs font-medium text-[#c9d1d9] backdrop-blur">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#3fb950]" />
          Auto metadata
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {hasFavicon ? (
                <img
                  src={site.favicon}
                  alt=""
                  className="h-7 w-7 rounded-full border border-[#30363d] bg-[#0d1117] object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#30363d] bg-[#0d1117] text-xs font-semibold text-[#c9d1d9]">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-[#8b949e]">Site</p>
                <h3 className="truncate text-xl font-semibold text-white">{site.title}</h3>
              </div>
            </div>
            <p className="mt-2 text-sm text-[#8b949e]">{hostname}</p>
          </div>
          <span className="rounded-full border border-[#30363d] bg-[#0d1117] px-3 py-1 text-xs font-medium text-[#c9d1d9]">
            {formatAddedAt(site.createdAt)}
          </span>
        </div>

        <p className="text-sm leading-6 text-[#c9d1d9]">{site.description}</p>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#30363d] bg-[#0d1117] px-3 py-1 text-xs font-medium text-[#8b949e]">
            Metadata fetched
          </span>
          <span className="rounded-full border border-[#30363d] bg-[#0d1117] px-3 py-1 text-xs font-medium text-[#8b949e]">
            {hostname}
          </span>
          <span className="rounded-full border border-[#30363d] bg-[#0d1117] px-3 py-1 text-xs font-medium text-[#8b949e]">
            {protocol}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-[#30363d] pt-4">
          <div className="flex min-w-0 items-center gap-2 text-xs text-[#8b949e]">
            <Globe className="h-4 w-4 shrink-0 text-[#58a6ff]" />
            <span className="truncate">{site.url}</span>
          </div>
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[#30363d] bg-[#0d1117] px-4 py-2 text-sm font-semibold text-white transition hover:border-[#58a6ff]/40 hover:bg-[#1f2633]"
          >
            Visit
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}

function formatAddedAt(value: string) {
  const created = new Date(value).getTime();
  const diff = Date.now() - created;
  if (!Number.isFinite(created)) {
    return "just added";
  }

  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) {
    return minutes <= 1 ? "just added" : `${minutes}m ago`;
  }

  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(diff / 86_400_000);
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function App() {
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [adminConfigured, setAdminConfigured] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [sitesResponse, adminResponse] = await Promise.all([
          fetch("/api/sites", { signal: controller.signal }),
          fetch("/api/admin/status", { signal: controller.signal }),
        ]);

        if (!sitesResponse.ok) {
          throw new Error("Unable to load sites.");
        }

        const [siteData, adminData] = await Promise.all([
          sitesResponse.json(),
          adminResponse.json(),
        ]);

        setSites(Array.isArray(siteData.sites) ? siteData.sites : []);
        setAdminReady(Boolean(adminData.authenticated));
        setAdminConfigured(Boolean(adminData.configured));
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatusError(error instanceof Error ? error.message : "Unable to load the site directory.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setStatusError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Invalid passcode.");
      }

      setPasscode("");
      setAdminReady(true);
      setStatusMessage("Admin portal unlocked.");
      setAdminOpen(true);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Unable to unlock admin portal.");
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleLogout() {
    setStatusError("");
    setStatusMessage("");

    const response = await fetch("/api/admin/logout", {
      method: "POST",
    });

    if (response.ok) {
      setAdminReady(false);
      setStatusMessage("Admin portal locked.");
    }
  }

  async function handleAddSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveBusy(true);
    setStatusError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/admin/sites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: siteUrl }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to add site.");
      }

      setSites(Array.isArray(payload?.sites) ? payload.sites : []);
      setSiteUrl("");
      setStatusMessage(`Added ${payload.site?.title ?? "site"}.`);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Unable to add site.");
    } finally {
      setSaveBusy(false);
    }
  }

  const sortedSites = [...sites].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const stats = heroStats(sortedSites.length, adminReady);
  const latestSite = sortedSites[0];

  return (
    <div id="top" className="relative min-h-screen bg-[#0d1117] text-[#c9d1d9] selection:bg-[#1f6feb] selection:text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,_rgba(88,166,255,0.15),_transparent_45%),radial-gradient(circle_at_top_right,_rgba(63,185,80,0.12),_transparent_40%)]" />

      <header className="sticky top-0 z-30 border-b border-[#30363d] bg-[#0d1117]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#30363d] bg-[#161b22]">
              <Menu className="h-5 w-5 text-[#58a6ff]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#8b949e]">IIIT-H Online</p>
              <p className="text-sm font-semibold text-white">Community site directory</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/iiith-online"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-full border border-[#30363d] bg-[#161b22] px-4 py-2 text-sm font-semibold text-white transition hover:border-[#58a6ff]/40 hover:bg-[#1f2633] sm:inline-flex"
            >
              <GitFork className="h-4 w-4" />
              GitHub
            </a>

            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#1f6feb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#388bfd]"
            >
              <Lock className="h-4 w-4" />
              {adminReady ? "Admin unlocked" : "Admin portal"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="space-y-8">
            <div className="overflow-hidden rounded-[2rem] border border-[#30363d] bg-[#161b22] shadow-[0_1px_0_rgba(255,255,255,0.04)]">
              <div className="border-b border-[#30363d] px-6 py-6 sm:px-8">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#8b949e]">
                  <span className="font-medium text-white">iiith-online</span>
                  <ChevronRight className="h-4 w-4" />
                  <span className="font-medium text-white">sites</span>
                  <span className="rounded-full border border-[#30363d] bg-[#0d1117] px-2.5 py-1 text-xs font-medium text-[#c9d1d9]">
                    Dark only
                  </span>
                </div>

                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Community site directory
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-[#8b949e] sm:text-lg">
                  Browse IIIT-H community projects in a dark interface, unlock the admin portal with a server-side
                  passcode, and add new sites without typing their title or description by hand.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setAdminOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#238636] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2ea043]"
                  >
                    <Plus className="h-4 w-4" />
                    Add site
                  </button>
                  <a
                    href="https://github.com/iiith-online"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-[#30363d] bg-[#0d1117] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-[#58a6ff]/40 hover:bg-[#1f2633]"
                  >
                    <GitFork className="h-4 w-4" />
                    View GitHub
                  </a>
                </div>
              </div>

              <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <StatChip key={stat.label} {...stat} />
                ))}
              </div>
            </div>

            {statusError ? (
              <div className="rounded-2xl border border-[#f85149]/40 bg-[#2d1f1f] px-4 py-3 text-sm text-[#ffb4b4]">
                {statusError}
              </div>
            ) : null}

            {statusMessage ? (
              <div className="rounded-2xl border border-[#3fb950]/30 bg-[#13261a] px-4 py-3 text-sm text-[#c6f6d5]">
                {statusMessage}
              </div>
            ) : null}

            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8b949e]">Featured site</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Latest additions</h2>
                </div>
                <p className="text-sm text-[#8b949e]">
                  {latestSite ? `Most recent: ${latestSite.title}` : "No sites added yet"}
                </p>
              </div>

              {loading ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={index}
                      className="animate-pulse overflow-hidden rounded-3xl border border-[#30363d] bg-[#161b22]"
                    >
                      <div className="aspect-[16/9] bg-[#0d1117]" />
                      <div className="space-y-4 p-5">
                        <div className="h-4 w-24 rounded-full bg-[#30363d]" />
                        <div className="h-6 w-2/3 rounded-full bg-[#30363d]" />
                        <div className="h-4 w-full rounded-full bg-[#30363d]" />
                        <div className="h-4 w-5/6 rounded-full bg-[#30363d]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : sortedSites.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {sortedSites.map((site) => (
                    <SiteCard key={site.id} site={site} />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-[#30363d] bg-[#161b22] p-8 text-sm text-[#8b949e]">
                  No sites are stored yet. Unlock the admin portal and add one to seed the directory.
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-[2rem] border border-[#30363d] bg-[#161b22] p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
              <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8b949e]">How it works</h2>
              <div className="mt-4 space-y-4">
                {[
                  "Unlock the admin portal with a server-side passcode.",
                  "Paste a site URL and let the server scrape title, description, and images automatically.",
                  "The saved site list refreshes immediately after each add.",
                ].map((step, index) => (
                  <div key={step} className="flex gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#30363d] bg-[#0d1117] text-xs font-semibold text-[#58a6ff]">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-[#c9d1d9]">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#30363d] bg-[#161b22] p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
              <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8b949e]">Environment</h2>
              <dl className="mt-4 space-y-4">
                {[
                  ["ADMIN_PORTAL_PASSCODE", "Server-only passcode for admin login"],
                  ["BUN_PUBLIC_*", "Any public client variables already exposed by Bun"],
                  ["data/sites.json", "File-backed storage for the site directory"],
                ].map(([label, value]) => (
                  <div key={label} className="border-b border-[#30363d] pb-3 last:border-b-0 last:pb-0">
                    <dt className="text-sm text-[#8b949e]">{label}</dt>
                    <dd className="mt-1 text-sm font-medium text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-[2rem] border border-[#30363d] bg-[#161b22] p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)]">
              <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8b949e]">Quick links</h2>
              <div className="mt-4 space-y-3">
                {[
                  {
                    icon: GitFork,
                    title: "GitHub organization",
                    description: "Browse the iiith-online repos.",
                    href: "https://github.com/iiith-online",
                  },
                  {
                    icon: FileText,
                    title: "Current data file",
                    description: "Site records are stored in data/sites.json.",
                    href: "#top",
                  },
                ].map((link) => (
                  <LinkRow key={link.title} {...link} />
                ))}
              </div>
            </section>
          </aside>
        </section>
      </main>

      <footer className="border-t border-[#30363d] bg-[#0d1117]/80">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="max-w-3xl text-sm leading-6 text-[#8b949e]">
            <strong className="text-[#c9d1d9]">Disclaimer:</strong> IIIT-H Online is an independent community
            initiative. We are not officially affiliated with, maintained by, or endorsed by the International
            Institute of Information Technology, Hyderabad (IIIT-H).
            This applies to iiith.online and all of its subdomains, content, including the site directory, codebase, and associated materials. All contributions are voluntary and do not reflect the views or positions of IIIT Hyderabad as a whole and only represent the individual contributors. For any concerns regarding content or conduct, please contact the maintainers directly through our GitHub organization at{" "}
            <a
              href="https://github.com/iiith-online"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              https://github.com/iiith-online
            </a>
          </p>
        </div>
      </footer>

      {adminOpen ? (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => setAdminOpen(false)}>
          <div
            className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-[#30363d] bg-[#0d1117] shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#30363d] px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#8b949e]">Admin portal</p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {adminReady ? "Add a site" : "Enter passcode"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAdminOpen(false)}
                className="rounded-full border border-[#30363d] bg-[#161b22] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2633]"
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {!adminConfigured ? (
                <div className="rounded-2xl border border-[#30363d] bg-[#161b22] p-4 text-sm text-[#c9d1d9]">
                  Set <code className="rounded bg-[#0d1117] px-1.5 py-0.5 text-[#58a6ff]">ADMIN_PORTAL_PASSCODE</code>
                  to enable the admin flow.
                </div>
              ) : null}

              {!adminReady ? (
                <form onSubmit={handleLogin} className="space-y-4 rounded-3xl border border-[#30363d] bg-[#161b22] p-5">
                  <div>
                    <label className="text-sm font-medium text-white" htmlFor="passcode">
                      Passcode
                    </label>
                    <input
                      id="passcode"
                      type="password"
                      autoComplete="current-password"
                      value={passcode}
                      onChange={(event) => setPasscode(event.target.value)}
                      placeholder="Enter admin passcode"
                      className="mt-2 w-full rounded-2xl border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#6e7681] focus:border-[#58a6ff]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginBusy}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f6feb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#388bfd] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Lock className="h-4 w-4" />
                    {loginBusy ? "Checking..." : "Unlock"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAddSite} className="space-y-4 rounded-3xl border border-[#30363d] bg-[#161b22] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-[#8b949e]">Access granted</p>
                      <h3 className="mt-1 text-lg font-semibold text-white">Add a new site</h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-full border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs font-semibold text-[#c9d1d9] transition hover:bg-[#1f2633]"
                    >
                      Lock
                    </button>
                  </div>

                  <p className="text-sm leading-6 text-[#8b949e]">
                    Paste a URL and the server will fetch its metadata automatically. The stored record includes the
                    title, description, image, favicon, and hostname when available.
                  </p>

                  <div>
                    <label className="text-sm font-medium text-white" htmlFor="site-url">
                      Site URL
                    </label>
                    <input
                      id="site-url"
                      type="url"
                      value={siteUrl}
                      onChange={(event) => setSiteUrl(event.target.value)}
                      placeholder="https://example.com"
                      className="mt-2 w-full rounded-2xl border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#6e7681] focus:border-[#58a6ff]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saveBusy || siteUrl.trim().length === 0}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#238636] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Plus className="h-4 w-4" />
                    {saveBusy ? "Fetching metadata..." : "Add site"}
                  </button>
                </form>
              )}

              {adminReady ? (
                <section className="rounded-3xl border border-[#30363d] bg-[#161b22] p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-[#8b949e]">Current state</h3>
                  <div className="mt-4 space-y-3 text-sm text-[#c9d1d9]">
                    <p>{sortedSites.length} sites stored.</p>
                    <p>Metadata is fetched on the server when a URL is added.</p>
                    <p>Only the passcode unlocks the write endpoint.</p>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
