import { GlobalStyles } from '@mui/material'

// Number boxes lose the little up/down arrows (they ate the space, so only 3 digits showed),
// and boxes inside tables get less side padding, so a full amount like 1,23,456.78 is visible.
export default function GlobalInputStyles() {
  return (
    <GlobalStyles
      styles={{
        'input[type=number]': { MozAppearance: 'textfield' },
        'input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button': {
          WebkitAppearance: 'none',
          margin: 0,
        },
        '.MuiTableCell-root .MuiInputBase-input.MuiInputBase-input': { paddingLeft: 8, paddingRight: 8 },
      }}
    />
  )
}
