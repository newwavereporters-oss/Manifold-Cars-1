import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Edit3,
  Flag,
  Loader2,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { missionService, type ServerMissionOverrideRow } from '../../services/missionService';

export const AdminMissionsView: React.FC = () => {
  const [rows, setRows] = useState<ServerMissionOverrideRow[]>([]);
  const [schemaNotApplied, setSchemaNotApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<'ALL' | 'NEAR' | 'FAR' | 'VERY_FAR'>('ALL');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<ServerMissionOverrideRow | null>(null);
  const [saving, setSaving] = useState(false);

  const loadMissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await missionService.adminListMissions();
      setRows(res.rows);
      setSchemaNotApplied(Boolean(res.schemaNotApplied));
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Unable to load game missions.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMissions();
  }, [loadMissions]);

  const handleToggleActive = async (row: ServerMissionOverrideRow) => {
    setBanner(null);
    try {
      await missionService.adminUpdateMission({
        missionId: row.id,
        isActive: !row.is_active,
      });
      setBanner({
        type: 'success',
        text: `Mission "${row.title}" is now ${!row.is_active ? 'active' : 'paused'}.`,
      });
      await loadMissions();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to toggle mission status.' });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setBanner(null);
    try {
      await missionService.adminUpdateMission({
        missionId: editing.id,
        isActive: editing.is_active,
        rewardCredits: Number(editing.reward_credits),
        rewardXp: Number(editing.reward_xp),
        timeLimitSeconds: Number(editing.time_limit_seconds),
        cooldownSeconds: Number(editing.cooldown_seconds),
        difficulty: editing.difficulty,
      });
      setBanner({ type: 'success', text: `Saved settings for "${editing.title}".` });
      setEditing(null);
      await loadMissions();
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to save mission updates.' });
    } finally {
      setSaving(false);
    }
  };

  const filtered =
    tierFilter === 'ALL' ? rows : rows.filter((r) => r.distance_category === tierFilter);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-[#EF233C] flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#071A2B]">
              Game World Missions &amp; Rewards Manager
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure rewards, XP, cooldowns, time limits, and active availability for all 12
              Lagos operations across Near, Far, and Very Far tiers.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadMissions()}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {schemaNotApplied && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Game Expansion SQL Migration Pending</p>
            <p className="mt-0.5">
              Apply <code className="font-mono font-bold">src/db/manifold-game-expansion-migration.sql</code> in
              Supabase SQL Editor to enable live server mission editing and persistence.
            </p>
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Tier Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(['ALL', 'NEAR', 'FAR', 'VERY_FAR'] as const).map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => setTierFilter(tier)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              tierFilter === tier
                ? 'bg-[#071A2B] text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tier.replace('_', ' ')} (
            {tier === 'ALL' ? rows.length : rows.filter((r) => r.distance_category === tier).length})
          </button>
        ))}
      </div>

      {/* Missions Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin text-[#EF233C]" />
            <span>Loading missions catalog...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-500">
            No server mission rows found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Mission</th>
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-4">Reward</th>
                  <th className="py-3 px-4">Timer / Cooldown</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900">{m.title}</div>
                      <div className="text-[11px] text-gray-400">{m.subtitle}</div>
                      {m.reward_badge && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          <Award className="w-3 h-3" />
                          <span>{m.reward_badge}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          m.distance_category === 'NEAR'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.distance_category === 'FAR'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {m.distance_category.replace('_', ' ')}
                      </span>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {m.distance_meters}m
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-800">{m.difficulty}</td>
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-amber-700">
                        +{m.reward_credits.toLocaleString()} MC
                      </div>
                      <div className="text-[10px] text-cyan-700 font-bold">+{m.reward_xp} XP</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div>Limit: {m.time_limit_seconds}s</div>
                      <div className="text-gray-400">Cooldown: {m.cooldown_seconds}s</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => void handleToggleActive(m)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase transition ${
                          m.is_active
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {m.is_active ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing({ ...m })}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900">{editing.title}</h3>
                <p className="text-[11px] text-gray-500">{editing.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Reward Credits (MC)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editing.reward_credits}
                    onChange={(e) =>
                      setEditing({ ...editing, reward_credits: Number(e.target.value) || 0 })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-gray-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Reward XP
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editing.reward_xp}
                    onChange={(e) =>
                      setEditing({ ...editing, reward_xp: Number(e.target.value) || 0 })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-gray-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Time Limit (Seconds)
                  </label>
                  <input
                    type="number"
                    min={20}
                    required
                    value={editing.time_limit_seconds}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        time_limit_seconds: Math.max(20, Number(e.target.value) || 60),
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-gray-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                    Cooldown (Seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editing.cooldown_seconds}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        cooldown_seconds: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-gray-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                  Difficulty
                </label>
                <select
                  value={editing.difficulty}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      difficulty: e.target.value as ServerMissionOverrideRow['difficulty'],
                    })
                  }
                  className="w-full h-9 px-3 rounded-xl border border-gray-200"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                  <option value="Expert">Expert</option>
                  <option value="Master">Master</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="missionActiveChk"
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                <label htmlFor="missionActiveChk" className="font-semibold text-gray-700">
                  Mission active for players in MANIFOLD World
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#EF233C] hover:bg-[#D90429] text-white font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
