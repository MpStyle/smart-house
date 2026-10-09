import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart } from '@mui/x-charts/LineChart';
import { formatTime, historySeries } from './measurements';
import type { History } from './types';

export default function HistoryChart({ history, label, language, timezone, hours }: {
  history: History; label: string; language: string; timezone: string; hours: number;
}) {
  const { t } = useTranslation();
  const series = useMemo(() => historySeries(history.points), [history.points]);
  return <LineChart
    height={350}
    xAxis={[{
      data: series.map(point => point.time), scaleType: 'time',
      min: new Date(history.from), max: new Date(history.to),
      valueFormatter: value => formatTime(new Date(value).toISOString(), timezone, language, hours > 12),
    }]}
    series={[{
      data: series.map(point => point.value), label: `${label} (${history.unit})`,
      curve: 'linear', showMark: false, connectNulls: false,
      valueFormatter: value => value === null ? t('unavailable')
        : `${new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value)} ${history.unit}`,
    }]}
    grid={{ horizontal: true }}
  />;
}
