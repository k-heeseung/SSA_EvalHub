import { useId } from 'react';
import { createPortal } from 'react-dom';

export default function ApplicationDeadlineDialog({ message, onConfirm }) {
  const id = useId();
  if (!message) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[1px]">
      <div role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id={`${id}-title`} className="text-lg font-bold text-gray-900">지원 마감 안내</h2>
        <p id={`${id}-message`} className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
        <button type="button" autoFocus onClick={onConfirm}
          onKeyDown={(event) => { if (event.key === 'Tab') event.preventDefault(); }}
          className="mt-6 w-full cursor-pointer rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          확인
        </button>
      </div>
    </div>, document.body,
  );
}
