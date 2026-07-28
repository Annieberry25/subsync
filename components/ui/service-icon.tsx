'use client';

import { 
  Tv, 
  Music, 
  Code2, 
  Bot, 
  Video, 
  Cloud, 
  Flame, 
  PenTool, 
  FileText, 
  ShieldAlert, 
  CreditCard,
  Sparkles,
  Layers,
  Globe
} from 'lucide-react';

interface ServiceIconProps {
  name: string;
  category?: string;
  className?: string;
}

export function ServiceIcon({ name, category, className = 'w-11 h-11' }: ServiceIconProps) {
  const normalizedName = name.toLowerCase().trim();

  // Known brand patterns
  if (normalizedName.includes('netflix')) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br from-red-600 to-rose-900 border border-red-500/30 flex items-center justify-center text-white font-black shadow-md shadow-red-600/20 shrink-0`}>
        <Tv className="w-5 h-5 text-white" />
      </div>
    );
  }

  if (normalizedName.includes('spotify')) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-900 border border-emerald-400/30 flex items-center justify-center text-white font-black shadow-md shadow-emerald-500/20 shrink-0`}>
        <Music className="w-5 h-5 text-white" />
      </div>
    );
  }

  if (normalizedName.includes('github') || normalizedName.includes('copilot')) {
    return (
      <div className={`${className} rounded-2xl bg-env-button-sec border border-env-main flex items-center justify-center text-env-heading font-black shadow-md shrink-0`}>
        <Code2 className="w-5 h-5 text-env-heading" />
      </div>
    );
  }

  if (normalizedName.includes('chatgpt') || normalizedName.includes('openai') || normalizedName.includes('gpt')) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-800 border border-teal-400/30 flex items-center justify-center text-white font-black shadow-md shadow-teal-500/20 shrink-0`}>
        <Bot className="w-5 h-5 text-white" />
      </div>
    );
  }

  if (normalizedName.includes('youtube') || normalizedName.includes('yt')) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br from-red-500 to-rose-800 border border-rose-400/30 flex items-center justify-center text-white font-black shadow-md shadow-red-500/20 shrink-0`}>
        <Video className="w-5 h-5 text-white" />
      </div>
    );
  }

  if (normalizedName.includes('figma')) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br from-purple-500 via-rose-500 to-amber-500 border border-purple-400/30 flex items-center justify-center text-white font-black shadow-md shrink-0`}>
        <PenTool className="w-5 h-5 text-white" />
      </div>
    );
  }

  if (normalizedName.includes('notion')) {
    return (
      <div className={`${className} rounded-2xl bg-env-button-sec border border-env-main flex items-center justify-center text-env-heading font-black shadow-md shrink-0`}>
        <FileText className="w-5 h-5 text-env-heading" />
      </div>
    );
  }

  if (normalizedName.includes('aws') || normalizedName.includes('amazon')) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br from-amber-500 to-orange-800 border border-amber-400/30 flex items-center justify-center text-white font-black shadow-md shadow-amber-500/20 shrink-0`}>
        <Cloud className="w-5 h-5 text-white" />
      </div>
    );
  }

  if (normalizedName.includes('adobe') || normalizedName.includes('creative cloud')) {
    return (
      <div className={`${className} rounded-2xl bg-gradient-to-br from-rose-600 to-red-900 border border-rose-500/30 flex items-center justify-center text-white font-black shadow-md shadow-rose-600/20 shrink-0`}>
        <Flame className="w-5 h-5 text-white" />
      </div>
    );
  }

  if (normalizedName.includes('apple') || normalizedName.includes('icould') || normalizedName.includes('apple music')) {
    return (
      <div className={`${className} rounded-2xl bg-env-button-sec border border-env-main flex items-center justify-center text-env-heading font-black shadow-md shrink-0`}>
        <Globe className="w-5 h-5 text-env-heading" />
      </div>
    );
  }

  // Fallback icon based on Category
  const categoryGradients: Record<string, { bg: string; icon: any }> = {
    Streaming: { bg: 'from-purple-600 to-indigo-900 border-purple-500/30 text-purple-200', icon: Tv },
    Software: { bg: 'from-indigo-600 to-blue-900 border-indigo-500/30 text-indigo-200', icon: Layers },
    Utilities: { bg: 'from-amber-600 to-orange-900 border-amber-500/30 text-amber-200', icon: Cloud },
    Fitness: { bg: 'from-emerald-600 to-teal-900 border-emerald-500/30 text-emerald-200', icon: Sparkles },
    Finance: { bg: 'from-teal-600 to-emerald-950 border-teal-500/30 text-teal-200', icon: CreditCard },
    Education: { bg: 'from-blue-600 to-indigo-900 border-blue-500/30 text-blue-200', icon: FileText },
    Gaming: { bg: 'from-rose-600 to-red-950 border-rose-500/30 text-rose-200', icon: ShieldAlert },
    Other: { bg: 'from-env-badge to-env-button-sec border-env-main text-env-heading', icon: Layers },
  };

  const style = category ? categoryGradients[category] || categoryGradients.Other : categoryGradients.Other;

  return (
    <div className={`${className} rounded-2xl bg-gradient-to-br ${style.bg} border flex items-center justify-center font-black text-sm tracking-wider uppercase shadow-md shrink-0`}>
      <span className="text-env-heading font-black text-sm">{name.slice(0, 2)}</span>
    </div>
  );
}
