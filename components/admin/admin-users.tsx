'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, ShieldCheck, ShieldOff, Gem } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import type { AdminUserDetail, AdminUserRow } from '@/lib/types/admin.types';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/contexts/user-settings-context';
import { LoadingState, ErrorState, EmptyState, PlanBadge, StatusBadge, formatMoney, formatDateTime } from '@/components/admin/admin-ui';

export default function AdminUsersTab() {
  const { toast } = useToast();
  const { email: myEmail } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [grantTarget, setGrantTarget] = useState<AdminUserRow | null>(null);
  const [grantTier, setGrantTier] = useState<'plus' | 'premium'>('plus');
  const [grantDays, setGrantDays] = useState(30);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (q = '', isNewSearch = false) => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load users.');
        return;
      }
      setError(null);
      if (isNewSearch) setSearch(q);
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to load user detail.', 'Admin');
      } else {
        setDetail(data as AdminUserDetail);
      }
    } catch {
      toast.error('Failed to load user detail.', 'Admin');
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleRole = async (user: AdminUserRow) => {
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin: !user.is_admin }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to update role.', 'Admin');
      } else {
        toast.success(user.is_admin ? 'Admin privileges removed.' : 'Admin privileges granted.', 'Admin');
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_admin: !user.is_admin } : u)));
        if (detail?.profile.id === user.id) {
          setDetail({ ...detail, profile: { ...detail.profile, is_admin: !user.is_admin } });
        }
      }
    } catch {
      toast.error('Failed to update role.', 'Admin');
    } finally {
      setBusyId(null);
    }
  };

  const applyGrant = async () => {
    if (!grantTarget) return;
    setBusyId(grantTarget.id);
    try {
      const res = await fetch(`/api/admin/users/${grantTarget.id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'grant', tier: grantTier, days: grantDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to grant plan.', 'Admin');
        return;
      }
      toast.success(`${grantTarget.email} granted ${grantTier} (${grantDays} days).`, 'Plan Granted');
      setGrantTarget(null);
      load(search, false);
    } catch {
      toast.error('Failed to grant plan.', 'Admin');
    } finally {
      setBusyId(null);
    }
  };

  const revokePlan = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || 'Failed to revoke plan.', 'Admin');
        return;
      }
      toast.success('Plan revoked; user downgraded to free.', 'Admin');
      load(search, false);
      if (detail?.profile.id === id) {
        setDetail({ ...detail, profile: { ...detail.profile, plan_tier: 'free', plan_expires_at: null } });
      }
    } catch {
      toast.error('Failed to revoke plan.', 'Admin');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(search, false);
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email…"
              className="w-full pl-9 pr-3 h-10 rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] text-xs text-[#F5F7F6] placeholder:text-[#5B6470] focus:outline-none focus:border-[#14B8A6]/50"
            />
          </form>
        </div>
        <span className="text-xs text-[#94A8B8]">{total.toLocaleString()} user{total === 1 ? '' : 's'}</span>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <LoadingState label="Loading users…" />
      ) : users.length === 0 ? (
        <EmptyState message="No users found." />
      ) : (
        <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] table-scroll">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-[#1A1D1D]">
              <tr className="text-[11px] uppercase tracking-wider text-[#94A3B8]">
                <th className="px-4 py-3 font-medium table-sticky-col">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1D1D]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#0D0F0F] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-[#F5F7F6] truncate max-w-[240px]">{u.email}</p>
                    <p className="text-[11px] text-[#94A3B8] truncate max-w-[240px]">{u.full_name || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <PlanBadge tier={u.plan_tier} />
                    {u.plan_expires_at ? (
                      <p className="text-[11px] text-[#94A3B8] mt-1">until {formatDateTime(u.plan_expires_at)}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${u.is_admin ? 'text-[#14B8A6]' : 'text-[#94A3B8]'}`}>
                      {u.is_admin ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      {u.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{formatDateTime(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openDetail(u.id)}
                        disabled={busyId === u.id}
                        className="px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-medium text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setGrantTarget(u)}
                        disabled={busyId === u.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-medium text-[#14B8A6] bg-[#14B8A6]/10 border border-[#14B8A6]/25 hover:bg-[#14B8A6]/20 transition-colors cursor-pointer"
                      >
                        <Gem className="w-3 h-3" />
                        Grant
                      </button>
                      {u.email !== myEmail ? (
                        <button
                          type="button"
                          onClick={() => toggleRole(u)}
                          disabled={busyId === u.id}
                          /* Names the row it acts on: the visible label only
                             says "Demote", which is ambiguous in a table of
                             dozens of identical buttons. */
                          aria-label={
                            u.is_admin
                              ? `Remove admin from ${u.email}`
                              : `Grant admin to ${u.email}`
                          }
                          className={`px-2.5 py-1.5 min-h-[44px] rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                            u.is_admin
                              ? 'text-[#F87171] border-[#F87171]/25 bg-[#F87171]/5 hover:bg-[#F87171]/15'
                              : 'text-[#94A3B8] border-[#1A1D1D] hover:text-[#F5F7F6] hover:bg-[#1A1D1D]'
                          }`}
                        >
                          {u.is_admin ? 'Demote' : 'Make admin'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        size="md"
        title={detail?.profile.email ?? ''}
        description={detail?.profile.full_name || 'No display name'}
      >
        {detail ? (
          detailLoading ? (
            <LoadingState label="Loading user detail…" />
          ) : (
            <div className="space-y-5 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] p-3">
                    <p className="text-[11px] text-[#94A3B8]">Plan</p>
                    <div className="mt-1 flex items-center gap-2">
                      <PlanBadge tier={detail.profile.plan_tier} />
                      {detail.profile.plan_expires_at ? (
                        <span className="text-[11px] text-[#94A3B8]">{formatDateTime(detail.profile.plan_expires_at)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] p-3">
                    <p className="text-[11px] text-[#94A3B8]">Subscriptions</p>
                    <p className="text-lg font-semibold text-[#F5F7F6]">
                      {detail.subscriptionCount} <span className="text-xs font-normal text-[#94A3B8]">({detail.activeSubscriptionCount} active)</span>
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#F5F7F6] mb-2">Plan History</p>
                  {detail.planSubscriptions.length === 0 ? (
                    <EmptyState message="No plan payments recorded." />
                  ) : (
                    <ul className="divide-y divide-[#1A1D1D] rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] px-3">
                      {detail.planSubscriptions.map((ps) => (
                        <li key={ps.id} className="py-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-[#F5F7F6] truncate">{ps.plan} · {ps.paystack_reference}</p>
                            <p className="text-[11px] text-[#94A3B8]">{formatDateTime(ps.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {ps.amount > 0 ? (
                              <span className="text-xs font-medium text-[#F5F7F6]">{formatMoney(ps.amount / 100, ps.currency)}</span>
                            ) : null}
                            <StatusBadge status={ps.status} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#F5F7F6] mb-2">Recent Activity</p>
                  {detail.recentActivity.length === 0 ? (
                    <EmptyState message="No activity recorded." />
                  ) : (
                    <ul className="divide-y divide-[#1A1D1D] rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] px-3">
                      {detail.recentActivity.slice(0, 8).map((a) => (
                        <li key={a.id} className="py-2.5">
                          <p className="text-xs text-[#F5F7F6]">{a.title}</p>
                          <p className="text-[11px] text-[#94A3B8]">{a.type} · {formatDateTime(a.timestamp)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {detail.profile.email !== myEmail ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => toggleRole({
                        id: detail.profile.id,
                        email: detail.profile.email,
                        full_name: detail.profile.full_name,
                        plan_tier: detail.profile.plan_tier,
                        plan_expires_at: detail.profile.plan_expires_at,
                        is_admin: detail.profile.is_admin,
                        created_at: detail.profile.created_at,
                      })}
                      disabled={busyId === detail.profile.id}
                      className={`flex-1 min-w-[140px] px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        detail.profile.is_admin
                          ? 'text-[#F87171] border-[#F87171]/25 bg-[#F87171]/5 hover:bg-[#F87171]/15'
                          : 'text-[#14B8A6] border-[#14B8A6]/25 bg-[#14B8A6]/10 hover:bg-[#14B8A6]/20'
                      }`}
                    >
                      {detail.profile.is_admin ? 'Remove admin role' : 'Grant admin role'}
                    </button>
                    <button
                      type="button"
                      onClick={() => revokePlan(detail.profile.id)}
                      disabled={busyId === detail.profile.id || detail.profile.plan_tier === 'free'}
                      className="flex-1 min-w-[140px] px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-[#94A3B8] border border-[#1A1D1D] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Revoke plan
                    </button>
                  </div>
                ) : null}
              </div>
            )
        ) : null}
      </Sheet>

      <Sheet
        open={Boolean(grantTarget)}
        onClose={() => setGrantTarget(null)}
        size="sm"
        title={`Grant plan — ${grantTarget?.email ?? ''}`}
        description="Creates a paid plan row and grants access immediately."
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGrantTarget(null)}
              className="flex-1 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium text-[#94A3B8] border border-[#1A1D1D] hover:text-[#F5F7F6] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyGrant}
              disabled={busyId === grantTarget?.id}
              className="flex-1 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-[#06090A] bg-[#14B8A6] hover:bg-[#0FA394] transition-colors cursor-pointer disabled:opacity-50"
            >
              {busyId === grantTarget?.id ? 'Granting…' : 'Grant plan'}
            </button>
          </div>
        }
      >
            <div className="space-y-4 pt-1">
              <div className="flex gap-2" role="group" aria-label="Plan tier">
                {(['plus', 'premium'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setGrantTier(tier)}
                    aria-pressed={grantTier === tier}
                    className={`flex-1 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold capitalize border transition-colors cursor-pointer ${
                      grantTier === tier
                        ? 'bg-[#14B8A6]/15 text-[#14B8A6] border-[#14B8A6]/40'
                        : 'text-[#94A3B8] border-[#1A1D1D] hover:text-[#F5F7F6]'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#94A3B8] mb-1.5">Duration (days)</label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={grantDays}
                  onChange={(e) => setGrantDays(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full h-11 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] px-3 text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]/50"
                />
              </div>
            </div>
      </Sheet>
    </div>
  );
}