import type {
  Anime as GenAnime,
  Episode as GenEpisode,
  PagedEpisode as GenPagedEpisode,
  Weekday,
  CalendarItem as GenCalendarItem,
  InfoItem as GenInfoItem,
  SubjectStatus as GenSubjectStatus,
  SubjectStatusCode as GenSubjectStatusCode,
} from "./gen/bangumi";

export type InfoBoxItem = GenInfoItem;

export type Episode = GenEpisode & {
  comment_str?: string;
  duration_display?: string;
};

export type PagedEpisode = Omit<GenPagedEpisode, "data"> & { data: Episode[] };

export type Anime = GenAnime & {
  air_date?: string;
  air_weekday?: number;
};

export type CalendarItem = GenCalendarItem;

export type CalendarDay = {
  weekday: Weekday;
  items: CalendarItem[];
};

export type SubjectStatus = GenSubjectStatus;
export type SubjectStatusCode = GenSubjectStatusCode;
