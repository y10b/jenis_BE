export const ErrorCodes = {
  // Auth Errors (1xxx)
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: '인증이 필요합니다.',
    statusCode: 401,
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: '이메일 또는 비밀번호가 올바르지 않습니다.',
    statusCode: 401,
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: '토큰이 만료되었습니다.',
    statusCode: 401,
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    message: '유효하지 않은 토큰입니다.',
    statusCode: 401,
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: '접근 권한이 없습니다.',
    statusCode: 403,
  },
  USER_INACTIVE: {
    code: 'USER_INACTIVE',
    message: '비활성화된 계정입니다. 관리자에게 문의하세요.',
    statusCode: 403,
  },
  USER_PENDING: {
    code: 'USER_PENDING',
    message: '승인 대기 중인 계정입니다.',
    statusCode: 403,
  },

  // Validation Errors (2xxx)
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: '입력값 검증에 실패했습니다.',
    statusCode: 400,
  },
  INVALID_EMAIL: {
    code: 'INVALID_EMAIL',
    message: '유효한 이메일 주소를 입력하세요.',
    statusCode: 400,
  },
  WEAK_PASSWORD: {
    code: 'WEAK_PASSWORD',
    message: '비밀번호는 8자 이상, 영문, 숫자, 특수문자를 포함해야 합니다.',
    statusCode: 400,
  },

  // Resource Errors (3xxx)
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: '요청한 리소스를 찾을 수 없습니다.',
    statusCode: 404,
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: '사용자를 찾을 수 없습니다.',
    statusCode: 404,
  },
  TEAM_NOT_FOUND: {
    code: 'TEAM_NOT_FOUND',
    message: '팀을 찾을 수 없습니다.',
    statusCode: 404,
  },
  TASK_NOT_FOUND: {
    code: 'TASK_NOT_FOUND',
    message: 'Task를 찾을 수 없습니다.',
    statusCode: 404,
  },

  // Conflict Errors (4xxx)
  CONFLICT: {
    code: 'CONFLICT',
    message: '리소스 충돌이 발생했습니다.',
    statusCode: 409,
  },
  EMAIL_ALREADY_EXISTS: {
    code: 'EMAIL_ALREADY_EXISTS',
    message: '이미 사용 중인 이메일입니다.',
    statusCode: 409,
  },
  TEAM_HAS_MEMBERS: {
    code: 'TEAM_HAS_MEMBERS',
    message: '팀에 소속된 멤버가 있어 삭제할 수 없습니다.',
    statusCode: 409,
  },
  USER_ALREADY_IN_TEAM: {
    code: 'USER_ALREADY_IN_TEAM',
    message: '사용자가 이미 해당 팀에 소속되어 있습니다.',
    statusCode: 409,
  },
  USER_NOT_IN_TEAM: {
    code: 'USER_NOT_IN_TEAM',
    message: '사용자가 해당 팀에 소속되어 있지 않습니다.',
    statusCode: 409,
  },
  CANNOT_REMOVE_TEAM_OWNER: {
    code: 'CANNOT_REMOVE_TEAM_OWNER',
    message: '팀 소유자는 팀에서 제외할 수 없습니다.',
    statusCode: 409,
  },

  // Integration Errors (5xxx)
  GITHUB_ERROR: {
    code: 'GITHUB_ERROR',
    message: 'GitHub 연동 중 오류가 발생했습니다.',
    statusCode: 502,
  },
  SLACK_ERROR: {
    code: 'SLACK_ERROR',
    message: 'Slack 연동 중 오류가 발생했습니다.',
    statusCode: 502,
  },
  INTEGRATION_NOT_CONNECTED: {
    code: 'INTEGRATION_NOT_CONNECTED',
    message: '연동이 설정되지 않았습니다.',
    statusCode: 400,
  },

  // Server Errors (9xxx)
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: '서버 오류가 발생했습니다.',
    statusCode: 500,
  },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
