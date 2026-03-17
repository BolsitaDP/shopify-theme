export type GsapQuality = 'high' | 'balanced' | 'low';

export interface GsapSettings {
  enabled: boolean;
  quality: GsapQuality;
  enableDesktop: boolean;
  enableMobile: boolean;
}

export interface HomepageSettings {
  featuredCollectionHandle: string;
  productsLimit: number;
}

export interface WhyUsCard {
  title: string;
  text: string;
}

export interface WhyUsSettings {
  eyebrow: string;
  title: string;
  subtitle: string;
  cards: WhyUsCard[];
}

export interface ThemeSettings {
  gsap: GsapSettings;
  homepage: HomepageSettings;
  whyUs: WhyUsSettings;
}

export interface CollectionOption {
  id: string;
  title: string;
  handle: string;
}

export interface SettingsResponse {
  shop: string;
  settings: ThemeSettings;
  collections: CollectionOption[];
}
