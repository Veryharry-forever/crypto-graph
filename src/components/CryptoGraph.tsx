import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Paper, Typography, List, ListItem, ListItemButton, ListItemText, Alert, useTheme, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import axios from 'axios';

interface CryptoData {
  prices: [number, number][];
}

interface CoinInfo {
  id: string;
  symbol: string;
  name: string;
}

function getSuggestions(input: string, coins: CoinInfo[], max = 5) {
  if (!input) return [];
  const lowerInput = input.toLowerCase();
  // Simple substring match, prioritize name/id/symbol
  const matches = coins.filter(
    (coin) =>
      coin.id.toLowerCase().includes(lowerInput) ||
      coin.symbol.toLowerCase().includes(lowerInput) ||
      coin.name.toLowerCase().includes(lowerInput)
  );
  // Sort by shortest Levenshtein distance (optional, simple version)
  matches.sort((a, b) =>
    Math.min(
      a.id.length,
      a.symbol.length,
      a.name.length
    ) -
    Math.min(
      b.id.length,
      b.symbol.length,
      b.name.length
    )
  );
  return matches.slice(0, max);
}

const CryptoGraph: React.FC = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [cryptoName, setCryptoName] = useState('');
  const [graphData, setGraphData] = useState<CryptoData | null>(null);
  const [allCoins, setAllCoins] = useState<CoinInfo[]>([]);
  const [suggestions, setSuggestions] = useState<CoinInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gridLineCount, setGridLineCount] = useState<number>(6);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch all coins on mount
  useEffect(() => {
    axios.get<CoinInfo[]>('https://api.coingecko.com/api/v3/coins/list')
      .then(res => setAllCoins(res.data))
      .catch(() => setAllCoins([]));
  }, []);

  const fetchCryptoData = async () => {
    if (!startDate || !endDate || !cryptoName) return;
    setError(null);
    setSuggestions([]);
    setGraphData(null);
    try {
      const response = await axios.get<CryptoData>(
        `https://api.coingecko.com/api/v3/coins/${cryptoName.toLowerCase()}/market_chart/range`,
        {
          params: {
            vs_currency: 'usd',
            from: Math.floor(startDate.getTime() / 1000),
            to: Math.floor(endDate.getTime() / 1000),
          },
        }
      );
      setGraphData(response.data);
    } catch (error) {
      setError('Token not found or API error. Please check the name or try a suggestion.');
      setSuggestions(getSuggestions(cryptoName, allCoins));
    }
  };

  const downloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cryptoName}-price-chart.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderGraph = () => {
    if (!graphData?.prices.length) return null;
    const prices = graphData.prices;
    
    // Mobile-friendly dimensions (taller and narrower)
    const width = 400;
    const height = 450;
    const padding = { top: 60, right: 80, bottom: 40, left: 40 };
    
    // Downsample the data points to a consistent number regardless of timescale
    const downsampleData = (data: [number, number][], targetPoints = 75): [number, number][] => {
      if (data.length <= targetPoints) return data;
      
      const step = data.length / targetPoints;
      const result: [number, number][] = [];
      
      // Always include first and last points for accuracy
      result.push(data[0]);
      
      for (let i = 1; i < targetPoints - 1; i++) {
        const index = Math.floor(i * step);
        result.push(data[index]);
      }
      
      result.push(data[data.length - 1]);
      return result;
    };
    
    // Downsample the data to a consistent number of points
    const sampledPrices = downsampleData(prices);
    
    const xScale = (width - padding.left - padding.right) / (sampledPrices.length - 1);
    const yMin = Math.min(...sampledPrices.map((p) => p[1]));
    const yMax = Math.max(...sampledPrices.map((p) => p[1]));
    const yScale = (height - padding.top - padding.bottom) / (yMax - yMin);
    
    // Generate points array from downsampled data
    const points = sampledPrices.map((price, i) => ({
      x: padding.left + i * xScale,
      y: height - padding.bottom - (price[1] - yMin) * yScale
    }));

    // Create a smooth curve using cubic Bezier curves
    const createSmoothPath = (points: {x: number, y: number}[]): string => {
      if (points.length < 2) return '';
      
      // Start with the first point
      let path = `M ${points[0].x} ${points[0].y}`;
      
      // Tension controls how "tight" the curve is (0.2 gives a gentle curve)
      const tension = 0.2;
      
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = i > 0 ? points[i - 1] : points[0];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = i < points.length - 2 ? points[i + 2] : p2;
        
        // Calculate control points
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
        
        // Add cubic Bezier curve
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }
      
      return path;
    };

    const smoothPath = createSmoothPath(points);

    // Theme-aware colors
    const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
    const textColor = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    // Format currency for large numbers
    const formatCurrency = (value: number) => {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
      } else if (value >= 10000) {
        return `$${Math.round(value).toLocaleString()}`;
      } else if (value >= 1) {
        return `$${value.toFixed(2)}`;
      } else {
        return `$${value.toFixed(5)}`;
      }
    };
    
    // Generate vertical price markers on the right side
    const priceMarkers = gridLineCount;  // Use the selected value
    const pricePoints = Array.from({ length: priceMarkers }, (_, i) => {
      const value = yMin + (yMax - yMin) * (priceMarkers - 1 - i) / (priceMarkers - 1);
      const y = height - padding.bottom - (value - yMin) * yScale;
      return { value, y };
    });
    
    return (
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ backgroundColor, borderRadius: '8px' }}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Gradient for the line */}
          <linearGradient id="lineGradient" gradientUnits="userSpaceOnUse" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f44336" /> {/* Red */}
            <stop offset="25%" stopColor="#ff9800" /> {/* Orange */}
            <stop offset="50%" stopColor="#cddc39" /> {/* Yellow-green */}
            <stop offset="75%" stopColor="#8bc34a" /> {/* Green */}
            <stop offset="100%" stopColor="#bb86fc" /> {/* Purple */}
          </linearGradient>
        </defs>
        
        {/* Horizontal price grid lines */}
        {pricePoints.map((point, i) => (
          <line 
            key={`grid-h-${i}`}
            x1={padding.left} 
            y1={point.y} 
            x2={width - padding.right} 
            y2={point.y} 
            stroke={gridColor} 
            strokeWidth="1"
          />
        ))}
        
        {/* Smooth price line with gradient */}
        <path
          d={smoothPath}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Final point indicator */}
        {points.length > 0 && (
          <>
            {/* Circle at final point */}
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="6"
              fill="white"
              stroke="#bb86fc"
              strokeWidth="2"
              filter="drop-shadow(0 0 3px rgba(187, 134, 252, 0.8))"
            />
            
            {/* Value label for final point */}
            <text
              x={points[points.length - 1].x}
              y={points[points.length - 1].y - 15}
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="white"
              stroke={backgroundColor}
              strokeWidth="4"
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {formatCurrency(sampledPrices[sampledPrices.length - 1][1])}
            </text>
          </>
        )}
        
        {/* Price markers on the right side */}
        {pricePoints.map((point, i) => (
          <text 
            key={`price-${i}`}
            x={width - padding.right + 10} 
            y={point.y + 4} 
            textAnchor="start" 
            fontSize="12" 
            fill={textColor}
          >
            {formatCurrency(point.value)}
          </text>
        ))}
        
        {/* Token name and percentage change - similar to the reference image */}
        {cryptoName && (
          <>
            <text 
              x={width / 2} 
              y={padding.top / 2} 
              textAnchor="middle" 
              fontSize="22" 
              fill={textColor}
              fontWeight="bold"
            >
              {cryptoName.toUpperCase()}
            </text>
            {prices.length > 1 && (
              <text 
                x={width / 2} 
                y={padding.top / 2 + 30} 
                textAnchor="middle" 
                fontSize="20" 
                fill="#bb86fc"
                fontWeight="bold"
              >
                {((prices[prices.length - 1][1] / prices[0][1] - 1) * 100).toFixed(2)}%
              </text>
            )}
          </>
        )}
      </svg>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 500, mx: 'auto', p: 3 }}>
        <Paper 
          elevation={isDarkMode ? 2 : 1} 
          sx={{ 
            p: 3, 
            borderRadius: 2,
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <Typography variant="h4" gutterBottom fontWeight="500" sx={{ mb: 3 }}>
            Crypto Price Chart
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <TextField
              label="Cryptocurrency Name"
              value={cryptoName}
              onChange={(e) => setCryptoName(e.target.value)}
              placeholder="e.g., bitcoin"
              size="small"
              sx={{ minWidth: 200 }}
            />
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              renderInput={(params) => <TextField {...params} size="small" />}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              renderInput={(params) => <TextField {...params} size="small" />}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="grid-line-select-label">Grid Lines</InputLabel>
              <Select
                labelId="grid-line-select-label"
                id="grid-line-select"
                value={gridLineCount}
                label="Grid Lines"
                onChange={(e) => setGridLineCount(Number(e.target.value))}
              >
                {[3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
                  <MenuItem key={count} value={count}>{count} Lines</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="contained"
              onClick={fetchCryptoData}
              disabled={!startDate || !endDate || !cryptoName}
              sx={{ 
                bgcolor: theme.palette.mode === 'dark' ? '#bb86fc' : '#6200ee',
                '&:hover': {
                  bgcolor: theme.palette.mode === 'dark' ? '#a56eff' : '#3700b3',
                }
              }}
            >
              Generate Graph
            </Button>
            {graphData && (
              <Button 
                variant="outlined" 
                onClick={downloadSVG}
                sx={{ 
                  borderColor: theme.palette.mode === 'dark' ? '#bb86fc' : '#6200ee',
                  color: theme.palette.mode === 'dark' ? '#bb86fc' : '#6200ee',
                }}
              >
                Download SVG
              </Button>
            )}
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          
          {suggestions.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1">Did you mean:</Typography>
              <List>
                {suggestions.map((coin) => (
                  <ListItem key={coin.id} disablePadding>
                    <ListItemButton onClick={() => setCryptoName(coin.id)}>
                      <ListItemText primary={`${coin.name} (${coin.symbol})`} secondary={coin.id} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              mb: 2,
              maxWidth: '100%',
              overflow: 'hidden',
              '& svg': {
                maxWidth: '100%',
                height: 'auto',
                maxHeight: '70vh' // Limit height on larger screens
              }
            }}
          >
            {renderGraph()}
          </Box>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default CryptoGraph; 