"use client";

import { useEffect, useState } from "react";

/** Cuon len dau trang; ton trong cai dat "giam chuyen dong" cua he dieu hanh */
export function scrollToTop() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

/** Logo o header: bam de len dau trang */
export function BrandButton() {
    return (
        <button
            type="button"
            onClick={scrollToTop}
            aria-label="Tin Tức - lên đầu trang"
            className="group flex items-center gap-2.5 rounded-lg -mx-1.5 px-1.5 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
            <span className="grid h-8 w-8 place-items-center rounded-md bg-zinc-900 text-[15px] font-extrabold text-white transition-colors group-hover:bg-red-700 dark:bg-zinc-100 dark:text-zinc-900 dark:group-hover:bg-red-400">
                T
            </span>
            <span className="text-lg font-bold tracking-tight">Tin Tức</span>
        </button>
    );
}

/** Nut noi goc phai duoi, hien khi da cuon qua ~1 man hinh */
export function BackToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > window.innerHeight);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <button
            type="button"
            onClick={scrollToTop}
            aria-label="Lên đầu trang"
            title="Lên đầu trang"
            tabIndex={visible ? 0 : -1}
            aria-hidden={!visible}
            className={`fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-zinc-200 bg-white/90 text-zinc-700 shadow-lg backdrop-blur transition-all duration-200 hover:border-zinc-300 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:text-white sm:bottom-8 sm:right-8 ${visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
                }`}
        >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
        </button>
    );
}
