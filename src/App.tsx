import "./index.css";
import { ExternalLink, Globe } from "lucide-react";
import iiithLogo from "./image.png";

const WEBSITES = [
  {
    name: "IIIT-H Days Since Disaster",
    url: "https://disaster.iiith.online/",
    description: "Tracking the days since the last major disaster at IIIT-H.",
    icon: <Globe className="w-6 h-6 mb-2 text-blue-500" />
  }
];

export function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2 py-1.5 rounded-lg shadow-sm border border-border/50">
              <img src={iiithLogo} alt="IIIT-H Logo" className="h-8 md:h-10 w-auto object-contain mix-blend-multiply" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Online</h1>
          </div>
          <nav>
            <a 
              href="https://github.com/iiith-online" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col items-center">
        <section className="w-full px-6 py-24 md:py-32 flex flex-col items-center text-center relative overflow-hidden">
          {/* Background decorative blob */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
          
          <div className="max-w-3xl space-y-6">
            <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight">
              For the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">community</span>,<br/>
              by the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">community</span>.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              A curated directory of community-built projects, tools, and websites for the IIIT Hyderabad community.
            </p>
          </div>
        </section>

        {/* Projects Grid */}
        <section className="w-full max-w-6xl px-6 pb-24">
          <div className="flex items-center gap-3 mb-8">
            <h3 className="text-2xl font-bold tracking-tight">Community Projects</h3>
            <div className="h-px flex-grow bg-border ml-4" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WEBSITES.map((site, index) => (
              <a
                key={index}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col justify-between p-6 bg-card border border-border rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                {/* Card highlight effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                
                <div className="relative z-10">
                  <div className="bg-blue-50 dark:bg-blue-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6 shadow-sm border border-blue-100 dark:border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                    {site.icon}
                  </div>
                  <h4 className="text-xl font-bold mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {site.name}
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {site.description}
                  </p>
                </div>
                <div className="mt-8 flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400 relative z-10">
                  Visit Project 
                  <ExternalLink className="ml-2 w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="container mx-auto px-6 py-8 flex flex-col items-center gap-6 text-sm text-muted-foreground text-center">
          <p className="max-w-2xl">
            <strong>Disclaimer:</strong> IIIT-H Online is an independent community initiative. We are not officially affiliated with, maintained by, or endorsed by the International Institute of Information Technology, Hyderabad (IIIT-H).
          </p>
          <div className="flex items-center justify-center w-full border-t border-border/50 pt-6">
            <p className="flex items-center justify-center gap-1">
              Made with <span className="text-red-500 animate-pulse">❤️</span> by the community
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
