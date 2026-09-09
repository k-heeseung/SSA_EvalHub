export const PROGRAM_TYPE_LABEL = {
  MODULE_A: '프로그램 지원/심사 시스템',
  MODULE_B: '팀/프로젝트 평가',
};

export const programTypeLabel = (type) => PROGRAM_TYPE_LABEL[type] || type;
