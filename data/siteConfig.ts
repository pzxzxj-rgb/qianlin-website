import { destinations } from "./destinations";
import { tours } from "./tours";

type LocalizedText = {
  en: string;
  zh: string;
};

type HeroSlide = {
  src: string;
  alt: LocalizedText;
  desktopPosition: string;
  mobilePosition: string;
};

const companyAddress = "贵州省贵阳市云岩区毓秀街道飞山街祥源大厦A栋1单元7层2号";

export const company = {
  id: "qianlin-travel",
  name: "Qianlin Travel",
  nameZh: "黔林旅行社",
  logo: {
    mark: "Q",
    alt: {
      en: "Qianlin Travel home",
      zh: "黔林旅行首页",
    } satisfies LocalizedText,
  },
  description: {
    en: "Thoughtful private journeys and curated tours through Guizhou, China with a local travel team.",
    zh: "黔林旅行是一家专注于贵州旅游的本地旅行服务公司。",
  } satisfies LocalizedText,
  address: companyAddress,
  heroSlides: [
    { src: "/images/hero/hero-01.webp", alt: { zh: "贵州山水主题旅行视觉图", en: "Guizhou landscape travel visual" } satisfies LocalizedText, desktopPosition: "center center", mobilePosition: "50% center" },
    { src: "/images/hero/hero-03.webp", alt: { zh: "贵州自然风光主题视觉图", en: "Guizhou nature-inspired travel visual" } satisfies LocalizedText, desktopPosition: "68% center", mobilePosition: "62% center" },
  ] satisfies readonly HeroSlide[],
  contact: {
    channels: [
      {
        key: "phone",
        label: { en: "Phone", zh: "电话" } satisfies LocalizedText,
        value: "18985127882",
        href: "tel:+8618985127882",
      },
      {
        key: "email",
        label: { en: "Email", zh: "邮箱" } satisfies LocalizedText,
        value: "624667375@qq.com",
        href: "mailto:624667375@qq.com",
      },
      {
        key: "wechat",
        label: { en: "WeChat", zh: "微信" } satisfies LocalizedText,
        value: "powwow58",
      },
    ],
  },
  images: {
    about: "/images/hero/hero-07.webp",
    customize: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=85",
  },
  imageAlt: {
    about: {
      en: "Guizhou mountain village travel visual",
      zh: "贵州山间村寨主题视觉图",
    } satisfies LocalizedText,
    customize: {
      en: "Layered mountain landscape in soft morning light",
      zh: "晨光中的层叠山景",
    } satisfies LocalizedText,
  },
  tours,
  destinations,
} as const;

export type CompanyConfig = typeof company;
