import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { applicationPeriod } from '../utils/applicationPeriod';
import { scheduleNow } from '../utils/programSchedule';

// An open editor keeps its UI state until an action explicitly checks the period.
export function useApplicationEditorPeriod(program, queryKey, receivedAt, select = (data) => data) {
  const queryClient = useQueryClient();
  const scope = `${JSON.stringify(queryKey)}:${program?.applicationId ?? ''}`;
  const initialized = useRef(null);
  const [checked, setChecked] = useState(null);
  const readPeriod = useCallback(() => {
    const latest = queryClient.getQueryState(queryKey);
    const data = select(latest?.data);
    return applicationPeriod(data, scheduleNow(data?.schedule, latest?.dataUpdatedAt, Date.now()));
  }, [queryClient, queryKey, select]);
  useEffect(() => {
    if (!program) return;
    const previous = initialized.current;
    if (previous?.scope === scope && previous.receivedAt === receivedAt) return;
    initialized.current = { scope, receivedAt };
    const period = readPeriod();
    if (previous?.scope !== scope) setChecked({ scope, period });
    else {
      // A freshly extended period may unlock an editor. Refreshes never lock it.
      setChecked((current) => current?.scope === scope && !current.period.applicationOpen && period.applicationOpen
        ? { scope, period } : current);
    }
  }, [program, scope, receivedAt, readPeriod]);
  const checkPeriod = () => {
    const period = readPeriod();
    setChecked({ scope, period });
    return period;
  };
  const initial = applicationPeriod(program, scheduleNow(program?.schedule, receivedAt, receivedAt || 0));
  return { period: checked?.scope === scope ? checked.period : initial, checkPeriod };
}
