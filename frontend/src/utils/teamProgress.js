export function teamProgress(result, available = true) {
  if (!available || !result || !Array.isArray(result.evaluations)) {
    return { status: 'UNKNOWN', assigned: 0, completed: 0 };
  }
  const assigned = result.evaluations.length;
  const completed = result.evaluations.filter((item) => item.submission?.status === 'SUBMITTED').length;
  const started = result.evaluations.some((item) => item.submission != null);
  return {
    assigned, completed,
    status: assigned === 0 ? 'UNASSIGNED' : completed === assigned ? 'COMPLETE' : started ? 'IN_PROGRESS' : 'PENDING',
  };
}

export function programProgress(teams, results, available = true) {
  const byTeam = new Map(results.map((result) => [result.teamId, result]));
  const rows = teams.map((team, index) => ({ ...team, number: index + 1, progress: teamProgress(byTeam.get(team.teamId), available) }));
  const known = available && rows.every((team) => team.progress.status !== 'UNKNOWN');
  const assigned = rows.reduce((sum, team) => sum + team.progress.assigned, 0);
  const completed = rows.reduce((sum, team) => sum + team.progress.completed, 0);
  return { rows, known, assigned, completed, rate: known && assigned > 0 ? Math.round(completed / assigned * 100) : null };
}
