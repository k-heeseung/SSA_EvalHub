import { Component } from 'react';

// Suspense는 로딩만 처리하므로 모듈 로드/렌더 오류는 자료 영역에서 격리한다.
export default class PdfViewerErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-sm text-gray-600">
          <p>PDF 뷰어를 불러오지 못했습니다. 입력 중인 심사 내용은 유지됩니다.</p>
          <p>심사 내용을 저장한 뒤 페이지를 새로고침해 주세요.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
