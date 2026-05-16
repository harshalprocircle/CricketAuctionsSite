import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api, formatPts } from "@/lib/api";
import { SmartImage } from "@/components/SmartImage";
import { PLAYER_FALLBACK, TEAM_FALLBACK } from "@/lib/driveLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { RotateCcw, Search, History as HistoryIcon } from "lucide-react";

function timeAgo(iso) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleString();
}

export default function HistoryPage() {
    const [txs, setTxs] = useState([]);
    const [owners, setOwners] = useState([]);
    const [search, setSearch] = useState("");

    const load = useCallback(async () => {
        const [t, o] = await Promise.all([api.listTransactions(), api.listOwners()]);
        setTxs(t); setOwners(o);
    }, []);
    useEffect(() => { load(); }, [load]);

    const ownerMap = useMemo(() => Object.fromEntries(owners.map(o => [o.id, o])), [owners]);

    const filtered = useMemo(() => {
        if (!search.trim()) return txs;
        const q = search.toLowerCase();
        return txs.filter(t =>
            t.player_name.toLowerCase().includes(q) ||
            t.owner_name.toLowerCase().includes(q) ||
            t.team_name.toLowerCase().includes(q)
        );
    }, [txs, search]);

    const totalSpent = useMemo(() => txs.reduce((a, t) => a + t.amount, 0), [txs]);
    const highestBid = useMemo(() => txs.reduce((m, t) => Math.max(m, t.amount), 0), [txs]);

    const rollback = async (tx) => {
        if (!window.confirm(`Rollback the sale of ${tx.player_name} to ${tx.team_name}? This will refund ${formatPts(tx.amount)} points.`)) return;
        await api.rollbackTransaction(tx.id);
        toast.success("Transaction rolled back");
        load();
    };

    return (
        <div className="space-y-6" data-testid="history-page">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="font-display text-5xl tracking-wider">AUCTION HISTORY</h1>
                    <p className="text-white/50 text-sm tracking-wide">Every hammer-down logged in chronological order.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <Input placeholder="Search player, owner or team…" value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-[#121212] border-white/10" data-testid="history-search" />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#121212] border border-white/10 p-4">
                    <div className="text-[10px] tracking-[0.25em] text-white/50">TOTAL SALES</div>
                    <div className="font-display text-3xl">{txs.length}</div>
                </div>
                <div className="rounded-xl bg-[#121212] border border-white/10 p-4">
                    <div className="text-[10px] tracking-[0.25em] text-white/50">POINTS SPENT</div>
                    <div className="font-display text-3xl text-[#EAB308]">{formatPts(totalSpent)}</div>
                </div>
                <div className="rounded-xl bg-[#121212] border border-white/10 p-4">
                    <div className="text-[10px] tracking-[0.25em] text-white/50">HIGHEST BID</div>
                    <div className="font-display text-3xl text-[#22C55E]">{formatPts(highestBid)}</div>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#121212] overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="p-14 text-center text-white/60">
                        <HistoryIcon className="w-10 h-10 mx-auto text-white/30 mb-3" />
                        <div className="font-display text-2xl tracking-wider">NO TRANSACTIONS YET</div>
                        <p className="text-sm mt-2">Sales will appear here once players are sold on the auction floor.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/10 hover:bg-transparent">
                                <TableHead className="text-white/60 font-display tracking-widest text-xs">#</TableHead>
                                <TableHead className="text-white/60 font-display tracking-widest text-xs">PLAYER</TableHead>
                                <TableHead className="text-white/60 font-display tracking-widest text-xs">BOUGHT BY</TableHead>
                                <TableHead className="text-white/60 font-display tracking-widest text-xs text-right">AMOUNT</TableHead>
                                <TableHead className="text-white/60 font-display tracking-widest text-xs">WHEN</TableHead>
                                <TableHead className="text-white/60 font-display tracking-widest text-xs text-right">ACTIONS</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((t, i) => {
                                const owner = ownerMap[t.owner_id];
                                return (
                                    <TableRow key={t.id} className="border-white/5 hover:bg-white/5" data-testid={`tx-row-${t.id}`}>
                                        <TableCell className="text-white/40 font-mono">{filtered.length - i}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <SmartImage src={t.player_photo_url} alt={t.player_name} fallback={PLAYER_FALLBACK}
                                                    className="w-9 h-9 rounded-full object-cover border border-white/10" />
                                                <div>
                                                    <div className="font-display tracking-wide text-base">{t.player_name}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <SmartImage src={owner?.photo_url} alt={t.team_name} fallback={TEAM_FALLBACK}
                                                    className="w-8 h-8 rounded-md object-cover border border-white/10" />
                                                <div>
                                                    <div className="font-display text-base">{t.team_name}</div>
                                                    <div className="text-xs text-white/50">{t.owner_name}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="font-display text-2xl text-[#EAB308]">{formatPts(t.amount)}</span>
                                        </TableCell>
                                        <TableCell className="text-white/60 text-sm">{timeAgo(t.created_at)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="secondary"
                                                className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/20"
                                                onClick={() => rollback(t)} data-testid={`rollback-${t.id}`}>
                                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Rollback
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}
