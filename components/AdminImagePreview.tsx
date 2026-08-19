"use client";

import { useState } from "react";
import Image from "next/image";

export function AdminImagePreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  return <div className="admin-image-preview">{failed ? <div className="admin-image-preview-fallback" role="status">图片暂时无法预览</div> : <Image src={src} alt={alt} width={1000} height={220} sizes="(max-width: 720px) 100vw, 50vw" loading="lazy" onError={() => setFailed(true)} />}</div>;
}
