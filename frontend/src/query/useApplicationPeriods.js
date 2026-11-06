import { useQueryClient } from '@tanstack/react-query';
import { useScheduleNow } from './useScheduleNow';
import { scheduleNow } from '../utils/programSchedule';
import { applicationPeriod } from '../utils/applicationPeriod';

// Rendering ticks every second; event handlers read the latest cache and current time.
export function useApplicationPeriods(queryKey, receivedAt) {
  const clientNow = useScheduleNow();
  const queryClient = useQueryClient();
  const periodFor = (program) => applicationPeriod(program, scheduleNow(program?.schedule, receivedAt, clientNow));
  const currentPeriodFor = (select = (data) => data) => {
    const latest = queryClient.getQueryState(queryKey);
    const program = select(latest?.data);
    return applicationPeriod(program, scheduleNow(program?.schedule, latest?.dataUpdatedAt, Date.now()));
  };
  return { periodFor, currentPeriodFor };
}
