import { useEffect, useState, type FormEvent } from "react";
import { ExternalLink, Lock, Plus } from "lucide-react";
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
  updatedAt: string;
};

type AdminStatus = {
  authenticated: boolean;
  configured: boolean;
};

type Draft = {
  url: string;
  title: string;
  description: string;
};

const EMPTY_DRAFT: Draft = {
  url: "",
  title: "",
  description: "",
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function siteLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SiteCard({ site }: { site: SiteRecord }) {
  const hostname = site.hostname.replace(/^www\./, "");
  const initial = (site.title || hostname || site.url).slice(0, 1).toUpperCase();

  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/[0.08]"
    >
      <div className="flex items-start gap-3">
        {site.favicon ? (
          <img
            src={site.favicon}
            alt=""
            className="mt-0.5 h-9 w-9 rounded-xl border border-white/10 bg-black/20 object-cover"
          />
        ) : (
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-sm font-semibold text-white">
            {initial}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="truncate text-base font-semibold text-white">{site.title}</h2>
              <p className="mt-0.5 text-sm text-slate-400">{hostname}</p>
            </div>
            <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-300 line-clamp-2">{site.description}</p>
        </div>
      </div>
    </a>
  );
}

function SiteRow({
  site,
  onEdit,
  onRemove,
}: {
  site: SiteRecord;
  onEdit: (site: SiteRecord) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{site.title}</p>
          <p className="mt-1 text-sm text-slate-400">{site.url}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(site)}
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/5"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onRemove(site.id)}
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-rose-200 transition hover:border-rose-400/40 hover:bg-rose-500/10"
          >
            Remove
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">{site.description}</p>
    </div>
  );
}

export function App() {
  const isAdminPage = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminStatus, setAdminStatus] = useState<AdminStatus>({
    authenticated: false,
    configured: false,
  });
  const [passcode, setPasscode] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSites(signal?: AbortSignal) {
    const response = await fetch("/api/sites", { signal });
    if (!response.ok) {
      throw new Error("Unable to load sites.");
    }

    const payload = (await response.json()) as { sites?: SiteRecord[] };
    setSites(Array.isArray(payload.sites) ? payload.sites : []);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        await loadSites(controller.signal);

        if (isAdminPage) {
          const response = await fetch("/api/admin/status", { signal: controller.signal });
          if (response.ok) {
            const payload = (await response.json()) as AdminStatus;
            setAdminStatus({
              authenticated: Boolean(payload.authenticated),
              configured: Boolean(payload.configured),
            });
          }
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the app.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [isAdminPage]);

  async function refreshSites() {
    await loadSites();
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  }

  function beginEdit(site: SiteRecord) {
    setEditingId(site.id);
    setDraft({
      url: site.url,
      title: site.title,
      description: site.description,
    });
    setMessage("");
    setError("");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passcode }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Invalid passcode.");
      }

      setAdminStatus((current) => ({ ...current, authenticated: true }));
      setPasscode("");
      // setMessage("Admin unlocked.");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to unlock admin.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to lock admin.");
      }

      window.location.replace("/");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Unable to lock admin.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const url = normalizeText(draft.url);
      const title = normalizeText(draft.title);
      const description = normalizeText(draft.description);
      const existing = editingId ? sites.find((site) => site.id === editingId) : null;
      const urlChanged = Boolean(existing && normalizeText(existing.url) !== url);
      const payload = {
        url,
        title: editingId && !urlChanged && title === existing?.title ? "" : title,
        description: editingId && !urlChanged && description === existing?.description ? "" : description,
        syncMetadata: !editingId || urlChanged,
      };

      const response = await fetch(
        editingId ? `/api/admin/sites/${editingId}` : "/api/admin/sites",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json().catch(() => null)) as {
        error?: string;
        sites?: SiteRecord[];
      } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to save site.");
      }

      await refreshSites();
      resetDraft();
      setMessage(editingId ? "Site updated." : "Site added.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save site.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm("Remove this site?")) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/sites/${id}`, {
        method: "DELETE",
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
        sites?: SiteRecord[];
      } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to remove site.");
      }

      await refreshSites();
      if (editingId === id) {
        resetDraft();
      }
      setMessage("Site removed.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove site.");
    } finally {
      setBusy(false);
    }
  }

  const title = isAdminPage ? "Admin" : "Sites";
  const subtitle = isAdminPage
    ? "Passcode locked CRUD for the site list."
    : "Community websites for IIIT Hyderabad.";

  return (
    <div className="min-h-screen bg-[#0b0f14] text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <a href="/" className="text-lg font-semibold tracking-tight text-white">
              IIIT-H Online
            </a>
          </div>

          <nav className="flex items-center gap-2 text-sm">
            <a
              href="/admin"
              aria-label="Admin"
              title="Admin"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition ${
                isAdminPage ? "bg-white/5 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Lock className="h-4 w-4" />
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">{title}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{subtitle}</h1>
              {isAdminPage ? (
                <p className="mt-4 text-sm leading-6 text-slate-400">
                </p>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  A listing of community websites related to IIIT-H Online. If you want your website to be featured here, please post in the community at{" "}
                  <a
                    href="https://github.com/iiith-online"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Github
                  </a>
                  .
                </p>
              )}
            </div>

            {isAdminPage && adminStatus.authenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                disabled={busy}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Logout
              </button>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        {!isAdminPage ? (
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                Loading sites...
              </div>
            ) : sites.length > 0 ? (
              sites.map((site) => <SiteCard key={site.id} site={site} />)
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                No sites yet.
              </div>
            )}
          </section>
        ) : (
          <section className="mt-8 space-y-6">
            {/* {!adminStatus.configured ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300">
                Admin passcode is not configured.
              </div>
            ) : null} */}

            {!adminStatus.authenticated ? (
              <form onSubmit={handleLogin} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <label className="block">
                  <span className="text-sm font-medium text-white">Passcode</span>
                  <input
                    type="password"
                    value={passcode}
                    onChange={(event) => setPasscode(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-white/20"
                    placeholder="Enter passcode"
                  />
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Lock className="h-4 w-4" />
                  Unlock
                </button>
              </form>
            ) : (
              <>
                <form onSubmit={handleSave} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="grid gap-4">
                    <label className="block">
                      <span className="text-sm font-medium text-white">URL</span>
                      <input
                        type="url"
                        value={draft.url}
                        onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-white/20"
                        placeholder="https://example.com"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-white">Title</span>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-white/20"
                        placeholder="Leave blank to use metadata"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-white">Description</span>
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, description: event.target.value }))
                        }
                        className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-white/20"
                        placeholder="Leave blank to use metadata"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" />
                      {editingId ? "Update site" : "Add site"}
                    </button>
                    {editingId ? (
                      <button
                        type="button"
                        onClick={resetDraft}
                        className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/5"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Sites</h2>
                    <p className="text-xs text-slate-500">{sites.length} total</p>
                  </div>

                  {loading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                      Loading sites...
                    </div>
                  ) : sites.length > 0 ? (
                    sites.map((site) => (
                      <SiteRow key={site.id} site={site} onEdit={beginEdit} onRemove={handleRemove} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400">
                      No sites stored yet.
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-500">
          IIIT-H Online by the Community, for the Community. Hosted on Vercel. Source code available on{" "}
          <a
            href="https://github.com/iiith-online"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            Source Code
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
