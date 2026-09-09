import { formatPhone } from '../utils/phone';

// 팀 구성원(팀장 + 팀원)을 이름/이메일/연락처 열이 정렬된 목록으로 보여준다.
// 매니저 팀 상세와 지원자 제출 화면에서 공통으로 사용한다.
// 연락처는 숫자만 저장되므로 표시할 때 formatPhone으로 하이픈을 붙인다.
export default function TeamMemberList({ leaderName, leaderEmail, members = [], phone }) {
  const rows = [
    { name: leaderName, email: leaderEmail, phone, leader: true },
    ...members.map((m) => ({ name: m.name, email: m.email, phone: m.phone, leader: false })),
  ];

  return (
    <div>
      <div className="text-xs font-medium text-gray-400 mb-2">팀 구성원 {rows.length}명</div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="w-32 flex-shrink-0 flex items-center gap-1.5 min-w-0">
              <span className="text-gray-800 font-medium truncate">{r.name || '—'}</span>
              {r.leader && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">팀장</span>
              )}
            </span>
            <span className="flex-1 min-w-0 text-gray-500 break-all">{r.email || '—'}</span>
            <span className="w-32 flex-shrink-0 text-gray-500 tabular-nums">{formatPhone(r.phone) || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
