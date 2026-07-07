import { describe, expect, it } from 'vitest';
import {
  formatPipelineReport,
  maskSessionId,
  summarizeSteps,
  type PipelineDiagnosticReport,
} from './pipeline-diagnostic';

describe('pipeline-diagnostic', () => {
  it('masks session id', () => {
    expect(maskSessionId()).toBe('(none)');
    expect(maskSessionId('abcd1234efgh')).toBe('abcd...efgh');
  });

  it('summarizes steps', () => {
    const summary = summarizeSteps([
      { id: 'a', layer: 'inject', status: 'pass', message: 'ok' },
      { id: 'b', layer: 'content', status: 'fail', message: 'bad' },
    ]);
    expect(summary).toEqual({ pass: 1, warn: 0, fail: 1 });
  });

  it('formats report text', () => {
    const report: PipelineDiagnosticReport = {
      ranAt: Date.now(),
      pageUrl: 'https://cn.tradingview.com/chart/',
      durationMs: 100,
      steps: [{ id: 'inject_ping', layer: 'inject', status: 'pass', message: 'alive' }],
      summary: { pass: 1, warn: 0, fail: 0 },
    };
    const text = formatPipelineReport(report);
    expect(text).toContain('TV Quant Pipeline Diagnostic');
    expect(text).toContain('__TV_QUANT_RUN_DIAG__()');
  });
});
