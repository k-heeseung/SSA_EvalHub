import BreadcrumbTrail from './BreadcrumbTrail';

// 매니저 화면 공통 상단 배너.
// 제목·부제·액션 패널은 유지한다. 매니저의 경로만 공통 상단 바로 옮긴다.
//
// breadcrumb: 문자열 또는 { label, onClick } 객체의 배열.
//   - onClick이 있으면 클릭 가능한 버튼으로, 없으면 텍스트로 렌더링한다.
//   - 마지막 항목은 현재 위치로 간주해 진하게 표시한다.
export default function PageHeader({ breadcrumb = [], title, subtitle, children, stackOnSmall = false, className = '' }) {
  return (
    <div className={`ui-card ui-page-header ${stackOnSmall ? 'flex-col sm:flex-row' : ''} ${className}`}>
      <div className="min-w-0">
        <BreadcrumbTrail items={breadcrumb} />
        {title && <h1 className="ui-page-title text-gray-900">{title}</h1>}
        {subtitle && <p className="ui-page-description">{subtitle}</p>}
      </div>
      {children && <div className="ui-page-header-actions">{children}</div>}
    </div>
  );
}
