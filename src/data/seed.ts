import type { Employee, Position, Shift, ShiftOffer } from '../types'
import { PALETTE } from '../utils/colors'
import { addDays, parseShorthand } from '../utils/time'

/**
 * Transcribed from the "Wait Staff" September–October 2026 spreadsheet.
 * Each week is keyed by its Sunday; entries are "Name time" ("Name BB time" = bar back shift).
 * "A/B" means A covers it with B as backup. An entry with no name is an open shift.
 */
const WEEKS: Record<string, string[][]> = {
  '2026-09-06': [
    [],
    ['Tanielle 10-4', 'Lauri 10-4', 'Maggie 11-2', 'Jon Jon 4-CL', 'Eddie 4-9', 'Gina 4:40-CL', 'Anna 4-9', 'Lexi 5-9'],
    ['Kori 10-4', 'Lauri 10-4', 'Gina 11-2', 'Eddie 4-CL', 'Jon Jon 4-9', 'Brooke 4-CL', 'Maggie 4-9', 'Lexi 4-9'],
    [
      'Kori 10-4',
      'Stacey 10-4',
      'Brooke 11-2',
      'Jon Jon 4-CL',
      'Lexi BB 4-9',
      'Tanielle 4-CL',
      'Gina 4:40-9',
      'Anna 4-9',
    ],
    ['Kori 10-4', 'Stacey 10-4', 'Lauri 11-2', 'Maggie 4-CL', 'Eddie BB 4-9', 'Brooke 4-CL', 'Gentosi 4-9', 'Anna 4-9'],
    [
      'Tanielle 10-4',
      'Stacey 10-4',
      'Amber 11-4',
      'Nelle/Anna 11-4',
      'Kori 4-CL',
      'Mia BB 4-10',
      'Brooke 4-CL',
      'Gina 4:40-10',
      'Ashly 4-9',
    ],
    [
      'Elly 10-4',
      'Amber 10-4',
      'Aricka 11-4',
      'Isaiah 11-3',
      'Mia 4-CL',
      'Eddie BB 4-10',
      'Kyra 4-CL',
      'Tanielle 4-10',
      'Ashly 4-9',
    ],
  ],
  '2026-09-13': [
    [],
    [
      'Tanielle 10-4',
      'Maggie 10-4',
      'Amber 11-2',
      'Jon Jon 4-CL',
      'Eddie 4-9',
      'Gina 4:40-CL',
      'Kyra 4-9',
      'Amber 5-9',
    ],
    [
      'Tanielle 10-4',
      'Amber 10-4',
      'Stacey 11-2',
      'Eddie 4-CL',
      'Jon Jon 4-9',
      'Brooke 4-CL',
      'Maggie 4-9',
      'Lexi 4-9',
    ],
    [
      'Kori 10-4',
      'Stacey 10-4',
      'Brooke 11-2',
      'Jon Jon 4-CL',
      'Lexi BB 4-9',
      'Tanielle 4-CL',
      'Gina 4:40-CL',
      'Anna 4-9',
    ],
    [
      'Tanielle 10-4',
      'Stacey 10-4',
      'Amber 11-2',
      'Lexi 4-CL',
      'Eddie BB 4-9',
      'Brooke 4-CL',
      'Gentosi 4-9',
      'Anna 4-9',
    ],
    [
      'Tanielle 10-4',
      'Maggie 10-4',
      'Stacey 11-2',
      'Nelle/Amber 11-4',
      'Kori 4-CL',
      'Eddie BB 4-9',
      'Amber 4-CL',
      'Gina 4:40-10',
      'Ashly 4-9',
    ],
    [
      'Eddie 10-4',
      'Amber 10-4',
      'Aricka 11-4',
      'Ashly 11-3',
      'Jon Jon 4-CL',
      'Mia BB 4-9',
      'Tanielle 4-CL',
      'Elly 4-9',
      'Isaiah 4-9',
    ],
  ],
  '2026-09-20': [
    [],
    ['Tanielle 10-4', 'Amber 10-4', 'Maggie 11-2', 'Jon Jon 4-CL', 'Eddie 4-9', 'Gina 4-CL', 'Brooke 4-9', 'Lexi 4-9'],
    ['Kori 10-4', 'Amber 10-4', 'Gina 11-2', 'Eddie 4-CL', 'Jon Jon 4-9', 'Brooke 4-CL', 'Maggie 4-9', 'Lexi 4-9'],
    ['Kori 10-4', 'Stacey 10-4', 'Brooke 11-2', 'Jon Jon 4-CL', 'Lexi BB 4-9', 'Tanielle 4-CL', 'Gina 4-9', 'Kori 4-9'],
    ['Kori 10-4', 'Stacey 10-4', 'Lauri 11-2', 'Maggie 4-CL', 'Eddie BB 4-9', 'Lauri 4-CL', 'Gentosi 4-9', 'Anna 4-9'],
    [
      'Tanielle 10-4',
      'Stacey 10-4',
      'Lauri 11-4',
      'Nelle/Gina 11-4',
      'Kori 4-CL',
      'Mia BB 4-10',
      'Brooke 4-CL',
      'Gina 4-10',
      'Amber 4-9',
    ],
    [
      'Elly 10-4',
      'Amber 10-4',
      'Aricka 11-4',
      'Isaiah 11-3',
      'Mia 4-CL',
      'Eddie BB 4-10',
      'Kyra 4-CL',
      'Tanielle 4-10',
      '4-9',
    ],
  ],
  '2026-09-27': [
    [],
    [
      'Tanielle 10-4',
      'Lauri 10-4',
      'Maggie 11-2',
      'Jon Jon 4-CL',
      'Eddie 4-9',
      'Gina 4:40-CL',
      'Kyra 4-9',
      'Amber 5-9',
    ],
    ['Tanielle 10-4', 'Lauri 10-4', 'Gina 11-2', 'Eddie 4-CL', 'Jon Jon 4-9', 'Maggie 4-9', 'Brooke 4-9', 'Lexi 4-9'],
    [
      'Kori 10-4',
      'Stacey 10-4',
      'Brooke 11-2',
      'Jon Jon 4-CL',
      'Lexi BB 4-9',
      'Gina 4:40-CL',
      'Tanielle 4-9',
      'Anna 4-9',
    ],
    [
      'Tanielle 10-4',
      'Stacey 10-4',
      'Lauri 11-2',
      'Lexi 4-CL',
      'Eddie BB 4-9',
      'Maggie 4-CL',
      'Gentosi 4-9',
      'Anna 4-9',
    ],
    [
      'Tanielle 10-4',
      'Maggie 10-4',
      'Stacey 11-2',
      'Nelle/Amber 11-4',
      'Kori 4-CL',
      'Eddie BB 4-9',
      'Lauri 4-CL',
      'Gina 4:40-10',
      'Anna 4-9',
    ],
    [
      'Eddie 10-4',
      'Amber 10-4',
      'Aricka 11-4',
      'Ashly 11-3',
      'Jon Jon 4-CL',
      'Mia BB 4-9',
      'Kyra 4-CL',
      'Elly 4-9',
      'Isaiah 4-9',
    ],
  ],
  '2026-10-04': [
    [],
    ['Tanielle 10-4', 'Lauri 10-4', 'Maggie 11-2', 'Jon Jon 4-CL', 'Eddie 4-9', 'Gina 4:40-CL', 'Anna 4-9', 'Lexi 5-9'],
    ['Kori 10-4', 'Lauri 10-4', 'Gina 11-2', 'Eddie 4-CL', 'Jon Jon 4-9', 'Brooke 4-CL', 'Maggie 4-9', 'Lexi 4-9'],
    [
      'Kori 10-4',
      'Stacey 10-4',
      'Brooke 11-2',
      'Jon Jon 4-CL',
      'Lexi BB 4-9',
      'Tanielle 4-CL',
      'Gina 4:40-9',
      'Anna 4-9',
    ],
    ['Kori 10-4', 'Stacey 10-4', 'Lauri 11-2', 'Maggie 4-CL', 'Eddie BB 4-9', 'Brooke 4-CL', 'Gentosi 4-9', 'Anna 4-9'],
    [
      'Tanielle 10-4',
      'Stacey 10-4',
      'Amber 11-4',
      'Nelle/Amber 11-4',
      'Kori 4-CL',
      'Mia BB 4-10',
      'Brooke 4-CL',
      'Gina 4:40-10',
      'Ashly 4-9',
    ],
    [
      'Elly 10-4',
      'Amber 10-4',
      'Aricka 11-4',
      'Isaiah 11-3',
      'Mia 4-CL',
      'Eddie BB 4-10',
      'Kyra 4-CL',
      'Tanielle 4-10',
      'Ashly 4-9',
    ],
  ],
}

