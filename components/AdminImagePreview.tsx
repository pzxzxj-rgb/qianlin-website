"use client";

import { useState } from "react";

export function AdminImagePreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  return <div className="admin-image-preview">{failed ? <div className="admin-image-preview-fallback" role="status">图片暂时无法预览</div> : <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />}</div>;
}
