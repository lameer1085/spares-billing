import { useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import RangePicker from '../../components/RangePicker'
import { presets } from '../../utils/dates'
import { GstTab, ProfitTab, SalesTab, StockTab, TopTab } from './ReportTabs'

export default function ReportsPage() {
  const thisMonth = presets()[1]
  const [from, setFrom] = useState(thisMonth.from)
  const [to, setTo] = useState(thisMonth.to)
  const [tab, setTab] = useState(0)

  return (
    <>
      <Typography variant="h5" sx={{ mb: 2 }}>Reports</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
        <Tab label="Sales" />
        <Tab label="GST" />
        <Tab label="Profit" />
        <Tab label="Stock" />
        <Tab label="Top parts" />
      </Tabs>

      {tab !== 3 && (
        <Box sx={{ mb: 3 }}>
          <RangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        </Box>
      )}

      {tab === 0 && <SalesTab from={from} to={to} />}
      {tab === 1 && <GstTab from={from} to={to} />}
      {tab === 2 && <ProfitTab from={from} to={to} />}
      {tab === 3 && <StockTab />}
      {tab === 4 && <TopTab from={from} to={to} />}
    </>
  )
}