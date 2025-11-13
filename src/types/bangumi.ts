export interface Weekday {
  en: string;
  cn: string;
  ja: string;
  id: number;
}

export interface Anime {
  id: number;
  url: string;
  type: number;
  name: string;
  name_cn: string;
  summary: string;
  air_date: string;
  air_weekday: number;
  rating: {
    total: number;
    count: { [key: string]: number };
    score: number;
  };
  rank?: number;
  images: {
    large: string;
    common: string;
    medium: string;
    small: string;
    grid: string;
  };
  collection?: {
    doing: number;
  };
}

export interface CalendarDay {
  weekday: Weekday;
  items: Anime[];
}
