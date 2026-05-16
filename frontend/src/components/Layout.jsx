import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Gavel, Users, Trophy, ScrollText, Activity } from "lucide-react";

const NAV = [
    { to: "/", label: "Auction Room", icon: Gavel, end: true, testId: "nav-dashboard" },
    { to: "/owners", label: "Owners", icon: Users, testId: "nav-owners" },
    { to: "/players", label: "Players", icon: Trophy, testId: "nav-players" },
    { to: "/history", label: "History", icon: ScrollText, testId: "nav-history" },
];

export default function Layout() {
    const loc = useLocation();
    return (
        <div className="min-h-screen text-white">
            {/* Top broadcast ribbon */}
            <div className="w-full bg-[#EAB308] text-black overflow-hidden">
                <div className="flex whitespace-nowrap font-display text-sm tracking-widest py-1">
                    <div className="ticker-track flex gap-12 px-12">
                        <span>LIVE AUCTION FLOOR</span>
                        <span>•</span>
                        <span>BIDDING IN PROGRESS</span>
                        <span>•</span>
                        <span>POWERED BY EMERGENT</span>
                        <span>•</span>
                        <span>FANTASY LEAGUE 2026</span>
                        <span>•</span>
                        <span>WHO WILL GO UNDER THE HAMMER NEXT?</span>
                        <span>•</span>
                    </div>
                </div>
            </div>

            <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/70 border-b border-white/10">
                <div className="max-w-[1500px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
                    <NavLink to="/" className="flex items-center gap-3 group" data-testid="brand-link">
                        <div className="relative w-10 h-10 rounded-md bg-[#EAB308] text-black flex items-center justify-center">
                            <Gavel className="w-5 h-5" strokeWidth={2.5} />
                            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#22C55E] rounded-full ring-2 ring-black"></span>
                        </div>
                        <div className="leading-none">
                            <div className="font-display text-2xl tracking-wider">SLAM AUCTION</div>
                            <div className="text-[10px] tracking-[0.3em] text-white/50 -mt-0.5">LIVE BIDDING CONSOLE</div>
                        </div>
                    </NavLink>

                    <nav className="hidden md:flex items-center gap-1">
                        {NAV.map(({ to, label, icon: Icon, end, testId }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                data-testid={testId}
                                className={({ isActive }) =>
                                    `relative px-4 py-2 font-display tracking-widest text-sm flex items-center gap-2 transition-colors ${
                                        isActive ? "text-[#EAB308]" : "text-white/70 hover:text-white"
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon className="w-4 h-4" />
                                        <span>{label}</span>
                                        {isActive && (
                                            <span className="absolute left-3 right-3 bottom-0 h-[2px] bg-[#EAB308]"></span>
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="hidden md:flex items-center gap-2 text-xs tracking-widest text-white/60">
                        <Activity className="w-4 h-4 text-[#22C55E]" />
                        <span>LIVE</span>
                    </div>
                </div>

                {/* Mobile nav */}
                <div className="md:hidden border-t border-white/10 overflow-x-auto">
                    <div className="flex">
                        {NAV.map(({ to, label, icon: Icon, end, testId }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={end}
                                data-testid={`m-${testId}`}
                                className={({ isActive }) =>
                                    `flex-1 min-w-[110px] py-3 flex flex-col items-center gap-1 font-display tracking-widest text-xs ${
                                        isActive ? "text-[#EAB308] border-b-2 border-[#EAB308]" : "text-white/70"
                                    }`
                                }
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </NavLink>
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-[1500px] mx-auto px-4 md:px-8 py-6 md:py-10" key={loc.pathname}>
                <Outlet />
            </main>

            <footer className="border-t border-white/10 mt-12 py-6 text-center text-xs tracking-widest text-white/40">
                <span className="font-display text-sm tracking-[0.4em]">SLAM AUCTION</span> · STADIUM CONSOLE
            </footer>
        </div>
    );
}
