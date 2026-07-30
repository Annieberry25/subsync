'use client';

interface ServiceIconProps {
  name: string;
  category?: string;
  className?: string;
}

function getProviderInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '??';

  const words = trimmed.split(/[\s\-_]+/).filter(Boolean);

  if (words.length >= 2) {
    if (words.length >= 3) {
      return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  const clean = trimmed.replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length >= 2) {
    return clean.slice(0, 2).toUpperCase();
  }
  return clean.toUpperCase() || trimmed.slice(0, 2).toUpperCase();
}

export function ServiceIcon({ name, category, className = 'w-9 h-9' }: ServiceIconProps) {
  const norm = name.toLowerCase().trim();

  // 1. Netflix (Preserved 100% exactly as requested)
  if (norm.includes('netflix')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-red-600 to-rose-950 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-red-500/20`}>
        <span className="text-xs font-black tracking-tighter text-red-100">N</span>
      </div>
    );
  }

  // 2. Spotify
  if (norm.includes('spotify')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-emerald-500 to-teal-800 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-emerald-400/20`}>
        <span className="text-xs font-bold text-emerald-100">♪</span>
      </div>
    );
  }

  // 3. YouTube / YouTube Premium / YT
  if (norm.includes('youtube') || norm.includes('yt')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-red-500 to-rose-800 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-red-400/20`}>
        <span className="text-[10px] font-black tracking-tighter text-white">▶</span>
      </div>
    );
  }

  // 4. Disney+ / Disney
  if (norm.includes('disney')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-blue-700 via-indigo-900 to-slate-950 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-blue-400/20`}>
        <span className="text-[10px] font-extrabold tracking-tighter text-blue-200">D+</span>
      </div>
    );
  }

  // 5. Adobe / Creative Cloud
  if (norm.includes('adobe') || norm.includes('creative cloud')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-red-600 to-rose-900 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-red-500/20`}>
        <span className="text-xs font-black text-red-100">A</span>
      </div>
    );
  }

  // 6. ChatGPT / OpenAI / GPT
  if (norm.includes('chatgpt') || norm.includes('openai') || norm.includes('gpt')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-teal-600 to-emerald-950 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-teal-400/20 p-2`}>
        <svg className="w-5 h-5 fill-teal-100 shrink-0" viewBox="0 0 24 24" aria-label="OpenAI">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 1 .3927.6813v6.7369l-2.02-1.1686a.071.071 0 0 1-.038-.052v-5.5826zm-1.1786-8.9839a4.4708 4.4708 0 0 1 2.3418-1.9729v5.682a.7948.7948 0 0 0 .3927.6813l5.8349 3.3685-2.02 1.1686a.071.071 0 0 1-.076 0l-4.8398-2.7961a4.504 4.504 0 0 1-1.6336-6.131zm16.1417 4.9605l-5.8349-3.3685 2.02-1.1686a.071.071 0 0 1 .076 0l4.8398 2.7961a4.504 4.504 0 0 1 1.6336 6.131 4.4708 4.4708 0 0 1-2.3418 1.9729v-5.682a.7948.7948 0 0 0-.3927-.6813zm2.022-3.155a4.4708 4.4708 0 0 1 .5346 3.0137l-.142-.0852-4.783-2.7582a.7712.7712 0 0 1-.3927-.6813V2.946l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826zm-11.4589-7.3015a4.4755 4.4755 0 0 1 2.8764 1.0408l-.1419.0804-4.7783 2.7582a.7948.7948 0 0 0-.3927.6813v6.7369l-2.02-1.1686a.071.071 0 0 1-.038-.052V6.6713a4.504 4.504 0 0 1 4.4945-4.4944z" />
        </svg>
      </div>
    );
  }

  // 7. Amazon / Prime / AWS
  if (norm.includes('amazon') || norm.includes('prime') || norm.includes('aws')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 text-amber-400 font-black flex items-center justify-center shadow-sm shrink-0 border border-sky-500/20 p-2`}>
        <svg className="w-5 h-5 fill-amber-400 shrink-0" viewBox="0 0 24 24" aria-label="Amazon Prime">
          <path d="M13.94 11.07c-1.3.12-2.3.38-3 .78-.7.4-1.05.97-1.05 1.7 0 .61.23 1.1.7 1.45.46.36 1.07.54 1.83.54.88 0 1.63-.3 2.25-.9.62-.6.93-1.34.93-2.22v-1.35h-1.66zm6.34 7.64c-.23.2-.56.24-.8.07l-2.3-1.64c-.38-.27-.32-.66.11-.84 1.25-.5 2.8-1.57 2.8-3.05 0-1.85-1.5-2.75-3.37-2.75-2.2 0-4.04.9-4.04 2.85 0 1.25.75 2.1 1.94 2.1.84 0 1.5-.37 2.05-.98v.78c0 1.27-.72 1.94-1.9 1.94-.96 0-1.78-.44-2.12-1.15-.12-.25-.33-.35-.55-.26l-2.14.96c-.22.1-.3.35-.18.6 1.03 2.02 3.1 3.03 5.4 3.03 2.83 0 5.15-1.42 5.15-4.52 0-2.33-1.6-3.65-4.1-3.65-1.5 0-2.9.5-3.8 1.4V6.26h-3.4v1.85h1.75v8.5H9.55v-1.8c-.8.8-1.85 1.2-3.1 1.2-1.6 0-2.8-.52-3.6-1.56-.8-1.04-1.2-2.38-1.2-4 0-1.66.44-3.03 1.3-4.1.88-1.08 2.1-1.62 3.7-1.62 1.2 0 2.2.37 3 1.1V6.26h3.4V2.1H9.6v1.8h1.7v3.2c-.85-.8-1.95-1.2-3.3-1.2-2.1 0-3.8.74-5.1 2.22C1.6 9.6 1 11.55 1 13.9c0 2.3.6 4.2 1.8 5.67 1.2 1.48 2.9 2.22 5.1 2.22 1.5 0 2.8-.45 3.9-1.35v1.2c0 1.4-.38 2.45-1.14 3.15-.76.7-1.86 1.05-3.3 1.05-1.1 0-2.15-.22-3.13-.67-.25-.12-.5 0-.62.24l-.86 1.7c-.1.22-.03.5.2.62 1.37.7 2.84 1.05 4.4 1.05 2.5 0 4.45-.63 5.86-1.9 1.4-1.26 2.1-3.1 2.1-5.5V11.2h2.25c.3 0 .5-.2.5-.5V8.86c0-.3-.2-.5-.5-.5h-2.25V4.6h3.4v1.85h-1.75v4.26h.04z" />
        </svg>
      </div>
    );
  }

  // 8. Apple Music
  if (norm.includes('apple music')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-rose-500 to-pink-700 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-rose-400/20`}>
        <span className="text-xs font-black text-rose-100">♫</span>
      </div>
    );
  }

  // 9. Apple / iCloud / iCloud+
  if (norm.includes('apple') || norm.includes('icloud')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-slate-800 to-zinc-950 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-slate-700`}>
        <span className="text-[10px] font-bold text-slate-200">☁</span>
      </div>
    );
  }

  // 10. Microsoft 365 / Office / Microsoft
  if (norm.includes('microsoft') || norm.includes('m365') || norm.includes('office 365')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-sky-600 to-indigo-900 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-sky-400/20`}>
        <span className="text-[10px] font-extrabold text-sky-100">M365</span>
      </div>
    );
  }

  // 11. Google One / Google
  if (norm.includes('google')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-emerald-600 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-blue-400/20`}>
        <span className="text-xs font-black text-blue-100">G</span>
      </div>
    );
  }

  // 12. Canva
  if (norm.includes('canva')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-cyan-500 to-teal-700 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-cyan-400/20`}>
        <span className="text-[10px] font-black italic text-cyan-100">Canva</span>
      </div>
    );
  }

  // 13. Notion
  if (norm.includes('notion')) {
    return (
      <div className={`${className} rounded-xl bg-env-button-sec text-env-heading border border-env-subtle font-black flex items-center justify-center shadow-sm shrink-0`}>
        <span className="text-xs font-black text-env-heading">N</span>
      </div>
    );
  }

  // 14. Figma
  if (norm.includes('figma')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-purple-600 via-rose-500 to-amber-500 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-purple-400/20`}>
        <span className="text-xs font-black text-white">F</span>
      </div>
    );
  }

  // 15. Dropbox
  if (norm.includes('dropbox')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-blue-400/20`}>
        <span className="text-xs font-black text-blue-100">📦</span>
      </div>
    );
  }

  // 16. GitHub / Copilot
  if (norm.includes('github') || norm.includes('copilot')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-zinc-900 to-slate-950 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-zinc-700`}>
        <span className="text-[10px] font-bold text-zinc-100">GH</span>
      </div>
    );
  }

  // 17. Hulu
  if (norm.includes('hulu')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-emerald-500 to-green-900 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-emerald-400/20`}>
        <span className="text-[10px] font-black text-emerald-100">hulu</span>
      </div>
    );
  }

  // 18. HBO / Max
  if (norm.includes('hbo') || norm.includes('max')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-purple-700 to-indigo-950 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-purple-400/20`}>
        <span className="text-[10px] font-black text-purple-100">MAX</span>
      </div>
    );
  }

  // 19. Slack
  if (norm.includes('slack')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-fuchsia-700 to-purple-950 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-fuchsia-400/20`}>
        <span className="text-xs font-black text-fuchsia-100">#</span>
      </div>
    );
  }

  // 20. Zoom
  if (norm.includes('zoom')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-blue-400/20`}>
        <span className="text-[10px] font-extrabold text-blue-100">zoom</span>
      </div>
    );
  }

  // 21. LinkedIn
  if (norm.includes('linkedin')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-blue-700 to-sky-900 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-blue-400/20`}>
        <span className="text-xs font-black text-blue-100">in</span>
      </div>
    );
  }

  // 22. PlayStation / PS
  if (norm.includes('playstation') || norm.includes('ps5') || norm.includes('ps4')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-blue-700 to-indigo-950 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-blue-400/20`}>
        <span className="text-[10px] font-black text-blue-100">PS</span>
      </div>
    );
  }

  // 23. Xbox
  if (norm.includes('xbox')) {
    return (
      <div className={`${className} rounded-xl bg-gradient-to-br from-emerald-600 to-green-950 text-white font-black flex items-center justify-center shadow-sm shrink-0 border border-emerald-400/20`}>
        <span className="text-[10px] font-black text-emerald-100">XBOX</span>
      </div>
    );
  }

  // Fallback: Intelligent Initials for Unknown or Custom Providers (e.g. "GM" for Gym Membership, "NYT" for New York Times)
  const initials = getProviderInitials(name);
  const categoryGradients: Record<string, string> = {
    Streaming: 'from-purple-600/90 to-indigo-950 border-purple-500/30 text-purple-100',
    Software: 'from-indigo-600/90 to-blue-950 border-indigo-500/30 text-indigo-100',
    Utilities: 'from-amber-600/90 to-orange-950 border-amber-500/30 text-amber-100',
    Fitness: 'from-emerald-600/90 to-teal-950 border-emerald-500/30 text-emerald-100',
    Finance: 'from-teal-600/90 to-emerald-950 border-teal-500/30 text-teal-100',
    Education: 'from-blue-600/90 to-indigo-950 border-blue-500/30 text-blue-100',
    Gaming: 'from-rose-600/90 to-red-950 border-rose-500/30 text-rose-100',
    Other: 'from-slate-700 to-zinc-900 border-zinc-600/30 text-zinc-100',
  };

  const gradient = category ? categoryGradients[category] || categoryGradients.Other : categoryGradients.Other;

  return (
    <div className={`${className} rounded-xl bg-gradient-to-br ${gradient} border flex items-center justify-center font-black shadow-sm shrink-0`}>
      <span className="font-black text-xs tracking-tight">{initials}</span>
    </div>
  );
}
