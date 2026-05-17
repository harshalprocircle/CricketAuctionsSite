import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API });

export const api = {
    getSettings: () => http.get("/settings").then(r => r.data),
    updateSettings: (data) => http.put("/settings", data).then(r => r.data),

    listOwners: () => http.get("/owners").then(r => r.data),
    createOwner: (data) => http.post("/owners", data).then(r => r.data),
    updateOwner: (id, data) => http.put(`/owners/${id}`, data).then(r => r.data),
    deleteOwner: (id) => http.delete(`/owners/${id}`).then(r => r.data),
    deleteAllOwners: () => http.delete("/owners").then(r => r.data),
    importOwners: (file) => {
        const fd = new FormData();
        fd.append("file", file);
        return http.post("/owners/bulk-import", fd).then(r => r.data);
    },

    listPlayers: () => http.get("/players").then(r => r.data),
    createPlayer: (data) => http.post("/players", data).then(r => r.data),
    updatePlayer: (id, data) => http.put(`/players/${id}`, data).then(r => r.data),
    deletePlayer: (id) => http.delete(`/players/${id}`).then(r => r.data),
    deleteAllPlayers: () => http.delete("/players").then(r => r.data),
    setCurrent: (id) => http.post(`/players/${id}/set-current`).then(r => r.data),
    markUnsold: (id) => http.post(`/players/${id}/mark-unsold`).then(r => r.data),
    sellPlayer: (id, data) => http.post(`/players/${id}/sell`, data).then(r => r.data),
    importPlayers: (file) => {
        const fd = new FormData();
        fd.append("file", file);
        return http.post("/players/bulk-import", fd).then(r => r.data);
    },

    listTransactions: () => http.get("/transactions").then(r => r.data),
    rollbackTransaction: (id) => http.post(`/transactions/${id}/rollback`).then(r => r.data),
    resetAuction: () => http.post("/auction/reset").then(r => r.data),
    stats: () => http.get("/stats").then(r => r.data),
};

export const formatPts = (n) => {
    if (n === null || n === undefined || isNaN(n)) return "0";
    return new Intl.NumberFormat("en-IN").format(n);
};
