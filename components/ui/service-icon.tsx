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

export function ServiceIcon({ name, className = 'w-10 h-10' }: ServiceIconProps) {
  const norm = name.toLowerCase().trim();

  // Special brand initial renderings using SubSync Design System tokens
  if (norm.includes('netflix')) {
    return (
      <div className={`${className} rounded-xl bg-[#0B0D11] border border-[#262A33] text-white flex items-center justify-center shrink-0`}>
        <span className="text-xs font-bold text-[#EF4444]">N</span>
      </div>
    );
  }

  if (norm.includes('spotify')) {
    return (
      <div className={`${className} rounded-xl bg-[#0B0D11] border border-[#262A33] text-white flex items-center justify-center shrink-0`}>
        <span className="text-xs font-bold text-[#22C55E]">♪</span>
      </div>
    );
  }

  if (norm.includes('youtube') || norm.includes('yt')) {
    return (
      <div className={`${className} rounded-xl bg-[#0B0D11] border border-[#262A33] text-white flex items-center justify-center shrink-0`}>
        <span className="text-[10px] font-bold text-[#EF4444]">▶</span>
      </div>
    );
  }

  if (norm.includes('chatgpt') || norm.includes('openai') || norm.includes('gpt')) {
    return (
      <div className={`${className} rounded-xl bg-[#0B0D11] border border-[#262A33] text-white flex items-center justify-center shrink-0`}>
        <span className="text-xs font-bold text-[#4F46E5]">AI</span>
      </div>
    );
  }

  const initials = getProviderInitials(name);

  return (
    <div className={`${className} rounded-xl bg-[#0B0D11] border border-[#262A33] text-white flex items-center justify-center shrink-0`}>
      <span className="font-semibold text-xs text-white">{initials}</span>
    </div>
  );
}
