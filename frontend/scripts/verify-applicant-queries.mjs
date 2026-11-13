import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: Page } = await server.ssrLoadModule('/src/pages/ApplicantHomePage.jsx');
  const { default: ProgramInfo } = await server.ssrLoadModule('/src/components/ApplicantProgramInfo.jsx');
  const { default: Detail } = await server.ssrLoadModule('/src/pages/ApplicantProgramPage.jsx');
  const { queryKeys: keys } = await server.ssrLoadModule('/src/query/keys.js');
  const program = { id: 1, title: '회귀 검증 프로그램', status: 'RECRUITING', schedule: {
    serverNow: new Date().toISOString(), applicationStartAt: '2020-01-01T00:00:00+09:00', applicationDeadlineAt: '2099-01-01T00:00:00+09:00',
  } };
  function render(programStatus = 'success', appStatus = 'success', { cached = false, fetching = false, empty = false, submitted = false, detail = false, scheduled = false, applications = null } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, gcTime: Infinity } } });
    client.setQueryData(keys.currentUser, { name: '지원자' });
    for (const [key, status, data] of [
      [keys.openPrograms, programStatus, empty ? [] : [{ ...program, schedule: { ...program.schedule, ...(scheduled ? { applicationStartAt: '2098-01-01T00:00:00+09:00' } : {}) } }]],
      [keys.myApplications, appStatus, applications ?? (submitted ? [{ programId: 1, applicationId: 2, programTitle: program.title, status: 'SUBMITTED' }] : [])],
    ]) {
      if (status === 'success' || cached) client.setQueryData(key, data);
      const query = client.getQueryCache().build(client, { queryKey: key });
      query.setState({ status, fetchStatus: fetching && status === 'error' ? 'fetching' : 'idle', error: status === 'error' ? new Error('검증 오류') : null });
    }
    const html = renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: [detail ? '/applicant/programs/1' : '/applicant'] }, h(Routes, {}, h(Route, { path: '/applicant', element: h(Page) }), h(Route, { path: '/applicant/programs/:programId', element: h(Detail) })))));
    client.clear();
    return html;
  }
  const button = (html, text) => (html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || []).find(tag => tag.includes(text));
  const checks = [
    ['program-only failure is not an empty result', () => {
      const html = render('error');
      assert.match(html, /프로그램 목록 조회에 실패/);
      assert.ok(button(html, '프로그램 목록 다시 시도'));
      assert.doesNotMatch(html, /현재 모집 중인 프로그램이 없습니다/);
    }],
    ['application-only failure keeps programs but prevents new applications', () => {
      const html = render('success', 'error', { detail: true });
      assert.match(html, /회귀 검증 프로그램/);
      assert.match(html, /내 지원서 조회에 실패/);
      assert.match(button(html, '지원 여부 확인 불가'), / disabled=""/);
      assert.ok(button(html, '내 지원서 다시 시도'));
      assert.doesNotMatch(button(html, '지원 여부 확인 불가'), /지원서 작성 시작/);
    }],
    ['both failures have separate retries', () => {
      const html = render('error', 'error');
      assert.ok(button(html, '프로그램 목록 다시 시도'));
      assert.ok(button(html, '내 지원서 다시 시도'));
    }],
    ['pending application lookup cannot start a new application', () => {
      assert.match(button(render('success', 'pending', { detail: true }), '지원 여부 확인 중...'), / disabled=""/);
    }],
    ['cached data does not bypass a failed application refresh', () => {
      assert.match(button(render('success', 'error', { detail: true, cached: true, submitted: true }), '지원 여부 확인 불가'), / disabled=""/);
    }],
    ['retry feedback disables repeated retry clicks', () => {
      assert.match(button(render('success', 'error', { fetching: true }), '내 지원서 재시도 중...'), / disabled=""/);
    }],
    ['successful empty programs show genuine empty state', () => {
      assert.match(render('success', 'success', { empty: true }), /현재 모집 중인 프로그램이 없습니다/);
    }],
    ['successful queries restore new and submitted application actions', () => {
      assert.doesNotMatch(button(render('success', 'success', { detail: true }), '지원서 작성 시작'), / disabled=""/);
      assert.ok(button(render('success', 'success', { detail: true, submitted: true }), '지원서 보기'));
    }],
    ['program contents are read-only and preserve full text safely', () => {
      const description = '첫 번째 문단\n' + '긴 설명 <script> & 확인 '.repeat(80);
      const html = renderToStaticMarkup(h(ProgramInfo, { program: { title: '안내 프로그램', description, eligibilityCriteria: '재학생\n개인 또는 팀' } }));
      assert.doesNotMatch(html, /<details|<summary|line-clamp/);
      assert.match(html, /프로그램 소개/);
      assert.match(html, /재학생\n개인 또는 팀/);
      assert.match(html, /&lt;script&gt;/);
      assert.ok(html.includes('긴 설명 &lt;script&gt; &amp; 확인 '.repeat(80).trim()));
      assert.doesNotMatch(html, /<button|<form|<script>/);
    }],
    ['missing or whitespace-only program text has explicit fallbacks', () => {
      const html = renderToStaticMarkup(h(ProgramInfo, { program: { title: '안내 없음', description: '  ', eligibilityCriteria: '\n' } }));
      assert.match(html, /등록된 프로그램 설명이 없습니다/);
      assert.match(html, /등록된 지원 자격 안내가 없습니다/);
    }],
    ['list cards only navigate to program details', () => {
      const html = render();
      assert.match(html, /href="\/applicant\/programs\/1"/);
      assert.doesNotMatch(html, /지원서 작성 시작|<details/);
    }],
    ['scheduled program details block creation and explain when to start', () => {
      const html = render('success', 'success', { detail: true, scheduled: true });
      assert.match(button(html, '접수 예정'), / disabled=""/);
      assert.match(html, /접수가 시작되면/);
    }],
    ['direct detail entry handles an unavailable program without creation', () => {
      const html = render('success', 'success', { detail: true, empty: true });
      assert.match(html, /프로그램 안내를 확인할 수 없습니다/);
      assert.doesNotMatch(html, /지원서 작성 시작/);
    }],
  ];
  checks.push(
    ['recruitment includes already-submitted programs without creating another application', () => {
      const html = render('success', 'success', { submitted: true });
      assert.match(html, /href="\/applicant\/programs\/1"/);
      assert.match(html, /지원 완료 <strong>1건/);
      assert.match(html, /href="\/applicant\/submissions"/);
      assert.doesNotMatch(html, /href="\/applicant\/submissions\/2"/);
    }],
    ['compact summary counts all drafts without claiming they can be submitted', () => {
      const apps = [
        { programId: 2, applicationId: 12, programTitle: '제출 가능한 초안', status: 'DRAFT', schedule: program.schedule },
        { programId: 3, applicationId: 13, programTitle: '마감된 초안', status: 'DRAFT', schedule: { ...program.schedule, applicationDeadlineAt: '2020-01-02T00:00:00+09:00' } },
      ];
      const html = render('success', 'success', { applications: apps });
      assert.match(html, /작성 중 <strong>2건/);
      assert.doesNotMatch(html, /제출 가능 · 작성 중|href="\/applicant\/apply\/12"|href="\/applicant\/apply\/13"/);
    }],
    ['unconfirmed application lookup does not invent zero counts', () => {
      const html = render('success', 'error');
      assert.match(html, /지원 현황을 확인할 수 없습니다/);
      assert.doesNotMatch(html, /작성 중 <strong>0건/);
    }],
    ['program failure does not hide the summary and full application link', () => {
      const html = render('error', 'success', { submitted: true });
      assert.match(html, /지원 완료 <strong>1건/);
      assert.match(html, /href="\/applicant\/submissions"/);
    }],
    ['upcoming tab includes already-started programs as well', () => {
      const html = render('success', 'success', { submitted: true, scheduled: true });
      assert.match(html, /href="\/applicant\/programs\/1"/);
    }],
    ['classification tabs have selected state and correctly linked panels', () => {
      const html = render();
      assert.match(html, /role="tablist"/);
      assert.match(html, /id="program-tab-open"[^>]*aria-selected="true"[^>]*aria-controls="program-panel-open"/);
      assert.match(html, /id="program-panel-open"[^>]*aria-labelledby="program-tab-open"/);
      assert.match(html, /id="program-panel-scheduled"[^>]*hidden=""/);
    }],
  );
  for (const [name, check] of checks) { check(); console.log(`PASS ${name}`); }
  console.log(`${checks.length} applicant query checks passed`);
} finally { await server.close(); }
