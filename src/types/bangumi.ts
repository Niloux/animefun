export interface Weekday {
  en: string;
  cn: string;
  ja: string;
  id: number;
}

export interface Rating {
  rank?: number;
  total: number;
  count: { [key: string]: number };
  score: number;
}

export interface Images {
  large: string;
  common: string;
  medium: string;
  small: string;
  grid: string;
}

export interface Collection {
  wish: number;
  collect: number;
  doing: number;
  on_hold: number;
  dropped: number;
}

export interface SubjectTag {
  name: string;
  count: number;
}

export interface InfoBoxValue {
  v: string;
  [key: string]: string | number | boolean | unknown;
}

export interface InfoBoxItem {
  key: string;
  value: string | InfoBoxValue | Array<InfoBoxValue> | unknown;
}

export interface Episode {
  id: number;
  type: number;
  name: string;
  name_cn: string;
  sort: number;
  ep: number | null;
  airdate: string;
  comment: number;
  duration: string;
  desc: string;
  disc: number;
  duration_seconds?: number;
  subject_id?: number;
}

export interface PagedEpisode {
  total: number;
  limit: number;
  offset: number;
  data: Episode[];
}

export interface Anime {
  id: number;
  url?: string;
  type: number;
  name: string;
  name_cn: string;
  summary: string;
  date?: string;
  air_date?: string;
  air_weekday?: number;
  platform: string;
  rating?: Rating;
  rank?: number;
  images: Images;
  collection?: Collection;
  volumes?: number;
  eps?: number;
  total_episodes?: number;
  meta_tags?: string[];
  tags?: SubjectTag[];
  infobox?: InfoBoxItem[];
}

export interface CalendarDay {
  weekday: Weekday;
  items: Anime[];
}
