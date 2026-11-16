export type DayKey = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export interface DayScheduleConfig {
  enabled: boolean;
  slot1Start: string;
  slot1End: string;
  hasSecondSlot: boolean;
  slot2Start: string;
  slot2End: string;
}

export type AgentWeeklySchedule = Record<DayKey, DayScheduleConfig>;

export const WEEK_DAYS: Array<{ key: DayKey; labelBn: string; shortBn: string; jsDay: number }> = [
  { key: 'sat', labelBn: 'শনিবার', shortBn: 'শনি', jsDay: 6 },
  { key: 'sun', labelBn: 'রবিবার', shortBn: 'রবি', jsDay: 0 },
  { key: 'mon', labelBn: 'সোমবার', shortBn: 'সোম', jsDay: 1 },
  { key: 'tue', labelBn: 'মঙ্গলবার', shortBn: 'মঙ্গল', jsDay: 2 },
  { key: 'wed', labelBn: 'বুধবার', shortBn: 'বুধ', jsDay: 3 },
  { key: 'thu', labelBn: 'বৃহস্পতিবার', shortBn: 'বৃহঃ', jsDay: 4 },
  { key: 'fri', labelBn: 'শুক্রবার', shortBn: 'শুক্র', jsDay: 5 },
];

export const DEFAULT_OPEN_DAY_CONFIG: DayScheduleConfig = {
  enabled: true,
  slot1Start: '09:00',
  slot1End: '13:30',
  hasSecondSlot: true,
  slot2Start: '15:30',
  slot2End: '22:00',
};

export function createDefaultWeeklySchedule(): AgentWeeklySchedule {
  return {
    sat: { ...DEFAULT_OPEN_DAY_CONFIG },
    sun: { ...DEFAULT_OPEN_DAY_CONFIG },
    mon: { ...DEFAULT_OPEN_DAY_CONFIG },
    tue: { ...DEFAULT_OPEN_DAY_CONFIG },
    wed: { ...DEFAULT_OPEN_DAY_CONFIG },
    thu: { ...DEFAULT_OPEN_DAY_CONFIG },
    fri: {
      ...DEFAULT_OPEN_DAY_CONFIG,
      enabled: false,
    },
  };
}

export function normalizeWeeklySchedule(raw?: any): AgentWeeklySchedule {
  const base = createDefaultWeeklySchedule();
  if (!raw || typeof raw !== 'object') return base;

  for (const { key } of WEEK_DAYS) {
    const src = raw[key];
    if (src && typeof src === 'object') {
      base[key] = {
        enabled: src.enabled !== undefined ? Boolean(src.enabled) : base[key].enabled,
        slot1Start: typeof src.slot1Start === 'string' && src.slot1Start ? src.slot1Start : base[key].slot1Start,
        slot1End: typeof src.slot1End === 'string' && src.slot1End ? src.slot1End : base[key].slot1End,
        hasSecondSlot: src.hasSecondSlot !== undefined ? Boolean(src.hasSecondSlot) : base[key].hasSecondSlot,
        slot2Start: typeof src.slot2Start === 'string' && src.slot2Start ? src.slot2Start : base[key].slot2Start,
        slot2End: typeof src.slot2End === 'string' && src.slot2End ? src.slot2End : base[key].slot2End,
      };
    }
  }
  return base;
}

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBnDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BANGLA_DIGITS[parseInt(d, 10)] || d);
}

