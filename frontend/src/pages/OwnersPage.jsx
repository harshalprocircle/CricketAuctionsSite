import React, { useEffect, useState, useCallback, useRef } from "react";
import { api, formatPts } from "@/lib/api";
import { SmartImage } from "@/components/SmartImage";
import { TEAM_FALLBACK, PLAYER_FALLBACK } from "@/lib/driveLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Upload, Edit2, Trash2, Settings as SettingsIcon, RotateCcw, Trash } from "lucide-react";

const empty = { name: "", team_name: "", photo_url: "" };

export default function OwnersPage() {
    const [owners, setOwners] = useState([]);
    const [players, setPlayers] = useState([]);
    const [settings, setSettings] = useState(null);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(empty);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [budgetInput, setBudgetInput] = useState("");
    const [nameInput, setNameInput] = useState("");
    const fileInputRef = useRef();

    const load = useCallback(async () => {
        const [o, p, s] = await Promise.all([api.listOwners(), api.listPlayers(), api.getSettings()]);
        setOwners(o); setPlayers(p); setSettings(s);
        setBudgetInput(String(s.starting_budget));
        setNameInput(s.tournament_name);
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
    const openEdit = (o) => { setEditing(o); setForm({ name: o.name, team_name: o.team_name, photo_url: o.photo_url || "" }); setOpen(true); };

    const save = async () => {
        if (!form.name || !form.team_name) { toast.error("Name & Team are required"); return; }
        try {
            if (editing) await api.updateOwner(editing.id, form);
            else await api.createOwner(form);
            toast.success(editing ? "Owner updated" : "Owner added");
            setOpen(false);
            load();
        } catch (e) { toast.error(e.response?.data?.detail || "Save failed"); }
    };

    const remove = async (o) => {
        if (!window.confirm(`Delete ${o.team_name}? Their players will be released back to the unsold pool.`)) return;
        await api.deleteOwner(o.id);
        toast.success("Owner deleted");
        load();
    };

    const handleCsv = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
            const res = await api.importOwners(f);
            toast.success(`Imported ${res.created} owners${res.skipped ? ` (${res.skipped} skipped)` : ""}`);
            load();
        } catch (e2) { toast.error("Import failed"); }
        e.target.value = "";
    };

    const saveSettings = async () => {
        const b = parseInt(budgetInput, 10);
        if (!b || b <= 0) { toast.error("Budget must be positive"); return; }
        await api.updateSettings({ starting_budget: b, tournament_name: nameInput });
        toast.success("Settings updated");
        setSettingsOpen(false);
        load();
    };

    const resetAuction = async () => {
        if (!window.confirm("Reset auction? This clears all sales & transactions. Players & owners remain.")) return;
        await api.resetAuction();
        toast.success("Auction reset");
        load();
    };

    return (
        <div className="space-y-6" data-testid="owners-page">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="font-display text-5xl tracking-wider">OWNERS & TEAMS</h1>
                    <p className="text-white/50 text-sm tracking-wide">Manage team owners, photos & budgets.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" className="bg-white/5 border border-white/10 hover:bg-white/10 font-display tracking-widest"
                        onClick={() => setSettingsOpen(true)} data-testid="open-settings-btn">
                        <SettingsIcon className="w-4 h-4 mr-1.5" /> SETTINGS
                    </Button>
                    <Button variant="secondary" className="bg-white/5 border border-white/10 hover:bg-white/10 font-display tracking-widest"
                        onClick={resetAuction} data-testid="reset-auction-btn">
                        <RotateCcw className="w-4 h-4 mr-1.5" /> RESET AUCTION
                    </Button>
                    <Button variant="secondary" className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20 font-display tracking-widest"
                        onClick={deleteAll} data-testid="delete-all-owners-btn">
                        <Trash className="w-4 h-4 mr-1.5" /> DELETE ALL
                    </Button>
                    <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleCsv} data-testid="owners-csv-input" />
                    <Button variant="secondary" className="bg-white/5 border border-white/10 hover:bg-white/10 font-display tracking-widest"
                        onClick={() => fileInputRef.current.click()} data-testid="import-owners-btn">
                        <Upload className="w-4 h-4 mr-1.5" /> IMPORT CSV
                    </Button>
                    <Button className="bg-[#EAB308] text-black hover:bg-[#FACC15] font-display tracking-widest"
                        onClick={openCreate} data-testid="add-owner-btn">
                        <Plus className="w-4 h-4 mr-1.5" /> ADD OWNER
                    </Button>
                </div>
            </div>

            {owners.length === 0 ? (
                <div className="border border-dashed border-white/15 rounded-2xl p-14 text-center text-white/60">
                    <div className="font-display text-2xl tracking-wider">NO OWNERS YET</div>
                    <p className="text-sm mt-2">Add owners manually or upload a CSV with columns: <span className="font-mono">name, team_name, photo_url</span></p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {owners.map(o => {
                        const roster = players.filter(p => p.owner_id === o.id);
                        const pct = o.starting_budget ? (o.remaining / o.starting_budget) * 100 : 0;
                        const barColor = pct > 50 ? "bg-[#22C55E]" : pct > 20 ? "bg-[#EAB308]" : "bg-[#EF4444]";
                        return (
                            <div key={o.id} className="rounded-2xl border border-white/10 bg-[#121212] overflow-hidden" data-testid={`owner-card-${o.id}`}>
                                <div className="relative h-32">
                                    <SmartImage src={o.photo_url} alt={o.team_name} fallback={TEAM_FALLBACK}
                                        className="w-full h-full object-cover opacity-60" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent"></div>
                                    <div className="absolute bottom-3 left-4">
                                        <div className="font-display text-3xl tracking-wide">{o.team_name}</div>
                                        <div className="text-xs text-white/70">{o.name}</div>
                                    </div>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-white/5 rounded-md py-2">
                                            <div className="text-[9px] tracking-widest text-white/40">BUDGET</div>
                                            <div className="font-display text-lg">{formatPts(o.starting_budget)}</div>
                                        </div>
                                        <div className="bg-white/5 rounded-md py-2">
                                            <div className="text-[9px] tracking-widest text-white/40">SPENT</div>
                                            <div className="font-display text-lg text-[#EF4444]">{formatPts(o.spent)}</div>
                                        </div>
                                        <div className="bg-white/5 rounded-md py-2">
                                            <div className="text-[9px] tracking-widest text-white/40">LEFT</div>
                                            <div className="font-display text-lg text-[#22C55E]">{formatPts(o.remaining)}</div>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                                        <div className={`h-full ${barColor}`} style={{ width: `${Math.max(0, pct)}%` }}></div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] tracking-widest text-white/40 mb-1.5">ROSTER ({roster.length})</div>
                                        {roster.length === 0 ? (
                                            <div className="text-xs text-white/40 italic">No players bought yet</div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {roster.map(p => (
                                                    <div key={p.id} className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full pl-1 pr-3 py-1">
                                                        <SmartImage src={p.photo_url} alt={p.name} fallback={PLAYER_FALLBACK}
                                                            className="w-6 h-6 rounded-full object-cover" />
                                                        <span className="text-xs">{p.name}</span>
                                                        <span className="text-[10px] font-mono text-[#EAB308]">{formatPts(p.sold_price)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <Button size="sm" variant="secondary" className="bg-white/5 border border-white/10 hover:bg-white/10 flex-1"
                                            onClick={() => openEdit(o)} data-testid={`edit-owner-${o.id}`}>
                                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                                        </Button>
                                        <Button size="sm" variant="secondary" className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20"
                                            onClick={() => remove(o)} data-testid={`delete-owner-${o.id}`}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Owner form dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="bg-[#121212] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="font-display text-2xl tracking-widest">
                            {editing ? "EDIT OWNER" : "NEW OWNER"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs tracking-[0.2em] text-white/60">OWNER NAME</label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                className="bg-black/40 border-white/15 mt-1" data-testid="owner-name-input" />
                        </div>
                        <div>
                            <label className="text-xs tracking-[0.2em] text-white/60">TEAM NAME</label>
                            <Input value={form.team_name} onChange={e => setForm({ ...form, team_name: e.target.value })}
                                className="bg-black/40 border-white/15 mt-1" data-testid="owner-team-input" />
                        </div>
                        <div>
                            <label className="text-xs tracking-[0.2em] text-white/60">TEAM LOGO — GOOGLE DRIVE LINK</label>
                            <Input value={form.photo_url} onChange={e => setForm({ ...form, photo_url: e.target.value })}
                                placeholder="https://drive.google.com/file/d/FILE_ID/view"
                                className="bg-black/40 border-white/15 mt-1" data-testid="owner-photo-input" />
                            <p className="text-[10px] text-white/40 mt-1">Paste a shareable Drive link — we'll convert it automatically.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} className="text-white/70">Cancel</Button>
                        <Button onClick={save} className="bg-[#EAB308] text-black hover:bg-[#FACC15] font-display tracking-widest"
                            data-testid="save-owner-btn">SAVE</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Settings dialog */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="bg-[#121212] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="font-display text-2xl tracking-widest">TOURNAMENT SETTINGS</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs tracking-[0.2em] text-white/60">TOURNAMENT NAME</label>
                            <Input value={nameInput} onChange={e => setNameInput(e.target.value)}
                                className="bg-black/40 border-white/15 mt-1" data-testid="settings-name-input" />
                        </div>
                        <div>
                            <label className="text-xs tracking-[0.2em] text-white/60">STARTING BUDGET PER OWNER (POINTS)</label>
                            <Input type="number" min={1} value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
                                className="bg-black/40 border-white/15 mt-1 font-display text-xl" data-testid="settings-budget-input" />
                            <p className="text-[10px] text-white/40 mt-1">Applies to all owners. Default: 10,000.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSettingsOpen(false)} className="text-white/70">Cancel</Button>
                        <Button onClick={saveSettings} className="bg-[#EAB308] text-black hover:bg-[#FACC15] font-display tracking-widest"
                            data-testid="save-settings-btn">SAVE</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