const NAMES = [
  'Tanielle',
  'Lauri',
  'Maggie',
  'Kori',
  'Gina',
  'Stacey',
  'Brooke',
  'Amber',
  'Nelle',
  'Elly',
  'Aricka',
  'Isaiah',
  'Jon Jon',
  'Eddie',
  'Anna',
  'Lexi',
  'Mia',
  'Kyra',
  'Gentosi',
  'Ashly',
]

const BAR_BACKS = new Set(['Lexi', 'Eddie', 'Mia'])

const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '')

export const SEED_EMPLOYEES: Employee[] = NAMES.map((name, i) => ({
  id: `emp-${slug(name)}`,
  name,
  positions: BAR_BACKS.has(name) ? ['Server', 'Bar Back'] : ['Server'],
  email: `${slug(name)}@example.com`,
  phone: null,
  userId: null,
  color: PALETTE[i % PALETTE.length],
  active: true,
  role: 'employee',
}))

const byName = new Map(SEED_EMPLOYEES.map((e) => [e.name.toLowerCase(), e]))

function parseEntry(
  entry: string,
): { employeeId: string | null; position: Position; startMin: number; endMin: number; notes: string | null } | null {
  const tokens = entry.trim().split(/\s+/)
  const time = tokens.pop()
  if (!time) return null
  const range = parseShorthand(time)
  if (!range) return null
  const notes: string[] = []
  let position: Position = 'Server'
  if (tokens[tokens.length - 1] === 'BB') {
    tokens.pop()
    position = 'Bar Back'
  }
  let nameText = tokens.join(' ')
  if (nameText.includes('/')) {
    const [primary, backup] = nameText.split('/')
    nameText = primary
    notes.push(`Backup: ${backup}`)
  }
  const employee = nameText ? byName.get(nameText.toLowerCase()) : undefined
  return { employeeId: employee?.id ?? null, position, ...range, notes: notes.length ? notes.join(' · ') : null }
}

