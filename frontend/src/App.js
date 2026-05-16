import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import OwnersPage from "@/pages/OwnersPage";
import PlayersPage from "@/pages/PlayersPage";
import HistoryPage from "@/pages/HistoryPage";

function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <Routes>
                    <Route element={<Layout />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/owners" element={<OwnersPage />} />
                        <Route path="/players" element={<PlayersPage />} />
                        <Route path="/history" element={<HistoryPage />} />
                    </Route>
                </Routes>
            </BrowserRouter>
            <Toaster theme="dark" position="top-right" richColors />
        </div>
    );
}

export default App;
