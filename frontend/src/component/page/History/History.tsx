import { useState } from 'react';
import { Alert, Stack, Typography } from '@mui/material';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSnapshotQuery } from '../../../api/api';
import { DASHBOARD_ROUTE } from '../../../book/routes';
import type { Home } from '../../../entity/Home';
import Failure from '../../common/Failure/Failure';
import Loading from '../../common/Loading/Loading';
import MeasurementHistory, { HistoryRange } from './MeasurementHistory';

interface HistoryProps { homes: Home[] }

export default function History({ homes }: HistoryProps) {
  const { homeId, measurementId } = useParams();
  const { t } = useTranslation();
  const home = homes.find(item => item.id === homeId);
  const [hours, setHours] = useState(6);
  const snapshot = useSnapshotQuery(homeId ?? '', { skip: !home });
  const measurement = snapshot.currentData?.rooms.flatMap(room => room.measurements).find(item => item.id === measurementId);
  
  if (!home) return <Navigate to={DASHBOARD_ROUTE} replace />;

  return <Stack spacing={3}>
    {snapshot.isError && <Failure retry={() => void snapshot.refetch()} />}

    {snapshot.isLoading && <Loading />}

    {measurement && <>
      <Typography variant="h3" sx={{ fontSize: { xs: 32, md: 44 }, fontWeight: 600 }}>{t(measurement.kind)}</Typography>
      <Typography color="text.secondary">{measurement.deviceName} · {measurement.unit}</Typography>

      {!measurement.hasHistory ? <Alert severity="info">{t('historyMissing')}</Alert> : <>
        <HistoryRange hours={hours} change={setHours} />
        <MeasurementHistory home={home} measurement={measurement} hours={hours} />
      </>}
    </>}
    {snapshot.isSuccess && !measurement && <Alert severity="info">{t('notFound')}</Alert>}
  </Stack>;
}
