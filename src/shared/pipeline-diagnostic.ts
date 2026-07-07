export type DiagStatus = 'pass' | 'warn' | 'fail' | 'skip';

export type DiagStep = {
  id: string;
  layer: 'inject' | 'content' | 'background' | 'lifecycle';
  status: DiagStatus;
  message: string;
  detail?: Record<string, unknown>;
};

export type PipelineDiagnosticReport = {
  ranAt: number;
  pageUrl: string;
  durationMs: number;
  steps: DiagStep[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
};

export function maskSessionId(value?: string): string {
  if (!value) return '(none)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function summarizeSteps(steps: DiagStep[]): PipelineDiagnosticReport['summary'] {
  return {
    pass: steps.filter((s) => s.status === 'pass').length,
    warn: steps.filter((s) => s.status === 'warn').length,
    fail: steps.filter((s) => s.status === 'fail').length,
  };
}

export function formatPipelineReport(report: PipelineDiagnosticReport): string {
  const lines: string[] = [
    '=== TV Quant Pipeline Diagnostic ===',
    `time: ${new Date(report.ranAt).toISOString()}`,
    `url: ${report.pageUrl}`,
    `duration: ${report.durationMs}ms`,
    `result: pass=${report.summary.pass} warn=${report.summary.warn} fail=${report.summary.fail}`,
    '',
  ];

  for (const step of report.steps) {
    const tag = step.status.toUpperCase().padEnd(4);
    lines.push(`[${tag}] (${step.layer}) ${step.id}: ${step.message}`);
    if (step.detail && Object.keys(step.detail).length > 0) {
      lines.push(`       ${JSON.stringify(step.detail)}`);
    }
  }

  lines.push('');
  lines.push('Re-run: __TV_QUANT_RUN_DIAG__()');
  lines.push('Watch:  __TV_QUANT_WATCH__(30)');
  return lines.join('\n');
}

export const DIAG_PING_TYPE = 'TV_QUANTS_DIAG_PING';
export const DIAG_PONG_TYPE = 'TV_QUANTS_DIAG_PONG';
