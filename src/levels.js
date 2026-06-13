export const LEVELS = ['state', 'county', 'local']

export const COLORS = {
  state:  '#F5C518',  // brand yellow
  county: '#B87333',  // copper/rust
  local:  '#7A9E7E',  // sage green
}

export const LEVEL_PRIORITY = { state: 3, county: 2, local: 1 }

export const CANDIDATE_LAYERS = LEVELS.flatMap(
  level => [`candidates-${level}-glow`, `candidates-${level}-dot`],
)
