import { destinations } from "./destinations";
import { tours } from "./tours";

type LocalizedText = {
  en: string;
  zh: string;
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
    hero: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=2200&q=90",
    about: "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=1400&q=85",
    customize: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=85",
      "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=1000&q=85",
    ],
  },
  imageAlt: {
    about: {
      en: "Quiet stone path through a mountain village",
      zh: "穿过山间村落的石板路",
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
