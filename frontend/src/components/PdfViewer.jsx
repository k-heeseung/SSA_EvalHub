import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// pdf.js 워커. Vite가 워커 파일을 별도 에셋으로 번들링하도록 import.meta.url을 사용한다.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// '쪽 맞춤'은 분할 화면에서 배율이 0.5 아래로 내려가는 일이 흔하므로 하한을 낮게 잡는다.
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const SCALE_STEP = 0.2;
const FIT_MARGIN = 24; // '쪽 맞춤'에서 페이지 위아래로 남길 여백

const PAD_Y = 16; // 문서 영역 위/아래 여백 (py-4)
const GAP = 16; // 페이지 사이 간격
const DEFAULT_RATIO = 297 / 210; // 아직 크기를 모르는 페이지는 A4 세로 비율로 자리를 잡아둔다.
const OVERSCAN = 1; // 화면에 보이는 구간의 앞뒤로 몇 장을 더 미리 렌더링할지

// 첨부 PDF는 인증(JWT httpOnly 쿠키) 뒤에 있으므로 자격 증명을 함께 전송한다.
function useFileSource(url) {
  return useMemo(() => ({ url, withCredentials: true }), [url]);
}

export default function PdfViewer({ url, filename, className = '' }) {
  const file = useFileSource(url);
  const containerRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageDraft, setPageDraft] = useState(null); // 페이지 번호 입력 중인 값
  const [pageRatios, setPageRatios] = useState([]); // 페이지별 height/width
  const [visibleRange, setVisibleRange] = useState({ first: 0, last: 0 }); // 화면에 걸친 페이지 구간 (0-based)
  const [scale, setScale] = useState(1); // fitMode가 'width'일 때 쓰는 수동 배율
  const [fitMode, setFitMode] = useState('width'); // width(폭 맞춤) | page(쪽 맞춤)
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [prevUrl, setPrevUrl] = useState(url);

  // 문서 로드 세대 토큰. 파일이 바뀌면 진행 중이던 페이지 크기 계산 결과를 버린다.
  const loadTokenRef = useRef(0);

  // 파일이 바뀌면 페이지/배율/상태를 초기화한다. (렌더 중 상태 조정 패턴)
  if (url !== prevUrl) {
    setPrevUrl(url);
    setPageNumber(1);
    setPageRatios([]);
    setVisibleRange({ first: 0, last: 0 });
    setScale(1);
    setStatus('loading');
  }

  // 파일이 바뀌면 토큰을 올려, 이전 파일에 대해 진행 중이던 크기 계산을 무효화한다.
  useEffect(() => {
    loadTokenRef.current += 1;
  }, [url]);

  // 컨테이너 크기를 추적한다. 폭은 '폭 맞춤(scale=1)' 기준, 높이는 '쪽 맞춤' 배율 계산에 쓴다.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box?.width) setContainerWidth(box.width);
      if (box?.height) setContainerHeight(box.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 문서를 열면 총 페이지 수를 먼저 반영하고, 페이지별 실제 비율은 뒤이어 채운다.
  const onLoadSuccess = useCallback(async (pdf) => {
    const token = loadTokenRef.current;
    setNumPages(pdf.numPages);
    setStatus('ready');

    const ratios = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      if (loadTokenRef.current !== token) return;
      const viewport = page.getViewport({ scale: 1 });
      ratios.push(viewport.height / viewport.width);
    }
    setPageRatios(ratios);
  }, []);

  const onLoadError = useCallback(() => setStatus('error'), []);

  // '쪽 맞춤' 배율. 스크롤 중에 배율이 흔들리지 않도록 현재 페이지가 아니라
  // 문서에서 가장 세로로 긴 페이지를 기준으로 잡아, 어느 페이지든 한 장이 다 들어오게 한다.
  const maxRatio = useMemo(
    () => (pageRatios.length ? pageRatios.reduce((m, r) => (r > m ? r : m), 0) : DEFAULT_RATIO),
    [pageRatios],
  );
  const fitPageScale = useMemo(() => {
    if (!containerWidth || !containerHeight) return 1;
    const raw = (containerHeight - FIT_MARGIN) / ((containerWidth - 32) * maxRatio);
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(raw * 100) / 100));
  }, [containerWidth, containerHeight, maxRatio]);

  const effectiveScale = fitMode === 'page' ? fitPageScale : scale;

  // 렌더링 폭: 컨테이너 폭에서 좌우 여백을 제외한 값 × 배율.
  const pageWidth = containerWidth ? Math.max(240, Math.round((containerWidth - 32) * effectiveScale)) : 0;

  // 페이지별 높이와 누적 오프셋. 계산한 높이를 style로 그대로 박아 넣으므로
  // 스크롤 위치 계산과 실제 DOM 위치가 어긋나지 않는다.
  const pageHeights = useMemo(
    () => Array.from({ length: numPages }, (_, i) => Math.round(pageWidth * (pageRatios[i] ?? DEFAULT_RATIO))),
    [numPages, pageWidth, pageRatios],
  );
  const pageOffsets = useMemo(() => {
    let acc = PAD_Y;
    return pageHeights.map((h) => {
      const top = acc;
      acc += h + GAP;
      return top;
    });
  }, [pageHeights]);

  // 스크롤 핸들러(등록 시점 고정)와 레이아웃 이펙트에서 최신 값을 읽기 위한 미러.
  // 아래 '폭 변경 시 위치 복원' 이펙트보다 먼저 선언해 두어야 그 시점에 최신 값이 들어 있다.
  const pageOffsetsRef = useRef(pageOffsets);
  const pageHeightsRef = useRef(pageHeights);
  const pageNumberRef = useRef(pageNumber);
  useLayoutEffect(() => {
    pageOffsetsRef.current = pageOffsets;
    pageHeightsRef.current = pageHeights;
    pageNumberRef.current = pageNumber;
  }, [pageOffsets, pageHeights, pageNumber]);

  const scrollToPage = useCallback((n) => {
    const el = containerRef.current;
    const top = pageOffsetsRef.current[n - 1];
    if (!el || top == null) return;
    el.scrollTo({ top: Math.max(0, top - 8) });
  }, []);

  // 스크롤 위치에서 (1) 툴바에 표시할 현재 페이지와 (2) 실제로 화면에 걸친 페이지 구간을 역산한다.
  // 높이를 style로 직접 지정해 두었으므로 DOM을 읽지 않고 숫자 계산만으로 끝난다. (스크롤 중 reflow 없음)
  const measure = useCallback(() => {
    const el = containerRef.current;
    const offsets = pageOffsetsRef.current;
    const heights = pageHeightsRef.current;
    if (!el || offsets.length === 0) return;

    const top = el.scrollTop;
    const bottom = top + el.clientHeight;

    let first = 0;
    let last = -1;
    let current = 1;
    const probe = top + el.clientHeight * 0.3; // 컨테이너 상단 30% 지점을 '현재 페이지' 기준선으로 삼는다.

    for (let i = 0; i < offsets.length; i += 1) {
      const pageTop = offsets[i];
      const pageBottom = pageTop + heights[i];
      if (pageTop <= probe) current = i + 1;
      if (pageBottom <= top) continue; // 화면 위로 완전히 지나간 페이지
      if (pageTop >= bottom) break; // 화면 아래에 아직 안 들어온 페이지
      if (last < 0) first = i;
      last = i;
    }
    if (last < 0) last = first; // 계산이 비면 최소 한 장은 렌더링한다.

    setPageNumber((p) => (p === current ? p : current));
    setVisibleRange((r) => (r.first === first && r.last === last ? r : { first, last }));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [measure]);

  // 스크롤 없이도 구간이 달라지는 경우(문서 로드, 확대/축소, 창 크기 변경, 페이지 비율 반영)를 따라간다.
  useEffect(() => {
    measure();
  }, [measure, pageOffsets, status]);

  // 확대/축소나 창 크기 변경으로 페이지 폭이 달라져도 보고 있던 페이지를 유지한다.
  // pageWidth가 바뀔 때만 개입하고, 스크롤로 페이지가 넘어갈 때는 건드리지 않는다.
  useLayoutEffect(() => {
    if (!pageWidth || status !== 'ready') return;
    scrollToPage(pageNumberRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, status]);

  // 확대 상태에서는 드래그로 화면을 끌 수 있게 한다.
  // 단, 텍스트 위에서 시작한 드래그는 그대로 텍스트 선택으로 넘긴다.
  const panRef = useRef(null);
  const canPan = effectiveScale > 1;

  const onPointerDown = (e) => {
    const el = containerRef.current;
    if (!el || e.button !== 0) return;
    if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return;
    if (e.target.closest?.('.react-pdf__Page__textContent')) return;
    panRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const pan = panRef.current;
    const el = containerRef.current;
    if (!pan || !el) return;
    el.scrollLeft = pan.left - (e.clientX - pan.x);
    el.scrollTop = pan.top - (e.clientY - pan.y);
  };
  const endPan = (e) => {
    if (!panRef.current) return;
    panRef.current = null;
    containerRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const goPrev = () => scrollToPage(Math.max(1, pageNumber - 1));
  const goNext = () => scrollToPage(Math.min(numPages, pageNumber + 1));
  // 수동 확대/축소는 현재 보이는 배율에서 출발하고, 맞춤 모드를 빠져나온다.
  const zoomTo = (next) => {
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(next * 100) / 100)));
    setFitMode('width');
  };
  const zoomOut = () => zoomTo(effectiveScale - SCALE_STEP);
  const zoomIn = () => zoomTo(effectiveScale + SCALE_STEP);
  const fitWidth = () => {
    setScale(1);
    setFitMode('width');
  };
  const fitPage = () => setFitMode('page');

  const commitPageDraft = () => {
    const n = Number.parseInt(pageDraft, 10);
    if (Number.isFinite(n)) scrollToPage(Math.min(numPages, Math.max(1, n)));
    setPageDraft(null);
  };

  return (
    <div className={`flex flex-col bg-gray-100 min-h-0 ${className}`}>
      {/* 툴바 */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-white border-b border-gray-200">
        <ToolbarButton onClick={goPrev} disabled={status !== 'ready' || pageNumber <= 1} title="이전 페이지">
          <ChevronLeftIcon />
        </ToolbarButton>
        <div className="flex items-center gap-1 px-1 text-xs font-medium text-gray-600 tabular-nums">
          <input
            value={pageDraft ?? (status === 'ready' ? String(pageNumber) : '—')}
            onChange={(e) => setPageDraft(e.target.value.replace(/[^0-9]/g, ''))}
            onFocus={() => setPageDraft(String(pageNumber))}
            onBlur={commitPageDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setPageDraft(null);
            }}
            disabled={status !== 'ready'}
            title="페이지 번호로 이동"
            aria-label="페이지 번호"
            className="w-9 px-1 py-0.5 text-center rounded border border-gray-200 tabular-nums focus:outline-none focus:border-blue-400 disabled:opacity-40"
          />
          <span className="text-gray-400 select-none">/ {status === 'ready' ? numPages : '—'}</span>
        </div>
        <ToolbarButton onClick={goNext} disabled={status !== 'ready' || pageNumber >= numPages} title="다음 페이지">
          <ChevronRightIcon />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-200 mx-1.5" />

        <ToolbarButton onClick={zoomOut} disabled={status !== 'ready' || effectiveScale <= MIN_SCALE} title="축소">
          <MinusIcon />
        </ToolbarButton>
        <span className="px-2 py-1 text-xs font-medium text-gray-500 tabular-nums min-w-[48px] text-center select-none">
          {status === 'ready' ? `${Math.round(effectiveScale * 100)}%` : '—'}
        </span>
        <ToolbarButton onClick={zoomIn} disabled={status !== 'ready' || effectiveScale >= MAX_SCALE} title="확대">
          <PlusIcon />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-200 mx-1.5" />

        {/* 맞춤 모드: 폭 맞춤은 가로로 꽉 채워 크게 보고, 쪽 맞춤은 한 장이 통째로 들어오게 한다. */}
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
          <FitButton onClick={fitWidth} active={fitMode === 'width' && scale === 1} disabled={status !== 'ready'} title="폭에 맞춰 보기">
            폭 맞춤
          </FitButton>
          <div className="w-px self-stretch bg-gray-200" />
          <FitButton onClick={fitPage} active={fitMode === 'page'} disabled={status !== 'ready'} title="한 페이지가 다 보이도록 맞추기">
            쪽 맞춤
          </FitButton>
        </div>

        <div className="ml-auto flex items-center gap-2 min-w-0">
          {filename && (
            <span className="text-xs text-gray-400 truncate max-w-[360px] hidden sm:inline" title={filename}>
              {filename}
            </span>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="새 탭에서 열기"
            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <ExternalLinkIcon />
          </a>
        </div>
      </div>

      {/* 문서 영역: 전체 페이지를 세로로 이어 붙여 연속 스크롤로 읽는다. */}
      <div
        ref={containerRef}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        className={`flex-1 overflow-auto min-h-0 focus:outline-none ${canPan ? 'cursor-grab' : ''}`}
      >
        {status === 'error' ? (
          <ErrorState url={url} />
        ) : (
          <Document
            file={file}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading={<CenteredMessage><Spinner />PDF를 불러오는 중…</CenteredMessage>}
            error={<ErrorState url={url} />}
            className="py-4"
          >
            {status === 'ready' && pageWidth > 0 && pageHeights.map((height, i) => {
              const n = i + 1;
              // 화면에 걸친 구간 + 앞뒤 여유분만 실제로 그리고, 나머지는 같은 크기의 빈 자리로 남겨둔다.
              const rendered = i >= visibleRange.first - OVERSCAN && i <= visibleRange.last + OVERSCAN;
              return (
                <div
                  key={n}
                  data-page={n}
                  style={{ width: pageWidth, height, marginLeft: 'auto', marginRight: 'auto', marginBottom: GAP }}
                  className="relative bg-white shadow-sm overflow-hidden"
                >
                  {rendered ? (
                    <Page pageNumber={n} width={pageWidth} loading={null} />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-300 tabular-nums select-none">
                      {n}
                    </div>
                  )}
                </div>
              );
            })}
          </Document>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, disabled, title, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
    >
      {children}
    </button>
  );
}

function FitButton({ onClick, active, disabled, title, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function CenteredMessage({ children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-gray-400">
      {children}
    </div>
  );
}

function ErrorState({ url }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm text-gray-500">PDF를 불러오지 못했습니다.</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
      >
        새 탭에서 열어보기
      </a>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const MinusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);
