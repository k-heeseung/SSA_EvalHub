/** Common visual primitives. Domain validation and state remain with each caller. */
export function Button({ variant = 'secondary', className = '', type = 'button', ...props }) {
  return <button type={type} className={`ui-button ui-button--${variant} ${className}`} {...props} />;
}

export function Input({ className = '', ...props }) {
  return <input className={`ui-input ${className}`} {...props} />;
}

export function TextArea({ className = '', ...props }) {
  return <textarea className={`ui-input ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return <select className={`ui-input ${className}`} {...props}>{children}</select>;
}

export function Card({ className = '', children, ...props }) {
  return <section className={`ui-card ${className}`} {...props}>{children}</section>;
}

export function TableScroll({ className = '', children, ...props }) {
  return <div className={`ui-table-scroll ${className}`} {...props}>{children}</div>;
}
