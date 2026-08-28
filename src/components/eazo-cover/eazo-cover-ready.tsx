"use client";

import { useEffect } from "react";

/**
 * 标记封面已渲染完成，供平台截图服务识别。
 * 无副作用、无 auth、不触碰产品状态。
 */
export function EazoCoverReady({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.setAttribute("data-eazo-cover-ready", "1");
    return () => {
      document.body.removeAttribute("data-eazo-cover-ready");
    };
  }, []);
  return <div data-eazo-cover-ready-root="">{children}</div>;
}
