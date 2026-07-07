import { useEffect, useRef } from 'react';
import { ColorType, createChart, IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';
import { calculateExponentialFit } from '../../shared/math';
import type { Bar } from '../../shared/types';
import { barsToChartData } from '../../shared/metrics';

interface ChartPanelProps {
  bars: Bar[];
  showExpFit: boolean;
}

export function ChartPanel({ bars, showExpFit }: ChartPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || bars.length === 0) return;

    const data = barsToChartData(bars);
    const fitData = data.map((d, i) => ({ x: i, y: d.value }));
    const fit = calculateExponentialFit(fitData);
    const expLineData = fit
      ? data.map((d, i) => ({
          time: d.time,
          value: fit.a * Math.exp(fit.k * i),
        }))
      : [];

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
    });

    chartRef.current = chart;

    const mainSeries = chart.addSeries(LineSeries, {
      color: '#2962FF',
      lineWidth: 2,
    });
    mainSeries.setData(data as { time: string; value: number }[]);
    seriesRef.current = mainSeries;

    if (showExpFit && expLineData.length > 0) {
      const expSeries = chart.addSeries(LineSeries, {
        color: '#F6A800',
        lineWidth: 2,
        lineStyle: 2,
      });
      expSeries.setData(expLineData as { time: string; value: number }[]);
    }

    chart.timeScale().fitContent();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [bars, showExpFit]);

  if (bars.length === 0) {
    return (
      <div className="h-[180px] bg-[#131722] border border-[#2a2e39] rounded-xl flex items-center justify-center text-xs text-gray-500">
        --
      </div>
    );
  }

  return <div className="h-[180px] w-full relative" ref={chartContainerRef} />;
}
