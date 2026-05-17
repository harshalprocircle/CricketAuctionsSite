import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { api, formatPts } from "@/lib/api";
import { SmartImage } from "@/components/SmartImage";
import { PLAYER_FALLBACK } from "@/lib/driveLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Upload, Edit2, Trash2, Gavel, Search, Trash } from "lucide-react";

const ROLES = ["Batsman", "Bowler", "All-Rounder", "Wicket-Keeper"];
const emptyForm = { name: "", role: "All-Rounder", base_price: 100, photo_url: "" };

const statusBadge = (s) => {
    if (s === "sold") return <Badge className="bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30 hover:bg-[#22C55E]/20">SOLD</Badge>;
    if (s === "current") return <Badge className="bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 hover:bg-[#3B82F6]/20">CURRENT</Badge>;
    return <Badge className="bg-white/5 text-white/70 border-white/10 hover:bg-white/10">UNSOLD</Badge>;
};

export default function PlayersPage() {
    const [players, setPlayers] = useState([]);
    const [owners, setOwners] = useState([]);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const fileInputRef = useRef();

    const load = useCallback(async () => {
        const [p, o] = await Promise.all([api.listPlayers(), api.listOwners()]);
        setPlayers(p); setOwners(o);
    }, []);

    useEffect(() => { load(); }, [load]);

    const ownerMap = useMemo(() => Object.fromEntries(owners.map(o => [o.id, o])), [owners]);

    const filtered = useMemo(() => {
        let list = players;
        if (filter !== "all") list = list.filter(p => p.status === filter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q));
        }
        return list;
    }, [players, filter, search]);

    const counts = useMemo(() => ({
        all: players.length,
        unsold: players.filter(p => p.status === "unsold").length,
        current: players.filter(p => p.status === "current").length,
        sold: players.filter(p => p.status === "sold").length,
    }), [players]);

    const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
    const openEdit = (p) => {
        setEditing(p);
        setForm({ name: p.name, role: p.role, base_price: p.base_price, photo_url: p.photo_url || "" });
        setOpen(true);
    };
    const save = async () => {
        if (!form.name) { toast.error("Player name required"); return; }
        const payload = { ...form, base_price: parseInt(form.base_price, 10) || 100 };
        try {
            if (editing) await api.updatePlayer(editing.id, payload);
            else await api.createPlayer(payload);
            toast.success(editing ? "Player updated" : "Player added");
            setOpen(false);
            load();
        } catch (e) { toast.error(e.response?.data?.detail || "Save failed"); }
    };
    const remove = async (p) => {
        if (!window.confirm(`Delete ${p.name}?`)) return;
        await api.deletePlayer(p.id);
        toast.success("Player deleted");
        load();
    };
    const putOnBlock = async (p) => {
        try {
            await api.setCurrent(p.id);
            toast.success(`${p.name} is now on the block`);
            load();
        } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    };
    const handleCsv = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
            const res = await api.importPlayers(f);
            toast.success(`Imported ${res.created} players${res.skipped ? ` (${res.skipped} skipped)` : ""}`);
            load();
        } catch (e2) { toast.error("Import failed"); }
        e.target.value = "";
    };

    const deleteAll = async () => {
        if (players.length === 0) { toast.info("No players to delete"); return; }
        if (!window.confirm(`Delete ALL ${players.length} players? All transactions will also be cleared. This cannot be undone.`)) return;
        if (!window.confirm("Are you absolutely sure? Click OK once more to confirm.")) return;
        const res = await api.deleteAllPlayers();
        toast.success(`Deleted ${res.deleted} players`);
        load();
    };

    return (
        <div className="space-y-6" data-testid="players-page">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="font-display text-5xl tracking-wider">PLAYERS ROSTER</h1>
                    <p className="text-white/50 text-sm tracking-wide">All players in the tournament. Filter by status.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleCsv} data-testid="players-csv-input" />
                    <Button variant="secondary" className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20 font-display tracking-widest"
                        onClick={deleteAll} data-testid="delete-all-players-btn">
                        <Trash className="w-4 h-4 mr-1.5" /> DELETE ALL
                    </Button>
                    <Button variant="secondary" className="bg-white/5 border border-white/10 hover:bg-white/10 font-display tracking-widest"
                        onClick={() => fileInputRef.current.click()} data-testid="import-players-btn">
                        <Upload className="w-4 h-4 mr-1.5" /> IMPORT CSV
                    </Button>
                    <Button className="bg-[#EAB308] text-black hover:bg-[#FACC15] font-display tracking-widest"
                        onClick={openCreate} data-testid="add-player-btn">
                        <Plus className="w-4 h-4 mr-1.5" /> ADD PLAYER
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <Tabs value={filter} onValueChange={setFilter}>
                    <TabsList className="bg-[#121212] border border-white/10">
                        <TabsTrigger value="all" data-testid="tab-all" className="font-display tracking-widest data-[state=active]:bg-[#EAB308] data-[state=active]:text-black">ALL · {counts.all}</TabsTrigger>
                        <TabsTrigger value="unsold" data-testid="tab-unsold" className="font-display tracking-widest data-[state=active]:bg-[#EAB308] data-[state=active]:text-black">UNSOLD · {counts.unsold}</TabsTrigger>
                        <TabsTrigger value="current" data-testid="tab-current" className="font-display tracking-widest data-[state=active]:bg-[#EAB308] data-[state=active]:text-black">CURRENT · {counts.current}</TabsTrigger>
                        <TabsTrigger value="sold" data-testid="tab-sold" className="font-display tracking-widest data-[state=active]:bg-[#EAB308] data-[state=active]:text-black">SOLD · {counts.sold}</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <Input placeholder="Search by name or role…" value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-[#121212] border-white/10" data-testid="players-search" />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="border border-dashed border-white/15 rounded-2xl p-14 text-center text-white/60">
                    <div className="font-display text-2xl tracking-wider">NO PLAYERS</div>
                    <p className="text-sm mt-2">Add players manually or upload a CSV with columns: <span className="font-mono">name, role, base_price, photo_url</span></p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filtered.map(p => (
                        <div key={p.id} className="rounded-2xl border border-white/10 bg-[#121212] overflow-hidden group hover:border-[#EAB308]/40 transition"
                            data-testid={`player-card-${p.id}`}>
                            <div className="aspect-[4/5] relative">
                                <SmartImage src={p.photo_url} alt={p.name} fallback={PLAYER_FALLBACK}
                                    className="w-full h-full object-cover" />
                                <div className="absolute inset-x-0 top-0 p-2 flex justify-between">
                                    {statusBadge(p.status)}
                                    <Badge className="bg-black/60 border-white/10 text-white">{p.role}</Badge>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/70 to-transparent">
                                    <div className="font-display text-xl tracking-wide truncate">{p.name}</div>
                                    {p.status === "sold" ? (
                                        <div className="flex items-baseline gap-2 mt-0.5">
                                            <span className="text-xs text-white/60 truncate">{ownerMap[p.owner_id]?.team_name || "—"}</span>
                                            <span className="ml-auto font-mono text-[#22C55E] text-sm">{formatPts(p.sold_price)}</span>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-white/60">Base: <span className="font-mono text-[#EAB308]">{formatPts(p.base_price)}</span></div>
                                    )}
                                </div>
                            </div>
                            <div className="p-2 flex gap-1.5">
                                {p.status !== "sold" && (
                                    <Button size="sm" className="flex-1 bg-[#EAB308] text-black hover:bg-[#FACC15] font-display tracking-widest text-[11px]"
                                        onClick={() => putOnBlock(p)} data-testid={`put-block-${p.id}`}>
                                        <Gavel className="w-3 h-3 mr-1" /> ON BLOCK
                                    </Button>
                                )}
                                <Button size="sm" variant="secondary" className="bg-white/5 border border-white/10 hover:bg-white/10"
                                    onClick={() => openEdit(p)} data-testid={`edit-player-${p.id}`}>
                                    <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="secondary" className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20"
                                    onClick={() => remove(p)} data-testid={`delete-player-${p.id}`}>
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="bg-[#121212] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="font-display text-2xl tracking-widest">{editing ? "EDIT PLAYER" : "NEW PLAYER"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs tracking-[0.2em] text-white/60">PLAYER NAME</label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                className="bg-black/40 border-white/15 mt-1" data-testid="player-name-input" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs tracking-[0.2em] text-white/60">ROLE</label>
                                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                                    <SelectTrigger className="bg-black/40 border-white/15 mt-1" data-testid="player-role-select">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#121212] border-white/10 text-white">
                                        {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs tracking-[0.2em] text-white/60">BASE PRICE</label>
                                <Input type="number" min={1} value={form.base_price}
                                    onChange={e => setForm({ ...form, base_price: e.target.value })}
                                    className="bg-black/40 border-white/15 mt-1 font-display text-xl" data-testid="player-base-input" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs tracking-[0.2em] text-white/60">PHOTO — GOOGLE DRIVE LINK</label>
                            <Input value={form.photo_url} onChange={e => setForm({ ...form, photo_url: e.target.value })}
                                placeholder="https://drive.google.com/file/d/FILE_ID/view"
                                className="bg-black/40 border-white/15 mt-1" data-testid="player-photo-input" />
                            <div className="flex items-start gap-3 mt-2">
                                {form.photo_url ? (
                                    <SmartImage src={form.photo_url} alt="Preview" fallback={PLAYER_FALLBACK}
                                        className="w-16 h-20 rounded-md object-cover border border-white/15" />
                                ) : null}
                                <p className="text-[10px] text-white/40 leading-relaxed">
                                    Paste a Drive share link — we convert it automatically.<br />
                                    <span className="text-[#EAB308]">Important:</span> in Drive, set sharing to <span className="text-white/70">"Anyone with the link → Viewer"</span>, otherwise Google blocks the image.
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} className="text-white/70">Cancel</Button>
                        <Button onClick={save} className="bg-[#EAB308] text-black hover:bg-[#FACC15] font-display tracking-widest"
                            data-testid="save-player-btn">SAVE</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
