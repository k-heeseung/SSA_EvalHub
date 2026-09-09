import { Fragment } from 'react';

// 매니저 화면 공통 상단 배너.
// 브레드크럼 + 제목 + 부제를 하나의 카드로 묶고, 우측 액션 영역은 children으로 받는다.
//
// breadcrumb: 문자열 또는 { label, onClick } 객체의 배열.
//   - onClick이 있으면 클릭 가능한 버튼으로, 없으면 텍스트로 렌더링한다.
//   - 마지막 항목은 현재 위치로 간주해 진하게 표시한다.
export default function PageHeader({ breadcrumb = [], title, subtitle, children }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 bg-white rounded-xl border border-gray-200 px-6 py-5">
      <div className="min-w-0">
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            {breadcrumb.map((crumb, i) => {
              const item = typeof crumb === 'string' ? { label: crumb } : crumb;
              const isLast = i === breadcrumb.length - 1;
              return (
                <Fragment key={i}>
                  {i > 0 && <span>›</span>}
                  {item.onClick ? (
                    <button
                      onClick={item.onClick}
                      className="hover:text-gray-600 cursor-pointer transition-colors"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span className={isLast ? 'text-gray-600 font-medium' : ''}>{item.label}</span>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
        {title && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </div>
  );
}
