export type AdminImageUsage = "hero" | "about" | "customize" | "tour";

export type AdminImageOption = {
  path: string;
  labelZh: string;
  labelEn: string;
  recommendedFor: readonly AdminImageUsage[];
};

export const ADMIN_IMAGE_CATALOG = [
  { path: "/images/hero/hero-01.webp", labelZh: "贵州山水主题视觉图 01", labelEn: "Guizhou landscape visual 01", recommendedFor: ["hero", "customize", "tour"] },
  { path: "/images/hero/hero-02.webp", labelZh: "贵州自然风光主题视觉图 02", labelEn: "Guizhou nature visual 02", recommendedFor: ["hero", "customize", "tour"] },
  { path: "/images/hero/hero-03.webp", labelZh: "贵州山水主题视觉图 03", labelEn: "Guizhou landscape visual 03", recommendedFor: ["hero", "customize", "tour"] },
  { path: "/images/hero/hero-04.webp", labelZh: "贵州自然风光主题视觉图 04", labelEn: "Guizhou nature visual 04", recommendedFor: ["hero", "customize", "tour"] },
  { path: "/images/hero/hero-05.webp", labelZh: "贵州群山主题视觉图 05", labelEn: "Guizhou mountain visual 05", recommendedFor: ["hero", "customize", "tour"] },
  { path: "/images/hero/hero-06.webp", labelZh: "贵州主题竖版视觉图 06", labelEn: "Guizhou portrait visual 06", recommendedFor: ["about"] },
  { path: "/images/hero/hero-07.webp", labelZh: "贵州山间村寨主题视觉图 07", labelEn: "Guizhou mountain village visual 07", recommendedFor: ["about"] },
  { path: "/images/hero/hero-08.webp", labelZh: "贵州主题竖版视觉图 08", labelEn: "Guizhou portrait visual 08", recommendedFor: ["about"] },
  { path: "/images/hero/hero-09.webp", labelZh: "贵州主题竖版视觉图 09", labelEn: "Guizhou portrait visual 09", recommendedFor: ["about"] },
  { path: "/images/guizhou/about-village.png", labelZh: "贵州山间村寨主题图", labelEn: "Guizhou mountain village image", recommendedFor: ["about"] },
  { path: "/images/guizhou/customize-mountains.png", labelZh: "贵州层叠群山主题图", labelEn: "Layered Guizhou mountains image", recommendedFor: ["customize", "hero", "tour"] },
  { path: "/images/guizhou/fanjing-mountain.png", labelZh: "梵净山主题图", labelEn: "Fanjing Mountain image", recommendedFor: ["customize", "hero", "tour"] },
  { path: "/images/guizhou/hero-guizhou.png", labelZh: "贵州山水主题宽幅图", labelEn: "Wide Guizhou landscape image", recommendedFor: ["hero", "customize", "tour"] },
  { path: "/images/guizhou/huangguoshu.png", labelZh: "黄果树瀑布主题图", labelEn: "Huangguoshu Waterfall image", recommendedFor: ["hero", "customize", "tour"] },
  { path: "/images/guizhou/libo-xiaoqikong.png", labelZh: "荔波小七孔主题图", labelEn: "Libo Xiaoqikong image", recommendedFor: ["hero", "customize", "tour"] },
  { path: "/images/guizhou/wanfenglin.png", labelZh: "万峰林主题宽幅图", labelEn: "Wanfenglin landscape image", recommendedFor: ["hero", "customize", "tour"] },
  { path: "/images/guizhou/xijiang-miao-village.png", labelZh: "西江千户苗寨主题图", labelEn: "Xijiang Miao Village image", recommendedFor: ["about", "customize", "tour"] },
] as const satisfies readonly AdminImageOption[];

const ADMIN_IMAGE_PATHS = new Set<string>(ADMIN_IMAGE_CATALOG.map((image) => image.path));

function decodePathForValidation(value: string) {
  let decoded = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }
  return decoded;
}

export function isAdminImagePath(value: unknown): value is string {
  if (typeof value !== "string" || !value || !value.startsWith("/images/")) return false;
  const decoded = decodePathForValidation(value);
  if (!decoded) return false;
  if ([value, decoded].some((path) => path.includes("//") || path.includes("..") || path.includes("\\") || path.includes("?") || path.includes("#") || path.includes(":") || path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("javascript:"))) return false;
  return ADMIN_IMAGE_PATHS.has(value);
}

export function getAdminImageOption(path: string) {
  return ADMIN_IMAGE_CATALOG.find((image) => image.path === path);
}

export function getAdminImageOptions(usage: AdminImageUsage) {
  return ADMIN_IMAGE_CATALOG.filter((image) => image.recommendedFor.includes(usage));
}

export function isAdminImagePathForUsage(value: unknown, usage: AdminImageUsage): value is string {
  return isAdminImagePath(value) && Boolean(getAdminImageOption(value)?.recommendedFor.includes(usage));
}
