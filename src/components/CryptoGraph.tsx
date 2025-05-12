import React, { useState, useRef, useEffect } from 'react';
import { Box, Button, Paper, Typography, List, ListItem, ListItemButton, ListItemText, Alert } from '@mui/material';
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
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [cryptoName, setCryptoName] = useState('');
  const [graphData, setGraphData] = useState<CryptoData | null>(null);
  const [allCoins, setAllCoins] = useState<CoinInfo[]>([]);
  const [suggestions, setSuggestions] = useState<CoinInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
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
    const width = 800;
    const height = 400;
    const padding = 60;
    const xScale = (width - 2 * padding) / (prices.length - 1);
    const yMin = Math.min(...prices.map((p) => p[1]));
    const yMax = Math.max(...prices.map((p) => p[1]));
    const yScale = (height - 2 * padding) / (yMax - yMin);
    const points = prices
      .map((price, i) => {
        const x = padding + i * xScale;
        const y = height - padding - (price[1] - yMin) * yScale;
        return `${x},${y}`;
      })
      .join(' ');
    // Y-axis ticks (5 ticks)
    const yTicks = 5;
    const yTickVals = Array.from({ length: yTicks }, (_, i) => yMin + ((yMax - yMin) * i) / (yTicks - 1));
    // X-axis ticks (5 ticks)
    const xTicks = 5;
    const xTickIdxs = Array.from({ length: xTicks }, (_, i) => Math.round(i * (prices.length - 1) / (xTicks - 1)));
    return (
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ backgroundColor: 'white' }}
      >
        {/* Y-axis */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#888" strokeWidth="2" />
        {/* X-axis */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#888" strokeWidth="2" />
        {/* Y-axis ticks and labels */}
        {yTickVals.map((val, i) => {
          const y = height - padding - (val - yMin) * yScale;
          return (
            <g key={i}>
              <line x1={padding - 5} y1={y} x2={padding} y2={y} stroke="#888" />
              <text x={padding - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#444">
                {val.toFixed(2)}
              </text>
            </g>
          );
        })}
        {/* X-axis ticks and labels */}
        {xTickIdxs.map((idx, i) => {
          const x = padding + idx * xScale;
          const date = new Date(prices[idx][0]);
          return (
            <g key={i}>
              <line x1={x} y1={height - padding} x2={x} y2={height - padding + 5} stroke="#888" />
              <text x={x} y={height - padding + 20} textAnchor="middle" fontSize="12" fill="#444">
                {date.toLocaleDateString()}
              </text>
            </g>
          );
        })}
        {/* Price line */}
        <polyline
          points={points}
          fill="none"
          stroke="#2196f3"
          strokeWidth="2"
        />
        {/* Chart title */}
        <text x={width / 2} y={padding / 2} textAnchor="middle" fontSize="18" fill="#222">
          {cryptoName.toUpperCase()} Price Chart
        </text>
      </svg>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Crypto Price Chart Generator
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              label="Cryptocurrency Name"
              value={cryptoName}
              onChange={(e) => setCryptoName(e.target.value)}
              placeholder="e.g., bitcoin"
            />
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              renderInput={(params) => <TextField {...params} />}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              renderInput={(params) => <TextField {...params} />}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="contained"
              onClick={fetchCryptoData}
              disabled={!startDate || !endDate || !cryptoName}
            >
              Generate Graph
            </Button>
            {graphData && (
              <Button variant="outlined" onClick={downloadSVG}>
                Download SVG
              </Button>
            )}
          </Box>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {suggestions.length > 0 && (
            <Box sx={{ mb: 2 }}>
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
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            {renderGraph()}
          </Box>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default CryptoGraph; 