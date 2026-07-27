import { Settings, User, Bell, Shield } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Settings</h2>
        <p className="text-xs text-zinc-400">Manage account preferences, security, and notification triggers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Profile Settings', desc: 'Update name, avatar, and default currency.', icon: User },
          { title: 'Notifications', desc: 'Configure renewal reminders & email alerts.', icon: Bell },
          { title: 'Security & RLS', desc: 'Manage password, sessions, and data privacy.', icon: Shield },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-indigo-400">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <p className="text-xs text-zinc-500 mt-1">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
