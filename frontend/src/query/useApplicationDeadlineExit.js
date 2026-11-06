import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { applicationDeadlineNotice } from '../utils/applicationPeriod';

export function useApplicationDeadlineExit() {
  const navigate = useNavigate();
  const [operation, setOperation] = useState(null);
  const exitForDeadline = (action = '제출·수정') => setOperation(action);
  const confirmDeadlineExit = () => {
    setOperation(null);
    navigate('/applicant', { replace: true });
  };
  return { exitForDeadline, confirmDeadlineExit,
    deadlineNotice: operation === null ? null : applicationDeadlineNotice(operation) };
}
