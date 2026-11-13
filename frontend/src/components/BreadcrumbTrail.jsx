import { Fragment, useContext } from 'react';
import { createPortal } from 'react-dom';
import AdminBreadcrumbContext from '../contexts/AdminBreadcrumbContext';

export default function BreadcrumbTrail({ items = [] }) {
  const target = useContext(AdminBreadcrumbContext);
  if (!items.length) return null;
  const trail = <nav aria-label="현재 위치" className="ui-breadcrumb flex flex-wrap items-center gap-2 mb-1">
    {items.map((crumb, index) => {
      const item = typeof crumb === 'string' ? { label: crumb } : crumb;
      const last = index === items.length - 1;
      return <Fragment key={index}>
        {index > 0 && <span aria-hidden="true" className="breadcrumb-separator">›</span>}
        {item.onClick ? <button type="button" onClick={item.onClick} className="hover:text-gray-600 cursor-pointer transition-colors" aria-current={last ? 'page' : undefined}>{item.label}</button>
          : <span className={last ? 'text-gray-600 font-medium' : ''} aria-current={last ? 'page' : undefined}>{item.label}</span>}
      </Fragment>;
    })}
  </nav>;
  if (target === undefined) return trail;
  return target ? createPortal(trail, target) : null;
}
