export type LocalizedTourText = {
  zh: string;
  en: string;
};

export type TourStatus = "draft" | "published" | "archived";

export type Tour = {
  id: string;
  tenantId: string;
  slug: string;
  title: LocalizedTourText;
  description: LocalizedTourText;
  duration?: LocalizedTourText;
  tag?: LocalizedTourText;
  priceText?: LocalizedTourText;
  image?: string;
  imageAlt?: LocalizedTourText;
  featured: boolean;
  displayOrder: number;
  status: TourStatus;
};
