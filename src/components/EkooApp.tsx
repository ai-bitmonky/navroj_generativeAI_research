"use client";

import { useEffect, useRef, useState } from "react";

type View = "mobile" | "desktop";

/**
 * Hosts the ekoo engine. Laptops and larger screens (≥1024px) get the desktop web app;
 * phones and small tablets get the native-style mobile app. Crossing the breakpoint re-mounts live.
 * Everything works as a guest: state is kept on this device, no login, OTP or email.
 */
export default function EkooApp({ initialView }: { initialView: View }) {
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    import("@/engine/runtime").then((rt) => {
      if (cancelled || !root.current) return;
      dispose = rt.boot(root.current);
      requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <div id="ek-root" ref={root} data-initial={initialView}>
      <div className={"ek-launch" + (ready ? " out" : "")} aria-hidden={ready}>
        <div className="mark">
          <span className="dots" aria-hidden="true">
            <i />
            <i />
          </span>
          ekoo
        </div>
      </div>
      <noscript>
        <p className="ek-noscript">ekoo needs JavaScript to run.</p>
      </noscript>
    </div>
  );
}
