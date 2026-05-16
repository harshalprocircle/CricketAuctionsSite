import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { api, formatPts } from "@/lib/api";
import { SmartImage } from "@/components/SmartImage";
import { PLAYER_FALLBACK, TEAM_FALLBACK } from "@/lib/driveLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Gavel, ChevronRight, Trophy, RefreshCw, Crown, Zap, Tag } from "lucide-react";

const POLL_MS = 2500;

const StatChip = ({ label, value, accent }) => (
    <div className="px-4 py-3 bg-white/5 rounded-lg border border-white/10">
        <div className="text-[10px] tracking-[0.25em] text-white/50">{label}</div>
        <div className={`font-display text-2xl ${accent || "text-white"}`}>{value}</div>
    </div>
);

export default function Dashboard() {
    const [settings, setSettings] = useState(null);
    const [owners, setOwners] = useState([]);
    const [players, setPlayers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sellOpen, setSellOpen] = useState(false);
    const [sellOwnerId, setSellOwnerId] = useState("");
    const [sellPrice, setSellPrice] = useState("");
    const lastTxIdRef = useRef(null);
    const [flashOwnerId, setFlashOwnerId] = useState(null);

    const loadAll = useCallback(async () => {
        try {
            const [s, o, p, st] = await Promise.all([
                api.getSettings(), api.listOwners(), api.listPlayers(), api.stats(),
            ]);
            setSettings(s); setOwners(o); setPlayers(p); setStats(st);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAll();
        const t = setInterval(loadAll, POLL_MS);
        return () => clearInterval(t);
    }, [loadAll]);

    const currentPlayer = useMemo(() => players.find(p => p.status === "current"), [players]);
    const unsold = useMemo(() => players.filter(p => p.status === "unsold"), [players]);
    const sortedOwners = useMemo(
        () => [...owners].sort((a, b) => b.spent - a.spent),
        [owners]
    );
    const topOwner = sortedOwners[0];

    const handleSell = async () => {
        if (!currentPlayer || !sellOwnerId || !sellPrice) {
            toast.error("Select an owner and enter sold price.");
            return;
        }
        try {
            const res = await api.sellPlayer(currentPlayer.id, {
                owner_id: sellOwnerId,
                sold_price: parseInt(sellPrice, 10),
            });
            toast.success(`SOLD! ${currentPlayer.name} → ${res.owner.team_name} for ${formatPts(res.transaction.amount)}`);
            lastTxIdRef.current = res.transaction.id;
            setFlashOwnerId(sellOwnerId);
            setTimeout(() => setFlashOwnerId(null), 1000);
            setSellOpen(false);
            setSellOwnerId("");
            setSellPrice("");
            loadAll();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Sale failed");
        }
    };

    const pickNextRandom = async () => {
        if (unsold.length === 0) {
            toast.info("No unsold players left.");
            return;
        }
        const pick = unsold[Math.floor(Math.random() * unsold.length)];
        await api.setCurrent(pick.id);
        toast.success(`UP NEXT: ${pick.name}`);
        loadAll();
    };

    const markUnsoldClick = async () => {
        if (!currentPlayer) return;
        await api.markUnsold(currentPlayer.id);
        toast("Marked unsold");
        loadAll();
    };

    if (loading) {
        return <div className="font-display tracking-widest text-white/60 py-20 text-center">LOADING AUCTION FLOOR…</div>;
    }

    return (
        <div className="space-y-6" data-testid="dashboard-page">
            {/* Hero stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatChip label="TOURNAMENT" value={settings?.tournament_name?.split(" ")[0] || "—"} />
                <StatChip label="BUDGET / OWNER" value={formatPts(settings?.starting_budget || 0)} accent="text-[#EAB308]" />
                <StatChip label="OWNERS" value={stats?.owners ?? 0} />
                <StatChip label="PLAYERS SOLD" value={`${stats?.sold ?? 0} / ${stats?.total_players ?? 0}`} accent="text-[#22C55E]" />
                <StatChip label="UNSOLD POOL" value={stats?.unsold ?? 0} accent="text-[#EF4444]" />
            </div>

            {/* Auction Floor + Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT: Current Player */}
                <section className="lg:col-span-8 relative rounded-2xl border border-white/10 overflow-hidden stadium-bg grain min-h-[520px]"
                    data-testid="current-player-card">
                    <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-[#EF4444] rounded-full pulse-ring"></span>
                        <span className="font-display tracking-[0.3em] text-xs text-white/80">ON THE BLOCK</span>
                    </div>
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                        <Button size="sm" variant="secondary" onClick={pickNextRandom}
                            className="bg-white/10 border border-white/15 hover:bg-white/20 font-display tracking-widest"
                            data-testid="pick-random-btn">
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> RANDOM
                        </Button>
                    </div>

                    {currentPlayer ? (
                        <div className="grid md:grid-cols-2 h-full relative">
                            <div className="relative h-[360px] md:h-full">
                                <SmartImage
                                    src={currentPlayer.photo_url}
                                    alt={currentPlayer.name}
                                    fallback={PLAYER_FALLBACK}
                                    className="w-full h-full object-cover"
                                    testId="current-player-image"
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0A0A0A]"></div>
                            </div>
                            <div className="p-6 md:p-10 flex flex-col justify-center gap-6 relative">
                                <div>
                                    <div className="font-display tracking-[0.3em] text-[#EAB308] text-xs">{currentPlayer.role.toUpperCase()}</div>
                                    <h1 className="font-display text-5xl md:text-7xl leading-none mt-2" data-testid="current-player-name">
                                        {currentPlayer.name}
                                    </h1>
                                </div>
                                <div className="flex items-baseline gap-4">
                                    <div>
                                        <div className="text-[10px] tracking-[0.25em] text-white/50">BASE PRICE</div>
                                        <div className="font-display text-3xl text-white">{formatPts(currentPlayer.base_price)}</div>
                                    </div>
                                    <div className="h-10 w-px bg-white/10"></div>
                                    <div>
                                        <div className="text-[10px] tracking-[0.25em] text-white/50">STATUS</div>
                                        <div className="font-display text-3xl text-[#3B82F6]">CURRENT</div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3 mt-2">
                                    <Dialog open={sellOpen} onOpenChange={setSellOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                className="bg-[#EAB308] text-black hover:bg-[#FACC15] font-display tracking-widest text-lg px-7 py-6"
                                                data-testid="open-sell-btn">
                                                <Gavel className="w-5 h-5 mr-2" /> SELL TO HIGHEST BIDDER
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="bg-[#121212] border-white/10 text-white">
                                            <DialogHeader>
                                                <DialogTitle className="font-display tracking-widest text-2xl">
                                                    HAMMER DOWN — {currentPlayer.name}
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 py-2">
                                                <div>
                                                    <label className="text-xs tracking-[0.25em] text-white/60">WINNING OWNER</label>
                                                    <Select value={sellOwnerId} onValueChange={setSellOwnerId}>
                                                        <SelectTrigger className="bg-black/40 border-white/15 mt-1.5" data-testid="sell-owner-select">
                                                            <SelectValue placeholder="Choose owner…" />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-[#121212] border-white/10 text-white">
                                                            {owners.map(o => (
                                                                <SelectItem
                                                                    key={o.id} value={o.id}
                                                                    data-testid={`sell-owner-option-${o.id}`}
                                                                >
                                                                    {o.team_name} — {o.name} · {formatPts(o.remaining)} left
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="text-xs tracking-[0.25em] text-white/60">SOLD PRICE (POINTS)</label>
                                                    <Input
                                                        type="number"
                                                        min={currentPlayer.base_price}
                                                        value={sellPrice}
                                                        onChange={e => setSellPrice(e.target.value)}
                                                        placeholder={`Min ${currentPlayer.base_price}`}
                                                        className="bg-black/40 border-white/15 mt-1.5 font-display text-2xl tracking-wider"
                                                        data-testid="sell-price-input"
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="ghost" onClick={() => setSellOpen(false)} className="text-white/70" data-testid="sell-cancel-btn">
                                                    Cancel
                                                </Button>
                                                <Button
                                                    onClick={handleSell}
                                                    className="bg-[#22C55E] hover:bg-[#16A34A] text-black font-display tracking-widest"
                                                    data-testid="confirm-sell-btn"
                                                >
                                                    <Gavel className="w-4 h-4 mr-2" /> CONFIRM SALE
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    <Button variant="secondary" onClick={markUnsoldClick}
                                        className="bg-white/5 border border-white/15 hover:bg-white/10 font-display tracking-widest"
                                        data-testid="mark-unsold-btn">
                                        MARK UNSOLD
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[520px] flex flex-col items-center justify-center text-center px-6">
                            <Trophy className="w-14 h-14 text-[#EAB308] mb-4" />
                            <div className="font-display text-3xl tracking-wider">NO PLAYER ON THE BLOCK</div>
                            <p className="text-white/60 mt-2 max-w-md">
                                Pick a player from the roster to put them up for auction, or roll a random unsold player.
                            </p>
                            <Button onClick={pickNextRandom} className="mt-6 bg-[#EAB308] text-black hover:bg-[#FACC15] font-display tracking-widest"
                                data-testid="empty-pick-random-btn">
                                <Zap className="w-4 h-4 mr-2" /> ROLL RANDOM PLAYER
                            </Button>
                        </div>
                    )}
                </section>

                {/* RIGHT: Leaderboard */}
                <aside className="lg:col-span-4 rounded-2xl border border-white/10 bg-[#121212] overflow-hidden flex flex-col"
                    data-testid="leaderboard">
                    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-[#EAB308]" />
                            <div className="font-display tracking-[0.3em] text-sm">LEADERBOARD</div>
                        </div>
                        <Badge variant="secondary" className="bg-white/10 border-white/10 text-white/70">{owners.length} OWNERS</Badge>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[460px]">
                        {sortedOwners.length === 0 && (
                            <div className="p-6 text-center text-white/50 text-sm">Add owners to start the auction.</div>
                        )}
                        {sortedOwners.map((o, i) => {
                            const pct = o.starting_budget ? (o.remaining / o.starting_budget) * 100 : 0;
                            const isFlashing = flashOwnerId === o.id;
                            const barColor = pct > 50 ? "bg-[#22C55E]" : pct > 20 ? "bg-[#EAB308]" : "bg-[#EF4444]";
                            return (
                                <div key={o.id}
                                    className={`p-4 transition-colors ${isFlashing ? "flash-yellow" : ""}`}
                                    data-testid={`leaderboard-row-${o.id}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="font-display text-2xl text-white/40 w-6 text-right">{i + 1}</span>
                                        <SmartImage
                                            src={o.photo_url}
                                            alt={o.team_name}
                                            fallback={TEAM_FALLBACK}
                                            className="w-12 h-12 rounded-md object-cover border border-white/10"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-display text-lg tracking-wide truncate">{o.team_name}</div>
                                            <div className="text-xs text-white/50 truncate">{o.name} · {o.players_count} players</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-display text-xl text-white">{formatPts(o.remaining)}</div>
                                            <div className="text-[10px] tracking-widest text-white/40">REMAINING</div>
                                        </div>
                                    </div>
                                    <div className="mt-2 h-1.5 bg-white/5 rounded overflow-hidden">
                                        <div className={`h-full ${barColor}`} style={{ width: `${Math.max(0, pct)}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>
            </div>

            {/* Up Next strip */}
            <section className="rounded-2xl border border-white/10 bg-[#121212] p-5" data-testid="up-next-strip">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-[#3B82F6]" />
                        <div className="font-display tracking-[0.3em] text-sm">UP NEXT — UNSOLD POOL</div>
                    </div>
                    <div className="text-xs tracking-widest text-white/40">CLICK A PLAYER TO PUT THEM ON THE BLOCK</div>
                </div>
                {unsold.length === 0 ? (
                    <div className="text-white/50 text-sm">No unsold players left. {stats?.sold ? "Auction complete." : "Add players from the Roster page."}</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {unsold.slice(0, 12).map(p => (
                            <button
                                key={p.id}
                                onClick={async () => { await api.setCurrent(p.id); loadAll(); toast.success(`UP NEXT: ${p.name}`); }}
                                className="group text-left rounded-lg border border-white/10 bg-black/40 overflow-hidden hover:border-[#EAB308] hover:shadow-[0_0_18px_rgba(234,179,8,0.25)] transition"
                                data-testid={`upnext-${p.id}`}
                            >
                                <div className="aspect-square">
                                    <SmartImage src={p.photo_url} alt={p.name} fallback={PLAYER_FALLBACK}
                                        className="w-full h-full object-cover group-hover:scale-105 transition" />
                                </div>
                                <div className="p-2.5">
                                    <div className="font-display tracking-wide truncate">{p.name}</div>
                                    <div className="flex items-center justify-between text-[10px] text-white/50">
                                        <span>{p.role}</span>
                                        <span className="text-[#EAB308] font-mono">{formatPts(p.base_price)}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                {unsold.length > 12 && (
                    <div className="mt-3 text-right text-xs text-white/50">
                        + {unsold.length - 12} more · See full <a href="/players" className="text-[#EAB308] hover:underline">Players Roster <ChevronRight className="inline w-3 h-3" /></a>
                    </div>
                )}
            </section>
        </div>
    );
}