export const SEED_SHIFTS: Shift[] = Object.entries(WEEKS).flatMap(([sunday, days]) =>
  days.flatMap((entries, dow) => {
    const date = addDays(sunday, dow)
    return entries.flatMap((entry, i) => {
      const parsed = parseEntry(entry)
      if (!parsed) return []
      const shift: Shift = {
        id: `shift-${date}-${i}`,
        employeeId: parsed.employeeId,
        position: parsed.position,
        date,
        startMin: parsed.startMin,
        endMin: parsed.endMin,
        notes: parsed.notes,
        status: parsed.employeeId ? 'scheduled' : 'open',
        color: null,
      }
      return [shift]
    })
  }),
)

export const SEED_OFFERS: ShiftOffer[] = [
  {
    id: 'offer-1',
    shiftId: 'shift-2026-09-18-5',
    offeredBy: 'emp-eddie',
    targetEmployeeId: null,
    claimedBy: null,
    status: 'open',
    message: 'Family thing Friday night — can anyone take my 4–9?',
    createdAt: '2026-09-14T15:00:00.000Z',
    resolvedAt: null,
  },
  {
    id: 'offer-2',
    shiftId: 'shift-2026-09-19-7',
    offeredBy: 'emp-elly',
    targetEmployeeId: 'emp-ashly',
    claimedBy: null,
    status: 'open',
    message: 'Ashly, still up for swapping Saturday?',
    createdAt: '2026-09-14T18:30:00.000Z',
    resolvedAt: null,
  },
]
