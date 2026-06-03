import React from 'react';

// ----------------------------------------------------
// 1. VERTICAL BAR CHART (Biểu đồ Cột dọc)
// ----------------------------------------------------
interface BarChartProps {
  data: { label: string; value: number }[];
  yAxisSuffix?: string;
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({ data, yAxisSuffix = '', height = 200 }) => {
  const chartHeight = height - 40;
  const chartWidth = 500;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  // Round maxVal to a nice number
  const roundMax = Math.ceil(maxVal / 10) * 10 || 10;

  const barWidth = Math.max(10, Math.min(40, (graphWidth / data.length) * 0.5));
  const stepX = graphWidth / data.length;

  return (
    <div style={{ width: '100%', overflowX: 'auto', backgroundColor: '#ffffff', padding: '10px 0' }}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
        {/* Gradients */}
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>
        </defs>

        {/* Gridlines & Y-Axis Labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = paddingTop + graphHeight * (1 - ratio);
          const val = roundMax * ratio;
          return (
            <g key={idx}>
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={chartWidth - paddingRight} 
                y2={y} 
                stroke="#e2e8f0" 
                strokeWidth="1" 
                strokeDasharray="4 4"
              />
              <text 
                x={paddingLeft - 10} 
                y={y + 4} 
                textAnchor="end" 
                fontSize="11" 
                fill="#64748b"
                fontWeight="500"
              >
                {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val.toLocaleString()}{yAxisSuffix}
              </text>
            </g>
          );
        })}

        {/* X-Axis Line */}
        <line 
          x1={paddingLeft} 
          y1={paddingTop + graphHeight} 
          x2={chartWidth - paddingRight} 
          y2={paddingTop + graphHeight} 
          stroke="#cbd5e1" 
          strokeWidth="1.5"
        />

        {/* Bars */}
        {data.map((item, idx) => {
          const barHeight = (item.value / roundMax) * graphHeight;
          const x = paddingLeft + (idx * stepX) + (stepX - barWidth) / 2;
          const y = paddingTop + graphHeight - barHeight;

          return (
            <g key={idx} className="chart-bar-group">
              {/* Actual bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, barHeight)}
                fill="url(#barGrad)"
                rx="3"
                style={{ transition: 'all 0.3s ease' }}
              />
              {/* Value Label on top of bar */}
              {item.value > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="#1e3a8a"
                >
                  {item.value >= 1000000 ? `${(item.value / 1000000).toFixed(1)}M` : item.value.toLocaleString()}
                </text>
              )}
              {/* X Axis label */}
              <text
                x={x + barWidth / 2}
                y={paddingTop + graphHeight + 16}
                textAnchor="middle"
                fontSize="10"
                fill="#475569"
                fontWeight="500"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};


// ----------------------------------------------------
// 2. DONUT CHART (Biểu đồ Hình tròn rỗng)
// ----------------------------------------------------
interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
}

export const DonutChart: React.FC<DonutChartProps> = ({ data }) => {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const size = 180;
  const radius = 60;
  const strokeWidth = 24;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedAngle = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', backgroundColor: '#ffffff', padding: '16px', borderRadius: '6px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        {total === 0 ? (
          // Empty state placeholder donut
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
        ) : (
          data.map((item, idx) => {
            if (item.value === 0) return null;
            const percentage = item.value / total;
            const strokeDasharray = `${percentage * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedAngle;
            accumulatedAngle += percentage * circumference;

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
              />
            );
          })
        )}
      </svg>

      {/* Legend list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '150px' }}>
        {data.map((item, idx) => {
          const percent = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: item.color }} />
              <span style={{ fontWeight: 500, color: 'var(--color-text-main)' }}>{item.label}:</span>
              <strong style={{ marginLeft: 'auto' }}>{item.value} ({percent}%)</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
};


// ----------------------------------------------------
// 3. HORIZONTAL BAR CHART (Biểu đồ Cột ngang)
// ----------------------------------------------------
interface HorizontalBarChartProps {
  data: { label: string; value: number }[];
  valueSuffix?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({ data, valueSuffix = '' }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', padding: '10px 0' }}>
      {data.map((item, idx) => {
        const percentWidth = (item.value / maxVal) * 100;
        return (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
            <span 
              style={{ 
                fontWeight: 600, 
                color: 'var(--color-text-main)', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}
              title={item.label}
            >
              {item.label}
            </span>
            <div style={{ width: '100%', height: '18px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${percentWidth}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #93c5fd, #1d4ed8)', 
                  borderRadius: '4px',
                  transition: 'width 0.6s ease' 
                }} 
              />
            </div>
            <span style={{ fontWeight: 700, color: 'var(--color-primary)', textAlign: 'right' }}>
              {item.value.toLocaleString()}{valueSuffix}
            </span>
          </div>
        );
      })}
    </div>
  );
};
