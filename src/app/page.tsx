"use client";

import { useEffect } from "react";
import { Spinner } from "@/components/ui";

/** Phones and narrow screens → signatory gate; desktops → admin dashboard. */
export default function Home() {
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 820px)").matches;
    const touchOnly = window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches;
    window.location.replace(narrow || touchOnly ? "/sign" : "/admin");
  }, []);
  return (
    <div className="stage" style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <Spinner />
    </div>
  );
}