export function parseTimeToMinutes(hhmm: string): number {
  if (!hhmm || !hhmm.includes(':')) return 0;
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

export function formatTimeBn(hhmm: string): string {
  if (!hhmm || !hhmm.includes(':')) return hhmm || '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return hhmm;

  let period = 'রাত';
  if (h >= 5 && h < 12) period = 'সকাল';
  else if (h >= 12 && h < 16) period = 'দুপুর';
  else if (h >= 16 && h < 19) period = 'বিকাল';
  else if (h >= 19 && h < 24) period = 'রাত';

  const h12 = h % 12 === 0 ? 12 : h % 12;
  const minStr = m.toString().padStart(2, '0');
  return `${period} ${toBnDigits(h12)}:${toBnDigits(minStr)}`;
}

export function formatDayScheduleBn(day: DayScheduleConfig): string {
  if (!day.enabled) return 'সাপ্তাহিক বন্ধ';
  const s1 = `${formatTimeBn(day.slot1Start)} - ${formatTimeBn(day.slot1End)}`;
  if (!day.hasSecondSlot) return s1;
  const s2 = `${formatTimeBn(day.slot2Start)} - ${formatTimeBn(day.slot2End)}`;
  return `${s1} ও ${s2}`;
}

export function getWeeklyOffDays(schedule?: AgentWeeklySchedule | null): DayKey[] {
  if (!schedule) return ['fri'];
  return WEEK_DAYS.filter((d) => !schedule[d.key]?.enabled).map((d) => d.key);
}

export function formatClosedDaysLabel(schedule?: AgentWeeklySchedule | null): string {
  if (!schedule) return 'শুক্রবার বন্ধ';
  const offDays = WEEK_DAYS.filter((d) => !schedule[d.key]?.enabled);
  if (offDays.length === 0) return 'সপ্তাহে ৭ দিনই খোলা';
  if (offDays.length === WEEK_DAYS.length) return 'সব দিন বন্ধ';
  return `${offDays.map((d) => d.labelBn).join(', ')} বন্ধ`;
}

export function buildOpeningHoursSummary(schedule: AgentWeeklySchedule): string {
  const openDays = WEEK_DAYS.filter((d) => schedule[d.key]?.enabled);
  const offLabel = formatClosedDaysLabel(schedule);

  if (openDays.length === 0) {
    return 'বর্তমানে অস্থায়ীভাবে বন্ধ';
  }

  const firstDayHours = formatDayScheduleBn(schedule[openDays[0].key]);
  if (openDays.length === WEEK_DAYS.length) {
    return `প্রতিদিন: ${firstDayHours}`;
  }
  return `${firstDayHours} (${offLabel})`;
}

export interface LiveScheduleStatus {
  state: 'open' | 'break' | 'closed' | 'unknown';
  statusLabel: string;
  todayHours: string;
  closedDaysLabel: string;
  todayDayLabel: string;
}

export function getLiveScheduleStatus(
  schedule?: AgentWeeklySchedule | null,
  fallbackOpeningHours?: string,
  now: Date = new Date()
): LiveScheduleStatus {
  const jsDay = now.getDay();
  const todayMeta = WEEK_DAYS.find((d) => d.jsDay === jsDay) || WEEK_DAYS[0];

  if (!schedule) {
    return {
      state: 'unknown',
      statusLabel: 'সময়সূচি নির্ধারিত',
      todayHours: fallbackOpeningHours || 'সকাল ৯:০০ - রাত ১০:০০',
      closedDaysLabel: '',
      todayDayLabel: todayMeta.labelBn,
    };
  }

  const todayCfg = schedule[todayMeta.key];
  const closedDaysLabel = formatClosedDaysLabel(schedule);

  if (!todayCfg || !todayCfg.enabled) {
    return {
      state: 'closed',
      statusLabel: 'আজ সাপ্তাহিক বন্ধ',
      todayHours: 'আজ বন্ধ',
      closedDaysLabel,
      todayDayLabel: todayMeta.labelBn,
    };
  }

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const s1Start = parseTimeToMinutes(todayCfg.slot1Start);
  const s1End = parseTimeToMinutes(todayCfg.slot1End);
  const s2Start = parseTimeToMinutes(todayCfg.slot2Start);
  const s2End = parseTimeToMinutes(todayCfg.slot2End);
  const todayHours = formatDayScheduleBn(todayCfg);

  if (nowMins >= s1Start && nowMins <= s1End) {
    return {
      state: 'open',
      statusLabel: 'এখন খোলা আছে',
      todayHours,
      closedDaysLabel,
      todayDayLabel: todayMeta.labelBn,
    };
  }

  if (todayCfg.hasSecondSlot) {
    if (nowMins > s1End && nowMins < s2Start) {
      return {
        state: 'break',
        statusLabel: `বিরতি চলছে (${formatTimeBn(todayCfg.slot2Start)} খুলবে)`,
        todayHours,
        closedDaysLabel,
        todayDayLabel: todayMeta.labelBn,
      };
    }
    if (nowMins >= s2Start && nowMins <= s2End) {
      return {
        state: 'open',
        statusLabel: 'এখন খোলা আছে',
        todayHours,
        closedDaysLabel,
        todayDayLabel: todayMeta.labelBn,
      };
    }
  }

  return {
    state: 'closed',
    statusLabel: 'এখন বন্ধ আছে',
    todayHours,
    closedDaysLabel,
    todayDayLabel: todayMeta.labelBn,
  };
}
