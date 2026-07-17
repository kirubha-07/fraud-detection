"use client";
/**
 * contexts/DashboardContext.tsx
 * Global state for model selection, threshold, and cost parameters.
 * All dashboard pages read/write this context so changing the model
 * on one page propagates to all other pages instantly.
 */

import React, { createContext, useContext, useState, ReactNode } from "react";

interface DashboardState {
    model: string;
    threshold: number;
    fpCost: number;
    fnCost: number;
    setModel: (m: string) => void;
    setThreshold: (t: number) => void;
    setFpCost: (c: number) => void;
    setFnCost: (c: number) => void;
}

const DashboardContext = createContext<DashboardState>({
    model: "xgboost",
    threshold: 0.5,
    fpCost: 50,
    fnCost: 500,
    setModel: () => { },
    setThreshold: () => { },
    setFpCost: () => { },
    setFnCost: () => { },
});

export function DashboardProvider({ children }: { children: ReactNode }) {
    const [model, setModel] = useState("xgboost");
    const [threshold, setThreshold] = useState(0.5);
    const [fpCost, setFpCost] = useState(50);
    const [fnCost, setFnCost] = useState(500);

    return (
        <DashboardContext.Provider
            value={{ model, threshold, fpCost, fnCost, setModel, setThreshold, setFpCost, setFnCost }}
        >
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    return useContext(DashboardContext);
}
