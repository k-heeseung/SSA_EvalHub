import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signup } from '../api/applications';
import { formatPhoneInput, isValidPhone, toDigits } from '../utils/phone';

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: '약함', color: 'bg-red-400' };
  if (score === 2) return { score, label: '보통', color: 'bg-amber-400' };
  if (score === 3) return { score, label: '강함', color: 'bg-blue-500' };
  return { score, label: '안전함', color: 'bg-green-500' };
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', department: '', studentId: '',
    password: '', passwordConfirm: '',
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  // 휴대폰은 타이핑하는 동안 하이픈을 자동으로 붙이고, 서버에는 숫자만 보낸다.
  const setPhone = (e) => setForm((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }));

  const strength = getPasswordStrength(form.password);
  const emailValid = form.email.includes('@') && form.email.length > 4;
  const passwordMatch = form.password && form.passwordConfirm && form.password === form.passwordConfirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password || !form.passwordConfirm) {
      setError('필수 항목을 모두 입력해주세요.');
      return;
    }
    if (!emailValid) { setError('올바른 이메일 주소를 입력해주세요.'); return; }
    if (form.phone && !isValidPhone(form.phone)) { setError('올바른 휴대폰 번호를 입력해주세요.'); return; }
    if (form.password !== form.passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (strength.score < 2) { setError('비밀번호가 너무 약합니다.'); return; }
    if (!agreeTerms) { setError('서비스 이용약관에 동의해주세요.'); return; }

    setSubmitting(true);
    try {
      await signup({
        email: form.email,
        password: form.password,
        name: form.name,
        phone: toDigits(form.phone) || null,
        department: form.department,
      });
      navigate('/login');
    } catch (err) {
      if (err.response?.status === 409) {
        setError('이미 가입된 이메일입니다.');
      } else {
        setError('회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 좌측 패널 */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 flex-col bg-gradient-to-br from-slate-100 to-blue-50 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-blue-100/60" />
          <div className="absolute top-1/3 -right-10 w-48 h-48 rounded-full bg-indigo-100/40" />
          <div className="absolute -bottom-16 left-1/4 w-64 h-64 rounded-full bg-blue-50/80" />
        </div>

        <div className="relative flex flex-col h-full px-10 py-8">
          {/* 로고 */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">E</div>
            <div>
              <div className="text-sm font-bold text-gray-800 leading-none">EVALHUB</div>
              <div className="text-[10px] text-gray-500 mt-0.5">SKKU · AI 중심대학사업단</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-widest text-blue-500 uppercase mb-4">
              Applicant Sign Up
            </p>
            <h2 className="text-3xl font-bold text-gray-900 leading-snug mb-4">
              계정을 만들고<br />프로그램에<br />지원하세요
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              회원가입 후 여러 프로그램에 지원하고, 지원서 임시저장·수정·제출 현황을 한 곳에서 관리할 수 있습니다.
            </p>

            <div className="space-y-3">
              {[
                '하나의 계정으로 여러 프로그램 지원',
                '지원서 자동 임시저장 · 마감 전 수정',
                '팀 구성·제출물 관리',
              ].map((text) => (
                <div key={text} className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-600">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-gray-400">© 2026 Sungkyunkwan University</p>
        </div>
      </div>

      {/* 우측 폼 패널 */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-white overflow-y-auto">
        <div className="w-full max-w-sm">
          <p className="text-xs font-medium text-blue-600 mb-1">회원가입</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">지원자 계정 만들기</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이름 + 휴대폰 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">휴대폰</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={setPhone}
                  placeholder="010-0000-0000"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                이메일 <span className="text-gray-400 font-normal">· 로그인 아이디로 사용</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-24"
                />
                {emailValid && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-green-600 font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    사용 가능
                  </span>
                )}
              </div>
            </div>

            {/* 소속 대학/학과 + 학번 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">소속 대학/학과</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={set('department')}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">학번</label>
                <input
                  type="text"
                  value={form.studentId}
                  onChange={set('studentId')}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {/* 강도 바 */}
              {form.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                          i <= strength.score ? strength.color : 'bg-gray-100'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    영문·숫자·특수문자 포함 10자 이상 ·{' '}
                    <span className={`font-medium ${
                      strength.score <= 1 ? 'text-red-500' :
                      strength.score === 2 ? 'text-amber-500' :
                      strength.score === 3 ? 'text-blue-500' : 'text-green-600'
                    }`}>{strength.label}</span>
                  </p>
                </div>
              )}
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호 확인</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={form.passwordConfirm}
                  onChange={set('passwordConfirm')}
                  className={`w-full px-3.5 py-2.5 pr-16 border rounded-lg text-sm focus:ring-2 outline-none ${
                    form.passwordConfirm
                      ? passwordMatch
                        ? 'border-green-400 focus:ring-green-400'
                        : 'border-red-300 focus:ring-red-400'
                      : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    tabIndex={-1}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                  {form.passwordConfirm && (
                    passwordMatch ? (
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* 약관 동의 */}
            <div className="space-y-2.5 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer mt-0.5 flex-shrink-0"
                />
                <span className="text-sm text-gray-700">
                  <span className="text-blue-600 font-medium">[필수]</span> 서비스 이용약관 및 개인정보 처리방침 동의
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreeMarketing}
                  onChange={(e) => setAgreeMarketing(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer mt-0.5 flex-shrink-0"
                />
                <span className="text-sm text-gray-600">
                  <span className="text-gray-400 font-medium">[선택]</span> 프로그램 소식·마감 알림 수신 동의
                </span>
              </label>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {submitting ? '처리 중...' : '회원가입 완료'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            이미 계정이 있으신가요?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-blue-600 font-medium hover:text-blue-800 cursor-pointer"
            >
              로그인
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m2.014-2.136A9.966 9.966 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-1.993 3.26M6.32 6.32L3 3m18 18l-3.32-3.32M9.88 9.88a3 3 0 104.243 4.243" />
    </svg>
  );
}
